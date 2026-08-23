// Audit critique 2/4 — Blocoperatoire.jsx envoie salle/date_heure_op (même
// convention que createIntervention) mais updateIntervention n'acceptait que
// salle_prevue/date_intervention_prev : un changement de salle/heure à la
// replanification ne persistait jamais, seul statut passait réellement,
// alors que l'UI affichait un succès optimiste. Corrigé par un alias
// (frontend → modèle), l'ajout de checkBlocConflict (absent jusqu'ici sur ce
// chemin, présent sur createIntervention/scheduleIntervention), et l'ajout
// de service_demandeur au schéma (jamais déclaré, silencieusement perdu à
// la fois en création ET en mise à jour).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Audit critique 2 — replanification bloc opératoire (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Patient = require('../models/Patient');
  const blocC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Crit2', nom: 'Test' };
  const created = { patients: [], dossiers: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-CRIT2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    created.patients.push(patient._id);

    await t.test('un changement de salle/heure via les noms envoyés par le frontend (salle/date_heure_op) persiste réellement en base', async () => {
      const dossier = await DossierChirurgical.create({
        numero: `T-CRIT2-${stamp}-A`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        statut: 'preoperatoire', salle_prevue: 'BO-1',
        date_intervention_prev: new Date(Date.now() + 86400000),
      });
      created.dossiers.push(dossier._id);

      const nouvelleDate = new Date(Date.now() + 2 * 86400000);
      const { status, body } = await call(blocC.updateIntervention, {
        params: { id: dossier._id },
        body: { statut: 'preoperatoire', salle: 'BO-2', date_heure_op: nouvelleDate.toISOString(), service_demandeur: 'Urgences' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.intervention.salle_prevue, 'BO-2', 'la réponse doit refléter la nouvelle salle');

      // Vérification réelle : relecture depuis la base (pas l'état local/la
      // réponse), pour prouver que ce n'est pas juste un succès optimiste.
      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.salle_prevue, 'BO-2', 'la salle doit avoir réellement changé en base après rechargement');
      assert.equal(new Date(fresh.date_intervention_prev).getTime(), nouvelleDate.getTime(), 'la date/heure doit avoir réellement changé en base');
      assert.equal(fresh.service_demandeur, 'Urgences', 'service_demandeur doit désormais être réellement persisté');
    });

    await t.test('un conflit de salle est désormais détecté à la replanification, comme à la création', async () => {
      const dateConflit = new Date(Date.now() + 5 * 86400000);
      const occupant = await DossierChirurgical.create({
        numero: `T-CRIT2-${stamp}-B`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        statut: 'preoperatoire', salle_prevue: 'BO-3', date_intervention_prev: dateConflit, duree_intervention_min: 60,
      });
      created.dossiers.push(occupant._id);

      const autreDossier = await DossierChirurgical.create({
        numero: `T-CRIT2-${stamp}-C`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        statut: 'preoperatoire', salle_prevue: 'BO-1', date_intervention_prev: new Date(Date.now() + 86400000),
      });
      created.dossiers.push(autreDossier._id);

      // Tente de replanifier autreDossier vers la même salle/le même
      // créneau que occupant — doit être refusé, contrairement au
      // comportement d'avant ce correctif (aucune vérification n'existait).
      const { status, body } = await call(blocC.updateIntervention, {
        params: { id: autreDossier._id },
        body: { statut: 'preoperatoire', salle: 'BO-3', date_heure_op: dateConflit.toISOString() },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 400);
      assert.match(body.message, /Conflit/);

      // Confirme qu'aucune écriture partielle n'a eu lieu (transaction refusée avant l'update).
      const fresh = await DossierChirurgical.findById(autreDossier._id).lean();
      assert.equal(fresh.salle_prevue, 'BO-1', 'la salle ne doit pas avoir changé suite au refus');
    });

    await t.test('createIntervention persiste désormais aussi service_demandeur (même correctif de schéma)', async () => {
      const { status, body } = await call(blocC.createIntervention, {
        body: { patient: patient._id.toString(), type_intervention: 'Appendicectomie', service_demandeur: 'Chirurgie générale' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.dossiers.push(body.intervention._id);
      const fresh = await DossierChirurgical.findById(body.intervention._id).lean();
      assert.equal(fresh.service_demandeur, 'Chirurgie générale');
    });
  } finally {
    for (const id of created.dossiers) await DossierChirurgical.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
