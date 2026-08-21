// Phase 3 §3.5(a) — Test de non-régression forgot-password / reset-password.
// Vérifie en conditions réelles (HTTP, contrôleur réel, DB réelle) que :
//   1. la réponse de /forgot-password est identique (message + statut) que
//      l'email existe ou non, sans fuite d'information sur l'existence du
//      compte (auth.controller.js:44-47) ;
//   2. un token de reset valide permet effectivement de changer le mot de
//      passe, invalide le token après usage, et permet de se reconnecter
//      avec le nouveau mot de passe ;
//   3. un token expiré ou inconnu est rejeté (400).
//
// AUDIT-0 (gap "base de test indépendante") — dépendait jusqu'ici d'un
// serveur de développement ambiant (localhost:5000) déjà lancé et branché
// sur la MÊME base que ce test — coïncidence qui ne tient plus une fois les
// tests basculés sur un mongod local isolé (utils/run-tests-local-db.js).
// Démarre désormais sa propre instance dédiée (serveur + mongod isolé),
// comme accessMatrix.test.js / googleAutoSignup.test.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

test('forgot-password / reset-password : réponse uniforme, token à usage unique, rejet si invalide', { skip: !mongodExists() && 'mongod introuvable — impossible de démarrer un serveur isolé pour ce test' }, async (t) => {
  const server = await startIsolatedServer();
  const BASE = server.baseUrl;
  let user;

  try {
    await mongoose.connect(server.mongoUri);
    const User = require('../models/User');

    const email = '_password-reset-test@_test.local';
    await User.deleteOne({ email });
    user = await User.create({
      email, password: 'AncienMdp1', nom: 'Test', prenom: 'ResetFlow',
      role: 'patient', statut: 'actif',
    });

    // 1. Réponse identique, email existant ou non (pas de fuite d'énumération de comptes).
    const resExisting = await fetch(`${BASE}/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const bodyExisting = await resExisting.json();

    const resUnknown = await fetch(`${BASE}/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '_password-reset-test-unknown@_test.local' }),
    });
    const bodyUnknown = await resUnknown.json();

    assert.equal(resExisting.status, resUnknown.status);
    assert.equal(bodyExisting.message, bodyUnknown.message);
    assert.equal(bodyExisting.success, true);
    assert.equal(bodyUnknown.success, true);

    // 2. Le contrôleur génère puis pose le token AVANT la tentative d'envoi
    //    (auth.controller.js:49-52), mais le révoque explicitement si le mail
    //    échoue (:56-61) — comportement réel, constaté avec un domaine de
    //    test (_test.local) que le SMTP réel ne peut pas livrer. La réponse
    //    HTTP reste "succès" dans les deux cas (pas de fuite), donc on ne
    //    peut pas dépendre du token posé par cet appel pour la suite du test :
    //    on simule ici l'état "token généré avec succès" directement en DB,
    //    ce que ferait le contrôleur avec un SMTP fonctionnel.
    const token = require('crypto').randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(user._id, {
      reset_password_token: token,
      reset_password_expire: new Date(Date.now() + 60 * 60 * 1000),
    });

    // 3. Token inconnu → rejeté.
    const resBadToken = await fetch(`${BASE}/auth/reset-password/token-inexistant-0000`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NouveauMdp1' }),
    });
    assert.equal(resBadToken.status, 400);

    // 4. Token expiré → rejeté (simulation d'expiration sans attendre 1h réelle).
    await User.findByIdAndUpdate(user._id, { reset_password_expire: new Date(Date.now() - 1000) });
    const resExpired = await fetch(`${BASE}/auth/reset-password/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NouveauMdp1' }),
    });
    assert.equal(resExpired.status, 400);

    // 5. Token valide → changement effectif + connexion possible avec le nouveau mdp.
    await User.findByIdAndUpdate(user._id, { reset_password_expire: new Date(Date.now() + 60 * 60 * 1000) });
    const resValid = await fetch(`${BASE}/auth/reset-password/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NouveauMdp1' }),
    });
    assert.equal(resValid.status, 200);

    const afterReset = await User.findById(user._id).select('+password +reset_password_token +reset_password_expire');
    assert.equal(afterReset.reset_password_token, undefined, 'le token doit être invalidé après usage');
    assert.equal(afterReset.reset_password_expire, undefined);
    assert.ok(await afterReset.matchPassword('NouveauMdp1'), 'le nouveau mot de passe doit être actif');
    assert.ok(!(await afterReset.matchPassword('AncienMdp1')), 'l\'ancien mot de passe ne doit plus fonctionner');

    // 6. Le même token, réutilisé, doit maintenant être rejeté (usage unique).
    const resReplay = await fetch(`${BASE}/auth/reset-password/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'EncoreUnAutre1' }),
    });
    assert.equal(resReplay.status, 400);

    // 7. Connexion réelle avec le nouveau mot de passe.
    const resLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'NouveauMdp1' }),
    });
    assert.equal(resLogin.status, 200);
  } finally {
    if (user) await mongoose.model('User').findByIdAndDelete(user._id);
    await mongoose.disconnect();
    await server.stop();
  }
});
