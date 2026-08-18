// AUDIT-B4 — le cache dashboard (T9.9, TTL 30s) n'était pas étendu aux
// endpoints Analytics, de coût comparable. Ce test prouve : (a) un second
// appel dans le TTL sert une réponse en cache, (b) emitDashboardUpdate()
// invalide bien le cache analytics (même statsCache que le dashboard —
// une seule invalidation couvre les deux), (c) la clé de cache de
// getStats dépend réellement de req.query.periode : deux périodes
// distinctes ne se collisionnent jamais.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('B4 — cache dashboard étendu aux endpoints Analytics (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const analyticsC = require('../controllers/analytics.controller');
  const { statsCache } = require('../utils/dashboardCache');
  const { emitDashboardUpdate } = require('../utils/socket');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { statusCode: 200, status: (c) => { status = c; res.statusCode = c; return res; }, set: () => res, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('analyticsFinancial — un second appel dans le TTL sert la réponse en cache, pas une réagrégation', async () => {
      statsCache.flushAll();
      const { body: first } = await call(analyticsC.getFinancial);

      const inv = await Invoice.create({ patient_nom: `B4Cache${stamp}`, service_label: 'Test', montant_ht: 1000, montant_ttc: 1000, statut: 'payee', montant_paye: 1000, date_facture: new Date(), created_by: new mongoose.Types.ObjectId() });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));

      const { body: second } = await call(analyticsC.getFinancial);
      assert.deepEqual(second, first, 'la réponse doit être strictement identique — servie depuis le cache, pas réagrégée');
    });

    await t.test('emitDashboardUpdate() invalide aussi le cache analytics (même statsCache que le dashboard)', async () => {
      statsCache.flushAll();
      const { body: first } = await call(analyticsC.getFinancial);

      const inv = await Invoice.create({ patient_nom: `B4Invalid${stamp}`, service_label: 'Test', montant_ht: 2000, montant_ttc: 2000, statut: 'payee', montant_paye: 2000, date_facture: new Date(), created_by: new mongoose.Types.ObjectId() });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));
      emitDashboardUpdate();

      const { body: second } = await call(analyticsC.getFinancial);
      assert.notDeepEqual(second, first, 'après invalidation, la réponse doit refléter la nouvelle facture');
    });

    await t.test('analyticsStats — la clé de cache dépend de req.query.periode, aucune collision entre deux périodes', async () => {
      statsCache.flushAll();
      await call(analyticsC.getStats, { query: { periode: 'mois' } });
      await call(analyticsC.getStats, { query: { periode: 'annee' } });

      assert.notEqual(statsCache.get('analyticsStats:mois'), undefined, 'une entrée de cache propre à periode=mois doit exister');
      assert.notEqual(statsCache.get('analyticsStats:annee'), undefined, 'une entrée de cache propre à periode=annee doit exister, distincte de mois');
    });

    await t.test('analyticsReport / analyticsPatientStats — mis en cache sous une clé globale (aucun paramètre de requête pertinent)', async () => {
      statsCache.flushAll();
      await call(analyticsC.getReport);
      await call(analyticsC.getPatientStats);

      assert.notEqual(statsCache.get('analyticsReport'), undefined);
      assert.notEqual(statsCache.get('analyticsPatientStats'), undefined);
    });
  } finally {
    for (const fn of cleanup) await fn();
    statsCache.flushAll();
    await mongoose.disconnect();
  }
});
