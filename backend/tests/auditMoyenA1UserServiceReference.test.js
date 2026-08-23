// AUDIT-M-A1 (Groupe A, Point 1) — User.service était une chaîne libre
// alimentée par une liste de 12 noms codée en dur côté frontend
// (Administration.jsx), déconnectée de la vraie collection Service —
// pendant que Staff.service était déjà une vraie référence (chantier HR
// précédent, Point 3). Constaté sur la base réelle avant correctif : 0/46
// comptes non-patients avaient User.service renseigné, alors que les 14
// fiches Staff existantes l'avaient toutes. Migré en vraie référence
// (ObjectId ref Service), formulaire corrigé (settings.controller.js::
// getUsers résout désormais un service_effectif : Staff.service prioritaire
// via la liaison Staff.utilisateur quand elle existe, User.service en repli
// seulement pour les comptes sans fiche Staff — jamais les deux affichés
// séparément, jamais de conflit à arbitrer). Option 3 validée avec
// l'utilisateur avant code.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-M-A1 — User.service référence réelle, résolution prioritaire via Staff.service (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Staff = require('../models/Staff');
  const Service = require('../models/Service');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const created = { users: [], staff: [], services: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };

  try {
    const svcA = await Service.create({ nom: `Cardiologie ${stamp}` });
    const svcB = await Service.create({ nom: `Pédiatrie ${stamp}` });
    created.services.push(svcA, svcB);

    await t.test('createUser — service est une vraie référence, peuplée dans la réponse', async () => {
      const email = `_a1-create-${stamp}@_test.local`;
      const { status, body } = await call(settingsC.createUser, {
        body: { prenom: 'A1', nom: 'Create', email, telephone: '', role: 'medecin', service: svcA._id.toString(), statut: 'actif', mot_de_passe: 'Xx1aaaaa' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.users.push(body.user._id);
      assert.equal(body.user.service.nom, svcA.nom, 'service doit être peuplé (nom), pas juste un ObjectId brut');

      const fresh = await User.findById(body.user._id).lean();
      assert.equal(fresh.service.toString(), svcA._id.toString(), 'la référence doit être réellement persistée en base');
    });

    await t.test('createUser — une chaîne vide (aucune sélection) efface la référence, pas de CastError', async () => {
      const email = `_a1-empty-${stamp}@_test.local`;
      const { status, body } = await call(settingsC.createUser, {
        body: { prenom: 'A1', nom: 'Empty', email, telephone: '', role: 'infirmier', service: '', statut: 'actif', mot_de_passe: 'Xx1aaaaa' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, 'une chaîne vide ne doit jamais provoquer une CastError sur ce champ ObjectId');
      created.users.push(body.user._id);
      assert.equal(body.user.service, null);
    });

    await t.test('getUsers — un compte SANS fiche Staff retombe sur son propre User.service', async () => {
      const email = `_a1-nostaff-${stamp}@_test.local`;
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'NoStaff', prenom: 'A1', role: 'medecin', statut: 'actif', service: svcA._id });
      created.users.push(user._id);

      const { body } = await call(settingsC.getUsers, {});
      const found = body.users.find(u => u._id.toString() === user._id.toString());
      assert.ok(found, 'le compte doit apparaître dans la liste');
      assert.equal(found.service_effectif?.nom, svcA.nom, 'sans fiche Staff liée, service_effectif doit retomber sur le propre User.service');
    });

    await t.test('getUsers — un compte AVEC fiche Staff liée privilégie Staff.service, jamais un conflit avec User.service', async () => {
      const email = `_a1-withstaff-${stamp}@_test.local`;
      // User.service = svcA (délibérément différent de Staff.service ci-dessous)
      // pour prouver que Staff.service gagne bien, jamais les deux exposés.
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'WithStaff', prenom: 'A1', role: 'medecin', statut: 'actif', service: svcA._id });
      created.users.push(user._id);
      const staff = await Staff.create({ utilisateur: user._id, prenom: 'A1', nom: 'WithStaff', poste: 'Médecin généraliste', service: svcB._id, statut: 'actif' });
      created.staff.push(staff._id);

      const { body } = await call(settingsC.getUsers, {});
      const found = body.users.find(u => u._id.toString() === user._id.toString());
      assert.ok(found);
      assert.equal(found.service_effectif?.nom, svcB.nom, 'Staff.service (svcB) doit être la valeur résolue, jamais User.service (svcA) quand une fiche Staff est liée');
      assert.notEqual(found.service_effectif?.nom, svcA.nom, 'les deux valeurs ne doivent jamais être exposées séparément — une seule, sans ambiguïté');
    });

    await t.test('updateUser — met à jour la référence, jamais de désynchronisation avec Staff quand aucune fiche n\'est liée', async () => {
      const email = `_a1-update-${stamp}@_test.local`;
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'Update', prenom: 'A1', role: 'medecin', statut: 'actif', service: svcA._id });
      created.users.push(user._id);

      const { status, body } = await call(settingsC.updateUser, {
        params: { id: user._id },
        body: { prenom: 'A1', nom: 'Update', email, telephone: '', role: 'medecin', service: svcB._id.toString(), statut: 'actif' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.user.service.nom, svcB.nom);

      const fresh = await User.findById(user._id).lean();
      assert.equal(fresh.service.toString(), svcB._id.toString());
    });
  } finally {
    for (const id of created.staff) await Staff.findByIdAndDelete(id);
    for (const id of created.users) await User.findByIdAndDelete(id);
    for (const s of created.services) await Service.findByIdAndDelete(s._id);
    await mongoose.disconnect();
  }
});
