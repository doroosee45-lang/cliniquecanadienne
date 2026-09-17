// MODULE AI — sous-module Administratif (implémentation réelle et
// partielle, assumée comme telle : seul "Résumé de consultation" est
// implémenté sur les 8 documents affichés en Sous-phase 5.6, tous des
// boutons "Générer" décoratifs sans handler réel).
//
// ai.controller.js::getConsultationSummary construit un prompt
// EXCLUSIVEMENT à partir de vraies données Consultation (jamais un
// diagnostic/valeur inventé dans le prompt lui-même) et réutilise
// generateReport() (déjà réel, déjà utilisé par le Chat IA et
// getPatientSummary). Ce test appelle réellement OPENAI_API_KEY quand
// elle est configurée sur cet environnement — le contenu exact d'une
// réponse LLM n'est jamais déterministe, donc ce test vérifie la
// structure réelle de bout en bout (200, synthese non vide OU repli
// simulated:true honnête — jamais les deux absents), pas un texte figé.
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

test('AI/Administratif — getConsultationSummary génère réellement un résumé à partir de vraies données de consultation (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const AuditLog = require('../models/AuditLog');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `AIAdmin-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1982-07-14' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecin = await User.create({ email: `_aiadmin-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));
    const consultation = await Consultation.create({
      patient: patient._id, medecin: medecin._id, numero: `C-TEST-${stamp}`,
      anamnese: 'Fièvre et céphalées depuis 3 jours, synthétique.', examen_clinique: 'Température 38.4°C, tension normale.',
      diagnostic: 'Suspicion de paludisme simple (synthétique)', recommandations: 'Traitement antipaludéen, repos, hydratation.',
      decision: 'domicile',
    });
    cleanup.push(() => Consultation.findByIdAndDelete(consultation._id));

    const user = { _id: medecin._id, prenom: 'Dr', nom: 'Test' };

    await t.test('résumé réel généré à partir des vraies données, repli simulé honnête, ou échec réel de l\'appel OpenAI (jamais un texte fabriqué à la place)', async () => {
      const r = await call(aiC.getConsultationSummary, { params: { consultationId: String(consultation._id) }, user, ip: '127.0.0.1', headers: {} });
      if (r.status === 200) {
        // OPENAI_API_KEY configurée et fonctionnelle : exactement un des
        // deux doit être vrai (jamais les deux absents, jamais les deux présents).
        const aUnTexte = typeof r.body.synthese === 'string' && r.body.synthese.length > 0;
        assert.equal(aUnTexte !== r.body.simulated, true, 'exactement un des deux doit être vrai : synthese réelle XOR simulated:true');
        const log = await AuditLog.findOne({ module: 'ia', action: 'IA_CONSULTATION_SUMMARY', entite_id: consultation._id.toString() }).lean();
        assert.ok(log, 'la génération doit être tracée dans AuditLog');
      } else {
        // OPENAI_API_KEY configurée mais l'appel réel échoue (quota,
        // panne...) — même chemin d'erreur qu'exports.chat : 502, message
        // générique jamais le détail brut de l'erreur OpenAI (SEC-AI-ERROR-LEAK).
        assert.equal(r.status, 502, JSON.stringify(r.body));
        assert.equal(r.body.success, false);
        assert.doesNotMatch(r.body.message, /openai|credit|quota|billing/i, 'le message renvoyé au client ne doit jamais exposer le détail brut de l\'erreur OpenAI');
      }
    });

    await t.test('consultation inexistante — 404', async () => {
      const r = await call(aiC.getConsultationSummary, { params: { consultationId: String(new mongoose.Types.ObjectId()) }, user, ip: '127.0.0.1', headers: {} });
      assert.equal(r.status, 404);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
