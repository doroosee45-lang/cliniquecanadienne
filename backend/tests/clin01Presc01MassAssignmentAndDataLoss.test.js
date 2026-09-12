// CLIN-01 + PRESC-01 (correction du 12 sept. 2026, audit indépendant) —
// create() passait `...req.body` tel quel (CLIN-01) : un client pouvait
// fabriquer directement statut:'dispensee'/patient/dispensee_par, contournant
// le vrai circuit pharmacie (aucun stock jamais décrémenté pour une
// ordonnance qui se déclare pourtant déjà dispensée). Dans le même temps,
// poids/allergies vérifiées/consultation liée/médecin réel/pathologie
// chronique/recommandations, réellement saisis dans Prescriptions.jsx,
// n'avaient aucun champ modèle pour les recevoir (PRESC-01) — perte
// silencieuse de données de sécurité clinique (allergies).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('CLIN-01/PRESC-01 — liste blanche stricte à la création, aucune donnée clinique saisie perdue', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Prescription = require('../models/Prescription');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const Medication = require('../models/Medication');
  const rxC = require('../controllers/prescriptions.controller');

  const stamp = Date.now();
  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await rxC.create(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const infirmier = await User.create({ email: `_clin01-inf-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Clin01', prenom: 'Inf', role: 'infirmier', statut: 'actif' });
  const vraiMedecin = await User.create({ email: `_clin01-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Clin01', prenom: 'Medecin', role: 'medecin', specialite: 'Pédiatrie', statut: 'actif' });
  const patientA = await Patient.create({ nom: `Clin01-A-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'M', allergies: ['Pénicilline'] });
  const patientB = await Patient.create({ nom: `Clin01-B-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'F' });
  const consultA = await Consultation.create({ patient: patientA._id, medecin: vraiMedecin._id, numero: `CONS-CLIN01-${stamp}`, service: 'Test' });
  const fakeRxId = new mongoose.Types.ObjectId();
  const cleanup = { prescriptions: [] };

  try {
    await t.test('un client ne peut pas fabriquer statut:"dispensee" ni patient/dispensee_par arbitraires à la création', async () => {
      const { status, body } = await call({
        user: infirmier,
        body: {
          patient: patientA._id.toString(),
          lignes: [{ medicament_nom: 'Amoxicilline', posologie: '1cp x3/j' }],
          diagnostic: 'Test',
          statut: 'dispensee',
          dispensee_par: infirmier._id.toString(),
          date_dispensation: new Date().toISOString(),
          numero_rx: 'RX-FORGE-0000',
          publie_at: new Date().toISOString(),
          _id: fakeRxId.toString(),
        },
      });
      assert.equal(status, 201);
      cleanup.prescriptions.push(body.prescription._id);

      const fresh = await Prescription.findById(body.prescription._id).lean();
      assert.equal(fresh.statut, 'brouillon', 'le statut fabriqué "dispensee" ne doit jamais être honoré à la création');
      assert.equal(fresh.dispensee_par, undefined, 'dispensee_par ne doit jamais être fabriqué à la création');
      assert.equal(fresh.date_dispensation, undefined);
      assert.equal(fresh.publie_at, undefined);
      assert.notEqual(String(fresh._id), fakeRxId.toString(), 'le client ne doit jamais pouvoir imposer son propre _id');
      assert.notEqual(fresh.numero_rx, 'RX-FORGE-0000', 'numero_rx doit toujours être généré par le serveur');
    });

    await t.test('le vrai circuit pharmacie reste le seul chemin de dispensation — aucun stock jamais touché par create()', async () => {
      const med = await Medication.create({ nom_commercial: `MedClin01-${stamp}`, stock_actuel: 50, prix_vente: 1000, prix_achat: 500 });
      const { body } = await call({
        user: infirmier,
        body: { patient: patientA._id.toString(), lignes: [{ medicament: med._id.toString(), medicament_nom: med.nom_commercial, posologie: '1cp/j', quantite: 5 }], diagnostic: 'Test stock' },
      });
      cleanup.prescriptions.push(body.prescription._id);
      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 50, 'create() ne doit jamais décrémenter le stock — seul pharmacy.controller.js::dispenser le fait réellement');
      await Medication.findByIdAndDelete(med._id);
    });

    await t.test('PRESC-01 — médecin réel (ObjectId User medecin) accepté et persisté, jamais un texte libre', async () => {
      const { status, body } = await call({
        user: infirmier,
        body: { patient: patientA._id.toString(), medecin: vraiMedecin._id.toString(), lignes: [{ medicament_nom: 'Test' }], diagnostic: 'Test' },
      });
      assert.equal(status, 201);
      cleanup.prescriptions.push(body.prescription._id);
      const fresh = await Prescription.findById(body.prescription._id).lean();
      assert.equal(String(fresh.medecin), String(vraiMedecin._id));
    });

    await t.test('PRESC-01 — un ID "médecin" invalide/inexistant se rabat sur l\'utilisateur réellement connecté', async () => {
      const { body } = await call({
        user: infirmier,
        body: { patient: patientA._id.toString(), medecin: new mongoose.Types.ObjectId().toString(), lignes: [{ medicament_nom: 'Test' }], diagnostic: 'Test' },
      });
      cleanup.prescriptions.push(body.prescription._id);
      const fresh = await Prescription.findById(body.prescription._id).lean();
      assert.equal(String(fresh.medecin), String(infirmier._id));
    });

    await t.test('PRESC-01 — poids/allergies vérifiées/chronique/pathologie/recommandations réellement persistés (jamais perdus)', async () => {
      const { status, body } = await call({
        user: infirmier,
        body: {
          patient: patientA._id.toString(), lignes: [{ medicament_nom: 'Test' }], diagnostic: 'Test',
          poids_kg: 72.5, allergies_verifiees: ['Pénicilline', 'Iode'],
          chronique: true, maladie_chronique: 'Diabète type 2',
          recommandations: 'Repos, surveillance glycémique quotidienne.',
        },
      });
      assert.equal(status, 201);
      cleanup.prescriptions.push(body.prescription._id);
      const fresh = await Prescription.findById(body.prescription._id).lean();
      assert.equal(fresh.poids_kg, 72.5);
      assert.deepEqual(fresh.allergies_verifiees, ['Pénicilline', 'Iode']);
      assert.equal(fresh.chronique, true);
      assert.equal(fresh.maladie_chronique, 'Diabète type 2');
      assert.equal(fresh.recommandations, 'Repos, surveillance glycémique quotidienne.');
    });

    await t.test('PRESC-01 — "consultation liée" résolue par numéro humain, refusée si elle appartient à un autre patient', async () => {
      const ok = await call({
        user: infirmier,
        body: { patient: patientA._id.toString(), consultation: consultA.numero, lignes: [{ medicament_nom: 'Test' }], diagnostic: 'Test' },
      });
      assert.equal(ok.status, 201);
      cleanup.prescriptions.push(ok.body.prescription._id);
      const fresh = await Prescription.findById(ok.body.prescription._id).lean();
      assert.equal(String(fresh.consultation), String(consultA._id));

      const mismatch = await call({
        user: infirmier,
        body: { patient: patientB._id.toString(), consultation: consultA.numero, lignes: [{ medicament_nom: 'Test' }], diagnostic: 'Test' },
      });
      assert.equal(mismatch.status, 400, 'une consultation liée à un AUTRE patient doit être refusée, jamais silencieusement acceptée');
    });

    await t.test('kpis.chroniques (stats) reflète désormais un vrai comptage', async () => {
      let status, body;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await rxC.getStats({}, res, (e) => { if (e) throw e; });
      assert.equal(status, undefined); // pas d'appel status() sur succès (200 implicite)
      assert.ok(body.stats.chroniques >= 1, 'au moins la prescription chronique créée ci-dessus doit être comptée');
    });
  } finally {
    await Prescription.deleteMany({ _id: { $in: cleanup.prescriptions } });
    await Consultation.findByIdAndDelete(consultA._id);
    await Patient.deleteMany({ _id: { $in: [patientA._id, patientB._id] } });
    await User.deleteMany({ _id: { $in: [infirmier._id, vraiMedecin._id] } });
    await mongoose.disconnect();
  }
});
