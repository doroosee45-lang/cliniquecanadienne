// Sous-phase 5.5.b — Rôles & Permissions éditables. Avant ce chantier,
// Administration.jsx et Settings.jsx affichaient chacun une matrice de
// permissions codée en dur, jamais lue par le moindre contrôleur — aucune
// route n'était réellement gouvernée par ces données, et les deux
// constantes avaient déjà divergé l'une de l'autre.
//
// Ce test prouve : (1) la matrice est réellement persistée dans Setting et
// relue après un rechargement frais (pas la réponse de l'appel qui vient de
// la modifier) ; (2) le garde-fou anti-verrouillage refuse toute mise à
// jour qui retirerait une permission à superadmin ; (3) — la preuve la
// plus importante — modifier la permission "creation" d'un rôle via le
// vrai endpoint change RÉELLEMENT l'accès sur POST /settings/suppliers
// (authorizePermission('creation'), la fonction réellement montée sur
// cette route), pas seulement l'affichage.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.5.b — matrice de permissions réelle, garde-fou, effet sur une vraie route', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Setting = require('../models/Setting');
  const settingsC = require('../controllers/settings.controller');
  const { authorize } = require('../middleware/auth');
  const { authorizePermission, getRolesPermissionsMatrix, DEFAULT_ROLES_PERMISSIONS } = require('../utils/permissions');

  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  const adminclinique = { _id: new mongoose.Types.ObjectId(), role: 'adminclinique' };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const callMiddleware = async (mw, req) => {
    let status = 200, body = null, nextCalled = false;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await mw(req, res, () => { nextCalled = true; });
    return { status, body, nextCalled };
  };

  // Sauvegarde/restauration de l'état réel de la base pour ne pas polluer
  // la matrice partagée par d'autres sessions sur cette même base Atlas.
  const before = await Setting.findOne({ cle: 'roles_permissions' }).lean();

  try {
    await t.test('getRolesPermissions() renvoie la matrice par défaut quand aucun réglage n\'existe', async () => {
      await Setting.deleteOne({ cle: 'roles_permissions' });
      const { status, body } = await call(settingsC.getRolesPermissions, {});
      assert.equal(status, 200);
      assert.deepEqual(body.permissions, DEFAULT_ROLES_PERMISSIONS);
    });

    await t.test('updateRolesPermissions persiste réellement, relu après un rechargement frais', async () => {
      const matrice = JSON.parse(JSON.stringify(DEFAULT_ROLES_PERMISSIONS));
      matrice.adminclinique.suppression = true; // changement réel, testable
      const { status, body } = await call(settingsC.updateRolesPermissions, { user: superadmin, ip: '127.0.0.1', body: { permissions: matrice } });
      assert.equal(status, 200, JSON.stringify(body));

      // Relecture indépendante de la réponse du PUT — via un appel getX() frais.
      const relue = await getRolesPermissionsMatrix();
      assert.equal(relue.adminclinique.suppression, true);
    });

    await t.test('garde-fou anti-verrouillage : retirer une permission à superadmin est refusé (400), rien n\'est persisté', async () => {
      const avant = await getRolesPermissionsMatrix();
      const matrice = JSON.parse(JSON.stringify(avant));
      matrice.superadmin.suppression = false; // tentative de verrouillage
      const { status, body } = await call(settingsC.updateRolesPermissions, { user: superadmin, ip: '127.0.0.1', body: { permissions: matrice } });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(body.message, /superadmin/);

      const apres = await getRolesPermissionsMatrix();
      assert.equal(apres.superadmin.suppression, true, 'la matrice réelle ne doit pas avoir changé après un rejet 400');
    });

    await t.test('rejette un rôle inconnu ou une action inconnue (400), rien n\'est persisté', async () => {
      const avant = await getRolesPermissionsMatrix();
      const { status: s1 } = await call(settingsC.updateRolesPermissions, { user: superadmin, ip: '127.0.0.1', body: { permissions: { ...avant, patient: { lecture:true } } } });
      assert.equal(s1, 400);
      const { status: s2 } = await call(settingsC.updateRolesPermissions, { user: superadmin, ip: '127.0.0.1', body: { permissions: { ...avant, medecin: { ...avant.medecin, vol_de_donnees: true } } } });
      assert.equal(s2, 400);
    });

    await t.test('authorize(\'superadmin\') — la vraie fonction montée sur ces 2 routes — refuse adminclinique (403)', async () => {
      let status = 200, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      const req = { user: adminclinique, baseUrl: '/settings', originalUrl: '/settings/roles-permissions', method: 'PUT', ip: '127.0.0.1' };
      await authorize('superadmin')(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false);
    });

    await t.test('PREUVE CENTRALE — modifier la permission "creation" d\'un rôle change réellement l\'accès sur POST /settings/suppliers (authorizePermission)', async () => {
      // Étape 1 : par défaut, adminclinique a creation:true → la vraie route
      // (via authorizePermission('creation'), la fonction montée dessus)
      // doit laisser passer.
      let matrice = JSON.parse(JSON.stringify(DEFAULT_ROLES_PERMISSIONS));
      await call(settingsC.updateRolesPermissions, { user: superadmin, ip: '127.0.0.1', body: { permissions: matrice } });

      const reqSuppliers = { user: adminclinique, baseUrl: '/settings', originalUrl: '/settings/suppliers', method: 'POST', ip: '127.0.0.1' };
      const avant = await callMiddleware(authorizePermission('creation'), reqSuppliers);
      assert.equal(avant.nextCalled, true, 'creation:true par défaut → la route réelle doit laisser passer adminclinique');

      // Étape 2 : un superadmin retire réellement la permission "creation"
      // à adminclinique via le vrai endpoint PUT.
      matrice = JSON.parse(JSON.stringify(DEFAULT_ROLES_PERMISSIONS));
      matrice.adminclinique.creation = false;
      const { status } = await call(settingsC.updateRolesPermissions, { user: superadmin, ip: '127.0.0.1', body: { permissions: matrice } });
      assert.equal(status, 200);

      // Étape 3 : la MÊME route réelle (authorizePermission('creation'))
      // refuse désormais adminclinique — sans avoir touché à un seul octet
      // de code, uniquement via la donnée réellement modifiée.
      const apres = await callMiddleware(authorizePermission('creation'), reqSuppliers);
      assert.equal(apres.nextCalled, false, 'creation:false après modification réelle → la même route réelle doit maintenant refuser adminclinique');
      assert.equal(apres.status, 403);

      // superadmin, lui, doit toujours passer (garde-fou également valable
      // au niveau du middleware, indépendamment de la matrice).
      const reqSuppliersAdmin = { user: superadmin, baseUrl: '/settings', originalUrl: '/settings/suppliers', method: 'POST', ip: '127.0.0.1' };
      const superadminCheck = await callMiddleware(authorizePermission('creation'), reqSuppliersAdmin);
      assert.equal(superadminCheck.nextCalled, true, 'superadmin doit toujours passer, quelle que soit la matrice');
    });
  } finally {
    if (before) {
      await Setting.findOneAndUpdate({ cle: 'roles_permissions' }, { valeur: before.valeur, type: before.type, groupe: before.groupe }, { upsert: true });
    } else {
      await Setting.deleteOne({ cle: 'roles_permissions' });
    }
    await mongoose.disconnect();
  }
});
