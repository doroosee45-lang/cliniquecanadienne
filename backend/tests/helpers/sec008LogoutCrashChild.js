// Processus enfant isolé pour SEC-008 (auditSEC008LogoutCrashIsole.test.js).
// Doit tourner dans un process séparé et jetable : sur le code non corrigé,
// ce script est CENSÉ crasher (process.exit(1) déclenché par le gestionnaire
// global unhandledRejection de server.js) — jamais dans le process partagé
// qui exécute la suite de tests.
//
// Monkey-patch de utils/helpers.js::logAction AVANT le require de
// ../server.js (qui charge toute la chaîne routes → controllers →
// utils/helpers) : auth.controller.js fait `const { logAction } =
// require('../utils/helpers')`, une déstructuration qui capture la
// référence de fonction au moment du require — le patch doit donc être posé
// sur l'objet exporté par le module AVANT ce premier require pour être
// effectivement capturé. Seule l'action LOGOUT est interceptée pour
// rejeter ; toutes les autres actions (LOGIN, etc., nécessaires pour
// obtenir un cookie de session réel avant de tester le logout) utilisent la
// vraie implémentation, inchangée.
const helpers = require('../../utils/helpers');
const originalLogAction = helpers.logAction;
helpers.logAction = async (payload) => {
  if (payload?.action === 'LOGOUT') {
    throw new Error('Écriture AuditLog simulée en échec (SEC-008, processus enfant isolé)');
  }
  return originalLogAction(payload);
};

require('../../server.js');
