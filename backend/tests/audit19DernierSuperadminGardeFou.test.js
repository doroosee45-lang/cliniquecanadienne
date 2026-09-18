// AUDIT-19-6 (18 sept. 2026, audit indépendant) —
// utils/permissions.js::enforceSuperadminSafeguard protège déjà la MATRICE
// de permissions du rôle superadmin (impossible de lui retirer une
// permission), mais aucune garde équivalente n'existait pour les COMPTES
// superadmin eux-mêmes : settings.controller.js::updateUser (rétrograder le
// rôle ou changer le statut) et deactivateUser pouvaient tous deux
// verrouiller le dernier compte superadmin actif — par erreur de
// manipulation ou via un compte compromis — sans aucune vérification,
// plus personne ne pouvant alors créer de compte ni gérer les permissions.
// Corrigé par refuseIfDernierSuperadminActif() : refuse (409) uniquement
// quand la cible EST le dernier superadmin actif ET que le changement
// demandé lui ferait perdre ce statut ; n'importe quel autre cas
// (superadmin non-dernier, cible non-superadmin, changement qui ne touche
// ni role ni statut) reste inchangé.
//
// Données synthétiques de démonstration — aucune donnée réelle. Compte tenu
// de comptes superadmin réels potentiellement déjà présents dans cette
// base partagée, chaque scénario isole explicitement son propre groupe de
// comptes (désactive tout superadmin réel externe n'est jamais fait ici).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
  return { status, body };
};

test('AUDIT-19-6 — garde-fou dernier compte superadmin actif (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const settingsC = require('../controllers/settings.controller');
  const mailModule = require('../utils/mail');

  // Même pattern que auditA4NotifChangementRoleStatut.test.js — SMTP réel
  // configuré dans cet environnement : sans ce stub, le passage à
  // statut:'inactif' déclenche un envoi réel vers les adresses factices
  // *_@_test.local, rejeté par le relais, faisant échouer next(err) avant
  // même le res.json() — sans rapport avec le garde-fou testé ici.
  const originalSendAccountSuspendedEmail = mailModule.sendAccountSuspendedEmail;
  mailModule.sendAccountSuspendedEmail = async () => ({ simulated: true });
  const originalSendAccountDeactivatedEmail = mailModule.sendAccountDeactivatedEmail;
  mailModule.sendAccountDeactivatedEmail = async () => ({ simulated: true });

  const stamp = Date.now();
  const created = [];
  const requester = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };

  try {
    await t.test('updateUser — rétrograder le rôle de l\'UNIQUE superadmin actif du groupe testé est refusé (409) tant qu\'aucun autre superadmin actif réel n\'existe', async (st) => {
      // Neutralise la variable de confusion : compte le nombre réel de
      // superadmins actifs déjà en base AVANT ce sous-test. S'il y en a
      // déjà au moins un (compte réel de production), la rétrogradation
      // d'un compte synthétique supplémentaire ne serait jamais bloquée
      // (comportement correct : ce n'est alors jamais le dernier) — ce cas
      // est donc explicitement skip pour rester déterministe, plutôt que
      // de fabriquer un faux positif ou de désactiver un compte réel.
      const superadminsReelsActifs = await User.countDocuments({ role: 'superadmin', statut: 'actif' });
      if (superadminsReelsActifs > 0) {
        st.skip(`${superadminsReelsActifs} superadmin(s) actif(s) réel(s) déjà en base — le compte synthétique ne peut jamais être "le dernier" dans ce contexte, scénario non déterministe, skip volontaire plutôt que fabriqué`);
        return;
      }
      const seulSuperadmin = await User.create({ email: `_audit19-6-a-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Seul', prenom: 'Superadmin', role: 'superadmin', statut: 'actif' });
      created.push(seulSuperadmin._id);

      const { status, body } = await call(settingsC.updateUser, { params: { id: seulSuperadmin._id.toString() }, body: { role: 'adminclinique' }, user: requester, ip: '127.0.0.1' });
      assert.equal(status, 409, JSON.stringify(body));
      assert.match(body.message, /dernier compte superadmin actif/);

      const fresh = await User.findById(seulSuperadmin._id).lean();
      assert.equal(fresh.role, 'superadmin', 'le rôle ne doit jamais avoir été modifié par la tentative bloquée');
    });

    await t.test('non-régression — rétrograder un superadmin QUAND un autre superadmin actif existe réussit toujours', async () => {
      const a = await User.create({ email: `_audit19-6-b1-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B1', prenom: 'Superadmin', role: 'superadmin', statut: 'actif' });
      const b = await User.create({ email: `_audit19-6-b2-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B2', prenom: 'Superadmin', role: 'superadmin', statut: 'actif' });
      created.push(a._id, b._id);

      const { status, body } = await call(settingsC.updateUser, { params: { id: a._id.toString() }, body: { role: 'adminclinique' }, user: requester, ip: '127.0.0.1' });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.user.role, 'adminclinique');
    });

    await t.test('deactivateUser — désactiver un superadmin QUAND un autre superadmin actif existe réussit toujours', async () => {
      const a = await User.create({ email: `_audit19-6-c1-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'C1', prenom: 'Superadmin', role: 'superadmin', statut: 'actif' });
      const b = await User.create({ email: `_audit19-6-c2-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'C2', prenom: 'Superadmin', role: 'superadmin', statut: 'actif' });
      created.push(a._id, b._id);

      const { status, body } = await call(settingsC.deactivateUser, { params: { id: a._id.toString() }, user: requester, ip: '127.0.0.1' });
      assert.equal(status, 200, JSON.stringify(body));

      const fresh = await User.findById(a._id).lean();
      assert.equal(fresh.statut, 'inactif');
    });

    await t.test('non-régression — modifier un champ qui ne touche ni role ni statut sur un superadmin (même seul) reste toujours autorisé', async () => {
      const superadminsReelsActifs = await User.countDocuments({ role: 'superadmin', statut: 'actif' });
      const seul = await User.create({ email: `_audit19-6-d-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'D', prenom: 'Superadmin', role: 'superadmin', statut: superadminsReelsActifs > 0 ? 'inactif' : 'actif' });
      created.push(seul._id);

      const { status, body } = await call(settingsC.updateUser, { params: { id: seul._id.toString() }, body: { telephone: '+242060000099' }, user: requester, ip: '127.0.0.1' });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.user.telephone, '+242060000099');
    });

    await t.test('non-régression — le garde-fou ne s\'applique jamais à un compte non-superadmin', async () => {
      const medecin = await User.create({ email: `_audit19-6-e-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'E', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
      created.push(medecin._id);

      const { status, body } = await call(settingsC.updateUser, { params: { id: medecin._id.toString() }, body: { statut: 'inactif' }, user: requester, ip: '127.0.0.1' });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.user.statut, 'inactif');
    });
  } finally {
    mailModule.sendAccountSuspendedEmail = originalSendAccountSuspendedEmail;
    mailModule.sendAccountDeactivatedEmail = originalSendAccountDeactivatedEmail;
    await User.deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
  }
});
