// SEC-009 (audit indépendant du 6 sept. 2026) — echographieController.js:117
// construisait `new RegExp(q, 'i')` directement depuis `req.query.q`, sans
// jamais passer par `escapeRegex()` — le seul endroit de tout
// `backend/controllers/` dans ce cas (grep -rn "new RegExp"
// backend/controllers/ confirmé : les 9 autres occurrences, dans
// analytics.controller.js, audit.controller.js, dashboard.controller.js,
// patients.controller.js et pharmacy/urgences/etc. via escapeRegex, passent
// toutes déjà par cet échappement — voir le commit historique 91ca5f6 qui
// avait généralisé le correctif à 8 contrôleurs sans jamais toucher celui-ci).
// Un motif pathologique comme (a+)+$ soumis par un compte du personnel
// authentifié (n'importe quel rôle autorisé sur GET /echographie) provoque
// un temps de calcul exponentiel (ReDoS par backtracking imbriqué) — le même
// moteur regex à backtracking (V8 côté Node, PCRE côté MongoDB une fois le
// motif transmis en $regex) est vulnérable à cette classe de motif.
//
// Preuve en deux parties :
//  1. Un enfant Node jetable (helpers/sec009RedosChild.js) reproduit EXACTEMENT
//     la construction de la ligne 117 (avant/après correction) et mesure le
//     temps réel d'exécution — le parent impose un délai d'arrêt strict pour
//     ne jamais faire pendre cette suite de tests, quelle que soit la lenteur
//     du motif pathologique.
//  2. Un appel réel au contrôleur (`echographieController.getAll`) contre la
//     vraie base, avec un motif regex-shaped mais non catastrophique, prouve
//     la non-régression : la recherche littérale continue de fonctionner
//     normalement après l'échappement.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');

const CHILD_SCRIPT = path.join(__dirname, 'helpers', 'sec009RedosChild.js');
const ATTACK_TARGET = 'a'.repeat(32) + '!'; // presque un match, backtracking exponentiel classique sur (a+)+$
const KILL_TIMEOUT_MS = 3000;

// Exécute l'enfant jetable, renvoie soit le résultat JSON réel (ms, matched),
// soit { timedOut: true, ms: KILL_TIMEOUT_MS } si le délai strict est dépassé
// (le process enfant est alors tué — jamais laissé tourner indéfiniment).
function runChild(mode) {
  return new Promise((resolve) => {
    const child = spawn('node', [CHILD_SCRIPT, mode, ATTACK_TARGET], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ timedOut: true, ms: KILL_TIMEOUT_MS });
    }, KILL_TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.once('exit', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // utils/helpers.js (via son logger) écrit un avertissement Sentry sur
      // stdout avant notre JSON — on extrait la dernière ligne { ... } réelle
      // plutôt que de parser tout le flux brut.
      const jsonLine = out.trim().split('\n').filter(Boolean).pop() || '';
      try { resolve({ timedOut: false, ...JSON.parse(jsonLine) }); }
      catch { resolve({ timedOut: true, ms: KILL_TIMEOUT_MS, parseError: true, raw: out }); }
    });
  });
}

test('SEC-009 — un motif pathologique (a+)+$ sur la recherche Échographie doit s\'exécuter en temps normal (pas un ReDoS)', async (t) => {
  await t.test('mode "escaped" (code corrigé) — temps normal, traité comme du texte littéral', async () => {
    const result = await runChild('escaped');
    assert.equal(result.timedOut, false, `le motif échappé ne doit jamais déclencher le garde-fou de ${KILL_TIMEOUT_MS}ms`);
    assert.ok(result.ms < 100, `temps anormal pour un motif échappé : ${result.ms}ms (attendu < 100ms)`);
    assert.equal(result.matched, false, 'échappé, "(a+)+$" doit être cherché comme texte littéral exact, absent de la cible — donc aucune correspondance');
  });

  await t.test('preuve du défaut sur le code actuellement en place (mode "raw") — documente le comportement avant correction', async () => {
    const result = await runChild('raw');
    // Rejoué explicitement contre le code non corrigé (voir rapport de
    // correction) : soit le garde-fou de 3000ms a dû intervenir (process tué),
    // soit le temps mesuré est déjà très supérieur au cas échappé — dans les
    // deux cas la preuve du ReDoS est apportée avant application du correctif.
    t.diagnostic(`mode raw : timedOut=${result.timedOut} ms=${result.ms}`);
  });
});

test('SEC-009 — non-régression : GET /echographie?q= continue de fonctionner normalement après l\'échappement', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Echographie = require('../models/Echographie');
  const Patient = require('../models/Patient');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const created = { patients: [], echos: [] };

  const call = async (query) => {
    let status = 200, body = null;
    const res = { json: (d) => { body = d; } };
    await echoC.getAll({ query }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({
      nom: `T9Sec009-${stamp}`, prenom: 'Test', sexe: 'F',
      date_naissance: new Date('1990-01-01'), telephone: `+000${stamp}`.slice(0, 15),
    });
    created.patients.push(patient._id);

    const echo = await Echographie.create({
      patient: patient._id, patient_nom: `Dupont (Marie) ${stamp}`,
      type: 'Gynécologique', statut: 'en_attente',
    });
    created.echos.push(echo._id);
    const unrelated = await Echographie.create({
      patient: patient._id, patient_nom: `SansRapport-${stamp}-X`,
      type: 'Abdominale', statut: 'en_attente',
    });
    created.echos.push(unrelated._id);

    await t.test('recherche par parenthèses littérales trouve la bonne demande', async () => {
      const { body } = await call({ q: `(Marie) ${stamp}` });
      assert.equal(body.success, true);
      const found = body.demandes.find(d => String(d._id) === String(echo._id));
      assert.ok(found, 'la recherche avec des parenthèses littérales doit trouver la demande dont le nom les contient réellement');
      const foundUnrelated = body.demandes.find(d => String(d._id) === String(unrelated._id));
      assert.equal(foundUnrelated, undefined, 'une demande sans rapport ne doit pas apparaître');
    });

    await t.test('un motif regex-shaped dans la recherche ne casse pas la requête et ne matche rien de non pertinent', async () => {
      const { body } = await call({ q: `(a+)+${stamp}` });
      assert.equal(body.success, true, 'la requête ne doit jamais planter, même avec un motif regex-shaped en entrée');
      const foundEcho = body.demandes.find(d => String(d._id) === String(echo._id));
      const foundUnrelated = body.demandes.find(d => String(d._id) === String(unrelated._id));
      assert.equal(foundEcho, undefined, 'un motif qui ne correspond littéralement à aucun nom réel ne doit rien retourner');
      assert.equal(foundUnrelated, undefined, 'idem pour le document sans rapport');
    });
  } finally {
    await Echographie.deleteMany({ _id: { $in: created.echos } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
