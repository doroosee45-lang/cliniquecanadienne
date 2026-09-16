// POST5-011 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE.
// AI.jsx (onglet Tableau de bord) affichait un graphique "Activité IA — 7
// derniers jours" alimenté par un tableau littéral codé en dur
// ([12,18,9,24,16,7,4]), juste à côté de vrais KPI Redux — jamais issu
// d'une requête réelle, alors qu'AIPrediction (createdAt réel sur chaque
// prédiction) permet un vrai comptage quotidien.
//
// Ce test prouve qu'ai.controller.js::getStats calcule désormais ce
// graphique depuis de vraies AIPrediction en base, pas une valeur inventée.
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

test('POST5-011 — activite_7j (Tableau de bord IA) reflète un vrai comptage AIPrediction, jamais une valeur codée en dur (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AIPrediction = require('../models/AIPrediction');
  const Patient = require('../models/Patient');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId() };
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `P5011-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    // Aujourd'hui : 3 vraies prédictions réelles.
    for (let i = 0; i < 3; i++) {
      const p = await AIPrediction.create({ type: 'diagnostic', patient: patient._id, resultat: { test: true } });
      cleanup.push(() => AIPrediction.findByIdAndDelete(p._id));
    }
    // Hier : 1 vraie prédiction, date forcée pour un comptage déterministe.
    const hier = await AIPrediction.create({ type: 'anomalie_labo', patient: patient._id, resultat: { test: true } });
    await AIPrediction.updateOne({ _id: hier._id }, { $set: { createdAt: new Date(Date.now() - 24 * 3600 * 1000) } });
    cleanup.push(() => AIPrediction.findByIdAndDelete(hier._id));

    await t.test('getStats() retourne activite_7j avec un comptage réel — jamais [12,18,9,24,16,7,4]', async () => {
      const r = await call(aiC.getStats, { user });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const activite = r.body.stats.activite_7j;
      assert.ok(activite, 'activite_7j doit être présent dans la réponse');
      assert.equal(activite.labels.length, 7);
      assert.equal(activite.data.length, 7);
      assert.notDeepEqual(activite.data, [12, 18, 9, 24, 16, 7, 4], 'ne doit plus jamais être l\'ancien tableau codé en dur');

      const totalCompte = activite.data.reduce((s, n) => s + n, 0);
      assert.ok(totalCompte >= 4, `doit refléter au moins les 4 prédictions réelles créées par ce test (obtenu : ${totalCompte})`);

      // Le dernier jour (aujourd'hui) doit contenir au moins les 3
      // prédictions créées à l'instant.
      const dernierJour = activite.data[activite.data.length - 1];
      assert.ok(dernierJour >= 3, `le dernier jour doit compter au moins les 3 prédictions du jour même (obtenu : ${dernierJour})`);
    });

    await t.test('non-régression — les autres champs de stats restent réellement calculés (analyses_mois inclut les prédictions créées)', async () => {
      const r = await call(aiC.getStats, { user });
      assert.ok(r.body.stats.analyses_mois >= 4);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
