// T9.9 — cache court des stats dashboard (node-cache, choix validé :
// Redis absent de l'environnement). Vérifie : (a) un second appel dans le
// TTL sert une réponse en cache sans re-agréger (donnée figée même si la
// base change entre-temps), (b) emitDashboardUpdate() invalide bien le
// cache — un appel juste après reflète la donnée fraîche, (c) medecinStats
// est cloisonné par utilisateur, pas de fuite entre deux médecins.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('T9.9 — cache dashboard : hit, invalidation, cloisonnement par utilisateur (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const dashC = require('../controllers/dashboard.controller');
  const { statsCache } = require('../utils/dashboardCache');
  const { emitDashboardUpdate } = require('../utils/socket');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    // statusCode initialisé à 200 par défaut, exactement comme le vrai
    // http.ServerResponse d'Express — le wrapper de cache (dashboardCache.js)
    // lit res.statusCode pour décider s'il met en cache, sans exiger un
    // appel explicite à .status(200).
    const res = { statusCode: 200, status: (c) => { status = c; res.statusCode = c; return res; }, set: () => res, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];

  try {
    await t.test('superAdminStats — un second appel dans le TTL sert la réponse en cache, pas une réagrégation', async () => {
      statsCache.flushAll();
      const { body: first } = await call(dashC.superAdminStats, { user: { role: 'superadmin' } });

      const p = await Patient.create({ nom: `T99Cache${stamp}`, prenom: 'X', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));

      const { body: second } = await call(dashC.superAdminStats, { user: { role: 'superadmin' } });
      assert.deepEqual(second, first, 'la réponse doit être strictement identique — servie depuis le cache, pas réagrégée (donc le nouveau patient créé entre les deux appels ne doit pas y apparaître)');
    });

    await t.test('emitDashboardUpdate() invalide le cache — l\'appel suivant reflète la donnée fraîche', async () => {
      statsCache.flushAll();
      const { body: first } = await call(dashC.superAdminStats, { user: { role: 'superadmin' } });

      const p = await Patient.create({ nom: `T99Invalid${stamp}`, prenom: 'X', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      emitDashboardUpdate();

      const { body: second } = await call(dashC.superAdminStats, { user: { role: 'superadmin' } });
      assert.notDeepEqual(second, first, 'après invalidation, la réponse doit refléter le nouveau patient — donc différer de la réponse mise en cache avant sa création');
    });

    await t.test('medecinStats — cloisonné par utilisateur, pas de fuite entre deux médecins', async () => {
      statsCache.flushAll();
      const medA = await User.create({ email: `_t99-meda-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'MedA', role: 'medecin', statut: 'actif' });
      const medB = await User.create({ email: `_t99-medb-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'MedB', role: 'medecin', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(medA._id), () => User.findByIdAndDelete(medB._id));

      await call(dashC.medecinStats, { user: medA });
      await call(dashC.medecinStats, { user: medB });

      assert.notEqual(
        statsCache.get(`medecinStats:${medA._id}`),
        undefined,
        'le cache doit exister sous une clé propre au médecin A',
      );
      assert.notEqual(
        statsCache.get(`medecinStats:${medB._id}`),
        undefined,
        'le cache doit exister sous une clé propre au médecin B, distincte de A',
      );
    });
  } finally {
    for (const fn of cleanup) await fn();
    statsCache.flushAll();
    await mongoose.disconnect();
  }
});
