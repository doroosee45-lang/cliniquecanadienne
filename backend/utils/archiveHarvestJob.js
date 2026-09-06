// AUDIT-CRIT-4 — moisson d'archivage (archive.controller.js::harvestArchivables)
// déplacée hors du chemin de lecture (GET /archives/stats la déclenchait
// auparavant de façon synchrone à chaque requête). Même structure que
// appointmentReminders.js/planningReminders.js : job node-cron + fonction de
// travail interne.
// CODE-002 (audit indépendant du 6 sept. 2026) — runArchiveHarvest() n'était
// en réalité jamais importée par aucun test (le commentaire ci-dessus
// affirmait "exportée séparément pour les tests" — faux, vérifié :
// auditCrit4ArchiveHarvestPerf.test.js appelle directement
// archiveC.harvestArchivables(), jamais ce wrapper). Export retiré ; la
// fonction reste utilisée en interne par startArchiveHarvestJob ci-dessous.
//
// Fréquence quotidienne (3h00, heure creuse — distincte du rappel RDV de
// 8h00) : les seuils d'archivabilité (SEUILS dans archive.controller.js)
// sont exprimés en jours (30-90j), jamais en heures — aucune de ces
// bascules n'a de valeur opérationnelle à la minute ou même à l'heure près,
// contrairement aux rappels RDV/planning. Délai de fraîcheur maximal :
// un nouveau document devenu archivable juste après l'exécution de 3h00
// n'apparaîtra dans les statistiques qu'au passage suivant, soit jusqu'à
// ~24h — plus le TTL de cache de 30s (dashboardCache.js) qui s'ajoute par
// dessus une fois la donnée moissonnée. Acceptable pour une liste de
// navigation d'archives, sans lien avec un flux clinique actif.
const cron = require('node-cron');
const { logAction } = require('./helpers');
const { logger, captureException } = require('./logger');
const { invalidateStatsCache } = require('./dashboardCache');

async function runArchiveHarvest() {
  const { harvestArchivables } = require('../controllers/archive.controller');
  const { candidats, inseres } = await harvestArchivables();

  // N'invalide le cache/n'emet un évènement que si de nouvelles entrées ont
  // réellement été insérées — inutile de faire circuler un évènement pour
  // un passage qui n'a rien trouvé de nouveau (cas courant, la plupart des
  // documents ont déjà été moissonnés lors d'un passage précédent).
  if (inseres > 0) {
    invalidateStatsCache();
    await logAction({
      action: 'ARCHIVE_HARVEST', module: 'archive',
      message: `Moisson d'archivage — ${inseres} nouvelle(s) entrée(s) sur ${candidats} candidat(s) examiné(s).`,
    });
  }
  return { candidats, inseres };
}

// Tous les jours à 3h00 — voir le raisonnement de fréquence en tête de fichier.
// Démarré depuis server.js à côté des autres jobs planifiés ; désactivable en
// test/CI en ne l'appelant simplement pas (comme les jobs déjà en place).
function startArchiveHarvestJob() {
  cron.schedule('0 3 * * *', () => {
    runArchiveHarvest().catch(err => {
      logger.error('[archive-harvest] Erreur job de moisson d\'archivage', { error: err.message, stack: err.stack });
      captureException(err, { job: 'archiveHarvest' });
    });
  });
}

module.exports = { startArchiveHarvestJob };
