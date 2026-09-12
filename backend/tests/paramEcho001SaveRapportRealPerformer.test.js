// PARAM-ECHO-001 (rapport de clôture du 11 sept. 2026) — le groupe
// "Paramètres d'examen" de Realisation.jsx (echographiste/salle) n'avait
// aucun value/onChange : une correction saisie (le réalisateur effectif
// diffère parfois de l'assignation initiale) était toujours perdue.
// saveRapport() accepte désormais echographiste/salle, mais UNIQUEMENT
// s'ils sont explicitement fournis et non vides — jamais un champ absent
// n'écrase la valeur déjà réelle assignée à la planification.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('PARAM-ECHO-001 — saveRapport() persiste réellement une correction echographiste/salle, jamais un champ vide n\'écrase une valeur réelle', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Echographie = require('../models/Echographie');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const radiologue = { _id: new mongoose.Types.ObjectId(), role: 'radiologue', prenom: 'Test', nom: 'Radiologue' };

  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await echoC.saveRapport(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  let demande;
  const cleanup = [];
  try {
    await t.test('echographiste/salle explicitement fournis → réellement persistés', async () => {
      // SPEC-07 (correction du 12 sept. 2026) — saveRapport(rapport_statut:
      // 'valide') exige désormais réellement statut !== 'en_attente' (la
      // demande doit avoir été planifiée) ; ce fixture simule directement
      // une demande déjà planifiée, hors du champ de ce test (persistance
      // echographiste/salle, pas le workflow de planification lui-même).
      demande = await Echographie.create({ patient: new mongoose.Types.ObjectId(), patient_nom: `T-PARAMECHO-${stamp}`, echographiste: 'Aline Mabiala', salle: 'Salle Écho 1', statut: 'planifiee' });
      cleanup.push(() => Echographie.findByIdAndDelete(demande._id));

      const { status, body } = await call({
        params: { id: demande._id }, user: radiologue, ip: '127.0.0.1',
        body: { rapport_statut: 'en_validation', echographiste: 'Paul Nzalé', salle: 'Salle Écho 2' },
      });
      assert.equal(status, 200);
      assert.equal(body.demande.echographiste, 'Paul Nzalé', 'la correction réelle du réalisateur doit être persistée');
      assert.equal(body.demande.salle, 'Salle Écho 2');

      const fresh = await Echographie.findById(demande._id).lean();
      assert.equal(fresh.echographiste, 'Paul Nzalé');
      assert.equal(fresh.salle, 'Salle Écho 2');
    });

    await t.test('echographiste/salle absents du body → la valeur déjà réelle n\'est jamais écrasée', async () => {
      const { status, body } = await call({
        params: { id: demande._id }, user: radiologue, ip: '127.0.0.1',
        body: { rapport_statut: 'valide', conclusion: 'RAS' },
      });
      assert.equal(status, 200);
      assert.equal(body.demande.echographiste, 'Paul Nzalé', 'un body sans echographiste ne doit jamais réinitialiser le champ');
      assert.equal(body.demande.salle, 'Salle Écho 2');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
