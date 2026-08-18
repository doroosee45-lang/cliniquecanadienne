// AUDIT-11 (audit complet post-Phase 10) — settings.controller.js::createUser
// transmettait req.body (moins mot_de_passe/password) quasi tel quel à
// User.create, sans liste blanche — contrairement à updateUser, corrigé lors
// de P2-1. Ce test prouve : (a) les champs légitimes du formulaire réel
// (EMPTY_USER, Administration.jsx) continuent de fonctionner à la création,
// (b) un champ hors liste blanche envoyé dans le même appel n'a aucun effet
// sur le compte créé, (c) le mot de passe soumis sous mot_de_passe est bien
// celui utilisable pour se connecter (non-régression du correctif T5.2).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-11 — mass-assignment bloqué sur settings.controller.js::createUser (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const settingsC = require('../controllers/settings.controller');
  const User = require('../models/User');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  let userId;

  try {
    await t.test('createUser — champs légitimes du formulaire (EMPTY_USER) persistent, mot_de_passe devient un mot de passe utilisable', async () => {
      const email = `_audit11-createuser-${stamp}@_test.local`;
      const { status, body } = await call(settingsC.createUser, {
        body: { prenom: 'Nouveau', nom: 'Compte', email, telephone: '+242061112233', role: 'infirmier', service: 'Urgences', statut: 'actif', mot_de_passe: 'Xx1aaaaa' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      userId = body.user._id;
      cleanup.push(() => User.findByIdAndDelete(userId));

      const fresh = await User.findById(userId).select('+password').lean();
      assert.equal(fresh.prenom, 'Nouveau');
      assert.equal(fresh.role, 'infirmier');
      assert.equal(fresh.service, 'Urgences');
      assert.ok(fresh.password, 'le mot de passe soumis sous mot_de_passe doit être réellement enregistré (non-régression T5.2)');

      const bcrypt = require('bcryptjs');
      assert.ok(await bcrypt.compare('Xx1aaaaa', fresh.password), 'le compte créé doit être utilisable pour se connecter avec le mot de passe saisi');
    });

    await t.test('createUser — un champ hors liste blanche envoyé dans le même appel n\'est jamais persisté', async () => {
      const email2 = `_audit11-createuser2-${stamp}@_test.local`;
      const patientIdFactice = new mongoose.Types.ObjectId();
      const { status, body } = await call(settingsC.createUser, {
        body: {
          prenom: 'Attaquant', nom: 'Test', email: email2, telephone: '', role: 'infirmier', service: '', statut: 'actif', mot_de_passe: 'Xx1aaaaa',
          // Champs hors liste blanche — ne doivent avoir strictement aucun effet.
          must_change_password: false,
          tentatives_echouees: 999,
          patient_id: patientIdFactice,
          verrouille_jusqu_a: new Date(Date.now() + 86400000),
          reset_password_token: 'devrait-etre-ignore',
        },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      const userId2 = body.user._id;
      cleanup.push(() => User.findByIdAndDelete(userId2));

      const fresh = await User.findById(userId2).lean();
      assert.equal(fresh.tentatives_echouees, 0, 'tentatives_echouees ne doit pas être positionnable à la création via cet endpoint');
      assert.equal(fresh.patient_id, null, 'patient_id ne doit pas être positionnable à la création via cet endpoint — empêche un compte staff de se faire passer pour lié à un dossier patient arbitraire');
      assert.equal(fresh.verrouille_jusqu_a, null, 'verrouille_jusqu_a ne doit pas être positionnable à la création via cet endpoint');
      assert.equal(fresh.reset_password_token, undefined, 'reset_password_token ne doit pas être positionnable à la création via cet endpoint');
    });

    await t.test('createUser — role hors liste blanche mais valide reste bien transmis (le rôle N\'EST PAS retiré de la liste blanche, seul le reste l\'est)', async () => {
      const email3 = `_audit11-createuser3-${stamp}@_test.local`;
      const { status, body } = await call(settingsC.createUser, {
        body: { prenom: 'Role', nom: 'Test', email: email3, telephone: '', role: 'medecin', service: '', statut: 'actif', mot_de_passe: 'Xx1aaaaa' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => User.findByIdAndDelete(body.user._id));
      assert.equal(body.user.role, 'medecin', 'role reste un champ légitime du formulaire de création, il doit continuer à fonctionner');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
