// POST5-010 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE.
// Le formulaire "Ajouter/Modifier médicament" (Pharmacy.jsx) a de vrais
// champs saisis pour Code médicament, Stock maximum et Emplacement, mais
// ni le payload frontend (createMed/updateMed) ni le schéma Medication ne
// les transmettaient/déclaraient — silencieusement perdus à chaque
// enregistrement. Complète la chaîne : modèle (nouveaux champs), payload
// frontend, normalizeMed (réaffichage après reload).
//
// Ce test couvre le bout backend de la chaîne (create/update persistent et
// retournent réellement ces 3 champs) — la persistance MongoDB est la
// preuve la plus fiable qu'ils ne sont plus perdus côté serveur.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('POST5-010 — code/emplacement/stock_maximum sont réellement persistés et réafficheés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const pharmacyC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Pharmacien' };
  const cleanup = [];

  try {
    let medId;
    await t.test('create() — les 3 champs saisis sont réellement persistés, pas seulement retournés dans la réponse', async () => {
      const r = await call(pharmacyC.create, {
        user, ip: '127.0.0.1',
        body: { nom_commercial: `POST5010-${stamp}`, dci: 'Test', forme: 'comprime', code: 'MED-P5010', emplacement: 'A1-01', stock_maximum: 250 },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      medId = r.body.medication._id;
      cleanup.push(() => Medication.findByIdAndDelete(medId));

      // Preuve non négociable : relecture indépendante en base, pas la
      // réponse de l'écriture elle-même.
      const fresh = await Medication.findById(medId).lean();
      assert.equal(fresh.code, 'MED-P5010');
      assert.equal(fresh.emplacement, 'A1-01');
      assert.equal(fresh.stock_maximum, 250);
    });

    await t.test('getOne — les 3 champs sont réellement retournés au rechargement (pas de perte silencieuse à la lecture)', async () => {
      const r = await call(pharmacyC.getOne, { params: { id: medId } });
      assert.equal(r.status, 200);
      assert.equal(r.body.medication.code, 'MED-P5010');
      assert.equal(r.body.medication.emplacement, 'A1-01');
      assert.equal(r.body.medication.stock_maximum, 250);
    });

    await t.test('update() — modifier ces 3 champs les persiste réellement (pas bloqués comme stock_actuel/mouvements)', async () => {
      const r = await call(pharmacyC.update, { params: { id: medId }, user, ip: '127.0.0.1', body: { code: 'MED-P5010-B', emplacement: 'B2-02', stock_maximum: 300 } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const fresh = await Medication.findById(medId).lean();
      assert.equal(fresh.code, 'MED-P5010-B');
      assert.equal(fresh.emplacement, 'B2-02');
      assert.equal(fresh.stock_maximum, 300);
    });

    await t.test('non-régression — un médicament créé sans ces champs reste accepté (tous optionnels)', async () => {
      const r = await call(pharmacyC.create, { user, ip: '127.0.0.1', body: { nom_commercial: `POST5010B-${stamp}`, dci: 'Test', forme: 'comprime' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Medication.findByIdAndDelete(r.body.medication._id));
    });

    await t.test('non-régression — update() continue de bloquer stock_actuel/mouvements malgré l\'ajout de ces 3 champs', async () => {
      const before = await Medication.findById(medId).lean();
      const r = await call(pharmacyC.update, { params: { id: medId }, user, ip: '127.0.0.1', body: { stock_actuel: 999999 } });
      assert.equal(r.status, 200);
      const after = await Medication.findById(medId).lean();
      assert.equal(after.stock_actuel, before.stock_actuel, 'stock_actuel doit rester protégé par MED_BLOCKED_FIELDS');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
