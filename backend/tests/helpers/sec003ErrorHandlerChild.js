// Script exécuté dans un processus Node séparé (spawné par
// auditSEC003ProductionMessageLeak.test.js) — nécessaire car config/env.js
// lit process.env.NODE_ENV une seule fois, au premier require, puis le met
// en cache (module.exports figé). Pour observer réellement le comportement
// de errorHandler.js selon NODE_ENV, il faut deux vrais processus distincts,
// chacun démarré avec la variable d'environnement déjà positionnée AVANT le
// tout premier require de errorHandler.js/config/env.js — pas une bascule de
// process.env dans le même process après coup, qui ne changerait rien au
// module déjà chargé.
const errorHandler = require('../../middleware/errorHandler');

const err = new TypeError("Cannot read properties of undefined (reading 'foo') — détail interne réel jamais destiné au client");

let status = 200;
let body = null;
const res = {
  status(code) { status = code; return this; },
  json(payload) { body = payload; },
};
const req = { method: 'GET', originalUrl: '/test/sec-003' };

errorHandler(err, req, res, () => {});

// logger.error (appelé par errorHandler ci-dessus) écrit aussi sur stdout —
// marqueur unique pour que le processus parent retrouve le résultat sans
// confondre les deux flux.
process.stdout.write('\n###SEC003-RESULT###' + JSON.stringify({ status, body }));
