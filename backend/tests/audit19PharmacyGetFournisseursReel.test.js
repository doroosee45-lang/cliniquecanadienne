// AUDIT-19-2 (18 sept. 2026, audit indépendant) —
// pharmacy.controller.js::getFournisseurs ignorait complètement le vrai
// modèle Supplier (CRUD réel via suppliers.controller.js, géré depuis
// Administration.jsx) et fabriquait une liste à partir de
// Medication.distinct('fabricant') : contact/ville/email toujours vides,
// delai_livraison:7 codé en dur pour TOUS les fournisseurs, _id instable
// (index du tableau, pas un vrai ObjectId). Deux notions de « fournisseur »
// coexistaient sans jamais se rejoindre. Unifié sur la source réelle
// unique — ce test prouve que l'endpoint reflète désormais Supplier, jamais
// une liste dérivée des fabricants de médicaments.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('AUDIT-19-2 — pharmacy.controller.js::getFournisseurs reflète le vrai modèle Supplier (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Supplier = require('../models/Supplier');
  const Medication = require('../models/Medication');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const created = { suppliers: [], meds: [] };

  try {
    await t.test('un vrai Supplier avec toutes ses coordonnées apparaît tel quel — jamais contact/email vidés ni type/délai inventés', async () => {
      const supplier = await Supplier.create({
        nom: `Audit19-Fournisseur-${stamp}`,
        contact: 'M. Test Contact',
        telephone: '+242 06 000 0000',
        email: `_audit19-${stamp}@_test.local`,
        adresse: 'Souanké, Congo',
        produits: 'Antibiotiques, antalgiques',
        montant_total: 125000,
      });
      created.suppliers.push(supplier._id);

      const { status, body } = await call(pharmaC.getFournisseurs);
      assert.equal(status, 200, JSON.stringify(body));
      const found = body.fournisseurs.find(f => String(f._id) === String(supplier._id));
      assert.ok(found, 'le fournisseur réel doit apparaître dans la réponse, avec son vrai _id (pas un index de tableau)');
      assert.equal(found.contact, 'M. Test Contact', 'contact ne doit jamais être vidé — c\'est le point central du correctif');
      assert.equal(found.email, `_audit19-${stamp}@_test.local`);
      assert.equal(found.telephone, '+242 06 000 0000');
      assert.equal(found.produits, 'Antibiotiques, antalgiques');
      assert.equal(found.montant_total, 125000);
      assert.equal(found.type, undefined, 'aucune classification "type" n\'existe réellement sur Supplier — jamais une valeur inventée comme avant');
      assert.equal(found.delai_livraison, undefined, 'aucun délai de livraison réel n\'existe sur Supplier — jamais 7 codé en dur comme avant');
    });

    await t.test('non-régression — un fabricant de Medication sans fiche Supplier n\'apparaît plus (ancienne source abandonnée)', async () => {
      const med = await Medication.create({ nom_commercial: `Audit19-Med-${stamp}`, fabricant: `FabricantSansFicheSupplier-${stamp}`, stock_actuel: 10, prix_vente: 100 });
      created.meds.push(med);

      const { body } = await call(pharmaC.getFournisseurs);
      const found = body.fournisseurs.find(f => f.nom === `FabricantSansFicheSupplier-${stamp}`);
      assert.equal(found, undefined, 'un simple fabricant sans fiche Supplier réelle ne doit plus jamais apparaître — la liste vient uniquement de Supplier');
    });
  } finally {
    for (const id of created.suppliers) await Supplier.findByIdAndDelete(id);
    for (const id of created.meds) await Medication.findByIdAndDelete(id._id || id);
    await mongoose.disconnect();
  }
});
