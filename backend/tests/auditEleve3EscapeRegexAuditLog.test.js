// Audit élevé 3/9 — audit.controller.js::getAll construisait 5 RegExp
// (module, action, q ×2, ip) directement depuis req.query sans escapeRegex
// (utils/helpers.js), contrairement au reste du projet (patients.controller.js
// et 10 autres) — sur une collection AuditLog qui ne fait que croître, une
// entrée pathologique en paramètre pouvait provoquer un scan catastrophique.
// `action` avait le même défaut que les 3 nommés dans le constat original
// (module/q/ip), corrigé au passage.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Audit élevé 3 — regex échappée sur le journal d\'audit (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const auditC = require('../controllers/audit.controller');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (query) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await auditC.getAll({ query }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const entry = await AuditLog.create({
      module: `T-ELEVE3-${stamp}`, action: 'creation', ip_address: `10.10.10.${stamp % 250}`,
      message: `Message de test ${stamp}`, statut: 'succes',
    });
    cleanup.push(() => AuditLog.findByIdAndDelete(entry._id));

    await t.test('escapeRegex actif — un métacaractère regex (.*) est traité comme littéral, pas comme un joker', async () => {
      // Avant le correctif, module='.*' matchait TOUT (RegExp('.*') = joker
      // universel) — désormais traité comme la chaîne littérale ".*", que
      // notre entrée de test ne contient pas.
      const { body } = await call({ module: '.*' });
      assert.ok(!body.events.some(e => e.module === `T-ELEVE3-${stamp}`), 'un motif regex non échappé ne doit plus matcher comme un joker');
    });

    await t.test('non-régression — une recherche normale sur chaque paramètre retourne toujours les bons résultats', async () => {
      const rModule = await call({ module: `T-ELEVE3-${stamp}` });
      assert.ok(rModule.body.events.some(e => e.module === `T-ELEVE3-${stamp}`), 'recherche par module');

      const rAction = await call({ module: `T-ELEVE3-${stamp}`, action: 'creation' });
      assert.ok(rAction.body.events.some(e => e.module === `T-ELEVE3-${stamp}`), 'recherche par action');

      const rQ = await call({ q: `T-ELEVE3-${stamp}` });
      assert.ok(rQ.body.events.some(e => e.module === `T-ELEVE3-${stamp}`), 'recherche texte libre (q) sur module');

      const rIp = await call({ ip: `10.10.10.${stamp % 250}` });
      assert.ok(rIp.body.events.some(e => e.module === `T-ELEVE3-${stamp}`), 'recherche par ip');

      // Insensible à la casse — comportement déjà existant (flag 'i'), doit
      // survivre à l'échappement.
      const rCase = await call({ module: `t-eleve3-${stamp}`.toUpperCase() });
      assert.ok(rCase.body.events.some(e => e.module === `T-ELEVE3-${stamp}`), 'recherche insensible à la casse toujours fonctionnelle');
    });

    await t.test('entrée pathologique (ReDoS classique) sur module/action/q/ip — répond normalement, sans dégradation de temps', async () => {
      // Motif ReDoS classique (quantificateurs imbriqués) testé contre une
      // valeur réelle "presque correspondante" — le cas exact où un moteur de
      // regex vulnérable au backtracking catastrophique explose en temps
      // exponentiel. escapeRegex neutralise ceci en le traitant comme une
      // chaîne littérale (recherche simple, temps constant).
      const evil = '(a+)+$';
      const evilValue = 'a'.repeat(30) + '!'; // ne termine jamais par des 'a' — pire cas pour (a+)+$ non échappé
      const evilLog = await AuditLog.create({
        module: evilValue, action: 'creation', ip_address: '127.0.0.1',
        message: 'evil', statut: 'succes',
      });
      cleanup.push(() => AuditLog.findByIdAndDelete(evilLog._id));

      for (const params of [{ module: evil }, { action: evil }, { q: evil }, { ip: evil }]) {
        const t0 = Date.now();
        const { status } = await call(params);
        const elapsed = Date.now() - t0;
        assert.equal(status, 200);
        assert.ok(elapsed < 3000, `réponse doit rester rapide même avec un motif pathologique (${JSON.stringify(params)}) — ${elapsed}ms`);
      }
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
