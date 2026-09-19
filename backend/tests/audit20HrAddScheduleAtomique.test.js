// AUDIT-20-8 (19 sept. 2026, audit indépendant) —
// hr.controller.js::addSchedule faisait staff.planning.push(...) +
// staff.save() — même PATTERN de code que le reste de ce chantier
// (AUDIT-20-6/7).
//
// PRÉCISION IMPORTANTE, à ne pas passer sous silence : contrairement aux
// cas déjà prouvés d'AUDIT-20-6/7 (qui mutent un ÉLÉMENT EXISTANT d'un
// tableau via .id(sid), ou insèrent en tête via unshift()), addSchedule ne
// fait qu'un simple push() en fin de tableau. Une tentative de
// reproduction sérieuse (N=40 appels concurrents sur le même employé, puis
// 15 paires addSchedule×addSchedule en Promise.all unique, contre le
// mongod local à faible latence) n'a PRODUIT AUCUNE VersionError ni aucune
// perte — vraisemblablement parce que Mongoose peut exprimer un simple
// push() en fin de tableau via .save() comme un vrai $push Mongo atomique,
// sans jamais avoir besoin du contrôle de version. Corrigé quand même en
// $push explicite via findByIdAndUpdate — par cohérence de style avec le
// reste du chantier et parce que rien ne garantit ce comportement dans
// toutes les conditions (charge, versions de driver) — mais ce correctif
// n'a PAS de preuve de régression réellement corrigée, contrairement à
// AUDIT-20-6/7/l'addConsommation d'AUDIT-20-8. Les tests ci-dessous
// valident la CORRECTION (comportement correct après réécriture), pas une
// reproduction du bug avant.
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

test('AUDIT-20-8 — hr.controller.js::addSchedule atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const hrC = require('../controllers/hr.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Concurrence' };
  const created = [];

  try {
    await t.test('N ajouts de créneaux concurrents sur le même employé → tous persistés, aucun perdu', async () => {
      const staff = await Staff.create({ nom: `Audit20-8-${stamp}`, prenom: 'Test', poste: 'Infirmier', statut: 'actif' });
      created.push(staff._id);

      const N = 8;
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(hrC.addSchedule, { params: { id: staff._id.toString() }, user, ip: '127.0.0.1', body: { date: `2026-10-0${(i % 9) + 1}`, heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } })
      ));
      for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));

      const fresh = await Staff.findById(staff._id).lean();
      assert.equal(fresh.planning.length, N, `les ${N} créneaux doivent tous être persistés, aucun perdu sous concurrence réelle`);
    });

    await t.test('non-régression — 404 sur employé inexistant', async () => {
      const fauxId = new mongoose.Types.ObjectId().toString();
      const { status } = await call(hrC.addSchedule, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { date: '2026-10-01', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } });
      assert.equal(status, 404);
    });

    await t.test('non-régression — contrat de réponse inchangé ({ success, staff } document complet)', async () => {
      const staff = await Staff.create({ nom: `Audit20-8B-${stamp}`, prenom: 'Test', poste: 'Médecin', statut: 'actif' });
      created.push(staff._id);
      const { status, body } = await call(hrC.addSchedule, { params: { id: staff._id.toString() }, user, ip: '127.0.0.1', body: { date: '2026-10-05', heure_debut: '09:00', heure_fin: '17:00', type: 'garde' } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.success, true);
      assert.equal(String(body.staff._id), String(staff._id));
      assert.equal(body.staff.planning.length, 1);
      assert.equal(body.staff.planning[0].type, 'garde');
      assert.equal(body.staff.planning[0].statut, 'brouillon');
    });
  } finally {
    for (const id of created) await Staff.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
