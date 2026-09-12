// AI-02 (correction du 12 sept. 2026, audit indépendant) —
// ai.controller.js::checkInteractions persistait toujours
// score_confiance:95, quel que soit le type d'appariement réellement
// détecté (allergie patient documentée vs interaction médicamenteuse
// générique de la table de référence). Corrigé : le score reflète
// désormais la nature réelle de l'appariement (100 = allergie patient
// spécifique et certaine, 85 = interaction générique de référence),
// jamais un chiffre fixe indépendant du résultat réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AI-02 — score_confiance reflète réellement le type d\'appariement, jamais un 95 fixe', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const AIPrediction = require('../models/AIPrediction');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await aiC.checkInteractions(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patientAllergique = await Patient.create({ nom: `Ai02-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01', allergies: ['penicilline'] });
  const created = { predictions: [] };

  try {
    await t.test('allergie patient documentée réellement détectée → score_confiance = 100, jamais 95', async () => {
      const { body } = await call({ user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1', body: { medications: ['penicilline'], patientId: patientAllergique._id.toString() } });
      assert.ok(body.warnings.length > 0);
      const pred = await AIPrediction.findOne({ patient: patientAllergique._id, type: 'interaction_medicament' }).sort('-createdAt');
      assert.ok(pred);
      created.predictions.push(pred._id);
      assert.equal(pred.score_confiance, 100, 'une allergie patient réellement documentée doit produire un score de 100, jamais un 95 fabriqué');
    });

    await t.test('interaction médicamenteuse générique (table de référence), sans allergie patient → score_confiance = 85', async () => {
      const { body } = await call({ user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1', body: { medications: ['warfarine', 'aspirine'] } });
      assert.ok(body.warnings.length > 0, 'warfarine+aspirine doit être une interaction connue de la table de référence');
      const pred = await AIPrediction.findOne({ type: 'interaction_medicament', patient: { $exists: false } }).sort('-createdAt');
      assert.ok(pred);
      created.predictions.push(pred._id);
      assert.equal(pred.score_confiance, 85, 'une interaction générique (non spécifique au patient) doit produire 85, jamais le même 95 fixe que toute autre détection');
    });
  } finally {
    await AIPrediction.deleteMany({ _id: { $in: created.predictions } });
    await Patient.findByIdAndDelete(patientAllergique._id);
    await mongoose.disconnect();
  }
});
