const AIPrediction  = require('../models/AIPrediction');
const Patient       = require('../models/Patient');
const LabResult     = require('../models/LabResult');
const ImagingResult = require('../models/ImagingResult');
const Prescription  = require('../models/Prescription');
const Hospitalization = require('../models/Hospitalization');
const Consultation  = require('../models/Consultation');
const { logAction } = require('../utils/helpers');
const { detectInteractions } = require('../utils/drugInteractions');
const { logger } = require('../utils/logger');

// ─── Symptômes → conditions probables ────────────────────────
const SYMPTOM_MAP = {
  fievre:            ['Paludisme', 'Fièvre typhoïde', 'Pneumonie', 'Infection urinaire', 'COVID-19'],
  frissons:          ['Paludisme', 'Fièvre typhoïde', 'Sepsis'],
  cephalees:         ['Paludisme', 'Hypertension artérielle', 'Méningite', 'Migraine'],
  douleurs_musculaires: ['Paludisme', 'Grippe', 'Leptospirose'],
  toux:              ['Pneumonie', 'Tuberculose', 'COVID-19', 'Asthme', 'Bronchite'],
  toux_chronique:    ['Tuberculose', 'Asthme', 'BPCO'],
  hemoptysie:        ['Tuberculose', 'Cancer pulmonaire', 'Pneumonie sévère'],
  dyspnee:           ['Pneumonie', 'Insuffisance cardiaque', 'Asthme', 'Embolie pulmonaire'],
  douleur_thoracique:['Angine de poitrine', 'Infarctus du myocarde', 'Péricardite', 'Pneumonie'],
  nausees:           ['Gastroentérite', 'Paludisme', 'Grossesse', 'Appendicite'],
  vomissements:      ['Gastroentérite', 'Paludisme', 'Appendicite', 'Occlusion intestinale'],
  diarrhee:          ['Gastroentérite', 'Fièvre typhoïde', 'Dysenterie', 'Choléra'],
  douleur_abdominale:['Appendicite', 'Gastroentérite', 'Ulcère gastrique', 'Cholécystite'],
  douleur_fossa_iliaque_droite: ['Appendicite'],
  polyurie:          ['Diabète', 'Infection urinaire', 'Insuffisance rénale'],
  polydipsie:        ['Diabète', 'Diabète insipide'],
  perte_poids:       ['Diabète', 'Tuberculose', 'VIH/SIDA', 'Cancer'],
  fatigue:           ['Anémie', 'Paludisme', 'Diabète', 'VIH/SIDA', 'Hypothyroïdie'],
  paleur:            ['Anémie sévère', 'Paludisme grave', 'Hémorragie'],
  ictere:            ['Hépatite virale', 'Paludisme grave', 'Lithiase biliaire', 'Leptospirose'],
  eruption_cutanee:  ['Rougeole', 'Varicelle', 'Allergie', 'Scarlatine'],
  oedemes:           ['Insuffisance cardiaque', 'Insuffisance rénale', 'Malnutrition', 'Grossesse'],
  convulsions:       ['Méningite', 'Paludisme grave', 'Épilepsie', 'Hypoglycémie'],
  troubles_conscience: ['Paludisme grave', 'Méningite', 'AVC', 'Hypoglycémie'],
  douleur_lombaire:  ['Lithiase rénale', 'Pyélonéphrite', 'Lombalgie'],
  brulures_miction:  ['Cystite', 'Urétrite', 'Prostatite'],
  pertes_vaginales:  ['Vaginite', 'Infections sexuellement transmissibles'],
  douleurs_pelviennes: ['Salpingite', 'Grossesse extra-utérine', 'Endométriose'],
};

// Interactions médicamenteuses connues — voir utils/drugInteractions.js
// (source unique de vérité, également utilisée par prescriptions.controller.js
// et pharmacy.controller.js, qui maintenaient chacun leur propre liste partielle).

// ─── Calcul risques cliniques ─────────────────────────────────
function computeRisks(patient, symptoms = [], vitals = {}) {
  const age = patient?.date_naissance
    ? Math.floor((Date.now() - new Date(patient.date_naissance)) / (365.25 * 24 * 3600 * 1000))
    : null;
  const sexe = patient?.sexe || '';
  const antecedents = (patient?.antecedents_medicaux || []).map(a => a.toLowerCase());
  const symp = symptoms.map(s => s.toLowerCase());

  // Score diagnostique global
  let diagnostic = 30;
  if (vitals.temperature > 38.5) diagnostic += 25;
  else if (vitals.temperature > 37.5) diagnostic += 10;
  if (vitals.frequence_cardiaque > 100 || vitals.frequence_cardiaque < 50) diagnostic += 15;
  if (symp.length > 3) diagnostic += 15;
  if (antecedents.length > 2) diagnostic += 10;
  diagnostic = Math.min(diagnostic, 99);

  // Score diabétique
  let diabetique = 5;
  if (vitals.glycemie > 1.26) diabetique += 60;
  else if (vitals.glycemie > 1.10) diabetique += 30;
  if (symp.includes('polyurie') || symp.includes('polydipsie')) diabetique += 20;
  if (symp.includes('perte_poids')) diabetique += 10;
  if (antecedents.some(a => a.includes('diabet'))) diabetique += 20;
  if (age > 45) diabetique += 10;
  const bmi = vitals.poids && vitals.taille
    ? vitals.poids / ((vitals.taille / 100) ** 2) : null;
  if (bmi && bmi > 30) diabetique += 10;
  diabetique = Math.min(diabetique, 99);

  // Score cardiovasculaire
  let cardiovasculaire = 5;
  const [sys, dia] = vitals.pression_arterielle
    ? String(vitals.pression_arterielle).split('/').map(Number) : [0, 0];
  if (sys >= 160 || dia >= 100) cardiovasculaire += 35;
  else if (sys >= 140 || dia >= 90) cardiovasculaire += 20;
  if (symp.includes('douleur_thoracique')) cardiovasculaire += 25;
  if (symp.includes('dyspnee')) cardiovasculaire += 15;
  if (antecedents.some(a => a.includes('cardio') || a.includes('hypertension') || a.includes('infarctus'))) cardiovasculaire += 20;
  if (age > 60) cardiovasculaire += 15;
  else if (age > 45) cardiovasculaire += 8;
  if (sexe === 'M' && age > 45) cardiovasculaire += 5;
  cardiovasculaire = Math.min(cardiovasculaire, 99);

  // Score obstétrical (femmes en âge de procréer)
  let obstetrical = 0;
  if (sexe === 'F' && age >= 15 && age <= 50) {
    obstetrical = 10;
    if (symp.includes('nausees') || symp.includes('vomissements')) obstetrical += 20;
    if (symp.includes('douleurs_pelviennes')) obstetrical += 25;
    if (symp.includes('pertes_vaginales')) obstetrical += 15;
    if (antecedents.some(a => a.includes('grossesse') || a.includes('gyn'))) obstetrical += 15;
    obstetrical = Math.min(obstetrical, 99);
  }

  return { diagnostic, diabetique, cardiovasculaire, obstetrical };
}

// ─── Évaluation des constantes vitales ───────────────────────
function evaluateVitals(vitals = {}) {
  const alerts = [];
  if (vitals.temperature) {
    if (vitals.temperature > 39.5)      alerts.push({ champ: 'Température', valeur: `${vitals.temperature}°C`, niveau: 'critique', message: 'Hyperthermie sévère' });
    else if (vitals.temperature > 38)   alerts.push({ champ: 'Température', valeur: `${vitals.temperature}°C`, niveau: 'alerte', message: 'Fièvre' });
    else if (vitals.temperature > 37.5) alerts.push({ champ: 'Température', valeur: `${vitals.temperature}°C`, niveau: 'info', message: 'Subfébrile' });
  }
  if (vitals.frequence_cardiaque) {
    if (vitals.frequence_cardiaque > 120)  alerts.push({ champ: 'Fréquence cardiaque', valeur: `${vitals.frequence_cardiaque} bpm`, niveau: 'critique', message: 'Tachycardie sévère' });
    else if (vitals.frequence_cardiaque > 100) alerts.push({ champ: 'Fréquence cardiaque', valeur: `${vitals.frequence_cardiaque} bpm`, niveau: 'alerte', message: 'Tachycardie' });
    else if (vitals.frequence_cardiaque < 50)  alerts.push({ champ: 'Fréquence cardiaque', valeur: `${vitals.frequence_cardiaque} bpm`, niveau: 'critique', message: 'Bradycardie' });
  }
  if (vitals.pression_arterielle) {
    const [sys] = String(vitals.pression_arterielle).split('/').map(Number);
    if (sys >= 180)      alerts.push({ champ: 'Tension artérielle', valeur: vitals.pression_arterielle, niveau: 'critique', message: 'Crise hypertensive' });
    else if (sys >= 140) alerts.push({ champ: 'Tension artérielle', valeur: vitals.pression_arterielle, niveau: 'alerte', message: 'Hypertension' });
    else if (sys < 90)   alerts.push({ champ: 'Tension artérielle', valeur: vitals.pression_arterielle, niveau: 'critique', message: 'Hypotension' });
  }
  if (vitals.glycemie) {
    if (vitals.glycemie > 2.0)       alerts.push({ champ: 'Glycémie', valeur: `${vitals.glycemie} g/L`, niveau: 'critique', message: 'Hyperglycémie sévère' });
    else if (vitals.glycemie > 1.26) alerts.push({ champ: 'Glycémie', valeur: `${vitals.glycemie} g/L`, niveau: 'alerte', message: 'Diabète probable' });
    else if (vitals.glycemie < 0.6)  alerts.push({ champ: 'Glycémie', valeur: `${vitals.glycemie} g/L`, niveau: 'critique', message: 'Hypoglycémie' });
  }
  return alerts;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/stats
// ═══════════════════════════════════════════════════════════════
exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay   = new Date(now.setHours(0, 0, 0, 0));

    // AI-01 (correction du 12 sept. 2026, audit indépendant) — ce ratio
    // (prédictions au statut 'traite' / total) était nommé/étiqueté
    // "precision" : un taux de traitement des alertes, pas une précision de
    // modèle (aucune vérité terrain, aucune mesure de justesse des
    // prédictions n'existe dans ce système). Renommé pour refléter
    // honnêtement ce qui est réellement mesuré.
    // PERF-001 (audit de performance du 12 sept. 2026) — traites/total
    // fusionnés dans le même Promise.all que les 7 comptages ci-dessus
    // (tous indépendants) plutôt qu'un second aller-retour groupé séparé.
    const [
      analyses_mois,
      diagnostics_mois,
      interactions_mois,
      labo_critiques,
      labo_anomalies_ia,
      imagerie_urgentes,
      patients_analyses,
      traites,
      total,
    ] = await Promise.all([
      AIPrediction.countDocuments({ createdAt: { $gte: startOfMonth } }),
      AIPrediction.countDocuments({ type: 'diagnostic', createdAt: { $gte: startOfMonth } }),
      AIPrediction.countDocuments({ type: 'interaction_medicament', createdAt: { $gte: startOfMonth } }),
      LabResult.countDocuments({ est_critique: true, createdAt: { $gte: startOfDay } }),
      LabResult.countDocuments({ ia_anomalie: true, createdAt: { $gte: startOfMonth } }),
      ImagingResult.countDocuments({ priorite: { $in: ['urgente', 'tres_urgente', 'stat'] }, createdAt: { $gte: startOfDay } }),
      AIPrediction.distinct('patient', { createdAt: { $gte: startOfMonth } }),
      AIPrediction.countDocuments({ statut: 'traite' }),
      AIPrediction.countDocuments(),
    ]);
    const taux_traitement = total > 0 ? Math.round((traites / total) * 100) : 0;

    // R-10c — conflit_rdv retiré de l'enum AIPrediction.type (jamais alimenté) ;
    // alertes_risque ne compte plus que les deux sources réellement produites.
    const alertes_risque = labo_critiques + imagerie_urgentes;

    // POST5-011 (audit indépendant post-Phase 5, 14 sept. 2026) — le
    // graphique "Activité IA — 7 derniers jours" (AI.jsx, onglet Tableau
    // de bord) était alimenté par un tableau littéral codé en dur
    // ([12,18,9,24,16,7,4]), jamais issu d'une requête réelle, alors que
    // AIPrediction (createdAt réel sur chaque prédiction) permet un vrai
    // comptage quotidien — même principe que echographieController.js::
    // getStats (agrégation par période réelle, jamais une valeur inventée
    // quand la donnée source existe réellement).
    const septJoursAgo = new Date();
    septJoursAgo.setDate(septJoursAgo.getDate() - 6);
    septJoursAgo.setHours(0, 0, 0, 0);
    const activiteAgg = await AIPrediction.aggregate([
      { $match: { createdAt: { $gte: septJoursAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]);
    const activiteLabels = [];
    const activiteData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      activiteLabels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
      const entry = activiteAgg.find(a => a._id === key);
      activiteData.push(entry ? entry.count : 0);
    }

    res.json({
      success: true,
      stats: {
        analyses_mois,
        diagnostics: diagnostics_mois,
        taux_traitement,
        interactions: interactions_mois,
        alertes_risque,
        labo_critiques,
        labo_anomalies_ia,
        imagerie_urgentes,
        patients_analyses: patients_analyses.length,
        activite_7j: { labels: activiteLabels, data: activiteData },
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/predictions
// ═══════════════════════════════════════════════════════════════
exports.getPredictions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type = '', patient = '', statut = '' } = req.query;
    const filter = {};
    if (type)    filter.type    = type;
    if (patient) filter.patient = patient;
    if (statut)  filter.statut  = statut;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    // PERF-001 (audit de performance du 12 sept. 2026) — indépendants, en parallèle.
    const [total, predictions] = await Promise.all([
      AIPrediction.countDocuments(filter),
      AIPrediction.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('traite_par', 'nom prenom')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
    ]);

    res.json({ success: true, predictions, total });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/diagnose
// ═══════════════════════════════════════════════════════════════
exports.runDiagnosis = async (req, res, next) => {
  try {
    const { patientId, symptoms = [], vitals = {} } = req.body;

    // Charger les données réelles du patient
    const [patient, recentLabs, recentImaging, recentPrescriptions, hospitalizations] =
      await Promise.all([
        patientId ? Patient.findById(patientId).lean() : null,
        patientId ? LabResult.find({ patient: patientId }).sort('-createdAt').limit(5).lean() : [],
        patientId ? ImagingResult.find({ patient: patientId }).sort('-createdAt').limit(5).lean() : [],
        patientId ? Prescription.find({ patient: patientId, statut: { $in: ['active', 'publiee'] } }).sort('-createdAt').limit(3).lean() : [],
        patientId ? Hospitalization.find({ patient: patientId }).sort('-createdAt').limit(2).lean() : [],
      ]);

    // Construire les suggestions diagnostiques
    const conditionScores = {};
    for (const sym of symptoms) {
      const key = sym.toLowerCase().replace(/\s+/g, '_');
      const conditions = SYMPTOM_MAP[key] || [];
      for (const cond of conditions) {
        conditionScores[cond] = (conditionScores[cond] || 0) + 1;
      }
    }

    // Enrichir avec les anomalies labo récentes
    const labCritiques = recentLabs.filter(l => l.est_critique || l.ia_anomalie);
    if (labCritiques.length > 0) {
      conditionScores['Anomalie biologique (voir résultats labo)'] = labCritiques.length * 2;
    }

    // Alertes constantes vitales
    const vitalAlerts = evaluateVitals(vitals);

    // Trier les suggestions par score décroissant
    const suggestions = Object.entries(conditionScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([condition, score]) => ({
        condition,
        probabilite: Math.min(Math.round((score / symptoms.length) * 100), 95),
        urgence: score >= 3 ? 'elevée' : score >= 2 ? 'modérée' : 'faible',
      }));

    // Calcul des scores de risque
    const risks = computeRisks(patient, symptoms, vitals);

    // Résumé du contexte patient
    const patient_context = patient ? {
      nom:                `${patient.prenom} ${patient.nom}`,
      numero_dossier:     patient.numero_dossier,
      age:                patient.date_naissance
        ? Math.floor((Date.now() - new Date(patient.date_naissance)) / (365.25 * 24 * 3600 * 1000))
        : null,
      sexe:               patient.sexe,
      groupe_sanguin:     patient.groupe_sanguin,
      allergies:          patient.allergies || [],
      antecedents:        patient.antecedents_medicaux || [],
      hospitalisations_recentes: hospitalizations.length,
    } : null;

    // Sauvegarder la prédiction IA
    const prediction = await AIPrediction.create({
      type: 'diagnostic',
      patient: patientId || undefined,
      resultat: { suggestions, risks, vitalAlerts, vitals, symptoms },
      score_confiance: suggestions.length > 0
        ? Math.min(suggestions[0].probabilite, 92)
        : 30,
      statut: 'en_attente',
    });

    // Mettre à jour les résultats labo avec flag IA si anomalie détectée
    if (labCritiques.length > 0 && patientId) {
      await LabResult.updateMany(
        { patient: patientId, est_critique: true, ia_anomalie: false },
        { ia_anomalie: true, ia_details: 'Anomalie détectée lors de l\'analyse IA du dossier patient' }
      );
    }

    await logAction({
      utilisateur: req.user?._id,
      action: 'IA_DIAGNOSTIC',
      module: 'ia',
      entite_id: prediction._id,
      ip: req.ip,
      ua: req.headers['user-agent'],
      message: `Analyse IA diagnostique — patient: ${patientId || 'anonyme'} — ${suggestions.length} suggestions`,
    });

    res.status(201).json({
      success: true,
      prediction_id: prediction._id,
      suggestions,
      risks,
      vitalAlerts,
      patient_context,
      recent_labs: recentLabs.map(l => ({
        id: l._id,
        date: l.date_prescription,
        statut: l.statut,
        critique: l.est_critique,
        ia_anomalie: l.ia_anomalie,
      })),
      recent_imaging: recentImaging.map(i => ({
        id: i._id,
        type_examen: i.type_examen,
        date: i.date_prescription,
        conclusion: i.conclusion,
        priorite: i.priorite,
      })),
      active_prescriptions: recentPrescriptions.map(p => ({
        id: p._id,
        numero_rx: p.numero_rx,
        medicaments: p.lignes?.map(l => l.medicament_nom).filter(Boolean) || [],
        interactions_connues: p.interactions_detectees?.length || 0,
      })),
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/interactions
// ═══════════════════════════════════════════════════════════════
exports.checkInteractions = async (req, res, next) => {
  try {
    const { medications = [], patientId } = req.body;
    const warnings = [];

    const medNames = medications.map(m =>
      (typeof m === 'string' ? m : m.nom || m.name || '').toLowerCase()
    );

    // Vérifier les interactions connues
    warnings.push(...detectInteractions(medNames));

    // Vérifier les allergies patient
    let allergieWarnings = [];
    if (patientId) {
      const patient = await Patient.findById(patientId).select('allergies nom prenom').lean();
      if (patient?.allergies?.length > 0) {
        const allergies = patient.allergies.map(a => a.toLowerCase());
        for (const med of medNames) {
          for (const allergie of allergies) {
            if (med.includes(allergie) || allergie.includes(med)) {
              allergieWarnings.push({
                medicaments: [med],
                risque: 'elevé',
                description: `⚠️ ALLERGIE PATIENT : ${patient.prenom} ${patient.nom} est allergique à « ${allergie} ». Contre-indication absolue.`,
              });
            }
          }
        }
      }
    }

    const allWarnings = [...allergieWarnings, ...warnings];

    // Sauvegarder si des interactions détectées
    if (allWarnings.length > 0) {
      // AI-02 (correction du 12 sept. 2026, audit indépendant) — 95 fixe,
      // jamais une confiance réellement calculée. Ce détecteur n'est pas un
      // modèle probabiliste (aucun entraînement, aucune probabilité de
      // sortie) : c'est un appariement déterministe (allergie du patient
      // réellement documentée, ou paire de médicaments d'une table de
      // référence statique, detectInteractions()). Un score réel et
      // honnête ici reflète donc la NATURE de l'appariement plutôt qu'un
      // nombre inventé : une allergie patient documentée est un signal
      // certain et spécifique à ce patient (100) ; une interaction
      // médicamenteuse générique (table de référence, non spécifique au
      // patient) reste un signal fort mais moins spécifique (85).
      const score_confiance = allergieWarnings.length > 0 ? 100 : 85;
      const prediction = await AIPrediction.create({
        type: 'interaction_medicament',
        patient: patientId || undefined,
        resultat: { medications: medNames, warnings: allWarnings },
        score_confiance,
        statut: 'en_attente',
      });
      await logAction({ utilisateur: req.user?._id, action: 'IA_INTERACTION_DETECTEE', module: 'ia', entite_id: prediction._id, ip: req.ip, message: `${allWarnings.length} interaction(s)/allergie(s) détectée(s)` });
    }

    res.json({
      success: true,
      warnings: allWarnings,
      total_verifiees: medNames.length,
      interactions_detectees: allWarnings.length,
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/alerts  — alertes critiques cross-modules
// ═══════════════════════════════════════════════════════════════
exports.getAlerts = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000); // 7 derniers jours

    const [labCritiques, imagerieStat, predictionsEnAttente] = await Promise.all([
      LabResult.find({ est_critique: true, acquitte_par: null, createdAt: { $gte: since } })
        .populate('patient', 'nom prenom numero_dossier')
        .select('patient patient_nom est_critique ia_anomalie createdAt statut')
        .sort('-createdAt').limit(20).lean(),

      ImagingResult.find({ priorite: { $in: ['tres_urgente', 'stat'] }, createdAt: { $gte: since } })
        .populate('patient', 'nom prenom numero_dossier')
        .select('patient patient_nom type_examen priorite createdAt')
        .sort('-createdAt').limit(20).lean(),

      AIPrediction.find({ statut: 'en_attente', createdAt: { $gte: since } })
        .populate('patient', 'nom prenom numero_dossier')
        .sort('-createdAt').limit(30).lean(),
    ]);

    res.json({
      success: true,
      alerts: {
        labo_critiques: labCritiques,
        imagerie_urgentes: imagerieStat,
        predictions_en_attente: predictionsEnAttente,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/chat  — Chat Assistant IA (AI.jsx, panneau Header)
// CHAT-001 (rapport de clôture du 11 sept. 2026) — les autres actions IA de
// ce fichier (diagnose/interactions/predictions ci-dessus) forment un moteur
// déterministe local (SYMPTOM_MAP, utils/drugInteractions.js), jamais un
// appel LLM. utils/openai.js::generateReport() existe déjà, réel (appel
// OpenAI + repli simulé honnête si OPENAI_API_KEY absente, jamais un faux
// succès), mais n'était utilisé que par le rapport hebdomadaire Analytics
// (utils/weeklyAnalyticsReport.js) — même service réutilisé tel quel ici,
// aucune seconde intégration OpenAI créée.
const openai = require('../utils/openai');
const CHAT_SYSTEM_PROMPT = "Tu es l'assistant IA de MediSync, le système d'information de la Clinique Canadienne de Souanké. Tu réponds au personnel médical connecté (jamais directement à un patient) de façon concise et utile, en français. Tu ne fournis JAMAIS de diagnostic définitif ni de prescription : rappelle que la décision clinique reste la responsabilité du professionnel de santé. Tes réponses sont informatives uniquement.";
const CHAT_MAX_MESSAGE_LEN = 2000;
const CHAT_MAX_HISTORY = 6;

exports.chat = async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message vide.' });
  }
  if (message.length > CHAT_MAX_MESSAGE_LEN) {
    return res.status(400).json({ success: false, message: `Message trop long (max ${CHAT_MAX_MESSAGE_LEN} caractères).` });
  }
  // Historique replié dans le userPrompt (plutôt qu'un tableau messages[])
  // pour réutiliser generateReport() sans modifier sa signature — aucun
  // autre appelant (weeklyAnalyticsReport.js) n'est affecté.
  const histArr = Array.isArray(history) ? history.slice(-CHAT_MAX_HISTORY) : [];
  const transcript = histArr
    .filter(h => h && typeof h.content === 'string' && (h.role === 'user' || h.role === 'bot'))
    .map(h => `${h.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${h.content}`)
    .join('\n');
  const userPrompt = transcript ? `${transcript}\nUtilisateur: ${message}` : message;

  try {
    const result = await openai.generateReport({ systemPrompt: CHAT_SYSTEM_PROMPT, userPrompt });
    if (result.simulated) {
      // Jamais une réponse fictive présentée comme réelle : le simulé est
      // annoncé comme une indisponibilité, pas comme une réponse IA.
      return res.json({ success: false, simulated: true, message: 'Assistant IA indisponible — OPENAI_API_KEY non configurée sur le serveur.' });
    }
    res.json({
      success: true,
      reply: result.content,
      disclaimer: 'Réponse générée par IA — à titre informatif — non validée médicalement.',
    });
  } catch (err) {
    // SEC-AI-ERROR-LEAK (13 sept. 2026, découvert en test navigateur réel sur
    // le pendant patient de ce même appel, portal.controller.js::aiChat) —
    // err.message peut porter le texte brut renvoyé par l'API OpenAI (ex.
    // un lien vers la page de facturation du compte OpenAI de la clinique),
    // un détail d'infrastructure interne sans raison d'atteindre le client,
    // même s'il s'agit ici de personnel et non d'un patient. L'erreur réelle
    // reste tracée (log + AuditLog) — seul le message renvoyé est générique.
    logger.error('[AI CHAT] Échec appel assistant IA', { error: err.message, userId: req.user?._id?.toString() });
    await logAction({ utilisateur: req.user?._id, action: 'AI_CHAT', module: 'ai', ip: req.ip, statut: 'echec', message: `Échec appel assistant IA : ${err.message}` });
    res.status(502).json({ success: false, message: "Assistant IA temporairement indisponible. Réessayez plus tard." });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/patient-summary/:patientId
// ═══════════════════════════════════════════════════════════════
exports.getPatientSummary = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    if (!patientId) return res.status(400).json({ success: false, message: 'patientId requis' });

    const [patient, recentLabs, recentImaging, recentPrescriptions, hospitalizations, lastConsultation] =
      await Promise.all([
        Patient.findById(patientId).lean(),
        LabResult.find({ patient: patientId }).sort('-createdAt').limit(5).lean(),
        ImagingResult.find({ patient: patientId }).sort('-createdAt').limit(5).lean(),
        Prescription.find({ patient: patientId, statut: { $in: ['active', 'publiee'] } }).sort('-createdAt').limit(5).lean(),
        Hospitalization.find({ patient: patientId }).sort('-createdAt').limit(3).lean(),
        Consultation.findOne({ patient: patientId }).sort('-date_consultation').lean(),
      ]);

    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable' });

    // Constantes vitales de la derniere consultation, si disponible - aucun
    // symptome fabrique ici (pas de plainte active saisie par l'utilisateur).
    const vitals = lastConsultation?.signes_vitaux ? {
      temperature: lastConsultation.signes_vitaux.temperature,
      frequence_cardiaque: lastConsultation.signes_vitaux.pouls,
      pression_arterielle: (lastConsultation.signes_vitaux.tension_systolique && lastConsultation.signes_vitaux.tension_diastolique)
        ? `${lastConsultation.signes_vitaux.tension_systolique}/${lastConsultation.signes_vitaux.tension_diastolique}` : undefined,
      glycemie: lastConsultation.signes_vitaux.glycemie,
      poids: lastConsultation.signes_vitaux.poids,
      taille: lastConsultation.signes_vitaux.taille,
    } : {};

    const risks = computeRisks(patient, [], vitals);

    const patient_context = {
      nom: `${patient.prenom || ''} ${patient.nom || ''}`.trim(),
      numero_dossier: patient.numero_dossier,
      age: patient.date_naissance
        ? Math.floor((Date.now() - new Date(patient.date_naissance)) / (365.25 * 24 * 3600 * 1000))
        : null,
      sexe: patient.sexe,
      groupe_sanguin: patient.groupe_sanguin,
      allergies: patient.allergies || [],
      antecedents: patient.antecedents_medicaux || [],
      hospitalisations_recentes: hospitalizations.length,
    };

    const labCritiques = recentLabs.filter(l => l.est_critique || l.ia_anomalie);

    // Synthese narrative - meme utilitaire que Chat IA
    // (utils/openai.js::generateReport), repli honnete si OPENAI_API_KEY
    // n'est pas configuree : jamais de texte fabrique presente comme reel.
    const systemPrompt = "Tu es un assistant clinique d'aide a la synthese de dossier patient dans un logiciel hospitalier. Redige une synthese courte et factuelle EXCLUSIVEMENT a partir des donnees fournies, sans jamais inventer de diagnostic, de valeur ou d'antecedent absent des donnees. Termine systematiquement par : « Cette synthese est une aide et doit etre validee par un professionnel de sante avant toute decision clinique. »";
    const userPrompt = `Dossier patient :
- Identite : ${patient_context.nom}, ${patient_context.age ?? '?'} ans, ${patient_context.sexe || 'sexe non renseigne'}
- Antecedents : ${patient_context.antecedents.join(', ') || 'aucun renseigne'}
- Allergies : ${patient_context.allergies.join(', ') || 'aucune renseignee'}
- Prescriptions actives : ${recentPrescriptions.map(p => p.lignes?.map(l => l.medicament_nom).filter(Boolean).join(', ')).filter(Boolean).join(' ; ') || 'aucune'}
- Derniers resultats labo : ${recentLabs.map(l => `${l.statut}${l.est_critique ? ' (critique)' : ''}`).join(', ') || 'aucun'}
- Derniere imagerie : ${recentImaging[0]?.conclusion || recentImaging[0]?.type_examen || 'aucune'}
- Derniere consultation : ${lastConsultation ? `${lastConsultation.diagnostic || 'diagnostic non renseigne'} (${new Date(lastConsultation.date_consultation).toLocaleDateString('fr-FR')})` : 'aucune'}
- Hospitalisations recentes : ${hospitalizations.length}`;

    let synthese = null;
    let simulated = false;
    try {
      const result = await openai.generateReport({ systemPrompt, userPrompt });
      if (result.simulated) simulated = true;
      else synthese = result.content;
    } catch (err) {
      logger.error('[AI PATIENT SUMMARY] Echec generateReport', { error: err.message });
    }

    await logAction({
      utilisateur: req.user?._id,
      action: 'IA_PATIENT_SUMMARY',
      module: 'ia',
      entite_id: patient._id,
      ip: req.ip,
      ua: req.headers['user-agent'],
      message: `Resume IA patient - ${patient_context.nom}`,
    });

    res.json({
      success: true,
      patient_context,
      risks,
      synthese,
      simulated,
      recent_labs: recentLabs.map(l => ({
        id: l._id, date: l.date_prescription, statut: l.statut,
        critique: l.est_critique, ia_anomalie: l.ia_anomalie,
      })),
      recent_imaging: recentImaging.map(i => ({
        id: i._id, type_examen: i.type_examen, date: i.date_prescription,
        conclusion: i.conclusion, priorite: i.priorite,
      })),
      active_prescriptions: recentPrescriptions.map(p => ({
        id: p._id, numero_rx: p.numero_rx,
        medicaments: p.lignes?.map(l => l.medicament_nom).filter(Boolean) || [],
      })),
      last_consultation: lastConsultation ? {
        date: lastConsultation.date_consultation,
        diagnostic: lastConsultation.diagnostic,
        medecin: lastConsultation.medecin,
      } : null,
      hospitalisations_count: hospitalizations.length,
      lab_critiques_count: labCritiques.length,
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// PUT /api/ai/predictions/:id  — traiter une prédiction
// ═══════════════════════════════════════════════════════════════
exports.updatePrediction = async (req, res, next) => {
  try {
    const { statut, commentaire } = req.body;
    // AUDIT-3.5 — sans runValidators, l'enum statut du modèle
    // (en_attente/traite/ignore) n'était pas appliqué sur ce chemin
    // d'écriture : une valeur arbitraire aurait été persistée sans être
    // rejetée.
    const prediction = await AIPrediction.findByIdAndUpdate(
      req.params.id,
      {
        statut,
        commentaire,
        traite_par: req.user?._id,
        traite_at: new Date(),
      },
      { new: true, runValidators: true }
    ).populate('patient', 'nom prenom').lean();

    if (!prediction) return res.status(404).json({ success: false, message: 'Prédiction introuvable' });

    await logAction({
      utilisateur: req.user?._id,
      action: 'IA_PREDICTION_TRAITEE',
      module: 'ia',
      entite_id: prediction._id,
      ip: req.ip,
      message: `Prédiction IA marquée "${statut}"`,
    });

    res.json({ success: true, prediction });
  } catch (err) { next(err); }
};
