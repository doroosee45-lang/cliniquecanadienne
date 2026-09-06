// Sous-phase 5.5.c — état du verrou anti-concurrence pour la sauvegarde
// déclenchée via HTTP (POST /settings/backup). Volontairement un simple
// objet en mémoire de processus (pas Setting/Mongo) : la sauvegarde
// elle-même doit rester utilisable même si la base est indisponible au
// moment du déclenchement, et un redémarrage du serveur remet
// naturellement l'état à "pas en cours" — ce qui est le comportement
// souhaité (aucune sauvegarde ne peut rester bloquée "en cours" pour
// toujours après un crash). Limite disclosée : ce verrou est local au
// processus — il ne protège pas contre deux instances serveur distinctes
// tournant en parallèle (déploiement multi-instance), absent de ce projet
// à ce jour.
const state = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastManifest: null,
  lastError: null,
};

module.exports = state;
