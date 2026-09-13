// AUDIT-PHASE4-G2 — patients.controller.js n'émettait dashboard:refresh/
// activity:new que sur create() : setPasswordAndActivate, activateAdmin,
// update, remove (2 branches succès) et uploadPhoto laissaient
// Patients.jsx (déjà branché sur useRealtimeRefresh) sans aucun signal de
// rafraîchissement — la page restait figée tant que le socket était
// connecté (le fallback polling ne s'active que si déconnecté). Corrigé en
// réutilisant emitActivity/emitDashboardUpdate déjà exportés par
// utils/socket.js, avec un choix au cas par cas sur emitActivity (voir
// commentaires dans le contrôleur) : émis pour les événements notables
// (activation, désactivation, suppression), pas pour les modifications
// routinières (update de champs, photo) qui n'obtiennent que
// emitDashboardUpdate. activate() reste volontairement intact : elle ne
// mute rien (confirmé par lecture — seule setPasswordAndActivate active
// réellement le compte), donc rien à émettre.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withLocalUploadFallback } = require('./helpers/forceLocalUploadFallback');

test('AUDIT-PHASE4-G2 — patients.controller.js émet activity:new/dashboard:refresh sur les mutations notables (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const { setIO } = require('../utils/socket');
  const patientsC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [] };
  const emitted = [];
  const fakeIo = { emit: (event, payload) => emitted.push({ event, payload }) };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'G2', nom: 'Staff', role: 'medecin' };
  const eventsOf = (name) => emitted.filter(e => e.event === name);

  try {
    setIO(fakeIo);

    // SEC-ACTIVATION-TOKEN-HASH — le contrôleur hashe désormais le token
    // reçu avant comparaison (même traitement que SEC-006 pour le reset de
    // mot de passe) : la base doit donc contenir le HASH, req.params.token
    // le token EN CLAIR (ce que le lien envoyé par email contient réellement).
    const hashActivationToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

    await t.test('activate() ne mute rien → aucune émission (non-régression du raisonnement, pas un bug)', async () => {
      const patient = await Patient.create({ nom: `G2Activate${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F', token_activation: hashActivationToken('tok-g2-activate'), token_activation_expire: new Date(Date.now() + 3600000) });
      created.patients.push(patient);
      emitted.length = 0;
      const { status } = await call(patientsC.activate, { params: { token: 'tok-g2-activate' } });
      assert.equal(status, 200);
      assert.equal(emitted.length, 0, 'activate() ne mute aucune donnée — aucune émission attendue');
    });

    await t.test('setPasswordAndActivate() → activity:new (acteur = le compte patient lui-même) + dashboard:refresh', async () => {
      const email = `_g2-setpwd-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: 'SetPwd', prenom: 'G2', email, date_naissance: '1990-01-01', sexe: 'F', token_activation: hashActivationToken('tok-g2-setpwd'), token_activation_expire: new Date(Date.now() + 3600000) });
      created.patients.push(patient);
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'SetPwd', prenom: 'G2', role: 'patient', statut: 'inactif', patient_id: patient._id });
      created.users.push(user);
      emitted.length = 0;

      const { status } = await call(patientsC.setPasswordAndActivate, { params: { token: 'tok-g2-setpwd' }, body: { password: 'Yy2bbbbb' }, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(eventsOf('activity:new').length, 1);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
      const payload = eventsOf('activity:new')[0].payload;
      assert.equal(payload.userId.toString(), user._id.toString(), 'acteur = le compte patient lui-même (route publique, pas de req.user)');
    });

    await t.test('activateAdmin() → activity:new + dashboard:refresh', async () => {
      const patient = await Patient.create({ nom: 'AdminAct', prenom: 'G2', date_naissance: '1990-01-01', sexe: 'M', actif: false, statut: 'inactif' });
      created.patients.push(patient);
      emitted.length = 0;

      const { status } = await call(patientsC.activateAdmin, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(eventsOf('activity:new').length, 1);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
    });

    await t.test('update() → dashboard:refresh SEUL (pas emitActivity, modification routinière)', async () => {
      const patient = await Patient.create({ nom: 'Update', prenom: 'G2', date_naissance: '1990-01-01', sexe: 'F' });
      created.patients.push(patient);
      emitted.length = 0;

      const { status } = await call(patientsC.update, { params: { id: patient._id.toString() }, body: { telephone: '060000000' }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(eventsOf('activity:new').length, 0, 'update() ne doit pas polluer le flux activité pour une modif routinière');
      assert.equal(eventsOf('dashboard:refresh').length, 1);
    });

    await t.test('remove() branche désactivation (historique existant) → activity:new + dashboard:refresh', async () => {
      const patient = await Patient.create({ nom: 'Deactiv', prenom: 'G2', date_naissance: '1990-01-01', sexe: 'F' });
      created.patients.push(patient);
      const Consultation = require('../models/Consultation');
      const consult = await Consultation.create({ patient: patient._id, medecin: staff._id, date_consultation: new Date(), type_consultation: 'nouvelle_visite', service: 'Médecine Générale' });
      emitted.length = 0;

      const { status, body } = await call(patientsC.remove, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.deactivated, true);
      assert.equal(eventsOf('activity:new').length, 1);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
      await Consultation.findByIdAndDelete(consult._id);
    });

    await t.test('remove() branche suppression réelle (aucun historique) → activity:new + dashboard:refresh', async () => {
      const patient = await Patient.create({ nom: 'DeleteReal', prenom: 'G2', date_naissance: '1990-01-01', sexe: 'M' });
      emitted.length = 0;

      const { status, body } = await call(patientsC.remove, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.message, 'Patient supprimé.');
      assert.equal(eventsOf('activity:new').length, 1);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
      // déjà supprimé par remove() lui-même — rien à nettoyer dans `created`.
    });

    await t.test('uploadPhoto() → dashboard:refresh SEUL (pas emitActivity)', async () => {
      const patient = await Patient.create({ nom: 'Photo', prenom: 'G2', date_naissance: '1990-01-01', sexe: 'F' });
      created.patients.push(patient);
      emitted.length = 0;

      // MIGRATION-CLOUDINARY — req.file.buffer (multer memoryStorage), plus
      // de filename généré côté disque. Force le repli disque local même si
      // CLOUDINARY_* est réellement configuré dans le .env de cette machine.
      const { status, body } = await withLocalUploadFallback(() => call(patientsC.uploadPhoto, { params: { id: patient._id.toString() }, file: { originalname: `g2-photo-${stamp}.jpg`, buffer: Buffer.from('img') }, user: staff, ip: '127.0.0.1' }));
      assert.equal(status, 200);
      assert.equal(eventsOf('activity:new').length, 0);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
      await fs.promises.unlink(path.join(__dirname, '..', body.photo)).catch(() => {});
    });
  } finally {
    setIO(null);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id).catch(() => {});
    await mongoose.disconnect();
  }
});
