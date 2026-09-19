// AUDIT-20-7 (19 sept. 2026, audit indépendant) —
// urgencesController.js::addSoin/addPrescription/addExamen faisaient tous
// trois findById() puis push()/unshift() en mémoire sur DEUX tableaux (la
// sous-ressource + timeline) + u.save() du document Urgence PARENT entier.
// Même cause racine qu'AUDIT-20-6 (hospitalization.controller.js::
// makeSubResource) : le versioning optimiste natif de Mongoose (__v) fait
// échouer l'un des .save() concurrents avec une VersionError explicite dès
// que deux écritures visent le même document — reproduit directement
// (contre un mongod local à faible latence, où la fenêtre de course est la
// plus large) : addSoin/addPrescription/addExamen lancés en parallèle sur
// le même dossier → addSoin a échoué en 500 VersionError, les deux autres
// ont réussi. Contexte plus sensible qu'en hospitalisation : un dossier
// d'urgence est par nature multi-acteurs sur une fenêtre courte (infirmier
// + médecin simultanément sur le même patient).
//
// Corrigé : $push atomique sur les deux tableaux dans la même opération
// Mongo (addSoin : $each + $position:0 pour préserver le unshift — le plus
// récent en tête) ; updateExamen : $set positionnel via arrayFilters, même
// pattern qu'AUDIT-20-6.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message, name: err.name }; } });
  return { status, body };
};

test('AUDIT-20-7 — sous-ressources du dossier urgences atomiques sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Urgence = require('../models/Urgence');
  const urgC = require('../controllers/urgencesController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Concurrence' };
  const created = [];

  try {
    await t.test('addSoin + addPrescription + addExamen en parallèle sur le même dossier → les 3 réussissent (201), les 3 entrées timeline présentes', async () => {
      const u = await Urgence.create({ patient_nom: `Audit20-7-${stamp}`, niveau_triage: 'orange', motif: 'Test concurrence multi-ressources' });
      created.push(u._id);

      const [rSoin, rPresc, rExam] = await Promise.all([
        call(urgC.addSoin, { params: { id: u._id.toString() }, user, ip: '127.0.0.1', body: { acte: 'Pansement' } }),
        call(urgC.addPrescription, { params: { id: u._id.toString() }, user, ip: '127.0.0.1', body: { designation: 'Paracétamol' } }),
        call(urgC.addExamen, { params: { id: u._id.toString() }, user, ip: '127.0.0.1', body: { designation: 'NFS' } }),
      ]);

      assert.equal(rSoin.status, 201, JSON.stringify(rSoin.body));
      assert.equal(rPresc.status, 201, JSON.stringify(rPresc.body));
      assert.equal(rExam.status, 201, JSON.stringify(rExam.body));

      const fresh = await Urgence.findById(u._id).lean();
      assert.equal(fresh.soins.length, 1);
      assert.equal(fresh.prescriptions.length, 1);
      assert.equal(fresh.examens.length, 1);
      assert.equal(fresh.timeline.length, 3, 'les 3 entrées timeline doivent toutes être présentes, aucune perdue sous concurrence réelle');
    });

    await t.test('6 addSoin concurrents → les 6 persistés, ordre le plus récent en tête préservé', async () => {
      const u = await Urgence.create({ patient_nom: `Audit20-7B-${stamp}`, niveau_triage: 'orange', motif: 'Test concurrence même ressource' });
      created.push(u._id);

      const N = 6;
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(urgC.addSoin, { params: { id: u._id.toString() }, user, ip: '127.0.0.1', body: { acte: `Acte${i}` } })
      ));
      for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));

      const fresh = await Urgence.findById(u._id).lean();
      assert.equal(fresh.soins.length, N, `les ${N} soins doivent tous être persistés, aucun perdu sous concurrence réelle`);
      const actes = new Set(fresh.soins.map(s => s.acte));
      assert.equal(actes.size, N, 'chaque soin doit être réellement distinct, aucun écrasement');
      // unshift() : le plus récemment inséré en base doit rester en tête —
      // vérifié indirectement via la date de création du document sous-jacent,
      // impossible à ordonner par timestamp exact sous concurrence réelle
      // (tous quasi simultanés) ; on vérifie donc seulement que $position:0
      // insère bien en tête et non en queue, en comparant à un ajout
      // séquentiel ultérieur.
      await call(urgC.addSoin, { params: { id: u._id.toString() }, user, ip: '127.0.0.1', body: { acte: 'DernierEnDate' } });
      const fresh2 = await Urgence.findById(u._id).lean();
      assert.equal(fresh2.soins[0].acte, 'DernierEnDate', 'un ajout séquentiel ultérieur doit apparaître en tête (unshift), jamais en queue');
    });

    await t.test('updateExamen en course avec addSoin sur le même dossier → les deux réussissent, jamais de VersionError', async () => {
      const u = await Urgence.create({
        patient_nom: `Audit20-7C-${stamp}`, niveau_triage: 'orange', motif: 'Test concurrence update/add',
        examens: [{ designation: 'NFS initiale', statut: 'attente' }],
      });
      created.push(u._id);
      const examenId = u.examens[0]._id.toString();

      const [rUpdate, rSoin] = await Promise.all([
        call(urgC.updateExamen, { params: { id: u._id.toString(), sid: examenId }, user, ip: '127.0.0.1', body: { statut: 'resultat', resultat: 'Normal' } }),
        call(urgC.addSoin, { params: { id: u._id.toString() }, user, ip: '127.0.0.1', body: { acte: 'Concurrent' } }),
      ]);

      assert.equal(rUpdate.status, 200, `updateExamen ne doit jamais échouer avec une VersionError sous concurrence réelle — obtenu ${rUpdate.status} ${rUpdate.body.name || ''} ${rUpdate.body.message || ''}`);
      assert.equal(rSoin.status, 201, JSON.stringify(rSoin.body));

      const fresh = await Urgence.findById(u._id).lean();
      assert.equal(fresh.examens[0].resultat, 'Normal', 'la mise à jour de l\'examen doit être réellement persistée');
      assert.equal(fresh.soins.length, 1, 'le soin ajouté en parallèle doit être réellement persisté, jamais perdu');
    });

    await t.test('non-régression — 404 "Dossier introuvable" sur un dossier inexistant', async () => {
      const fauxId = new mongoose.Types.ObjectId().toString();
      const { status, body } = await call(urgC.addSoin, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { acte: 'X' } });
      assert.equal(status, 404);
      assert.match(body.message, /Dossier introuvable/);

      const { status: s2, body: b2 } = await call(urgC.updateExamen, { params: { id: fauxId, sid: new mongoose.Types.ObjectId().toString() }, user, ip: '127.0.0.1', body: { statut: 'resultat' } });
      assert.equal(s2, 404);
      assert.match(b2.message, /Dossier introuvable/);
    });

    await t.test('non-régression — 404 "Examen introuvable" sur un sous-document inexistant (dossier réel)', async () => {
      const u = await Urgence.create({ patient_nom: `Audit20-7D-${stamp}`, niveau_triage: 'orange', motif: 'Test 404 sous-document', examens: [{ designation: 'X' }] });
      created.push(u._id);
      const fauxSid = new mongoose.Types.ObjectId().toString();

      const { status, body } = await call(urgC.updateExamen, { params: { id: u._id.toString(), sid: fauxSid }, user, ip: '127.0.0.1', body: { statut: 'resultat' } });
      assert.equal(status, 404);
      assert.match(body.message, /Examen introuvable/);

      const { status: s2 } = await call(urgC.updateExamen, { params: { id: u._id.toString(), sid: 'pas-un-objectid' }, user, ip: '127.0.0.1', body: { statut: 'resultat' } });
      assert.equal(s2, 404, 'un sid malformé doit rester un 404 propre, jamais un 500');
    });
  } finally {
    for (const id of created) await Urgence.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
