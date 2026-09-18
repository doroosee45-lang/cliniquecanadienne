// POST5-016 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE/
// FAIBLE. urgencesController.js::create/update et
// pediatrieController.js::create/update acceptaient patient_nom/nom/prenom
// bruts du client même quand `patient`/`patient_id` référence un Patient
// réellement vérifié — un client pouvait envoyer un ID réel accompagné
// d'un nom arbitraire, créant une incohérence nom/ID jamais détectée. Ce
// test prouve que ces champs sont désormais dérivés du Patient vérifié
// (création ET tentative de réécriture via update), jamais acceptés tels
// quels — tout en préservant le cas légitime d'un intake Urgences non
// identifié (patient absent).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
  return { status, body };
};

test('POST5-016 — patient_nom/nom/prenom dérivés du Patient vérifié, jamais acceptés bruts du client (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Urgence = require('../models/Urgence');
  const Child = require('../models/Child');
  const urgC = require('../controllers/urgencesController');
  const pedC = require('../controllers/pediatrieController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Medecin' };
  const cleanup = [];

  try {
    const patientReel = await Patient.create({ nom: `VraiNom${stamp}`, prenom: 'VraiPrenom', sexe: 'M', date_naissance: '1990-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patientReel._id));

    // AUDIT-18-4 (18 sept. 2026) — ces deux sous-tests imbriquaient
    // auparavant "update()" à l'intérieur du callback de "create()"
    // (t.test dans t.test). Sous --test-concurrency=1 (utilisé par npm
    // test, cf. utils/run-tests-local-db.js), ce nid provoque un vrai
    // interblocage du planificateur de node:test — le sous-test enfant
    // n'obtient jamais le seul "slot" disponible pendant que le parent
    // l'attend indéfiniment ('test did not finish before its parent and
    // was cancelled' après le timeout). Confirmé indépendant de tout bug
    // applicatif : urgC.create() appelé directement hors node:test répond
    // en <1s. Aplati en deux sous-tests frères, l'état (urgenceCreeeId)
    // étant partagé via une variable de portée englobante comme le reste
    // du fichier le fait déjà pour patientReel.
    let urgenceCreeeId;
    await t.test('urgences — create() : patient_nom fabriqué par le client est ignoré, dérivé du Patient réel', async () => {
      const r = await call(urgC.create, {
        user, ip: '127.0.0.1',
        body: { patient: String(patientReel._id), patient_nom: 'NOM COMPLETEMENT FABRIQUE', niveau_triage: 'orange', motif: 'Test' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      urgenceCreeeId = r.body.urgence._id;
      cleanup.push(() => Urgence.findByIdAndDelete(urgenceCreeeId));
      const relu = await Urgence.findById(urgenceCreeeId).lean();
      assert.equal(relu.patient_nom, 'VraiPrenom VraiNom' + stamp, 'patient_nom doit être dérivé du Patient réel, jamais accepté du client');
      assert.notEqual(relu.patient_nom, 'NOM COMPLETEMENT FABRIQUE');
    });

    await t.test('urgences — update() : tentative de réécriture de patient_nom rejetée silencieusement (patient lié réel)', async () => {
      const rUp = await call(urgC.update, {
        params: { id: urgenceCreeeId.toString() }, user, ip: '127.0.0.1',
        body: { patient_nom: 'AUTRE NOM FABRIQUE APRES COUP' },
      });
      assert.equal(rUp.status, 200, JSON.stringify(rUp.body));
      const reluApres = await Urgence.findById(urgenceCreeeId).lean();
      assert.equal(reluApres.patient_nom, 'VraiPrenom VraiNom' + stamp, 'patient_nom ne doit jamais être réécrit par le client une fois un Patient réel lié');
    });

    await t.test('urgences — non-régression : intake ER non identifié (patient absent) garde le nom saisi manuellement, à la création ET après correction', async () => {
      const r = await call(urgC.create, {
        user, ip: '127.0.0.1',
        body: { patient_nom: 'Inconnu Non Identifie', niveau_triage: 'orange', motif: 'Test intake anonyme' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Urgence.findByIdAndDelete(r.body.urgence._id));
      assert.equal(r.body.urgence.patient_nom, 'Inconnu Non Identifie', 'sans patient lié, le nom saisi à l\'accueil doit être conservé tel quel');

      const rUp = await call(urgC.update, {
        params: { id: r.body.urgence._id }, user, ip: '127.0.0.1',
        body: { patient_nom: 'Nom Corrige Manuellement' },
      });
      assert.equal(rUp.status, 200, JSON.stringify(rUp.body));
      const relu = await Urgence.findById(r.body.urgence._id).lean();
      assert.equal(relu.patient_nom, 'Nom Corrige Manuellement', 'sans patient lié, une correction manuelle ultérieure du nom doit rester possible (cas légitime)');
    });

    // AUDIT-18-4 — même aplatissement que ci-dessus pour la même raison
    // (interblocage node:test sous --test-concurrency=1 avec t.test imbriqué).
    let enfantCreeId;
    await t.test('pédiatrie — create() : nom/prenom fabriqués par le client sont ignorés, dérivés du Patient réel', async () => {
      const r = await call(pedC.create, {
        user, ip: '127.0.0.1',
        body: { patient_id: String(patientReel._id), nom: 'FAUX-NOM', prenom: 'FAUX-PRENOM', date_naissance: '2020-01-01', sexe: 'M', parent_nom: 'Un Parent', parent_tel: '+242060000000' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      enfantCreeId = r.body.enfant._id;
      cleanup.push(() => Child.findByIdAndDelete(enfantCreeId));
      assert.equal(r.body.enfant.nom, `VraiNom${stamp}`, 'nom doit être dérivé du Patient réel, jamais accepté du client');
      assert.equal(r.body.enfant.prenom, 'VraiPrenom');
      // parent_nom n'a aucune référence Patient/ID vérifiable dans ce schéma
      // — reste légitimement une saisie manuelle, hors périmètre du garde-fou.
      assert.equal(r.body.enfant.parent_nom, 'Un Parent');
    });

    await t.test('pédiatrie — update() : tentative de réécriture de nom/prenom rejetée (champs bloqués)', async () => {
      const rUp = await call(pedC.update, {
        params: { id: enfantCreeId }, user, ip: '127.0.0.1',
        body: { nom: 'AUTRE-FAUX-NOM', prenom: 'AUTRE-FAUX-PRENOM' },
      });
      assert.equal(rUp.status, 200, JSON.stringify(rUp.body));
      const relu = await Child.findById(enfantCreeId).lean();
      assert.equal(relu.nom, `VraiNom${stamp}`, 'nom ne doit jamais être réécrit via update() — dérivé une fois pour toutes du Patient vérifié');
      assert.equal(relu.prenom, 'VraiPrenom');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
