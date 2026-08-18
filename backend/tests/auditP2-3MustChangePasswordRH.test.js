// AUDIT-P2-3 (ticket 0003) — deux gaps distincts :
// (1) hr.controller.js::create générait un mot de passe temporaire pour le
//     compte User lié qu'aucune personne ne pouvait connaître (jamais
//     retourné, journalisé, ni emailé) et ne positionnait jamais
//     must_change_password, rendant le compte inutilisable dès sa création.
// (2) settings.controller.js::createUser n'acceptait pas must_change_password
//     dans son payload (absent de la liste blanche AUDIT-11), donc même en
//     le transmettant depuis Administration.jsx, il n'avait aucun effet.
// Piste 3 du ticket (blocage UI équivalent à Portal.jsx côté layout staff,
// App.jsx) reste hors périmètre — collision directe avec l'exclusion
// App.jsx en cours de modification par l'utilisateur.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P2-3 — must_change_password appliqué aux comptes staff RH et transmissible via createUser (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const hrC = require('../controllers/hr.controller');
  const settingsC = require('../controllers/settings.controller');
  const Staff = require('../models/Staff');
  const User = require('../models/User');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('hr.create() avec email — must_change_password=true et mot de passe temporaire renvoyé dans la réponse', async () => {
      const email = `_p23-hr-${stamp}@_test.local`;
      const { status, body } = await call(hrC.create, {
        body: { prenom: 'Nouveau', nom: 'Employe', email, poste: 'infirmier', statut: 'actif' },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => Staff.findByIdAndDelete(body.staff._id));

      const user = await User.findOne({ email });
      assert.ok(user, 'un compte User doit être créé quand un email est fourni');
      cleanup.push(() => User.findByIdAndDelete(user._id));

      assert.equal(user.must_change_password, true, 'must_change_password doit être forcé pour un compte staff créé via RH');
      assert.ok(body.temp_password, 'le mot de passe généré doit être renvoyé dans la réponse HTTP — sinon aucune personne ne peut le connaître');
      assert.match(body.temp_password, /^Clinique[0-9a-f]{8}!$/);

      // Le mot de passe renvoyé doit être le mot de passe réel du compte créé.
      const withPassword = await User.findById(user._id).select('+password');
      const bcrypt = require('bcryptjs');
      assert.ok(await bcrypt.compare(body.temp_password, withPassword.password), 'le mot de passe renvoyé doit correspondre au hash stocké');
    });

    await t.test('hr.create() sans email — aucun compte User, temp_password absent', async () => {
      const { status, body } = await call(hrC.create, {
        body: { prenom: 'SansEmail', nom: `Employe${stamp}`, poste: 'infirmier', statut: 'actif' },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => Staff.findByIdAndDelete(body.staff._id));
      assert.equal(body.temp_password, undefined);
    });

    await t.test('settings.createUser() — must_change_password transmis dans le payload est désormais persisté', async () => {
      const { status, body } = await call(settingsC.createUser, {
        body: {
          prenom: 'Force', nom: 'Changement', email: `_p23-createuser-${stamp}@_test.local`,
          telephone: '', role: 'infirmier', service: '', statut: 'actif',
          mot_de_passe: 'Xx1aaaaa', must_change_password: true,
        },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => User.findByIdAndDelete(body.user._id));

      const fresh = await User.findById(body.user._id).lean();
      assert.equal(fresh.must_change_password, true, 'la case à cocher doit maintenant avoir un effet réel — c\'était le gap identifié par le ticket 0003');
    });

    await t.test('settings.createUser() — must_change_password omis reste au défaut (false), pas de régression', async () => {
      const { status, body } = await call(settingsC.createUser, {
        body: {
          prenom: 'Defaut', nom: 'Standard', email: `_p23-createuser-defaut-${stamp}@_test.local`,
          telephone: '', role: 'infirmier', service: '', statut: 'actif', mot_de_passe: 'Xx1aaaaa',
        },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => User.findByIdAndDelete(body.user._id));

      const fresh = await User.findById(body.user._id).lean();
      assert.equal(fresh.must_change_password, false);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
