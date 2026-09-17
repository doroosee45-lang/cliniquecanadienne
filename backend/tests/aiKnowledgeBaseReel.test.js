// MODULE AI — onglet "Base de connaissances" (implémentation réelle,
// demandée explicitement en complément des 5 sous-modules pour remplacer
// le dernier placeholder "🚧 Fonctionnalité en cours de développement"
// du module IA).
//
// ai.controller.js::getKnowledgeBase n'invente aucun contenu médical : il
// rend consultables trois références déjà réelles et déjà utilisées
// ailleurs pour de vraies décisions cliniques — ExamCatalogue (catalogue
// réel labo/imagerie), INTERACTIONS_DB (utils/drugInteractions.js, déjà
// utilisé par checkInteractions/prescriptions/pharmacy), et SYMPTOM_MAP
// (déjà utilisé par runDiagnosis). Ce test vérifie la consolidation et le
// filtrage réels, jamais une donnée fabriquée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('AI/Base de connaissances — getKnowledgeBase consolide les vraies références existantes, jamais un contenu inventé (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ExamCatalogue = require('../models/ExamCatalogue');
  const { INTERACTIONS_DB } = require('../utils/drugInteractions');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const examenReel = await ExamCatalogue.create({
      nom: `Examen synthétique ${stamp}`, code: `SYN-${stamp}`, type: 'laboratoire',
      description: 'Description synthétique de test.', prix: 7500, delai_rendu_h: 12, statut: 'actif',
    });
    cleanup.push(() => ExamCatalogue.findByIdAndDelete(examenReel._id));
    // Examen inactif — ne doit jamais apparaître (catalogue réellement
    // proposé au personnel, pas un catalogue historique complet).
    const examenInactif = await ExamCatalogue.create({
      nom: `Examen inactif synthétique ${stamp}`, code: `SYNX-${stamp}`, type: 'laboratoire', statut: 'inactif',
    });
    cleanup.push(() => ExamCatalogue.findByIdAndDelete(examenInactif._id));

    await t.test('catalogue d\'examens réel — actif inclus, inactif exclu, jamais un examen inventé', async () => {
      const r = await call(aiC.getKnowledgeBase, { query: {} });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const found = r.body.items.find(i => i.categorie === 'examen' && i.titre === examenReel.nom);
      assert.ok(found, 'l\'examen actif réellement créé doit apparaître');
      assert.equal(found.detail, 'Description synthétique de test.');
      assert.ok(found.meta.some(m => m.includes('7')), 'le prix réel doit apparaître (7 500 CFA)');
      const foundInactif = r.body.items.find(i => i.categorie === 'examen' && i.titre === examenInactif.nom);
      assert.equal(foundInactif, undefined, 'un examen inactif ne doit jamais apparaître');
    });

    await t.test('interactions médicamenteuses — exactement la vraie source utils/drugInteractions.js, jamais une copie divergente', async () => {
      const r = await call(aiC.getKnowledgeBase, { query: {} });
      const interactions = r.body.items.filter(i => i.categorie === 'interaction');
      assert.equal(interactions.length, INTERACTIONS_DB.length, 'même nombre exact que la source unique réelle');
      const warfarine = interactions.find(i => i.tags.includes('warfarine'));
      assert.ok(warfarine);
      assert.match(warfarine.detail, /hémorragique/i);
    });

    await t.test('symptômes — exactement la vraie source SYMPTOM_MAP utilisée par runDiagnosis', async () => {
      const r = await call(aiC.getKnowledgeBase, { query: {} });
      const fievre = r.body.items.find(i => i.categorie === 'symptome' && i.tags.includes('fievre'));
      assert.ok(fievre, 'le symptôme "fievre" doit apparaître (même source que runDiagnosis)');
      assert.match(fievre.detail, /paludisme/i);
    });

    await t.test('recherche serveur (q) filtre réellement, jamais une recherche décorative', async () => {
      const r = await call(aiC.getKnowledgeBase, { query: { q: 'warfarine' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.ok(r.body.total >= 1);
      assert.ok(r.body.items.every(i => i.tags.some(t => t.includes('warfarine')) || i.titre.toLowerCase().includes('warfarine') || i.detail.toLowerCase().includes('warfarine')));
      const rVide = await call(aiC.getKnowledgeBase, { query: { q: `inexistant-${stamp}` } });
      assert.equal(rVide.body.total, 0, 'une recherche sans correspondance réelle doit renvoyer une liste vide, jamais un résultat inventé');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
