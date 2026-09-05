// Sous-phase 5.1 (relecture du 6 sept. 2026) — onglet Rapports
// (Prescriptions.jsx) affichait "Total prescriptions ce mois"/"Interactions
// détectées par IA"/"Renouvellements effectués"/"Ordonnances par service"
// tous codés en dur — alors que dispensees/annulees étaient déjà réellement
// renvoyés par prescriptions.controller.js::getStats sans jamais être
// récupérés côté frontend, et que kpis.renouvellements/interactions
// existaient déjà dans l'état local sans jamais être alimentés (l'alerte
// sécurité "interactions médicamenteuses potentielles" restait toujours à 0).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Prescriptions) — onglet Rapports réellement calculé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Prescription = require('../models/Prescription');
  const rxC = require('../controllers/prescriptions.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], prescriptions: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T51-Rx-${stamp}`, prenom: 'P', date_naissance: '1985-01-01', sexe: 'M' });
    created.patients.push(patient._id);
    const medecin = await User.create({ email: `_51rx-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: '51', role: 'medecin', statut: 'actif', specialite: `SpecialiteT51-${stamp}` });
    created.users.push(medecin._id);

    // Ordonnance 1 — avec une vraie interaction détectée, dispensée.
    const rx1 = await Prescription.create({
      patient: patient._id, medecin: medecin._id, diagnostic: 'Test51',
      lignes: [{ medicament_nom: 'Med1', posologie: '1x/j', duree: '7j' }],
      statut: 'dispensee', interactions_detectees: [{ medicaments: ['Med1', 'Med2'], risque: 'modere', description: 'Test' }],
    });
    // Ordonnance 2 — annulée.
    const rx2 = await Prescription.create({
      patient: patient._id, medecin: medecin._id, diagnostic: 'Test51 2',
      lignes: [{ medicament_nom: 'Med2', posologie: '1x/j', duree: '7j' }],
      statut: 'annulee', motif_annulation: 'Test',
    });
    // Ordonnance 3 — issue d'un vrai renouvellement.
    const rx3 = await Prescription.create({
      patient: patient._id, medecin: medecin._id, diagnostic: 'Test51 3',
      lignes: [{ medicament_nom: 'Med3', posologie: '1x/j', duree: '7j' }],
      statut: 'active', note_renouvellement: 'Renouvelé pour test51',
    });
    // Ordonnance 4 — active, expire dans 3 jours (doit compter dans "à renouveler bientôt").
    const rx4 = await Prescription.create({
      patient: patient._id, medecin: medecin._id, diagnostic: 'Test51 4',
      lignes: [{ medicament_nom: 'Med4', posologie: '1x/j', duree: '7j' }],
      statut: 'active', date_expiration: new Date(Date.now() + 3 * 86400000),
    });
    created.prescriptions.push(rx1._id, rx2._id, rx3._id, rx4._id);

    await t.test('getStats() calcule réellement mois/interactions/renouvellements/spécialité — jamais figés à une valeur fixe', async () => {
      const { status, body } = await call(rxC.getStats);
      assert.equal(status, 200, JSON.stringify(body));
      const s = body.stats;

      assert.ok(s.mois >= 4, `mois doit compter au moins nos 4 ordonnances créées ce mois-ci, obtenu ${s.mois}`);
      assert.ok(s.interactions >= 1, 'interactions doit détecter la vraie interaction créée (rx1)');
      assert.ok(s.renouvellements_effectues >= 1, 'renouvellements_effectues doit détecter le vrai renouvellement (rx3, note_renouvellement réelle)');
      assert.ok(s.renouvellements_a_bientot >= 1, 'renouvellements_a_bientot doit détecter rx4 (expire dans 3 jours, <= 7 jours)');
      assert.ok(s.dispensees >= 1, 'dispensees doit compter rx1 (déjà réel côté backend, juste jamais récupéré côté frontend avant cette correction)');
      assert.ok(s.annulees >= 1, 'annulees doit compter rx2 (idem)');

      const specReelle = s.repartition_specialite.find(x => x.specialite === medecin.specialite);
      assert.ok(specReelle && specReelle.pct > 0, 'la vraie spécialité du médecin prescripteur doit apparaître avec un poids réel non nul');
    });
  } finally {
    await Prescription.deleteMany({ _id: { $in: created.prescriptions } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
