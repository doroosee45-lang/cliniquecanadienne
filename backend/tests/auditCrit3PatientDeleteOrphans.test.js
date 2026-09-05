// Audit critique 3/4 — patients.controller.js::remove() ne vérifiait que 12
// modèles avant d'autoriser une suppression physique ; 6 modèles référençant
// réellement Patient étaient absents (AIPrediction, Child, Document,
// Echographie via patient, Newborn, Room.lits.patient_actuel). Un patient
// dont la seule trace clinique était l'un de ceux-ci pouvait être supprimé
// physiquement, laissant une référence orpheline — le pire cas étant un lit
// qui resterait indéfiniment marqué occupé par un patient qui n'existe plus.
//
// Room est traité différemment des 5 autres : ce n'est pas un "historique"
// mais un état live (occupation actuelle d'un lit) — refusé explicitement
// (409), sans même désactiver le dossier, plutôt que la simple désactivation
// appliquée aux 5 autres cas.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Audit critique 3 — références fantômes à la suppression patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AIPrediction = require('../models/AIPrediction');
  const Child = require('../models/Child');
  const Document = require('../models/Document');
  const Echographie = require('../models/Echographie');
  const Newborn = require('../models/Newborn');
  const Room = require('../models/Room');
  const patientsC = require('../controllers/patients.controller');
  const { anonymizePatient } = require('../utils/patientAnonymization');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Crit3', nom: 'Test' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const mkPatient = async (suffix) => {
    const p = await Patient.create({ nom: `T-CRIT3-${suffix}-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    cleanup.push(() => Patient.findByIdAndDelete(p._id));
    return p;
  };

  try {
    const cases = [
      { label: 'AIPrediction', create: async (p) => AIPrediction.create({ type: 'diagnostic', patient: p._id }), model: AIPrediction },
      { label: 'Child',        create: async (p) => Child.create({ patient_id: p._id, nom: 'EnfantTest', prenom: 'X', date_naissance: '2020-01-01', sexe: 'M' }), model: Child },
      { label: 'Document',     create: async (p) => Document.create({ nom: 'doc-test.pdf', patient: p._id }), model: Document },
      { label: 'Echographie',  create: async (p) => Echographie.create({ patient: p._id, patient_nom: 'Nom Affichage' }), model: Echographie },
      { label: 'Newborn',      create: async (p) => Newborn.create({ patient_id: p._id, mere_nom: 'Mere Test', prenom: 'Bebe' }), model: Newborn },
    ];

    for (const c of cases) {
      await t.test(`remove() refuse la suppression physique — patient dont la seule trace est ${c.label}, désactive à la place`, async () => {
        const p = await mkPatient(c.label);
        const doc = await c.create(p);
        cleanup.push(() => c.model.findByIdAndDelete(doc._id));

        const { status, body } = await call(patientsC.remove, { params: { id: p._id }, user: superadmin, ip: '127.0.0.1' });
        assert.equal(status, 200);
        assert.equal(body.deactivated, true, `${c.label} doit déclencher une désactivation, pas une suppression`);

        const fresh = await Patient.findById(p._id).lean();
        assert.ok(fresh, `le patient doit toujours exister en base (pas supprimé) — ${c.label}`);
        assert.equal(fresh.actif, false);
        assert.equal(fresh.statut, 'inactif');
      });
    }

    await t.test('remove() refuse toute action (ni suppression ni désactivation) si le patient occupe actuellement un lit', async () => {
      const p = await mkPatient('Room');
      const room = await Room.create({
        numero: `T-CRIT3-ROOM-${stamp}`,
        lits: [{ numero: '1', statut: 'occupe', patient_actuel: p._id }],
      });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      const { status, body } = await call(patientsC.remove, { params: { id: p._id }, user: superadmin, ip: '127.0.0.1' });
      assert.equal(status, 409);
      assert.match(body.message, /occupe actuellement un lit/);

      const fresh = await Patient.findById(p._id).lean();
      assert.ok(fresh, 'le patient doit toujours exister');
      assert.equal(fresh.statut, 'actif', 'ne doit PAS être désactivé — refus complet, pas une simple désactivation');
    });

    await t.test('anonymizePatient() scrube désormais Child.nom/prenom/parent_nom/parent_tel (conserve date_naissance/sexe), Echographie.patient_nom, Newborn.mere_nom — laisse les références ObjectId intactes', async () => {
      const p = await mkPatient('Anonym');
      const child = await Child.create({ patient_id: p._id, nom: 'ScrubMoi', prenom: 'Y', date_naissance: '2019-06-01', sexe: 'F' });
      cleanup.push(() => Child.findByIdAndDelete(child._id));
      const echo = await Echographie.create({ patient: p._id, patient_nom: 'ScrubMoiAussi' });
      cleanup.push(() => Echographie.findByIdAndDelete(echo._id));
      const newborn = await Newborn.create({ patient_id: p._id, mere_nom: 'ScrubLaMere', prenom: 'Bebe2' });
      cleanup.push(() => Newborn.findByIdAndDelete(newborn._id));
      const aiPred = await AIPrediction.create({ type: 'diagnostic', patient: p._id, commentaire: 'reste intact' });
      cleanup.push(() => AIPrediction.findByIdAndDelete(aiPred._id));

      await anonymizePatient(p._id, { utilisateur: superadmin._id, ip: '127.0.0.1' });

      const freshChild = await Child.findById(child._id).lean();
      // AUDIT-C2 (ticket 0017) — Child.nom est `required: true` : remplacé
      // par le libellé neutre, pas retiré, sinon le prochain .save() réel
      // sur ce document échouerait en ValidationError (même défaut que
      // DossierChirurgical.patient_nom/Urgence.patient_nom, corrigé ici pour
      // les 3 modèles en même temps — voir CASCADE_TARGETS.requiredFields).
      assert.equal(freshChild.nom, 'Patient anonymisé', 'Child.nom doit être scrubé (remplacé par le libellé neutre, champ required)');
      assert.equal(freshChild.prenom, undefined, 'Child.prenom doit être scrubé');
      assert.equal(freshChild.parent_nom, undefined);
      assert.equal(freshChild.parent_tel, undefined);
      assert.equal(new Date(freshChild.date_naissance).getFullYear(), 2019, 'date_naissance doit être conservée (donnée clinique, pas une copie d\'affichage)');
      assert.equal(freshChild.sexe, 'F', 'sexe doit être conservé');
      assert.equal(freshChild.patient_id.toString(), p._id.toString(), 'la référence ObjectId ne doit jamais être retirée');

      const freshEcho = await Echographie.findById(echo._id).lean();
      assert.equal(freshEcho.patient_nom, undefined, 'Echographie.patient_nom (nom affiché) doit être scrubé');
      assert.equal(freshEcho.patient.toString(), p._id.toString(), 'patient (référence réelle) ne doit jamais être retiré');

      const freshNewborn = await Newborn.findById(newborn._id).lean();
      assert.equal(freshNewborn.mere_nom, undefined, 'mere_nom doit être scrubé');
      assert.equal(freshNewborn.patient_id.toString(), p._id.toString());

      const freshAiPred = await AIPrediction.findById(aiPred._id).lean();
      assert.equal(freshAiPred.commentaire, 'reste intact', 'AIPrediction n\'a aucun champ d\'identité — rien ne doit être touché');
      assert.equal(freshAiPred.patient.toString(), p._id.toString());
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
