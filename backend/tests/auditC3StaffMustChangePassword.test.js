// Ticket 0003 (C3) — must_change_password était déjà positionné à la
// création d'un compte staff (hr.controller.js) et déjà renvoyé par
// /auth/login et /auth/me, mais rien ne le remettait jamais à false, et rien
// côté frontend ne bloquait la navigation avant son changement (contrairement
// au portail patient, Portal.jsx). Ce test couvre la partie backend
// mécanique : PUT /auth/password doit désormais retomber must_change_password
// à false après un changement réussi, comme portal.controller.js::
// changePassword le fait déjà côté portail.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Ticket 0003 (C3) — PUT /auth/password retombe must_change_password à false (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const authC = require('../controllers/auth.controller');

  const stamp = Date.now();
  const created = { users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const cookieRes = { cookie: () => cookieRes, json: (d) => { body = d; } };
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; }, cookie: () => res };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const user = await User.create({
      email: `t-c3-${stamp}@medisync.test`, password: 'TempPass123!',
      nom: 'Test', prenom: 'C3', role: 'infirmier',
      must_change_password: true,
    });
    created.users.push(user._id);

    await t.test('mot de passe actuel incorrect — refusé, must_change_password inchangé', async () => {
      const { status } = await call(authC.updatePassword, {
        user: { _id: user._id }, body: { currentPassword: 'MauvaisMdp', newPassword: 'NouveauPass456!' }, ip: '127.0.0.1',
      });
      assert.equal(status, 401);
      const fresh = await User.findById(user._id);
      assert.equal(fresh.must_change_password, true);
    });

    await t.test('changement réussi — must_change_password retombe à false, nouveau mot de passe actif', async () => {
      const { status, body } = await call(authC.updatePassword, {
        user: { _id: user._id }, body: { currentPassword: 'TempPass123!', newPassword: 'NouveauPass456!' }, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.user.must_change_password, false);

      const fresh = await User.findById(user._id).select('+password');
      assert.equal(fresh.must_change_password, false);
      assert.ok(await fresh.matchPassword('NouveauPass456!'), 'le nouveau mot de passe doit fonctionner');
      assert.ok(!(await fresh.matchPassword('TempPass123!')), 'l\'ancien mot de passe ne doit plus fonctionner');
    });
  } finally {
    for (const id of created.users) await User.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
