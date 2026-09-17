// POST5-014 (audit indépendant post-Phase 5, 14 sept. 2026) — le bouton
// "Modifier" (Administration.jsx, section Fournisseurs) n'avait aucun
// handler : aucune route de mise à jour n'existait pour ce module (seuls
// GET/POST /admin/suppliers existaient — voir AUDIT-11-8). Ce test prouve
// que PUT /admin/suppliers/:id (suppliersC.updateSupplier) persiste
// réellement une modification, jamais un faux succès local, et respecte
// les mêmes garde-fous que les autres endpoints de ce module (404 sur un
// fournisseur inexistant, created_by/timestamps jamais réécrits par le
// client).
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

test('POST5-014 — suppliersC.updateSupplier persiste réellement une modification (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Supplier = require('../models/Supplier');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const suppliersC = require('../controllers/suppliers.controller');

  const stamp = Date.now();
  const admin = await User.create({ email: `_p5014-admin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin', prenom: 'P5014', role: 'adminclinique', statut: 'actif' });
  let supplier = null;

  try {
    supplier = await Supplier.create({
      nom: 'T5014 MedPharma', contact: 'Jean K.', telephone: '+242060000000',
      email: 'contact@t5014.test', adresse: 'Brazzaville', produits: 'Médicaments génériques',
      created_by: admin._id,
    });

    await t.test('modification réelle — persistée, tracée, created_by/montant_total jamais réécrits par le client', async () => {
      const { status, body } = await call(suppliersC.updateSupplier, {
        params: { id: supplier._id.toString() },
        user: admin, ip: '127.0.0.1',
        body: { nom: 'T5014 MedPharma Congo', contact: 'Alice N.', telephone: '+242060000099', email: 'contact@t5014.test', adresse: 'Pointe-Noire', produits: 'Médicaments génériques + consommables', created_by: new mongoose.Types.ObjectId().toString(), montant_total: 999999999 },
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.supplier.contact, 'Alice N.');
      assert.equal(body.supplier.adresse, 'Pointe-Noire');

      const relu = await Supplier.findById(supplier._id).lean();
      assert.equal(relu.contact, 'Alice N.', 'la modification doit être réellement persistée en base');
      assert.equal(relu.adresse, 'Pointe-Noire');
      assert.equal(relu.created_by.toString(), admin._id.toString(), 'created_by ne doit jamais être réécrit par le client');
      assert.equal(relu.montant_total, 0, 'montant_total ne doit jamais être injectable par le client — champ non whitelisté sur updateSupplier');

      const log = await AuditLog.findOne({ module: 'suppliers', action: 'UPDATE', entite_id: supplier._id.toString() }).lean();
      assert.ok(log, 'la modification doit être tracée dans AuditLog (module suppliers)');
    });

    await t.test('fournisseur inexistant — 404, aucune écriture', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const { status, body } = await call(suppliersC.updateSupplier, {
        params: { id: fauxId.toString() }, user: admin, ip: '127.0.0.1',
        body: { nom: 'X', produits: 'Y' },
      });
      assert.equal(status, 404, JSON.stringify(body));
    });
  } finally {
    if (supplier) {
      await Supplier.findByIdAndDelete(supplier._id);
      await AuditLog.deleteMany({ module: 'suppliers', entite_id: supplier._id.toString() });
    }
    await User.findByIdAndDelete(admin._id);
    await mongoose.disconnect();
  }
});
