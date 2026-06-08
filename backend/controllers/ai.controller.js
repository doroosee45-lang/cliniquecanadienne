const AIPrediction  = require('../models/AIPrediction');
const Patient       = require('../models/Patient');
const LabResult     = require('../models/LabResult');
const ImagingResult = require('../models/ImagingResult');
const Prescription  = require('../models/Prescription');
const Hospitalization = require('../models/Hospitalization');
const { logAction } = require('../utils/helpers');

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

// ─── Interactions médicamenteuses connues ─────────────────────
const INTERACTIONS_DB = [
  { drugs: ['quinine', 'digoxin', 'digoxine'],        risque: 'elevé',   description: 'La quinine augmente les concentrations de digoxine — risque de toxicité digitalique (arythmie, bradycardie).' },
  { drugs: ['metronidazole', 'alcool', 'alcohol'],    risque: 'elevé',   description: 'Association contre-indiquée : effet antabuse (nausées, vomissements, bouffées vasomotrices).' },
  { drugs: ['warfarine', 'aspirine', 'ibuprofene', 'naproxene'], risque: 'elevé', description: 'AINS + anticoagulant : risque hémorragique majeur.' },
  { drugs: ['methotrexate', 'cotrimoxazole', 'trimethoprime'], risque: 'elevé', description: 'Potentialisation de la toxicité hématologique du méthotrexate.' },
  { drugs: ['chloroquine', 'amiodarone'],             risque: 'elevé',   description: 'Allongement du QT — risque de torsades de pointes.' },
  { drugs: ['rifampicine', 'contraceptifs'],          risque: 'modéré', description: 'La rifampicine réduit l\'efficacité des contraceptifs oraux.' },
  { drugs: ['inhibiteur_eca', 'spironolactone', 'amiloride'], risque: 'modéré', description: 'Risque d\'hyperkaliémie avec les diurétiques épargneurs de potassium.' },
  { drugs: ['aminoside', 'gentamicine', 'amikacine', 'furosemide'], risque: 'modéré', description: 'Association néphrotoxique et ototoxique — surveiller la fonction rénale et l\'audition.' },
  { drugs: ['quinine', 'mefloquine'],                 risque: 'elevé',   description: 'Association déconseillée : risque de convulsions et cardiotoxicité.' },
  { drugs: ['artemether', 'efavirenz', 'nevirapine'], risque: 'modéré', description: 'Les antirétroviraux inducteurs enzymatiques réduisent les concentrations d\'artémether.' },
  { drugs: ['isoniazide', 'rifampicine', 'pyrazinamide'], risque: 'modéré', description: 'Hépatotoxicité cumulée des antituberculeux — surveiller les enzymes hépatiques.' },
  { drugs: ['ciprofloxacine', 'theophylline'],        risque: 'modéré', description: 'Augmentation des concentrations de théophylline — risque de toxicité.' },
  { drugs: ['morphine', 'benzodiazepine', 'diazepam', 'midazolam'], risque: 'elevé', description: 'Dépression respiratoire additive — surveillance étroite requise.' },
  { drugs: ['paracetamol', 'acetaminophen'],          risque: 'faible',  description: 'Paracétamol : vérifier que la dose totale/24h ne dépasse pas 4g (3g si insuffisance hépatique).' },
  { drugs: ['metformine', 'produit_de_contraste'],    risque: 'modéré', description: 'Arrêter la metformine 48h avant injection de produit de contraste iodé — risque d\'acidose lactique.' },
];

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

    const [
      analyses_mois,
      diagnostics_mois,
      interactions_mois,
      labo_critiques,
      labo_anomalies_ia,
      imagerie_urgentes,
      rdv_conflits,
      patients_analyses,
    ] = await Promise.all([
      AIPrediction.countDocuments({ createdAt: { $gte: startOfMonth } }),
      AIPrediction.countDocuments({ type: 'diagnostic', createdAt: { $gte: startOfMonth } }),
      AIPrediction.countDocuments({ type: 'interaction_medicament', createdAt: { $gte: startOfMonth } }),
      LabResult.countDocuments({ est_critique: true, createdAt: { $gte: startOfDay } }),
      LabResult.countDocuments({ ia_anomalie: true, createdAt: { $gte: startOfMonth } }),
      ImagingResult.countDocuments({ priorite: { $in: ['urgente', 'tres_urgente', 'stat'] }, createdAt: { $gte: startOfDay } }),
      AIPrediction.countDocuments({ type: 'conflit_rdv', createdAt: { $gte: startOfMonth } }),
      AIPrediction.distinct('patient', { createdAt: { $gte: startOfMonth } }),
    ]);

    // Précision estimée : ratio prédictions traitées / total
    const traites = await AIPrediction.countDocuments({ statut: 'traite' });
    const total   = await AIPrediction.countDocuments();
    const precision = total > 0 ? Math.round((traites / total) * 100) : 0;

    const alertes_risque = labo_critiques + imagerie_urgentes + rdv_conflits;

    res.json({
      success: true,
      stats: {
        analyses_mois,
        diagnostics: diagnostics_mois,
        precision,
        interactions: interactions_mois,
        alertes_risque,
        labo_critiques,
        labo_anomalies_ia,
        imagerie_urgentes,
        patients_analyses: patients_analyses.length,
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
    const total = await AIPrediction.countDocuments(filter);
    const predictions = await AIPrediction.find(filter)
      .populate('patient', 'nom prenom numero_dossier')
      .populate('traite_par', 'nom prenom')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

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
    for (const rule of INTERACTIONS_DB) {
      const matched = rule.drugs.filter(d => medNames.some(m => m.includes(d)));
      if (matched.length >= 2) {
        warnings.push({
          medicaments: matched,
          risque: rule.risque,
          description: rule.description,
        });
      }
    }

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
      await AIPrediction.create({
        type: 'interaction_medicament',
        patient: patientId || undefined,
        resultat: { medications: medNames, warnings: allWarnings },
        score_confiance: 95,
        statut: 'en_attente',
      });
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
// PUT /api/ai/predictions/:id  — traiter une prédiction
// ═══════════════════════════════════════════════════════════════
exports.updatePrediction = async (req, res, next) => {
  try {
    const { statut, commentaire } = req.body;
    const prediction = await AIPrediction.findByIdAndUpdate(
      req.params.id,
      {
        statut,
        commentaire,
        traite_par: req.user?._id,
        traite_at: new Date(),
      },
      { new: true }
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
