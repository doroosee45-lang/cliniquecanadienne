// AUDIT-ADMIN-P2 — settings.controller.js::createUser/updateUser acceptaient
// n'importe quelle valeur de l'enum User.role, y compris 'patient' : un
// compte créé par ce chemin générique n'a jamais de dossier Patient lié
// (patient_id), contrairement aux 3 vrais chemins de création patient
// (patients.controller.js::create/activateAdmin, googleAuth.controller.js).
// Vérifie que le refus est réel (aucun compte créé / rôle inchangé en base,
// pas seulement un message d'erreur) et que les rôles professionnels
// continuent de fonctionner normalement (non-régression).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Administration Point 2 — createUser/updateUser refusent role:patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const settingsC = require('../controllers/settings.controller');
  const User = require('../models/User');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  const created = { users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('createUser refuse réellement role:patient — aucun compte créé', async () => {
      const email = `t-adminp2-refus-${stamp}@test.local`;
      const { status, body } = await call(settingsC.createUser, {
        body: { prenom: 'X', nom: 'Y', email, role: 'patient', statut: 'actif', mot_de_passe: 'Xx1aaaaa' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 400);
      assert.equal(body.success, false);
      const fresh = await User.findOne({ email });
      assert.equal(fresh, null, 'aucun compte ne doit avoir été créé en base');
    });

    await t.test('createUser continue de fonctionner normalement pour un rôle professionnel (non-régression)', async () => {
      const email = `t-adminp2-ok-${stamp}@test.local`;
      const { status, body } = await call(settingsC.createUser, {
        body: { prenom: 'X', nom: 'Y', email, role: 'infirmier', statut: 'actif', mot_de_passe: 'Xx1aaaaa' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.users.push(body.user._id);
      const fresh = await User.findById(body.user._id).lean();
      assert.equal(fresh.role, 'infirmier');
    });

    await t.test('updateUser refuse réellement de faire passer un compte staff existant à role:patient', async () => {
      const medecin = await User.create({ email: `t-adminp2-target-${stamp}@test.local`, nom: 'Cible', prenom: 'M', role: 'medecin', statut: 'actif' });
      created.users.push(medecin._id);

      const { status, body } = await call(settingsC.updateUser, { params: { id: medecin._id.toString() }, body: { role: 'patient' }, user: superadmin, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);

      const fresh = await User.findById(medecin._id).lean();
      assert.equal(fresh.role, 'medecin', 'le rôle ne doit pas avoir changé en base');
    });

    await t.test('updateUser continue de fonctionner normalement pour un changement de rôle professionnel (non-régression)', async () => {
      const staff = await User.create({ email: `t-adminp2-role-${stamp}@test.local`, nom: 'R', prenom: 'S', role: 'infirmier', statut: 'actif' });
      created.users.push(staff._id);

      const { status } = await call(settingsC.updateUser, { params: { id: staff._id.toString() }, body: { role: 'laborantin' }, user: superadmin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      const fresh = await User.findById(staff._id).lean();
      assert.equal(fresh.role, 'laborantin');
    });
  } finally {
    for (const id of created.users) await User.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
