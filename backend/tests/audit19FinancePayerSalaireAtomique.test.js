// AUDIT-19-5 (18 sept. 2026, audit indépendant) —
// finance.controller.js::payerSalaire vérifiait salaire.statut !== 'paye'
// puis persistait via salaire.save() — non atomique, seul pattern du
// fichier à ne pas suivre la garde-par-filtre déjà systématique ailleurs
// (payerFacture/addPayment notamment). Deux appels payerSalaire concurrents
// sur le MÊME bulletin pouvaient tous deux lire 'en_attente' avant que l'un
// n'écrive, produisant deux entrées AuditLog "PAYMENT" pour un seul
// paiement réel — reproduit ci-dessous directement (Promise.all). Corrigé
// avec le même pattern findOneAndUpdate à filtre-garde déjà utilisé ailleurs
// dans ce fichier (ex. addPayment) et dans hospitalization.controller.js::
// discharge/prescriptions.controller.js::cancel/publier.
//
// Données synthétiques de démonstration — aucune donnée réelle.
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

test('AUDIT-19-5 — payerSalaire() atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Salaire = require('../models/Salaire');
  const Staff = require('../models/Staff');
  const AuditLog = require('../models/AuditLog');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const created = { staff: [], salaires: [] };
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Finance' };

  try {
    await t.test('non-régression : un paiement normal, seul, réussit toujours', async () => {
      const staff = await Staff.create({ nom: `Audit19-5-A-${stamp}`, prenom: 'Test', poste: 'Test', salaire_base: 100000, statut: 'actif' });
      created.staff.push(staff._id);
      const salaire = await Salaire.create({ staff: staff._id, mois: '2019-01', base: 100000, net: 100000 });
      created.salaires.push(salaire._id);

      const { status, body } = await call(finC.payerSalaire, { params: { id: salaire._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.salaire.statut, 'paye');
    });

    await t.test('deux tentatives de paiement concurrentes (Promise.all) sur le MÊME bulletin : une seule aboutit réellement, une seule entrée AuditLog PAYMENT', async () => {
      const staff = await Staff.create({ nom: `Audit19-5-B-${stamp}`, prenom: 'Test', poste: 'Test', salaire_base: 200000, statut: 'actif' });
      created.staff.push(staff._id);
      const salaire = await Salaire.create({ staff: staff._id, mois: '2019-02', base: 200000, net: 200000 });
      created.salaires.push(salaire._id);

      const req = () => ({ params: { id: salaire._id.toString() }, user, ip: '127.0.0.1' });
      const [rA, rB] = await Promise.all([call(finC.payerSalaire, req()), call(finC.payerSalaire, req())]);

      const successCount = [rA, rB].filter(r => r.status === 200).length;
      assert.equal(successCount, 1, `exactement un des deux paiements concurrents doit réussir — obtenu ${successCount} (statuts : ${rA.status}, ${rB.status})`);
      const rejectCount = [rA, rB].filter(r => r.status === 400).length;
      assert.equal(rejectCount, 1, 'l\'autre doit être rejeté proprement (400 "déjà payé"), jamais un crash ni un doublon silencieux');

      const fresh = await Salaire.findById(salaire._id).lean();
      assert.equal(fresh.statut, 'paye');

      const paiementLogs = await AuditLog.countDocuments({ module: 'finance', action: 'PAYMENT', entite_id: salaire._id.toString() });
      assert.equal(paiementLogs, 1, 'un seul paiement réel doit produire une seule entrée AuditLog PAYMENT, jamais deux pour la même course gagnée une seule fois');
    });

    await t.test('non-régression : payer un bulletin déjà payé reste refusé (400)', async () => {
      const staff = await Staff.create({ nom: `Audit19-5-C-${stamp}`, prenom: 'Test', poste: 'Test', salaire_base: 100000, statut: 'actif' });
      created.staff.push(staff._id);
      const salaire = await Salaire.create({ staff: staff._id, mois: '2019-03', base: 100000, net: 100000, statut: 'paye', date_paiement: new Date() });
      created.salaires.push(salaire._id);

      const { status, body } = await call(finC.payerSalaire, { params: { id: salaire._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 400, JSON.stringify(body));
    });
  } finally {
    for (const id of created.salaires) await Salaire.findByIdAndDelete(id);
    for (const id of created.staff) await Staff.findByIdAndDelete(id);
    await AuditLog.deleteMany({ module: 'finance', action: 'PAYMENT', utilisateur: user._id });
    await mongoose.disconnect();
  }
});
