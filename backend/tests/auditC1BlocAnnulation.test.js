// Ticket 0022 (C1) — updateIntervention rejetait statut:'annulee' en 400
// ("enum invalide") car il écrivait req.body.statut tel quel (vocabulaire UI)
// au lieu de le traduire via toModelStatut() comme le fait déjà
// createIntervention ('annulee' -> 'consultation'). Traduction ajoutée, avec
// une garde de transition : annulation autorisée uniquement depuis
// 'consultation'/'preoperatoire', refusée depuis 'opere'/'suivi_postop'/
// 'cloture' (règle par défaut adoptée en l'absence de décision de l'équipe
// clinique — voir commentaire AUDIT-C1 dans blocoperatoireController.js).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Ticket 0022 (C1) — annulation d\'intervention bloc opératoire (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Patient = require('../models/Patient');
  const blocC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'C1', nom: 'Test' };
  const created = { patients: [], dossiers: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-C1-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    created.patients.push(patient._id);

    await t.test('annuler depuis "preoperatoire" — autorisé, statut modèle devient "consultation"', async () => {
      const dossier = await DossierChirurgical.create({
        numero: `T-C1-${stamp}-A`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        statut: 'preoperatoire',
      });
      created.dossiers.push(dossier._id);

      const { status, body } = await call(blocC.updateIntervention, {
        params: { id: dossier._id },
        body: { statut: 'annulee' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.intervention.statut, 'consultation');

      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.statut, 'consultation', 'doit avoir réellement changé en base');
    });

    await t.test('annuler depuis "consultation" — autorisé', async () => {
      const dossier = await DossierChirurgical.create({
        numero: `T-C1-${stamp}-B`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        statut: 'consultation',
      });
      created.dossiers.push(dossier._id);

      const { status, body } = await call(blocC.updateIntervention, {
        params: { id: dossier._id },
        body: { statut: 'annulee' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.intervention.statut, 'consultation');
    });

    for (const statutDepart of ['opere', 'suivi_postop', 'cloture']) {
      await t.test(`annuler depuis "${statutDepart}" — refusé (400), aucune écriture`, async () => {
        const dossier = await DossierChirurgical.create({
          numero: `T-C1-${stamp}-${statutDepart}`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
          statut: statutDepart,
        });
        created.dossiers.push(dossier._id);

        const { status, body } = await call(blocC.updateIntervention, {
          params: { id: dossier._id },
          body: { statut: 'annulee' },
          user: superadmin, ip: '127.0.0.1',
        });
        assert.equal(status, 400);
        assert.match(body.message, /annuler/i);

        const fresh = await DossierChirurgical.findById(dossier._id).lean();
        assert.equal(fresh.statut, statutDepart, 'le statut ne doit pas avoir régressé suite au refus');
      });
    }

    await t.test('autres transitions de statut (hors annulation) continuent de fonctionner, traduites via toModelStatut', async () => {
      const dossier = await DossierChirurgical.create({
        numero: `T-C1-${stamp}-D`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        statut: 'preoperatoire',
      });
      created.dossiers.push(dossier._id);

      const { status, body } = await call(blocC.updateIntervention, {
        params: { id: dossier._id },
        body: { statut: 'en_cours' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.intervention.statut, 'opere');
    });
  } finally {
    for (const id of created.dossiers) await DossierChirurgical.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
