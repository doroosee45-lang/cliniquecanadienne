// backend/controllers/chirurgieController.js
const DossierChirurgical = require('../models/DossierChirurgical');
const Bilan = require('../models/Bilan');
const SuiviPostop = require('../models/SuiviPostop');
const Complication = require('../models/Complication');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// Génération du numéro de dossier : CHIR-YYYY-XXXX
async function generateNumero() {
  const year = new Date().getFullYear();
  const lastDossier = await DossierChirurgical.findOne({ numero: new RegExp(`^CHIR-${year}-`) }).sort({ numero: -1 });
  let nextNum = 1;
  if (lastDossier) {
    const parts = lastDossier.numero.split('-');
    nextNum = parseInt(parts[2]) + 1;
  }
  return `CHIR-${year}-${String(nextNum).padStart(4, '0')}`;
}

// Mise à jour du niveau IA à partir du score
function updateIaNiveau(score) {
  if (score >= 70) return 'critique';
  if (score >= 50) return 'eleve';
  if (score >= 30) return 'modere';
  return 'faible';
}

// Récupération des dossiers (liste paginée, recherche, filtre)
exports.getDossiers = async (req, res) => {
  try {
    const { page = 1, limit = 15, q = '', statut = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filter = {};

    if (statut) filter.statut = statut;
    if (q) {
      filter.$or = [
        { patient_nom: { $regex: q, $options: 'i' } },
        { diagnostic_chirurgical: { $regex: q, $options: 'i' } },
        { numero: { $regex: q, $options: 'i' } }
      ];
    }

    const dossiers = await DossierChirurgical.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DossierChirurgical.countDocuments(filter);

    res.json({ success: true, dossiers, surgeries: dossiers, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Statistiques pour tableau de bord et graphiques
exports.getStats = async (req, res) => {
  try {
    const dossiers = await DossierChirurgical.find();
    const total = dossiers.length;

    const consultations = dossiers.filter(d => d.statut === 'consultation').length;
    const preoperatoires = dossiers.filter(d => d.statut === 'preoperatoire').length;
    const operes = dossiers.filter(d => d.statut === 'opere').length;
    const suivis_nb = dossiers.filter(d => d.statut === 'suivi_postop').length;
    const clotures = dossiers.filter(d => d.statut === 'cloture').length;
    const risques_eleves = dossiers.filter(d => d.ia_risque_niveau === 'eleve' || d.ia_risque_niveau === 'critique').length;
    const score_moyen = total ? Math.round(dossiers.reduce((s, d) => s + (d.ia_risque_score || 0), 0) / total) : 0;

    // Nombre de dossiers avec au moins une complication
    const dossiersAvecComplications = dossiers.filter(d => d.nb_complications > 0).length;
    const taux_compl = total ? parseFloat((dossiersAvecComplications / total * 100).toFixed(1)) : 0;

    // Graphique : interventions par mois (basé sur date_intervention_reelle)
    const moisLabels = [];
    const moisData = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '');
      moisLabels.push(mois);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const count = dossiers.filter(d => d.date_intervention_reelle && new Date(d.date_intervention_reelle) >= start && new Date(d.date_intervention_reelle) <= end).length;
      moisData.push(count);
    }

    res.json({
      kpis: { total, consultations, preoperatoires, operes, suivis_nb, clotures, risques_eleves, score_moyen },
      chart: { labels: moisLabels, data: moisData },
      taux_compl
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Récupération d'un dossier complet (avec bilans, suivis, complications)
exports.getDossierById = async (req, res) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ message: 'Dossier non trouvé' });

    const bilan = await Bilan.find({ dossier_chirurgical_id: dossier._id }).sort({ createdAt: -1 });
    const suivis = await SuiviPostop.find({ dossier_chirurgical_id: dossier._id }).sort({ date_suivi: -1 });
    const complications = await Complication.find({ dossier_chirurgical_id: dossier._id }).sort({ date_survenue: -1 });

    res.json({ dossier, bilan, suivis, complications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Création d'un nouveau dossier
exports.createDossier = async (req, res) => {
  try {
    const { patient_id, chirurgien_id, statut, niveau_urgence, motif_consultation, diagnostic_chirurgical, type_intervention, symptomes, decision } = req.body;

    // Récupérer les infos du patient
    const patient = await Patient.findById(patient_id);
    if (!patient) return res.status(400).json({ message: 'Patient introuvable' });

    let chirurgien_nom = null;
    if (chirurgien_id) {
      const chirurgien = await User.findById(chirurgien_id);
      if (chirurgien) chirurgien_nom = `Dr. ${chirurgien.prenom} ${chirurgien.nom}`;
    }

    const numero = await generateNumero();

    const dossier = new DossierChirurgical({
      numero,
      patient_id: patient._id,
      patient_nom: `${patient.prenom} ${patient.nom}`,
      date_naissance: patient.date_naissance,
      sexe: patient.sexe === 'M' ? 'homme' : patient.sexe === 'F' ? 'femme' : (patient.sexe || 'autre'),
      groupe_sanguin: patient.groupe_sanguin,
      allergies: Array.isArray(patient.allergies) ? patient.allergies.join(', ') : (patient.allergies || ''),
      antecedents_medicaux: Array.isArray(patient.antecedents_medicaux) ? patient.antecedents_medicaux.join(', ') : (patient.antecedents_medicaux || ''),
      antecedents_chirurgicaux: Array.isArray(patient.antecedents_chirurgicaux) ? patient.antecedents_chirurgicaux.join(', ') : (patient.antecedents_chirurgicaux || ''),
      telephone: patient.telephone,
      chirurgien_id,
      chirurgien_nom,
      statut: statut || 'consultation',
      niveau_urgence: niveau_urgence || 'electif',
      motif_consultation,
      diagnostic_chirurgical,
      type_intervention,
      symptomes,
      decision: decision || 'intervention',
      ia_risque_score: 0,
      ia_risque_niveau: 'faible'
    });

    await dossier.save();
    emitActivity({ module: 'chirurgie', action: 'Nouveau dossier chirurgical', detail: `${dossier.patient_nom} — ${dossier.type_intervention || dossier.motif_consultation || ''}`, icon: '🏥', userId: chirurgien_id || null, userName: chirurgien_nom || 'Système' });
    emitDashboardUpdate();
    res.status(201).json(dossier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mise à jour d'un dossier
exports.updateDossier = async (req, res) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ message: 'Dossier non trouvé' });

    Object.assign(dossier, req.body);
    if (req.body.ia_risque_score !== undefined) {
      dossier.ia_risque_niveau = updateIaNiveau(req.body.ia_risque_score);
    }
    dossier.updated_at = Date.now();
    await dossier.save();

    res.json(dossier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Ajout d'un bilan
exports.addBilan = async (req, res) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ message: 'Dossier non trouvé' });

    const bilan = new Bilan({
      dossier_chirurgical_id: dossier._id,
      ...req.body
    });
    await bilan.save();
    res.status(201).json(bilan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Ajout d'un suivi postopératoire
exports.addSuivi = async (req, res) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ message: 'Dossier non trouvé' });

    const suivi = new SuiviPostop({
      dossier_chirurgical_id: dossier._id,
      ...req.body
    });
    await suivi.save();

    // Incrémenter le compteur de suivis
    dossier.nb_suivis += 1;
    await dossier.save();

    res.status(201).json(suivi);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Ajout d'une complication
exports.addComplication = async (req, res) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ message: 'Dossier non trouvé' });

    const complication = new Complication({
      dossier_chirurgical_id: dossier._id,
      ...req.body
    });
    await complication.save();

    // Incrémenter le compteur de complications
    dossier.nb_complications += 1;
    // Optionnel : ajuster le score IA
    let newScore = (dossier.ia_risque_score || 0) + 15;
    if (newScore > 100) newScore = 100;
    dossier.ia_risque_score = newScore;
    dossier.ia_risque_niveau = updateIaNiveau(newScore);
    await dossier.save();

    res.status(201).json(complication);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};