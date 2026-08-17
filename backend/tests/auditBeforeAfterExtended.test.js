// R-17 — donnees_avant/donnees_apres n'étaient renseignés que dans 3
// contrôleurs sur 109 appels logAction. Étendu ici aux mutations réelles
// (pas les créations, qui n'ont pas de "avant") des contrôleurs priorisés :
// hospitalisation, prescriptions, finance. Vérifie contre la vraie base que
// chaque action journalise un avant/apres cohérent avec le changement réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('donnees_avant/donnees_apres — hospitalisation, prescriptions, finance (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const Prescription = require('../models/Prescription');
  const Invoice = require('../models/Invoice');
  const Staff = require('../models/Staff');
  const Salaire = require('../models/Salaire');
  require('../models/Medication'); // enregistré pour Prescription.populate('lignes.medicament') dans publier()
  const hospC = require('../controllers/hospitalization.controller');
  const prescC = require('../controllers/prescriptions.controller');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const user = await User.create({ email: `_t17-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T17', prenom: 'Test', role: 'medecin', statut: 'actif' });
  const patient = await Patient.create({ nom: `T17Pat${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_t17-pat-${stamp}@_test.local` });

  const cleanup = [];
  const noop = { status: () => noop, json: () => {} };

  try {
    await t.test('hospitalization.update journalise avant/apres', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, medecin_responsable: user._id, service_nom: 'Médecine', motif_entree: 'Test', lit_numero: 'X1' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));

      await hospC.update({ params: { id: hosp._id }, body: { motif_entree: 'Motif modifié' }, user, ip: '127.0.0.1' }, noop, () => {});
      const log = await AuditLog.findOne({ module: 'hospitalization', action: 'UPDATE', entite_id: hosp._id.toString() }).sort('-createdAt');
      assert.ok(log.donnees_avant, 'avant doit être renseigné');
      assert.ok(log.donnees_apres, 'apres doit être renseigné');
      assert.equal(log.donnees_avant.motif_entree, 'Test');
      assert.equal(log.donnees_apres.motif_entree, 'Motif modifié');
    });

    await t.test('hospitalization.discharge journalise avant/apres', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, medecin_responsable: user._id, service_nom: 'Médecine', motif_entree: 'Test', lit_numero: 'X2', statut: 'en_cours' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));

      await hospC.discharge({ params: { id: hosp._id }, body: {}, user, ip: '127.0.0.1' }, noop, () => {});
      const log = await AuditLog.findOne({ module: 'hospitalization', action: 'DISCHARGE', entite_id: hosp._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'en_cours');
      assert.equal(log.donnees_apres.statut, 'sorti');
    });

    await t.test('prescriptions.update et .cancel journalisent avant/apres', async () => {
      // AUDIT-P2-1 (groupe 2) — prescriptions.controller.js::update ne
      // laisse plus passer `statut` (liste noire dédiée, protège la machine
      // à états publier()/dispenser()/cancel() — voir
      // auditP2-1MassAssignmentClinical.test.js). Ce test vérifiait à
      // l'origine le logging avant/apres sur un changement de statut via
      // update() ; adapté pour vérifier ce même logging sur un champ
      // toujours légitime (date_expiration), .cancel() restant le seul
      // chemin valide vers 'annulee'.
      // PrescriptionSchema.pre('save') écrase toujours date_expiration à la
      // création (isNew) — on relit la vraie valeur persistée plutôt que de
      // supposer que celle passée à create() est respectée.
      const nouvelleExpiration = new Date(Date.now() + 20 * 86400000);
      const rx = await Prescription.create({ patient: patient._id, medecin: user._id, lignes: [{ medicament_nom: 'Test', quantite: 1 }], statut: 'active' });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));
      const ancienneExpiration = rx.date_expiration;

      await prescC.update({ params: { id: rx._id }, body: { date_expiration: nouvelleExpiration, statut: 'brouillon' }, user, ip: '127.0.0.1' }, noop, () => {});
      let log = await AuditLog.findOne({ module: 'prescriptions', action: 'UPDATE', entite_id: rx._id.toString() }).sort('-createdAt');
      assert.equal(new Date(log.donnees_avant.date_expiration).getTime(), ancienneExpiration.getTime());
      assert.equal(new Date(log.donnees_apres.date_expiration).getTime(), nouvelleExpiration.getTime());
      assert.equal(log.donnees_apres.statut, 'active', 'statut ne doit pas être modifiable via update() — envoyé dans le même appel, doit rester inchangé');

      await prescC.cancel({ params: { id: rx._id }, user, ip: '127.0.0.1' }, noop, () => {});
      log = await AuditLog.findOne({ module: 'prescriptions', action: 'CANCEL', entite_id: rx._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'active');
      assert.equal(log.donnees_apres.statut, 'annulee');
    });

    await t.test('prescriptions.publier journalise avant/apres', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: user._id, lignes: [{ medicament_nom: 'Test', quantite: 1 }], statut: 'active' });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      await prescC.publier({ params: { id: rx._id }, user, ip: '127.0.0.1' }, noop, () => {});
      const log = await AuditLog.findOne({ module: 'prescriptions', action: 'PUBLISH', entite_id: rx._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'active');
      assert.equal(log.donnees_apres.statut, 'publiee');
    });

    await t.test('finance.addPayment journalise avant/apres', async () => {
      const invoice = await Invoice.create({ patient: patient._id, patient_nom: 'T17', montant_ttc: 10000, lignes: [{ libelle: 'Test', prix_unitaire: 10000, quantite: 1, montant: 10000 }] });
      cleanup.push(() => Invoice.findByIdAndDelete(invoice._id));

      await finC.addPayment({ params: { id: invoice._id }, body: { montant: 4000, mode: 'especes' }, user, ip: '127.0.0.1' }, noop, () => {});
      const log = await AuditLog.findOne({ module: 'finance', action: 'PAYMENT', entite_id: invoice._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.montant_paye, 0);
      assert.equal(log.donnees_apres.montant_paye, 4000);
    });

    await t.test('finance.payerSalaire journalise avant/apres', async () => {
      const staff = await Staff.create({ prenom: 'T17', nom: `Staff${stamp}`, poste: 'infirmier', salaire_base: 200000, statut: 'actif' });
      const salaire = await Salaire.create({ staff: staff._id, mois: '2026-01', base: 200000 });
      cleanup.push(() => Staff.findByIdAndDelete(staff._id), () => Salaire.findByIdAndDelete(salaire._id));

      await finC.payerSalaire({ params: { id: salaire._id }, user, ip: '127.0.0.1' }, noop, () => {});
      const log = await AuditLog.findOne({ module: 'finance', action: 'PAYMENT', entite_id: salaire._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'en_attente');
      assert.equal(log.donnees_apres.statut, 'paye');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await AuditLog.deleteMany({ utilisateur: user._id });
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(user._id);
    await mongoose.disconnect();
  }
});
