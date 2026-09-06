// SEC-009 — enfant jetable, mesure le temps réel de construction+exécution
// du motif regex exactement comme echographieController.js::getAll le fait
// avec `q` (ligne 117) : `mode=raw` reproduit le code AVANT correction
// (aucun échappement), `mode=escaped` reproduit le code APRÈS correction
// (utils/helpers.js::escapeRegex, même helper que les 8 autres contrôleurs
// déjà protégés, commit historique 91ca5f6). Isolé dans un process séparé
// pour que le parent puisse le tuer avec un délai strict si le motif
// pathologique bloque effectivement le moteur regex — jamais de risque de
// faire pendre la suite de tests elle-même.
const { escapeRegex } = require('../../utils/helpers');

const [, , mode, target] = process.argv;
const q = '(a+)+$'; // motif pathologique classique (ReDoS par backtracking imbriqué)

const start = process.hrtime.bigint();
const re = mode === 'escaped' ? new RegExp(escapeRegex(q), 'i') : new RegExp(q, 'i');
const matched = re.test(target);
const ms = Number(process.hrtime.bigint() - start) / 1e6;

process.stdout.write(JSON.stringify({ ms, matched }));
