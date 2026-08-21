// AUDIT-3.1 — 6 contrôleurs (chirurgieController, urgencesController,
// maternityController, pediatrieController, echographieController,
// ambulances.controller) renvoyaient leurs erreurs en 500/400 brut
// (res.status(...).json({message: err.message})) au lieu de passer par le
// gestionnaire d'erreurs central (middleware/errorHandler.js), déjà utilisé
// partout ailleurs dans le projet. Conséquence concrète : un ID invalide
// (CastError Mongoose) renvoyait 500 avec le message technique Mongoose brut
// au lieu d'un 404 propre. Ce test prouve, pour chacun des 5 contrôleurs
// exposant un "getOne" par ID (ambulances.controller n'en a pas — ses
// lookups se font par numero, un champ texte, jamais sujet à CastError),
// qu'un ID syntaxiquement invalide produit désormais exactement la réponse
// du gestionnaire central : 404, "Ressource introuvable.", pas un 500.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const errorHandler = require('../middleware/errorHandler');

test('AUDIT-3.1 — ID invalide renvoie 404 via le gestionnaire central sur les 5 contrôleurs corrigés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);

  // Simule la chaîne Express réelle : next(err) doit être routé vers le
  // gestionnaire d'erreurs central, exactement comme app.use(errorHandler)
  // le fait en production — pas un simple "throw" qui masquerait le vrai
  // comportement observé par un client HTTP réel.
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) errorHandler(err, req, res, () => {}); });
    return { status, body };
  };

  const INVALID_ID = 'ceci-nest-pas-un-objectid';
  const cases = [
    { nom: 'chirurgieController.getDossierById', fn: require('../controllers/chirurgieController').getDossierById },
    { nom: 'urgencesController.getOne',           fn: require('../controllers/urgencesController').getOne },
    { nom: 'maternityController.getOne',          fn: require('../controllers/maternityController').getOne },
    { nom: 'pediatrieController.getOne',          fn: require('../controllers/pediatrieController').getOne },
    { nom: 'echographieController.getOne',        fn: require('../controllers/echographieController').getOne },
  ];

  try {
    for (const { nom, fn } of cases) {
      await t.test(`${nom}(id invalide) → 404 "Ressource introuvable." (pas 500 brut)`, async () => {
        const { status, body } = await call(fn, { params: { id: INVALID_ID } });
        assert.equal(status, 404, `${nom} doit renvoyer 404 sur un ID invalide, obtenu ${status} (${JSON.stringify(body)})`);
        assert.equal(body.message, 'Ressource introuvable.', `${nom} doit renvoyer le message générique du gestionnaire central, pas un message Mongoose brut`);
        assert.equal(body.success, false);
      });
    }
  } finally {
    await mongoose.disconnect();
  }
});
