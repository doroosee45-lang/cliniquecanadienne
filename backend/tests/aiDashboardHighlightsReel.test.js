// POST6-001 (audit final, 17 sept. 2026) — le tableau de bord IA affichait
// 4 "patients à risque" et 6 "recommandations du jour" entièrement codés en
// dur (noms, scores, motifs et chiffres inventés — ex. "André Mboula...
// risque critique 82/100", "510 000 CFA de créances"). Interdiction
// absolue de remplacer une donnée fictive par une autre donnée fictive :
// ai.controller.js::getDashboardHighlights calcule désormais un vrai score
// par patient à partir d'evaluateVitals() (déjà réel, sans plancher
// artificiel, utilisé par runDiagnosis) appliqué aux vraies constantes
// vitales de la consultation la plus récente (7 derniers jours), et des
// recommandations dérivées de vraies requêtes déjà utilisées ailleurs
// (labo critique non acquitté, stock pharmacie bas, créances > 30j).
//
// Preuve centrale de ce test : un patient aux constantes vitales
// normales n'apparaît JAMAIS dans la liste (pas de valeur de remplissage),
// tandis qu'un patient aux constantes réellement anormales apparaît avec
// un score et un motif dérivés exactement des vraies valeurs saisies.
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
// Comparaison AVANT/APRÈS (delta) sur les recommandations car ce test
// tourne contre la base Atlas partagée.
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

test('POST6-001/AI — getDashboardHighlights calcule un vrai score par patient et de vraies recommandations, jamais une donnée codée en dur (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const LabResult = require('../models/LabResult');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const medecin = await User.create({ email: `_aidash-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));

    const patientCritique = await Patient.create({ nom: `AIDashCritique-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1950-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patientCritique._id));
    const patientNormal = await Patient.create({ nom: `AIDashNormal-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1990-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patientNormal._id));

    // Consultation avec de vraies constantes vitales anormales (hyperthermie
    // sévère + tachycardie sévère) — les deux seuils critiques réels
    // d'evaluateVitals(), jamais des valeurs choisies pour "faire un score".
    const consultCritique = await Consultation.create({
      patient: patientCritique._id, medecin: medecin._id, numero: `C-DASH-CRIT-${stamp}`,
      date_consultation: new Date(),
      signes_vitaux: { temperature: 40.2, pouls: 135, tension_systolique: 120, tension_diastolique: 80 },
    });
    cleanup.push(() => Consultation.findByIdAndDelete(consultCritique._id));

    // Consultation avec de vraies constantes vitales strictement normales —
    // ne doit jamais apparaître dans "patients à surveiller".
    const consultNormale = await Consultation.create({
      patient: patientNormal._id, medecin: medecin._id, numero: `C-DASH-NORM-${stamp}`,
      date_consultation: new Date(),
      signes_vitaux: { temperature: 37.0, pouls: 72, tension_systolique: 118, tension_diastolique: 76, glycemie: 0.9 },
    });
    cleanup.push(() => Consultation.findByIdAndDelete(consultNormale._id));

    await t.test('patient aux constantes anormales : vrai score + vrai motif dérivés des vraies alertes, jamais un nom/score inventé', async () => {
      const r = await call(aiC.getDashboardHighlights, {});
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const entry = r.body.patients_risque.find(p => p.patient_id === String(patientCritique._id));
      assert.ok(entry, 'le patient aux constantes réellement anormales doit apparaître');
      assert.equal(entry.nom, 'Synthetique ' + `AIDashCritique-${stamp}`);
      assert.equal(entry.niveau, 'critique');
      assert.equal(entry.score, 80, 'hyperthermie sévère (40) + tachycardie sévère (40) = 80, jamais un score arbitraire');
      assert.match(entry.motif, /Hyperthermie sévère/);
      assert.match(entry.motif, /Tachycardie sévère/);
    });

    await t.test('patient aux constantes normales : aucune anomalie réelle détectée → absent de la liste, jamais une entrée de remplissage', async () => {
      const r = await call(aiC.getDashboardHighlights, {});
      const entry = r.body.patients_risque.find(p => p.patient_id === String(patientNormal._id));
      assert.equal(entry, undefined, 'un patient sans anomalie vitale réelle ne doit jamais recevoir un score fabriqué');
    });

    // Recommandations — vraie détection d'un résultat labo critique non
    // acquitté (delta, base partagée).
    const avant = await call(aiC.getDashboardHighlights, {});
    const labo = await LabResult.create({ patient: patientCritique._id, est_critique: true, statut: 'termine' });
    cleanup.push(() => LabResult.findByIdAndDelete(labo._id));

    await t.test('recommandation Laboratoire dérivée d\'un vrai résultat critique non acquitté, jamais un chiffre inventé', async () => {
      const r = await call(aiC.getDashboardHighlights, {});
      const recoAvant = avant.body.recommandations.find(x => x.module === 'Laboratoire');
      const recoApres = r.body.recommandations.find(x => x.module === 'Laboratoire');
      assert.ok(recoApres, 'une recommandation Laboratoire doit apparaître dès qu\'un résultat critique non acquitté existe');
      const nAvant = recoAvant ? parseInt(recoAvant.detail, 10) : 0;
      const nApres = parseInt(recoApres.detail, 10);
      assert.equal(nApres - nAvant, 1, 'le compteur doit augmenter exactement du vrai résultat critique créé');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
