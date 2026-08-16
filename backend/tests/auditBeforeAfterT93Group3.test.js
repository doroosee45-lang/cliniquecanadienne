// T9.3 (R-17) — extension de donnees_avant/donnees_apres, groupe 3 : cœur
// clinique restant (rendez-vous, consultations, portail patient). Même
// vérification que les groupes 1-2.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('donnees_avant/donnees_apres — appointments, consultations, portal (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const Consultation = require('../models/Consultation');
  const apptC = require('../controllers/appointments.controller');
  const consC = require('../controllers/consultations.controller');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'T93', nom: 'Test', role: 'medecin' };
  const patient = await Patient.create({ nom: `T93G3${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await User.create({ email: `_t93g3-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'T93G3', role: 'medecin', statut: 'actif' });

  // Patient supprimé en tout dernier (voir finally) — la contrainte
  // structurelle du ticket 0008 refuse de supprimer un Patient tant qu'un
  // User actif le référence par patient_id (créé plus bas, dans le
  // sous-test portal.updateProfile).
  const cleanup = [() => User.findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('appointments.controller — update et remove journalisent avant/apres', async () => {
      const appt = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(), motif: 'Suivi', type: 'consultation' });

      await call(apptC.update, { params: { id: appt._id }, body: { motif: 'Motif révisé', statut: 'confirme' }, user: staff, ip: '127.0.0.1' });
      let log = await AuditLog.findOne({ module: 'appointments', action: 'UPDATE', entite_id: appt._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.motif, 'Suivi');
      assert.equal(log.donnees_apres.motif, 'Motif révisé');

      await call(apptC.remove, { params: { id: appt._id }, user: staff, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'appointments', action: 'DELETE', entite_id: appt._id.toString() }).sort('-createdAt');
      assert.ok(log.donnees_avant, 'avant doit être renseigné pour la suppression (dernier état connu)');
      assert.equal(log.donnees_avant.motif, 'Motif révisé');
      assert.equal(log.donnees_apres, undefined, 'apres ne doit rien contenir — le document n\'existe plus');
    });

    await t.test('consultations.controller — update et remove journalisent avant/apres', async () => {
      const c = await Consultation.create({ patient: patient._id, medecin: medecin._id, diagnostic: 'Initial', statut: 'en_cours' });

      await call(consC.update, { params: { id: c._id }, body: { diagnostic: 'Diagnostic révisé' }, user: staff, ip: '127.0.0.1' });
      let log = await AuditLog.findOne({ module: 'consultations', action: 'UPDATE', entite_id: c._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.diagnostic, 'Initial');
      assert.equal(log.donnees_apres.diagnostic, 'Diagnostic révisé');

      await call(consC.remove, { params: { id: c._id }, user: staff, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'consultations', action: 'DELETE', entite_id: c._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.diagnostic, 'Diagnostic révisé');
    });

    await t.test('portal.controller.updateProfile journalise avant/apres', async () => {
      const email = `_t93g3-patient-${stamp}@_test.local`;
      const patUser = await User.create({ email, password: 'Xx1aaaaa', nom: 'T93G3', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(patUser._id));

      await call(portalC.updateProfile, { user: { _id: patUser._id, email, patient_id: patient._id }, body: { telephone: '060000001' }, ip: '127.0.0.1' });
      const log = await AuditLog.findOne({ module: 'portal', action: 'UPDATE', entite_id: patient._id.toString() }).sort('-createdAt');
      assert.notEqual(log.donnees_avant.telephone, '060000001');
      assert.equal(log.donnees_apres.telephone, '060000001');
    });

    await t.test('portal.controller.changePassword ne journalise volontairement pas avant/apres (pas de hash en audit)', async () => {
      const email = `_t93g3-pwd-${stamp}@_test.local`;
      const patUser = await User.create({ email, password: 'AncienMdp1', nom: 'T93G3', prenom: 'Pwd', role: 'patient', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(patUser._id));

      await call(portalC.changePassword, { user: { _id: patUser._id, email }, body: { currentPassword: 'AncienMdp1', newPassword: 'NouveauMdp2' }, ip: '127.0.0.1' });
      const log = await AuditLog.findOne({ module: 'portal', action: 'UPDATE_PASSWORD', utilisateur: patUser._id }).sort('-createdAt');
      assert.ok(log, 'l\'action doit rester journalisée');
      assert.equal(log.donnees_avant, undefined, 'aucun hash de mot de passe ne doit apparaître dans donnees_avant');
      assert.equal(log.donnees_apres, undefined, 'aucun hash de mot de passe ne doit apparaître dans donnees_apres');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
