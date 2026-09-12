// FE-ADM-02 (correction du 12 sept. 2026, audit indépendant) —
// Administration.jsx affichait des KPI "Revenus/Dépenses/Excédent" codés
// en dur (26.8M/18.2M/8.6M, "mai 2025" figé), jamais calculés. Corrigé côté
// backend : settings.controller.js::getKpis expose désormais
// depenses_par_mois, une vraie agrégation du modèle Depense (même
// principe que revenus_par_mois, déjà réel), pour que le frontend calcule
// le mois réellement en cours au lieu d'un chiffre fabriqué.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('FE-ADM-02 — getKpis() expose depenses_par_mois, une vraie agrégation du modèle Depense', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Depense = require('../models/Depense');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const now = new Date();
  const depense = await Depense.create({ description: `Depense reelle FeAdm02 ${stamp}`, montant: 12345, categorie: 'Autre', date: now });

  try {
    const { status, body } = await call(settingsC.getKpis, { user: { _id: new mongoose.Types.ObjectId(), role: 'superadmin' } });
    assert.equal(status, 200, JSON.stringify(body));
    assert.ok(Array.isArray(body.depenses_par_mois), 'depenses_par_mois doit être un vrai tableau, jamais absent');
    assert.equal(body.depenses_par_mois.length, 12);
    assert.ok(body.depenses_par_mois[now.getMonth()] >= 12345, 'le mois courant doit réellement inclure la dépense créée pour ce test');
  } finally {
    await Depense.findByIdAndDelete(depense._id);
    await mongoose.disconnect();
  }
});
