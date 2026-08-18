// AUDIT-11 (audit complet post-Phase 10) — 8 contrôleurs construisaient un
// filtre $regex directement depuis une entrée utilisateur (req.query.q ou
// équivalent), sans échapper les métacaractères regex : risque de ReDoS
// (motif pathologique type (a+)+) et de correspondances non voulues (. | etc
// interprétés comme syntaxe regex plutôt que texte littéral). Le seul
// endroit qui s'en protégeait déjà (patients.controller.js) l'a été
// généralisé ici en utils/helpers.js::escapeRegex, appliqué aux 8
// occurrences trouvées — y compris urgencesController.js, initialement
// exclu par erreur de périmètre (confondu avec Urgences.jsx, seul fichier
// réellement hors limites) puis débloqué explicitement (ticket 0019).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { escapeRegex } = require('../utils/helpers');

test('AUDIT-11 — escapeRegex() neutralise les métacaractères regex', () => {
  const cases = [
    ['(a+)+$', '\\(a\\+\\)\\+\\$'],
    ['a.b', 'a\\.b'],
    ['a|b', 'a\\|b'],
    ['a*b?c', 'a\\*b\\?c'],
    ['[abc]', '\\[abc\\]'],
    ['a\\b', 'a\\\\b'],
    ['Aspirine (500mg)', 'Aspirine \\(500mg\\)'],
    ['texte normal', 'texte normal'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(escapeRegex(input), expected, `échappement incorrect pour ${JSON.stringify(input)}`);
  }

  // Un motif pathologique échappé ne doit plus jamais se comporter comme un
  // regex — construit en RegExp réelle et testé contre une chaîne qui
  // matcherait le motif original s'il n'était pas échappé.
  const pathological = '(a+)+$';
  const re = new RegExp(escapeRegex(pathological), 'i');
  assert.equal(re.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!'), false, 'échappé, le motif doit être cherché comme texte littéral, pas exécuté comme regex');
  assert.equal(re.test('prix (a+)+$ inclus'), true, 'la chaîne littérale échappée doit toujours matcher le texte exact qu\'elle représente');
});

test('AUDIT-11 — recherche pharmacy.controller.js::getAll traite les métacaractères comme du texte littéral (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const pharmC = require('../controllers/pharmacy.controller');
  const Medication = require('../models/Medication');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  try {
    const med = await Medication.create({ nom_commercial: `T11-Aspirine (500mg) ${stamp}`, dci: 'Acide acétylsalicylique', categorie: 'Antalgique', prix_vente: 500 });
    cleanup.push(() => Medication.findByIdAndDelete(med._id));
    const unrelated = await Medication.create({ nom_commercial: `T11-Autre-${stamp}-X`, dci: 'Sans rapport', categorie: 'Autre', prix_vente: 100 });
    cleanup.push(() => Medication.findByIdAndDelete(unrelated._id));

    await t.test('recherche par parenthèses littérales trouve le bon médicament', async () => {
      const { status, body } = await call(pharmC.getAll, { query: { q: `(500mg) ${stamp}` } });
      assert.equal(status, 200);
      const found = body.medications.find(m => m._id.toString() === med._id.toString());
      assert.ok(found, 'la recherche avec des parenthèses littérales doit trouver le médicament dont le nom les contient réellement');
      const foundUnrelated = body.medications.find(m => m._id.toString() === unrelated._id.toString());
      assert.equal(foundUnrelated, undefined, 'un médicament sans rapport ne doit pas apparaître');
    });

    await t.test('un motif regex-shaped dans la recherche ne casse pas la requête et ne matche rien de non pertinent', async () => {
      const { status, body } = await call(pharmC.getAll, { query: { q: `(a+)+${stamp}` } });
      assert.equal(status, 200, 'la requête ne doit jamais planter, même avec un motif regex-shaped en entrée');
      assert.equal(body.medications.length, 0, 'un motif qui ne correspond littéralement à aucun nom réel ne doit rien retourner');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});

test('AUDIT-11 — recherche urgencesController.js::getAll traite les métacaractères comme du texte littéral (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const urgC = require('../controllers/urgencesController');
  const Urgence = require('../models/Urgence');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  try {
    const urg = await Urgence.create({ patient_nom: `T11-Douleur (thoracique) ${stamp}`, motif: 'Douleur (thoracique) aiguë' });
    cleanup.push(() => Urgence.findByIdAndDelete(urg._id));
    const unrelated = await Urgence.create({ patient_nom: `T11-SansRapport-${stamp}-X`, motif: 'Entorse cheville' });
    cleanup.push(() => Urgence.findByIdAndDelete(unrelated._id));

    await t.test('recherche par parenthèses littérales trouve le bon dossier', async () => {
      const { status, body } = await call(urgC.getAll, { query: { q: `(thoracique) ${stamp}` } });
      assert.equal(status, 200);
      const found = body.urgences.find(u => u._id.toString() === urg._id.toString());
      assert.ok(found, 'la recherche avec des parenthèses littérales doit trouver le dossier dont le motif les contient réellement');
      const foundUnrelated = body.urgences.find(u => u._id.toString() === unrelated._id.toString());
      assert.equal(foundUnrelated, undefined, 'un dossier sans rapport ne doit pas apparaître');
    });

    await t.test('un motif regex-shaped dans la recherche ne casse pas la requête et ne matche rien de non pertinent', async () => {
      const { status, body } = await call(urgC.getAll, { query: { q: `(a+)+${stamp}` } });
      assert.equal(status, 200, 'la requête ne doit jamais planter, même avec un motif regex-shaped en entrée');
      assert.equal(body.urgences.length, 0, 'un motif qui ne correspond littéralement à aucun dossier réel ne doit rien retourner');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
