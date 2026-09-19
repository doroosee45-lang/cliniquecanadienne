// AUDIT-20-9 (19 sept. 2026, audit indépendant) —
// hr.controller.js::leave et updateLeaveStatus avaient deux bugs distincts,
// de sévérité très différente :
//
// (a) exports.leave — staff.conges.push(...) + staff.save(). Simple push()
//     en fin de tableau, RBAC-gated (la lecture initiale sert aussi au
//     contrôle staff.utilisateur, conservée telle quelle et exécutée AVANT
//     toute écriture ; seule l'écriture est convertie en $push atomique).
//     Comme pour les 7 cas non-prouvés d'AUDIT-20-8 (pure trailing push,
//     par opposition à la mutation d'un élément EXISTANT), une
//     reproduction sérieuse (N=40 soumissions concurrentes sur le même
//     employé, puis 15 paires leave×addSchedule en Promise.all unique)
//     n'a PRODUIT AUCUNE VersionError ni aucune perte, y compris sur base
//     réelle. Corrigé quand même par cohérence de style avec le reste du
//     chantier — sans preuve de régression réellement corrigée.
//
// (b) updateLeaveStatus — CONFIRMÉ ET REPRODUIT, contrairement à (a) :
//     if (conge.statut !== 'en_attente') était lu-puis-vérifié-puis-écrit
//     sans garantie atomique (mutation d'un élément EXISTANT via .id(sid),
//     même catégorie qu'updateExamen/updateTraitement AUDIT-20-6/7). Deux
//     bugs concrets reproduits sur mongod local à faible latence :
//       - 8 approbations concurrentes de LA MÊME demande → les 8 ont
//         réussi (200) au lieu d'une seule, le contrôle "déjà traitée"
//         entièrement contourné sous concurrence.
//       - 2 approbations concurrentes de DEUX demandes DISTINCTES du même
//         employé (3 jours + 5 jours, solde initial 20) → conges_restants
//         final observé à 15 au lieu de 12 attendu (un des deux
//         décréments perdu, .save() écrasant l'autre).
//     Corrigé avec le même motif que Room.findOneAndUpdate
//     (hospitalization.controller.js) : $elemMatch sur l'état actuel du
//     sous-document dans le FILTRE de la requête (jamais une lecture
//     préalable) + $[elem] positionnel pour l'écriture ciblée + $inc
//     atomique pour conges_restants (jamais de perte, y compris entre
//     deux congés distincts approuvés en parallèle) + clamp à 0 via $max
//     en seconde opération atomique si le solde passerait sous zéro.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message, name: err.name }; } });
  return { status, body };
};

test('AUDIT-20-9 — hr.controller.js::leave/updateLeaveStatus atomiques sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const hrC = require('../controllers/hr.controller');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Test', nom: 'Concurrence' };
  const employe = { _id: new mongoose.Types.ObjectId(), role: 'infirmier', prenom: 'Test', nom: 'Employe' };
  const created = [];

  try {
    await t.test('updateLeaveStatus — deux approbations concurrentes de la MÊME demande → une seule réussit (200), le reste refuse proprement (400), conges_restants décrémenté une seule fois', async () => {
      const staff = await Staff.create({ nom: `Audit20-9-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', conges_restants: 20 });
      created.push(staff._id);

      const noop = { status: () => ({ json: () => {} }), json: () => {} };
      await hrC.leave({ params: { id: staff._id.toString() }, user: admin, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-05', motif: 'Vacances' } }, noop, () => {});
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[0]._id.toString();
      assert.equal(fresh.conges[0].nb_jours, 5);

      const N = 8;
      const results = await Promise.all(Array.from({ length: N }, () =>
        call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId }, user: admin, body: { statut: 'approuve' } })
      ));
      const succes = results.filter(r => r.status === 200).length;
      const echecs = results.filter(r => r.status === 400).length;
      assert.equal(succes, 1, `exactement 1 approbation doit réussir sur ${N} tentatives concurrentes de la même demande — obtenu ${succes}`);
      assert.equal(echecs, N - 1, 'toutes les autres doivent être refusées proprement avec "déjà traitée"');

      const after = await Staff.findById(staff._id);
      assert.equal(after.conges.id(congeId).statut, 'approuve');
      assert.equal(after.conges_restants, 15, `20 - 5 jours, décrémenté une seule fois malgré ${N} tentatives concurrentes — obtenu ${after.conges_restants}`);
    });

    await t.test('updateLeaveStatus — deux demandes DISTINCTES approuvées en parallèle sur le même employé → les deux réussissent, conges_restants décrémenté de la somme exacte, jamais un décrément perdu', async () => {
      const staff = await Staff.create({ nom: `Audit20-9B-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', conges_restants: 20 });
      created.push(staff._id);

      const noop = { status: () => ({ json: () => {} }), json: () => {} };
      await hrC.leave({ params: { id: staff._id.toString() }, user: admin, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-03', motif: 'x' } }, noop, () => {}); // 3 jours
      await hrC.leave({ params: { id: staff._id.toString() }, user: admin, body: { type: 'maladie', date_debut: '2026-09-10', date_fin: '2026-09-14', motif: 'y' } }, noop, () => {}); // 5 jours
      const fresh = await Staff.findById(staff._id);
      const [c1, c2] = fresh.conges.map(c => c._id.toString());

      const [r1, r2] = await Promise.all([
        call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId: c1 }, user: admin, body: { statut: 'approuve' } }),
        call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId: c2 }, user: admin, body: { statut: 'approuve' } }),
      ]);
      assert.equal(r1.status, 200, JSON.stringify(r1.body));
      assert.equal(r2.status, 200, JSON.stringify(r2.body));

      const after = await Staff.findById(staff._id);
      assert.equal(after.conges_restants, 12, `20 - 3 - 5 = 12, les deux décréments concurrents doivent tous deux s'appliquer — obtenu ${after.conges_restants}`);
    });

    await t.test('updateLeaveStatus — non-régression : clamp à 0 quand le solde est insuffisant', async () => {
      const staff = await Staff.create({ nom: `Audit20-9C-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', conges_restants: 2 });
      created.push(staff._id);
      const noop = { status: () => ({ json: () => {} }), json: () => {} };
      await hrC.leave({ params: { id: staff._id.toString() }, user: admin, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-10', motif: 'x' } }, noop, () => {}); // 10 jours
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[0]._id.toString();

      const { status, body } = await call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId }, user: admin, body: { statut: 'approuve' } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.staff.conges_restants, 0, 'clampé à 0, jamais négatif, comme Math.max(0, ...) dans l\'ancien code');
    });

    await t.test('updateLeaveStatus — non-régression : refuser ne décrémente jamais conges_restants', async () => {
      const staff = await Staff.create({ nom: `Audit20-9D-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', conges_restants: 20 });
      created.push(staff._id);
      const noop = { status: () => ({ json: () => {} }), json: () => {} };
      await hrC.leave({ params: { id: staff._id.toString() }, user: admin, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-05', motif: 'x' } }, noop, () => {});
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[0]._id.toString();

      const { status } = await call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId }, user: admin, body: { statut: 'refuse' } });
      assert.equal(status, 200);
      const after = await Staff.findById(staff._id);
      assert.equal(after.conges_restants, 20, 'inchangé — seule une approbation décompte');
    });

    await t.test('updateLeaveStatus — non-régression : 404 staff / 404 congé / 400 statut invalide distincts', async () => {
      const staff = await Staff.create({ nom: `Audit20-9E-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif' });
      created.push(staff._id);
      const fauxStaff = new mongoose.Types.ObjectId().toString();
      const fauxConge = new mongoose.Types.ObjectId().toString();

      const r1 = await call(hrC.updateLeaveStatus, { params: { id: fauxStaff, congeId: fauxConge }, user: admin, body: { statut: 'approuve' } });
      assert.equal(r1.status, 404);
      assert.match(r1.body.message, /Personnel introuvable/);

      const r2 = await call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId: fauxConge }, user: admin, body: { statut: 'approuve' } });
      assert.equal(r2.status, 404);
      assert.match(r2.body.message, /congé introuvable/);

      const r3 = await call(hrC.updateLeaveStatus, { params: { id: staff._id.toString(), congeId: fauxConge }, user: admin, body: { statut: 'invalide' } });
      assert.equal(r3.status, 400);
    });

    await t.test('leave — N soumissions concurrentes sur le même employé → toutes persistées, aucune perdue', async () => {
      const staff = await Staff.create({ nom: `Audit20-9F-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif' });
      created.push(staff._id);
      const N = 8;
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(hrC.leave, { params: { id: staff._id.toString() }, user: admin, body: { type: 'annuel', date_debut: `2026-09-0${(i % 9) + 1}`, date_fin: `2026-09-0${(i % 9) + 1}`, motif: `x${i}` } })
      ));
      for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));
      const fresh = await Staff.findById(staff._id);
      assert.equal(fresh.conges.length, N, `les ${N} demandes doivent toutes être persistées, aucune perdue sous concurrence réelle`);
    });

    await t.test('leave — non-régression RBAC : refus 403 pour un employé qui soumet pour la fiche d\'un autre', async () => {
      const staff = await Staff.create({ nom: `Audit20-9G-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', utilisateur: new mongoose.Types.ObjectId() });
      created.push(staff._id);
      const { status } = await call(hrC.leave, { params: { id: staff._id.toString() }, user: employe, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-02' } });
      assert.equal(status, 403);
      const fresh = await Staff.findById(staff._id);
      assert.equal(fresh.conges.length, 0, 'le 403 doit bloquer avant toute écriture — aucun congé ne doit avoir été inséré');
    });

    await t.test('leave — non-régression RBAC : autorisé pour l\'employé propriétaire de la fiche (isSelf) et pour un admin', async () => {
      const userId = new mongoose.Types.ObjectId();
      const staff = await Staff.create({ nom: `Audit20-9H-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', utilisateur: userId });
      created.push(staff._id);
      const self = { _id: userId, role: 'infirmier', prenom: 'Self', nom: 'Employe' };
      const r1 = await call(hrC.leave, { params: { id: staff._id.toString() }, user: self, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-02' } });
      assert.equal(r1.status, 200, JSON.stringify(r1.body));
      const r2 = await call(hrC.leave, { params: { id: staff._id.toString() }, user: admin, body: { type: 'annuel', date_debut: '2026-09-05', date_fin: '2026-09-06' } });
      assert.equal(r2.status, 200, JSON.stringify(r2.body));
      const fresh = await Staff.findById(staff._id);
      assert.equal(fresh.conges.length, 2);
    });
  } finally {
    for (const id of created) await Staff.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
