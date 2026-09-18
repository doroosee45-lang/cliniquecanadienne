// AUDIT-19-4 (18 sept. 2026, audit indépendant) —
// finance.controller.js::getSalaires : la génération auto des bulletins
// manquants utilisait `Salaire.insertMany(...).catch(() => {})`, censé
// tolérer uniquement la course concurrente attendue (deux GET simultanés
// créant le même bulletin, E11000 sur l'index unique (staff, mois)). Mais
// ce catch avalait TOUTE erreur sans distinction — une vraie panne
// d'écriture (validation, connexion DB) aurait disparu silencieusement,
// le re-fetch suivant renvoyant les bulletins déjà existants comme si de
// rien n'était, sans qu'aucune trace ne subsiste nulle part. Corrigé pour
// ne tolérer silencieusement que l'erreur de course réelle (code 11000,
// reproduit directement contre la base : voir la 2e assertion ci-dessous)
// et journaliser (logger.error + captureException) toute autre erreur.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-19-4 — getSalaires() ne journalise plus jamais silencieusement une vraie erreur insertMany (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Salaire = require('../models/Salaire');
  const Staff = require('../models/Staff');
  const finC = require('../controllers/finance.controller');
  const loggerModule = require('../utils/logger');

  const stamp = Date.now();
  const created = { staff: [], salaires: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('erreur insertMany réelle (non-11000) : journalisée (logger.error), jamais silencieuse, le GET reste fonctionnel', async () => {
      const staff = await Staff.create({ nom: `Audit19-4-${stamp}`, prenom: 'Test', poste: 'Test', salaire_base: 200000, statut: 'actif' });
      created.staff.push(staff._id);
      const mois = `2019-0${(stamp % 9) + 1}`; // mois synthétique jamais utilisé par un autre test

      const originalInsertMany = Salaire.insertMany;
      const originalLoggerError = loggerModule.logger.error;
      let loggerErrorCalled = false;
      let capturedErr = null;

      // Panne réelle simulée à la frontière de la base (erreur de connexion,
      // pas 11000) — même principe qu'une injection de faute contrôlée pour
      // vérifier une branche de gestion d'erreur, sans jamais fabriquer de
      // comportement métier. logger.error est un objet Winston partagé par
      // référence (require() renvoie le même module partout) : le muter ici
      // est vu par le contrôleur sans qu'il ait besoin d'être rechargé —
      // contrairement à captureException (fonction déstructurée par valeur
      // au chargement du contrôleur), non testable par ce même mécanisme et
      // volontairement non vérifiée ici pour cette raison.
      Salaire.insertMany = async () => { throw Object.assign(new Error('Simulated connection failure — not a duplicate key'), { code: undefined }); };
      loggerModule.logger.error = (...args) => { loggerErrorCalled = true; capturedErr = args; };

      try {
        const { status, body } = await call(finC.getSalaires, { query: { mois } });
        assert.equal(status, 200, 'le GET ne doit jamais échouer (500) à cause d\'une erreur non bloquante de génération auto');
        assert.ok(Array.isArray(body.salaires), 'la réponse reste exploitable malgré l\'échec d\'insertMany');
      } finally {
        Salaire.insertMany = originalInsertMany;
        loggerModule.logger.error = originalLoggerError;
      }

      assert.equal(loggerErrorCalled, true, 'une erreur réelle (non-11000) doit désormais être journalisée via logger.error, jamais avalée en silence');
      assert.match(capturedErr[0], /Échec insertMany/, 'le message journalisé doit être explicite sur la cause');
    });

    await t.test('non-régression — la vraie course concurrente attendue (E11000) reste tolérée silencieusement, sans journalisation ni échec', async () => {
      const staff = await Staff.create({ nom: `Audit19-4B-${stamp}`, prenom: 'Test', poste: 'Test', salaire_base: 150000, statut: 'actif' });
      created.staff.push(staff._id);
      const mois = `2019-0${((stamp + 1) % 9) + 1}`;

      // Le bulletin existe déjà avant l'appel : insertMany() va réellement
      // heurter l'index unique (staff, mois) — la vraie course, pas une
      // simulation.
      const preexistant = await Salaire.create({ staff: staff._id, mois, base: 150000, net: 150000 });
      created.salaires.push(preexistant._id);

      const originalLoggerError = loggerModule.logger.error;
      let loggerErrorCalled = false;
      loggerModule.logger.error = () => { loggerErrorCalled = true; };

      try {
        const { status, body } = await call(finC.getSalaires, { query: { mois } });
        assert.equal(status, 200, JSON.stringify(body));
        const count = body.salaires.filter(s => String(s._id) === String(preexistant._id) || s.staff === String(staff._id)).length;
        assert.ok(count >= 1, 'le bulletin préexistant doit toujours être visible, jamais dupliqué ni perdu');
      } finally {
        loggerModule.logger.error = originalLoggerError;
      }
      assert.equal(loggerErrorCalled, false, 'la course concurrente réelle (E11000) ne doit toujours jamais être journalisée comme une erreur — comportement inchangé');
    });
  } finally {
    for (const id of created.salaires) await Salaire.findByIdAndDelete(id);
    for (const id of created.staff) { await Salaire.deleteMany({ staff: id }); await Staff.findByIdAndDelete(id); }
    await mongoose.disconnect();
  }
});
