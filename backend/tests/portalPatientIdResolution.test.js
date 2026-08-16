// R-07 — portal.controller.js résolvait le dossier Patient exclusivement par
// email, malgré l'existence de User.patient_id (T2.2) jamais utilisé côté
// lecture. Migré vers patient_id en priorité, repli sur l'email pour les
// comptes non encore liés (vérifié avant migration : 4 comptes sur 7 dans
// les données réelles — pas un cas rare), avec journalisation d'anomalie si
// patient_id est renseigné mais ne résout plus rien.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('résolution patient_id/email dans portal.controller.js (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const AuditLog = require('../models/AuditLog');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const cleanup = [];
  const call = async (user) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await portalC.getMe({ user }, res, () => {});
    return { status, body };
  };

  try {
    await t.test('patient_id prioritaire — résout même si l\'email ne matcherait aucun dossier', async () => {
      const patient = await Patient.create({ nom: `T07A${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_t07-real-${stamp}@_test.local` });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      // Email du compte volontairement différent de celui du dossier —
      // seule la résolution par patient_id peut réussir ici.
      const user = await User.create({ email: `_t07-userA-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T07A', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(user);
      assert.equal(status, 200);
      assert.equal(String(body.patient._id), String(patient._id));
    });

    await t.test('repli sur l\'email quand patient_id n\'est pas peuplé', async () => {
      const email = `_t07-fallback-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `T07B${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'T07B', prenom: 'U', role: 'patient', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(user);
      assert.equal(status, 200);
      assert.equal(String(body.patient._id), String(patient._id));
    });

    await t.test('patient_id cassé (dossier supprimé) → anomalie journalisée avant le repli', async () => {
      const email = `_t07-broken-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `T07C${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email });
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'T07C', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));
      // Dossier supprimé APRÈS avoir été lié — simule le cas réel découvert
      // (ticket 0008) : le repli email échoue aussi, puisque le seul
      // Patient à cette adresse vient d'être supprimé. L'important ici
      // n'est pas que le repli "sauve" la requête (il ne le peut pas dans
      // ce cas précis) mais que l'anomalie soit bien journalisée avant
      // l'échec final, pour distinguer ce cas d'un compte jamais lié.
      await Patient.findByIdAndDelete(patient._id);

      const before = await AuditLog.countDocuments({ action: 'DATA_ANOMALY', utilisateur: user._id });
      const { status } = await call(user);
      assert.equal(status, 404, 'aucun dossier ne reste à cette adresse — le repli ne peut pas réussir');
      const after = await AuditLog.countDocuments({ action: 'DATA_ANOMALY', utilisateur: user._id });
      assert.equal(after, before + 1, 'anomalie doit être journalisée avant l\'échec du repli');
    });

    await t.test('ni patient_id ni email ne résolvent → 404 (comptes orphelins, ticket 0008)', async () => {
      const user = await User.create({ email: `_t07-orphan-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T07D', prenom: 'U', role: 'patient', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(user);
      assert.equal(status, 404);
      assert.match(body.message, /introuvable/);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await AuditLog.deleteMany({ action: 'DATA_ANOMALY', module: 'portal', message: { $regex: `_t07-` } });
    await mongoose.disconnect();
  }
});
