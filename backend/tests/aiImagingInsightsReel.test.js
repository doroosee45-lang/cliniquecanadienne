// MODULE AI — sous-module Imagerie IA (implémentation réelle demandée
// explicitement pour remplacer le placeholder "🚧 Fonctionnalité en cours
// de développement" posé en Sous-phase 5.6 à la place d'un contenu
// diagnostique entièrement inventé — POINT LE PLUS SENSIBLE de l'audit
// ayant motivé cette désactivation).
//
// ai.controller.js::getImagingInsights n'écrit ni ne génère AUCUN texte
// médical : conclusion/compte_rendu affichés sont le vrai texte saisi par
// le radiologue, anomalie_detectee son vrai jugement clinique. La
// comparaison porte sur le vrai examen antérieur du même type. Vérifie
// aussi qu'ia_anomalie/ia_confidence (jamais alimentés pour ImagingResult
// par aucun contrôleur — vérifié avant ce correctif) ne sont jamais
// exposés comme s'ils étaient réels.
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
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

test('AI/Imagerie — getImagingInsights expose le vrai compte-rendu radiologue et une vraie comparaison, jamais un diagnostic inventé (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const ImagingResult = require('../models/ImagingResult');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `AIImg-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1978-11-02' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    const ancien = await ImagingResult.create({
      patient: patient._id, type_examen: 'Radiographie thorax', statut: 'rapporte',
      date_rapport: new Date(Date.now() - 200 * 86400000),
      conclusion: 'Absence d\'opacité parenchymateuse. Examen normal.',
      anomalie_detectee: false, ia_anomalie: true, ia_confidence: 87, // jamais réellement alimentés — ne doivent jamais être exposés
    });
    cleanup.push(() => ImagingResult.findByIdAndDelete(ancien._id));

    const recent = await ImagingResult.create({
      patient: patient._id, type_examen: 'Radiographie thorax', statut: 'rapporte',
      date_rapport: new Date(),
      conclusion: 'Opacité basale droite, aspect évocateur de foyer infectieux.',
      anomalie_detectee: true,
    });
    cleanup.push(() => ImagingResult.findByIdAndDelete(recent._id));

    const sansCompteRendu = await ImagingResult.create({
      patient: patient._id, type_examen: 'Échographie abdominale', statut: 'rapporte',
      date_rapport: new Date(),
    });
    cleanup.push(() => ImagingResult.findByIdAndDelete(sansCompteRendu._id));

    await t.test('compte-rendu réel affiché, comparaison réelle avec l\'examen antérieur du même type', async () => {
      const r = await call(aiC.getImagingInsights, { params: { patientId: String(patient._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.historique_count, 3);

      const thorax = r.body.examens.find(e => e.type_examen === 'Radiographie thorax' && e.anomalie_detectee === true);
      assert.ok(thorax, 'l\'examen le plus récent doit être présent');
      assert.equal(thorax.conclusion, 'Opacité basale droite, aspect évocateur de foyer infectieux.', 'la vraie conclusion du radiologue, jamais reformulée ni inventée');
      assert.ok(thorax.comparaison, 'une comparaison doit exister (même type, examen antérieur réel)');
      assert.equal(thorax.comparaison.conclusion, 'Absence d\'opacité parenchymateuse. Examen normal.', 'la vraie conclusion de l\'examen antérieur, jamais un texte de comparaison inventé');

      // ia_anomalie/ia_confidence ne doivent JAMAIS apparaître dans la
      // réponse : ils ne sont réellement alimentés par aucun contrôleur
      // pour ce modèle, les exposer afficherait un calcul qui n'a jamais eu lieu.
      assert.equal('ia_anomalie' in thorax, false);
      assert.equal('ia_confidence' in thorax, false);
    });

    await t.test('examen sans compte-rendu — état honnête "en attente", jamais un résultat inventé, aucune comparaison fabriquée', async () => {
      const r = await call(aiC.getImagingInsights, { params: { patientId: String(patient._id) } });
      const echo = r.body.examens.find(e => e.type_examen === 'Échographie abdominale');
      assert.ok(echo);
      assert.equal(echo.conclusion, null);
      assert.equal(echo.compte_rendu, null);
      assert.equal(echo.comparaison, null, 'premier examen de ce type pour ce patient — aucune référence antérieure à inventer');
    });

    await t.test('non-régression — patient sans aucun examen rapporté : liste vide honnête', async () => {
      const patientVide = await Patient.create({ nom: `AIImgVide-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1995-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patientVide._id));
      const r = await call(aiC.getImagingInsights, { params: { patientId: String(patientVide._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.historique_count, 0);
      assert.deepEqual(r.body.examens, []);
    });

    await t.test('patient inexistant — 404', async () => {
      const r = await call(aiC.getImagingInsights, { params: { patientId: String(new mongoose.Types.ObjectId()) } });
      assert.equal(r.status, 404);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
