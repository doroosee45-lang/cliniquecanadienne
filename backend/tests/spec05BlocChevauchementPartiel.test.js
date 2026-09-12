// SPEC-05 (correction du 12 sept. 2026, audit indépendant) —
// blocoperatoireController.js::checkBlocConflict() (lecture) et l'écriture
// (createIntervention/scheduleIntervention/updateIntervention) n'étaient
// pas atomiques : l'index unique partiel (salle_prevue+date_intervention_prev)
// ferme la course sur le créneau EXACT, mais deux planifications concurrentes
// sur des créneaux DIFFÉRENTS qui se chevauchent partiellement pouvaient
// toutes deux passer la vérification avant que l'une n'ait écrit. Corrigé
// par le même mécanisme que AUDIT-M-B4 pour les rendez-vous : écriture
// optimiste + relecture + élimination déterministe
// (blocoperatoireController.js::isBlocRaceWinner) — DossierChirurgical
// n'est jamais supprimé (contrairement à Appointment), seuls ses champs de
// planification sont restaurés pour le perdant.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-05 — chevauchement partiel de planification bloc opératoire, atomique sous concurrence réelle', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Patient = require('../models/Patient');
  const blocC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const created = { dossiers: [], patients: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  // Le perdant peut être rejeté soit par la pré-vérification (400, si son
  // tour d'event-loop arrive après que le gagnant a déjà écrit), soit par
  // l'élimination après écriture (409) — les deux issues sont correctes ;
  // seul compte l'invariant "exactement un succès, jamais un crash ni un
  // double succès".
  const assertExactlyOneSucceeds = (results, message) => {
    const successes = results.filter(r => r.status === 201 || r.status === 200);
    const rejects = results.filter(r => r.status === 400 || r.status === 409);
    assert.equal(successes.length, 1, message);
    assert.equal(rejects.length, results.length - 1, `les requêtes non gagnantes doivent toutes être rejetées proprement (400 ou 409), jamais un crash — statuts observés : ${results.map(r => r.status).join(',')}`);
    return successes[0];
  };

  const makePatient = async (label) => {
    const p = await Patient.create({ nom: `Spec05-${label}-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(p);
    return p;
  };

  try {
    await t.test('createIntervention() — deux nouveaux dossiers concurrents sur la même salle à des créneaux qui se chevauchent partiellement : un seul réussit', async () => {
      const p1 = await makePatient('overlap1');
      const p2 = await makePatient('overlap2');
      const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'User' };
      // 09:00-10:00 et 09:30-10:30 sur la même salle : chevauchement réel [09:30,10:00).
      const reqA = { user, ip: '127.0.0.1', body: { patient: p1._id.toString(), salle: `SPEC05-Salle-${stamp}`, date_heure_op: '2033-03-10T09:00:00Z', duree_estimee: 60, type_intervention: 'Test A' } };
      const reqB = { user, ip: '127.0.0.1', body: { patient: p2._id.toString(), salle: `SPEC05-Salle-${stamp}`, date_heure_op: '2033-03-10T09:30:00Z', duree_estimee: 60, type_intervention: 'Test B' } };

      const results = await Promise.all([call(blocC.createIntervention, reqA), call(blocC.createIntervention, reqB)]);
      const winner = assertExactlyOneSucceeds(results, 'exactement une des deux planifications concurrentes en chevauchement partiel doit réussir');
      created.dossiers.push(winner.body.intervention._id);

      const enBase = await DossierChirurgical.find({
        salle_prevue: `SPEC05-Salle-${stamp}`,
        statut: { $in: ['preoperatoire', 'opere'] },
      }).lean();
      assert.equal(enBase.length, 1, 'un seul des deux dossiers doit rester réellement planifié dans cette salle — le perdant doit avoir été démoté, jamais laissé planifié en double');
      assert.equal(String(enBase[0]._id), String(winner.body.intervention._id));

      // Le perdant peut être rejeté par deux voies légitimes (comme pour les
      // rendez-vous, AUDIT-M-B4) : (a) la pré-vérification (400), avant tout
      // enregistrement — aucun dossier créé pour lui ; ou (b) l'élimination
      // après écriture (409) — son dossier existe (jamais supprimé, tout son
      // historique clinique), mais démoté : ses champs de planification
      // restaurés à leur état d'avant cet appel (aucune salle/date, non
      // planifié), jamais laissé dans un état incohérent.
      const dossierP1 = await DossierChirurgical.findOne({ patient: p1._id }).lean();
      const dossierP2 = await DossierChirurgical.findOne({ patient: p2._id }).lean();
      const loserDossier = String(winner.body.intervention._id) === String(dossierP1?._id) ? dossierP2 : dossierP1;
      if (loserDossier) {
        created.dossiers.push(loserDossier._id);
        assert.equal(loserDossier.salle_prevue, undefined, 'le perdant ne doit plus occuper la salle après démotion');
        assert.equal(loserDossier.statut, 'consultation', 'le perdant doit revenir à un statut non planifié (consultation), pas rester preoperatoire sans salle réelle');
      }
    });
  } finally {
    await DossierChirurgical.deleteMany({ _id: { $in: created.dossiers } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
