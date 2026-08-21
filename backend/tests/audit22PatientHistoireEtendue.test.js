// AUDIT-2.2 — patients.controller.js::remove ne vérifiait l'historique que
// sur 5 modèles (Appointment, Consultation, Hospitalization, Invoice,
// Prescription) avant d'autoriser la suppression physique d'un patient. Un
// patient ayant UNIQUEMENT un dossier chirurgical, un passage aux urgences,
// un dossier de grossesse, un résultat de laboratoire ou d'imagerie pouvait
// donc être supprimé physiquement, laissant ce dossier orphelin — alors même
// que utils/patientAnonymization.js (T9.13) couvrait déjà ces 8 collections
// pour l'anonymisation. La vérification est désormais alignée sur
// CASCADE_TARGETS. Ce test prouve, pour un modèle de chaque famille
// (DossierChirurgical déjà couvert par remove() avant ce correctif via
// aucun champ ; Urgence, Pregnancy — nouveaux dans la vérification) : un
// patient n'ayant QUE ce type de dossier est désormais désactivé, jamais
// supprimé physiquement.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-2.2 — remove() désactive (ne supprime pas) un patient ayant un historique hors des 5 modèles historiques (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Urgence = require('../models/Urgence');
  const Pregnancy = require('../models/Pregnancy');
  const patientsC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('patient avec uniquement un DossierChirurgical → désactivé, pas supprimé', async () => {
      const patient = await Patient.create({ nom: `T22-Chir-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const dossier = await DossierChirurgical.create({
        numero: `T22-CHIR-${stamp}`, patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
      });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
      const { status, body } = await call(patientsC.remove, { params: { id: patient._id }, user });
      assert.equal(status, 200);
      assert.equal(body.deactivated, true, 'doit être désactivé, pas supprimé, à cause du dossier chirurgical lié');

      const fresh = await Patient.findById(patient._id);
      assert.ok(fresh, 'le patient doit toujours exister en base (pas de suppression physique)');
      assert.equal(fresh.actif, false);
      assert.equal(fresh.statut, 'inactif');
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    });

    await t.test('patient avec uniquement un dossier Urgence → désactivé, pas supprimé', async () => {
      const patient = await Patient.create({ nom: `T22-Urg-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
      const urgence = await Urgence.create({ patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}` });
      cleanup.push(() => Urgence.findByIdAndDelete(urgence._id));

      const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
      const { status, body } = await call(patientsC.remove, { params: { id: patient._id }, user });
      assert.equal(status, 200);
      assert.equal(body.deactivated, true, 'doit être désactivé, pas supprimé, à cause du dossier urgences lié');

      const fresh = await Patient.findById(patient._id);
      assert.ok(fresh, 'le patient doit toujours exister en base (pas de suppression physique)');
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    });

    await t.test('patient avec uniquement un dossier Pregnancy (maternité) → désactivé, pas supprimé', async () => {
      const patient = await Patient.create({ nom: `T22-Mat-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
      const grossesse = await Pregnancy.create({ patient_id: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`, ddr: new Date('2026-01-01') });
      cleanup.push(() => Pregnancy.findByIdAndDelete(grossesse._id));

      const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
      const { status, body } = await call(patientsC.remove, { params: { id: patient._id }, user });
      assert.equal(status, 200);
      assert.equal(body.deactivated, true, 'doit être désactivé, pas supprimé, à cause du dossier de grossesse lié');

      const fresh = await Patient.findById(patient._id);
      assert.ok(fresh, 'le patient doit toujours exister en base (pas de suppression physique)');
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    });

    await t.test('patient sans aucun historique (aucun des 12 modèles) → toujours supprimé physiquement (non-régression)', async () => {
      const patient = await Patient.create({ nom: `T22-Vide-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
      const { status, body } = await call(patientsC.remove, { params: { id: patient._id }, user });
      assert.equal(status, 200);
      assert.equal(body.deactivated, undefined, 'ne doit pas être marqué désactivé — suppression réelle attendue');
      const fresh = await Patient.findById(patient._id);
      assert.equal(fresh, null, 'le patient doit avoir été réellement supprimé');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
