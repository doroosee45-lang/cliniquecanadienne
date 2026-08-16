// Ticket 0010 — patients.controller.js::remove() résolvait le User lié à
// supprimer/désactiver par correspondance d'email, pas par patient_id
// (référence ObjectId stable) — même classe de fragilité que l'ancien
// portal.controller.js avant R-07. C'est le mécanisme confirmé à l'origine
// des 3 comptes orphelins du ticket 0008 : un deleteOne({email: ...}) qui
// ne matche silencieusement rien quand patient.email a divergé de
// user.email, sans erreur ni signal pour le staff. Vérifie ici que la
// résolution passe désormais par patient_id en priorité (repli email
// seulement si aucun User n'a ce patient_id peuplé).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('remove() résout le User lié par patient_id, pas seulement par email (ticket 0010)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, () => {});
    return { status, body };
  };

  try {
    await t.test('email divergent + patient_id peuplé → la suppression nettoie quand même le User lié (scénario exact du ticket 0008)', async () => {
      const patient = await Patient.create({
        nom: `T0010A${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M',
        email: `_t0010-patient-email-${stamp}@_test.local`,
      });
      // Email volontairement différent de celui du Patient — c'est
      // exactement la désynchronisation qui faisait échouer silencieusement
      // l'ancien User.deleteOne({ email: patient.email, ... }).
      const user = await User.create({
        email: `_t0010-user-email-${stamp}@_test.local`, password: 'Xx1aaaaa',
        nom: 'T0010A', prenom: 'U', role: 'patient', statut: 'inactif', patient_id: patient._id,
      });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(patC.remove, { params: { id: patient._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.deactivated, undefined, 'aucun historique — suppression réelle attendue, pas une désactivation');

      assert.equal(await Patient.findById(patient._id), null, 'le Patient doit être supprimé');
      assert.equal(await User.findById(user._id), null, 'le User lié doit être nettoyé via patient_id, malgré l\'email divergent — avant le correctif, il restait orphelin ici');
    });

    await t.test('patient_id non peuplé → repli sur l\'email fonctionne toujours', async () => {
      const email = `_t0010-fallback-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `T0010B${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email });
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'T0010B', prenom: 'U', role: 'patient', statut: 'inactif' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status } = await call(patC.remove, { params: { id: patient._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(await User.findById(user._id), null, 'le repli sur l\'email doit toujours fonctionner quand patient_id n\'est pas peuplé');
    });

    await t.test('branche désactivation (historique existant) résout aussi par patient_id', async () => {
      const Appointment = require('../models/Appointment');
      const patient = await Patient.create({
        nom: `T0010C${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M',
        email: `_t0010-deact-patient-${stamp}@_test.local`,
      });
      const user = await User.create({
        email: `_t0010-deact-user-${stamp}@_test.local`, password: 'Xx1aaaaa',
        nom: 'T0010C', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id,
      });
      const appt = await Appointment.create({ patient: patient._id, date_heure: new Date(), motif: 'Test 0010', medecin: admin._id });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(patC.remove, { params: { id: patient._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.deactivated, true, 'historique présent — désactivation attendue, pas une suppression');

      const freshUser = await User.findById(user._id);
      assert.equal(freshUser.statut, 'inactif', 'le User doit être désactivé via patient_id malgré l\'email divergent');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
