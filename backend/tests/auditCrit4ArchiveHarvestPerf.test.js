// Audit critique 4/4 (dernier des 4) — archive.controller.js::harvestArchivables
// tournait de façon synchrone à CHAQUE requête GET /archives/stats, avec un
// upsert individuel attendu séquentiellement par document candidat : à
// grande échelle, des dizaines de milliers d'allers-retours d'écriture
// bloquants sur un simple chargement de page. Découplé du chemin de lecture
// (déclenché uniquement par utils/archiveHarvestJob.js, cron quotidien
// 3h00) ; les upserts sont regroupés en un seul bulkWrite ; getStats() est
// mis en cache (cacheStats, 30s, comme les autres stats de tableau de bord).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Audit critique 4 — moisson d\'archivage découplée du chemin de lecture (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ArchiveEntry = require('../models/ArchiveEntry');
  const Hospitalization = require('../models/Hospitalization');
  const Patient = require('../models/Patient');
  const archiveC = require('../controllers/archive.controller');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Crit4', nom: 'Test' };
  const cleanup = [];

  const call = async (fn, req) => {
    let body = null, headers = {};
    // statusCode par défaut à 200, comme http.ServerResponse en réalité —
    // cacheStats (dashboardCache.js) s'appuie dessus pour décider de mettre
    // en cache une réponse qui n'appelle jamais explicitement .status(200).
    const res = {
      statusCode: 200,
      status: (c) => { res.statusCode = c; return res; },
      json: (d) => { body = d; return res; },
      set: (k, v) => { headers[k] = v; },
    };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status: res.statusCode, body, headers };
  };

  try {
    let hospit, patient;
    await t.test('getStats() ne déclenche plus la moisson — un dossier archivable réel n\'apparaît PAS tant que le job n\'a pas tourné', async () => {
      patient = await Patient.create({ nom: `T-CRIT4-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      hospit = await Hospitalization.create({
        patient: patient._id, statut: 'sorti', motif_entree: 'Test audit critique 4',
      });
      // Force updatedAt dans le passé (au-delà du seuil de 30j) — le schéma
      // a {timestamps:true}, qui réécrit sinon updatedAt à "maintenant" sur
      // tout updateOne ; {timestamps:false} désactive ce comportement pour
      // ce seul appel.
      await Hospitalization.updateOne(
        { _id: hospit._id },
        { $set: { updatedAt: new Date(Date.now() - 40 * 86400000) } },
        { timestamps: false }
      );
      cleanup.push(() => Hospitalization.findByIdAndDelete(hospit._id));

      const before = await ArchiveEntry.countDocuments({ source_id: hospit._id, source_model: 'Hospitalization' });
      assert.equal(before, 0);

      // getStats (sans le wrapper cache, pour ne pas contaminer le cache
      // partagé du process avec ce test) — accès à la fonction non cachée
      // exposée par le module pour la vérification directe.
      await call(archiveC.getStats, { user: admin });

      const after = await ArchiveEntry.countDocuments({ source_id: hospit._id, source_model: 'Hospitalization' });
      assert.equal(after, 0, 'getStats() ne doit plus créer d\'entrée d\'archive — la moisson est découplée du chemin de lecture');
    });

    await t.test('harvestArchivables() — la logique de moisson elle-même fonctionne toujours (bulkWrite), et reflète ensuite dans getStats()', async () => {
      const { candidats, inseres } = await archiveC.harvestArchivables();
      assert.ok(candidats >= 1, 'au moins le dossier créé ci-dessus doit être candidat');
      assert.ok(inseres >= 1, 'au moins une nouvelle entrée doit avoir été insérée');

      const entry = await ArchiveEntry.findOne({ source_id: hospit._id, source_model: 'Hospitalization' }).lean();
      assert.ok(entry, 'l\'entrée doit maintenant exister après la moisson explicite');
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(entry._id));
      assert.equal(entry.categorie, 'hospitalisation');

      // En production, c'est le job (archiveHarvestJob.js) qui invalide le
      // cache après une moisson ayant réellement inséré des entrées — appelé
      // ici explicitement puisque ce sous-test appelle harvestArchivables()
      // directement (pour isoler la logique de moisson elle-même), sans
      // passer par le job.
      require('../utils/dashboardCache').invalidateStatsCache();

      const { body } = await call(archiveC.getStats, { user: admin });
      assert.ok(body.kpis.hospitalisations >= 1, 'getStats() doit désormais refléter l\'entrée moissonnée');
    });

    await t.test('harvestArchivables() est idempotent — un second passage ne crée aucun doublon', async () => {
      const avant = await ArchiveEntry.countDocuments({ source_id: hospit._id, source_model: 'Hospitalization' });
      const { inseres } = await archiveC.harvestArchivables();
      assert.equal(inseres, 0, 'un document déjà moissonné ne doit jamais être réinséré');
      const apres = await ArchiveEntry.countDocuments({ source_id: hospit._id, source_model: 'Hospitalization' });
      assert.equal(apres, avant, 'aucun doublon créé par un second passage');
    });

    await t.test('getStats() est désormais mis en cache (cacheStats) — deuxième appel = hit, mêmes données', async () => {
      // Invalidation explicite — la clé de cache 'archiveStats' est partagée
      // avec les appels getStats() des sous-tests précédents (dans la même
      // fenêtre de TTL de 30s) ; on force un état "miss" connu plutôt que de
      // supposer l'ordre d'exécution.
      const { invalidateStatsCache } = require('../utils/dashboardCache');
      invalidateStatsCache();

      const r1 = await call(archiveC.getStats, { user: admin });
      assert.equal(r1.headers['X-Dashboard-Cache'], 'miss');
      const r2 = await call(archiveC.getStats, { user: admin });
      assert.equal(r2.headers['X-Dashboard-Cache'], 'hit');
      assert.deepEqual(r2.body, r1.body);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    // Le cache 'archiveStats' est un singleton en mémoire de process, partagé
    // par tous les fichiers de test exécutés dans la même invocation
    // node --test — invalidé ici pour ne jamais laisser une réponse mise en
    // cache référençant des documents que le cleanup ci-dessus vient de
    // supprimer, qui pourrait sinon fuiter vers un autre fichier de test
    // appelant getStats() dans la même fenêtre de 30s.
    require('../utils/dashboardCache').invalidateStatsCache();
    await mongoose.disconnect();
  }
});
