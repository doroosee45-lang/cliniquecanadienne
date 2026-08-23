// AUDIT-11-8 — Administration.jsx (saveTask/saveSupplier) fabriquait
// systématiquement un enregistrement local factice ("ajouté (local)") car
// aucun routeur ne définissait /admin/tasks ni /admin/suppliers — les deux
// onglets étaient donc toujours vides au chargement (repli silencieux sur
// une liste vide, jamais des données fabriquées, mais rien ne persistait).
// Plan (modèles, routes, rôles, absence de liste blanche, logAction) validé
// avec l'utilisateur avant tout code. Ce test couvre : création réelle,
// changement de statut réel (Tâches), et confirme que GET ne renvoie plus
// silencieusement une liste vide.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-11-8 — /admin/tasks et /admin/suppliers réellement implémentés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Task = require('../models/Task');
  const Supplier = require('../models/Supplier');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const tasksC = require('../controllers/tasks.controller');
  const suppliersC = require('../controllers/suppliers.controller');

  const stamp = Date.now();
  const admin = await User.create({ email: `_h118-admin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin', prenom: 'H118', role: 'adminclinique', statut: 'actif' });
  const assignee = await User.create({ email: `_h118-assignee-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Kouma', prenom: 'Alice', role: 'infirmier', statut: 'actif' });
  const created = { tasks: [], suppliers: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  try {
    await t.test('createTask — persiste réellement, assignee populé, tracé dans AuditLog', async () => {
      const { status, body } = await call(tasksC.createTask, {
        user: admin, ip: '127.0.0.1',
        body: { titre: `T118 Renouveler agrément`, assignee: assignee._id.toString(), priorite: 'haute', categorie: 'administratif', echeance: '2026-12-01', description: 'Test réel' },
      });
      assert.equal(status, 201);
      assert.equal(body.task.titre, 'T118 Renouveler agrément');
      assert.equal(body.task.assignee._id.toString(), assignee._id.toString(), 'assignee doit être une vraie référence populée (nom/prenom), pas une chaîne');
      assert.equal(body.task.assignee.prenom, 'Alice');
      assert.equal(body.task.statut, 'en_attente', 'statut par défaut attendu par le frontend (TASK_STATUT)');
      created.tasks.push(body.task._id);

      const relu = await Task.findById(body.task._id).lean();
      assert.ok(relu, 'la tâche doit être réellement persistée en base');
      assert.equal(relu.assignee.toString(), assignee._id.toString());
      assert.equal(relu.created_by.toString(), admin._id.toString());

      const log = await AuditLog.findOne({ module: 'tasks', action: 'CREATE', entite_id: body.task._id.toString() }).lean();
      assert.ok(log, 'la création doit être tracée dans AuditLog (module tasks)');
    });

    await t.test('getTasks — la liste n\'est plus silencieusement vide (repli 404 supprimé)', async () => {
      const { status, body } = await call(tasksC.getTasks, {});
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.tasks), 'la réponse doit exposer body.tasks (forme attendue par Administration.jsx::loadAll)');
      assert.ok(body.tasks.some(ta => ta._id.toString() === created.tasks[0].toString()), 'la tâche réellement créée doit apparaître dans la liste');
    });

    await t.test('updateStatut — transition réelle persistée, tracée, rejette un statut hors énumération', async () => {
      const taskId = created.tasks[0];
      const { status, body } = await call(tasksC.updateStatut, { params: { id: taskId.toString() }, body: { statut: 'en_cours' }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.task.statut, 'en_cours');

      const relu = await Task.findById(taskId).lean();
      assert.equal(relu.statut, 'en_cours', 'le nouveau statut doit être réellement persisté en base');

      const log = await AuditLog.findOne({ module: 'tasks', action: 'UPDATE', entite_id: taskId.toString() }).lean();
      assert.ok(log, 'le changement de statut doit être tracé dans AuditLog');

      const { status: badStatus, body: badBody } = await call(tasksC.updateStatut, { params: { id: taskId.toString() }, body: { statut: 'valeur-inventee' }, user: admin, ip: '127.0.0.1' });
      assert.equal(badStatus, 400);
      assert.equal(badBody.success, false);

      const { status: notFoundStatus } = await call(tasksC.updateStatut, { params: { id: new mongoose.Types.ObjectId().toString() }, body: { statut: 'termine' }, user: admin, ip: '127.0.0.1' });
      assert.equal(notFoundStatus, 404);
    });

    await t.test('createSupplier — persiste réellement, montant_total/derniere_commande à 0/null (jamais inventés), tracé dans AuditLog', async () => {
      const { status, body } = await call(suppliersC.createSupplier, {
        user: admin, ip: '127.0.0.1',
        body: { nom: `T118 MedPharma`, contact: 'Jean K.', telephone: '+242060000000', email: 'contact@t118.test', adresse: 'Brazzaville', produits: 'Médicaments génériques' },
      });
      assert.equal(status, 201);
      assert.equal(body.supplier.nom, 'T118 MedPharma');
      assert.equal(body.supplier.montant_total, 0, 'montant_total ne doit jamais être inventé — 0 par défaut, pas dérivé de Commande.fournisseur (chaîne libre, aucune relation réelle)');
      assert.ok(body.supplier.derniere_commande == null, 'derniere_commande ne doit jamais être inventée à la création — absente/null, jamais une date fabriquée');
      created.suppliers.push(body.supplier._id);

      const relu = await Supplier.findById(body.supplier._id).lean();
      assert.ok(relu, 'le fournisseur doit être réellement persisté en base');
      assert.equal(relu.created_by.toString(), admin._id.toString());

      const log = await AuditLog.findOne({ module: 'suppliers', action: 'CREATE', entite_id: body.supplier._id.toString() }).lean();
      assert.ok(log, 'la création doit être tracée dans AuditLog (module suppliers)');
    });

    await t.test('getSuppliers — la liste n\'est plus silencieusement vide (repli 404 supprimé)', async () => {
      const { status, body } = await call(suppliersC.getSuppliers, {});
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.suppliers), 'la réponse doit exposer body.suppliers (forme attendue par Administration.jsx::loadAll)');
      assert.ok(body.suppliers.some(s => s._id.toString() === created.suppliers[0].toString()), 'le fournisseur réellement créé doit apparaître dans la liste');
    });
  } finally {
    for (const id of created.tasks) await Task.findByIdAndDelete(id);
    for (const id of created.suppliers) await Supplier.findByIdAndDelete(id);
    await AuditLog.deleteMany({ module: { $in: ['tasks', 'suppliers'] }, entite_id: { $in: [...created.tasks, ...created.suppliers].map(String) } });
    await User.findByIdAndDelete(admin._id);
    await User.findByIdAndDelete(assignee._id);
    await mongoose.disconnect();
  }
});
