// T3.4 — verrouillage de compte après échecs répétés + complexité minimale
// du mot de passe. Base réelle, compte de test créé et nettoyé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('verrouillage de compte et politique de mot de passe (T3.4)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const authController = require('../controllers/auth.controller');

  const mkRes = () => {
    const res = { _status: 200, _body: null, status: (c) => { res._status = c; return res; }, json: (d) => { res._body = d; } };
    return res;
  };

  await t.test('5 échecs consécutifs verrouillent le compte ; la 6e tentative échoue même avec le bon mot de passe', async () => {
    const email = `_t34-lockout-${Date.now()}@_test.local`;
    const goodPassword = 'BonMotDePasse1!';
    const user = await User.create({ email, password: goodPassword, nom: 'Test', prenom: 'T34', role: 'receptionniste' });

    try {
      for (let i = 1; i <= 5; i++) {
        const res = mkRes();
        await authController.login({ body: { email, password: 'mauvais-mdp' }, ip: '127.0.0.1', headers: {} }, res, () => {});
        assert.equal(res._status, 401, `tentative ${i} : attendu 401`);
      }

      const reloaded = await User.findOne({ email });
      assert.equal(reloaded.tentatives_echouees, 5);
      assert.ok(reloaded.verrouille_jusqu_a > new Date(), 'le compte doit être verrouillé après 5 échecs');

      // 6e tentative — avec le BON mot de passe cette fois : doit être refusée quand même.
      const res6 = mkRes();
      await authController.login({ body: { email, password: goodPassword }, ip: '127.0.0.1', headers: {} }, res6, () => {});
      assert.equal(res6._status, 423, 'un compte verrouillé doit refuser même le bon mot de passe');

      // Simule l'expiration du verrou (sans attendre 15 minutes réelles) :
      // la connexion avec le bon mot de passe doit alors réussir.
      await User.updateOne({ email }, { verrouille_jusqu_a: new Date(Date.now() - 1000) });
      const resAfterExpiry = mkRes();
      await authController.login({ body: { email, password: goodPassword }, ip: '127.0.0.1', headers: {} }, resAfterExpiry, () => {});
      assert.equal(resAfterExpiry._status, 200, 'après expiration du verrou, le bon mot de passe doit fonctionner');

      const afterSuccess = await User.findOne({ email });
      assert.equal(afterSuccess.tentatives_echouees, 0, 'une connexion réussie doit remettre le compteur à zéro');
      assert.equal(afterSuccess.verrouille_jusqu_a, null);
    } finally {
      await User.findByIdAndDelete(user._id);
    }
  });

  await t.test('un mot de passe sans majuscule ni chiffre est rejeté', async () => {
    const email = `_t34-complexity-${Date.now()}@_test.local`;
    await assert.rejects(
      User.create({ email, password: 'toutminuscule', nom: 'Test', prenom: 'T34', role: 'receptionniste' }),
      /majuscule/i
    );
    await User.deleteOne({ email }); // au cas où (ne devrait rien avoir créé)
  });

  await t.test('un save() sans rapport (ex. derniere_connexion) ne re-déclenche pas la validation de complexité sur un hash déjà stocké', async () => {
    const email = `_t34-resave-${Date.now()}@_test.local`;
    const user = await User.create({ email, password: 'BonMotDePasse1!', nom: 'Test', prenom: 'T34', role: 'receptionniste' });
    try {
      user.derniere_connexion = new Date();
      await assert.doesNotReject(user.save());
    } finally {
      await User.findByIdAndDelete(user._id);
    }
  });

  t.after(async () => { await mongoose.disconnect(); });
});
