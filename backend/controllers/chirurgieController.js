// backend/controllers/chirurgieController.js
const DossierChirurgical = require('../models/DossierChirurgical');
const Hospitalization = require('../models/Hospitalization');
const Bilan = require('../models/Bilan');
const SuiviPostop = require('../models/SuiviPostop');
const Complication = require('../models/Complication');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { nextSequence } = require('../utils/counter');
const { logAction, escapeRegex } = require('../utils/helpers');

// POST5-009 (audit indépendant post-Phase 5, 14 sept. 2026) — même classe
// qu'ANOM-MAT-01 (maternityController.js) et laboratory.controller.js/
// radiology.controller.js : DossierChirurgical.telephone est une copie
// figée du téléphone du Patient, écrite une seule fois à la création
// (createDossier ci-dessous) et jamais resynchronisée — un dossier
// chirurgical peut rester ouvert des mois (consultation → préopératoire →
// opéré → suivi postop) largement assez pour qu'un patient change de
// numéro sans que le personnel ne le voie jamais (risque réel en cas
// d'urgence). Préfère la donnée live du Patient lié quand elle est
// disponible (patient peuplé), replie sur la copie figée sinon — jamais
// l'inverse, jamais une valeur inventée.
const preferLiveTelephone = (obj) => {
  if (obj.patient && typeof obj.patient === 'object' && obj.patient.telephone) {
    obj.telephone = obj.patient.telephone;
  }
  return obj;
};

// Génération du numéro de dossier : CHIR-YYYY-XXXX
// Compteur atomique — l'ancien pattern findOne().sort() pouvait attribuer le
// même numéro à deux dossiers créés en même temps (condition de course).
async function generateNumero() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`chirurgie-${year}`);
  return `CHIR-${year}-${String(seq).padStart(4, '0')}`;
}

// Mise à jour du niveau IA à partir du score
function updateIaNiveau(score) {
  if (score >= 70) return 'critique';
  if (score >= 50) return 'eleve';
  if (score >= 30) return 'modere';
  return 'faible';
}

// Récupération des dossiers (liste paginée, recherche, filtre)
exports.getDossiers = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, q = '', statut = '', patient = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filter = {};

    if (statut) filter.statut = statut;
    if (patient) filter.patient = patient;
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { patient_nom: { $regex: qRe, $options: 'i' } },
        { diagnostic_chirurgical: { $regex: qRe, $options: 'i' } },
        { numero: { $regex: qRe, $options: 'i' } }
      ];
    }

    // PERF-001 (audit de performance du 12 sept. 2026) — indépendants, en parallèle.
    const [dossiers, total] = await Promise.all([
      DossierChirurgical.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DossierChirurgical.countDocuments(filter),
    ]);

    res.json({ success: true, dossiers, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// AUDIT-B3 — chargeait toute la collection en mémoire (DossierChirurgical.find())
// puis comptait/filtrait en JS, y compris pour le graphique 12 mois. Remplacé
// par deux agrégations ciblées, même pattern que dashboard.controller.js/
// analytics.controller.js : les compteurs et le score moyen restent exacts
// même sur une collection qui dépasse la mémoire disponible côté Node.
exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [kpisAgg, monthlyAgg] = await Promise.all([
      DossierChirurgical.aggregate([
        { $group: {
            _id: null,
            total: { $sum: 1 },
            consultations: { $sum: { $cond: [{ $eq: ['$statut', 'consultation'] }, 1, 0] } },
            preoperatoires: { $sum: { $cond: [{ $eq: ['$statut', 'preoperatoire'] }, 1, 0] } },
            operes: { $sum: { $cond: [{ $eq: ['$statut', 'opere'] }, 1, 0] } },
            suivis_nb: { $sum: { $cond: [{ $eq: ['$statut', 'suivi_postop'] }, 1, 0] } },
            clotures: { $sum: { $cond: [{ $eq: ['$statut', 'cloture'] }, 1, 0] } },
            risques_eleves: { $sum: { $cond: [{ $in: ['$ia_risque_niveau', ['eleve', 'critique']] }, 1, 0] } },
            scoreSum: { $sum: { $ifNull: ['$ia_risque_score', 0] } },
            dossiersAvecComplications: { $sum: { $cond: [{ $gt: ['$nb_complications', 0] }, 1, 0] } },
        } },
      ]),
      // Graphique : interventions par mois (basé sur date_intervention_reelle)
      DossierChirurgical.aggregate([
        { $match: { date_intervention_reelle: { $gte: twelveMonthsAgo } } },
        { $group: {
            _id: { year: { $year: '$date_intervention_reelle' }, month: { $month: '$date_intervention_reelle' } },
            count: { $sum: 1 },
        } },
      ]),
    ]);

    const k = kpisAgg[0] || { total: 0, consultations: 0, preoperatoires: 0, operes: 0, suivis_nb: 0, clotures: 0, risques_eleves: 0, scoreSum: 0, dossiersAvecComplications: 0 };
    const score_moyen = k.total ? Math.round(k.scoreSum / k.total) : 0;
    const taux_compl = k.total ? parseFloat((k.dossiersAvecComplications / k.total * 100).toFixed(1)) : 0;

    const moisLabels = [];
    const moisData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '');
      moisLabels.push(mois);
      const entry = monthlyAgg.find(m => m._id.year === date.getFullYear() && m._id.month === date.getMonth() + 1);
      moisData.push(entry ? entry.count : 0);
    }

    res.json({
      success: true,
      kpis: { total: k.total, consultations: k.consultations, preoperatoires: k.preoperatoires, operes: k.operes, suivis_nb: k.suivis_nb, clotures: k.clotures, risques_eleves: k.risques_eleves, score_moyen },
      chart: { labels: moisLabels, data: moisData },
      taux_compl
    });
  } catch (err) { next(err); }
};

// Récupération d'un dossier complet (avec bilans, suivis, complications)
exports.getDossierById = async (req, res, next) => {
  try {
    const found = await DossierChirurgical.findById(req.params.id).populate('patient', 'telephone');
    if (!found) return res.status(404).json({ success: false, message: 'Dossier non trouvé' });
    // POST5-009 — préfère le téléphone live du Patient lié, jamais la copie
    // figée seule ; `patient` est ensuite ramené à son _id (jamais un objet
    // peuplé exposé où le reste du contrat attend un ObjectId).
    const dossier = preferLiveTelephone(found.toObject());
    dossier.patient = found.patient?._id ?? found.patient;

    const bilan = await Bilan.find({ dossier_chirurgical_id: dossier._id }).sort({ createdAt: -1 });
    const suivis = await SuiviPostop.find({ dossier_chirurgical_id: dossier._id }).sort({ date_suivi: -1 });
    const complications = await Complication.find({ dossier_chirurgical_id: dossier._id }).sort({ date_survenue: -1 });

    // Correction 2 (module 5/6, relecture du 6 sept. 2026) — LIMITE
    // DOCUMENTÉE : contrairement à Laboratoire/Radiology/Echographie/
    // Urgences, aucun catalogue tarifaire réel n'existe dans ce système pour
    // les interventions chirurgicales (DossierChirurgical.type_intervention
    // est un champ texte libre, sans équivalent d'ExamCatalogue). Générer
    // automatiquement une facture ici obligerait à inventer un prix — exclu
    // par les règles de ce chantier. On expose donc uniquement une Invoice
    // RÉELLE si le personnel de facturation en a créé une manuellement via
    // le module Finance en la liant à ce dossier (source_module:'chirurgie',
    // déjà prévu dans le schéma Invoice depuis la Correction FLOW-002) —
    // jamais un calcul fabriqué côté client.
    const invoice = await Invoice.findOne({ source_module: 'chirurgie', source_id: dossier._id });

    res.json({ success: true, dossier, bilan, suivis, complications, invoice });
  } catch (err) { next(err); }
};

// Création d'un nouveau dossier
exports.createDossier = async (req, res, next) => {
  try {
    const { patient: patient_id, chirurgien_id, statut, niveau_urgence, motif_consultation, diagnostic_chirurgical, type_intervention, symptomes, decision, hospitalisation_id } = req.body;

    // Récupérer les infos du patient
    const patient = await Patient.findById(patient_id);
    if (!patient) return res.status(400).json({ success: false, message: 'Patient introuvable' });

    // Correction 11 (FLOW-001) — si un séjour d'hospitalisation est indiqué,
    // vérifier réellement qu'il existe, appartient à ce patient et est en
    // cours avant de le lier : jamais une référence acceptée à l'aveugle.
    let hospitalisation_id_valide;
    if (hospitalisation_id) {
      const hosp = await Hospitalization.findById(hospitalisation_id);
      if (!hosp || String(hosp.patient) !== String(patient_id) || hosp.statut !== 'en_cours') {
        return res.status(400).json({ success: false, message: "Séjour d'hospitalisation invalide, non lié à ce patient, ou déjà terminé." });
      }
      hospitalisation_id_valide = hosp._id;
    }

    let chirurgien_nom = null;
    if (chirurgien_id) {
      const chirurgien = await User.findById(chirurgien_id);
      if (chirurgien) chirurgien_nom = `Dr. ${chirurgien.prenom} ${chirurgien.nom}`;
    }

    const numero = await generateNumero();

    const dossier = new DossierChirurgical({
      numero,
      patient: patient._id,
      hospitalisation_id: hospitalisation_id_valide,
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
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'chirurgie', entite_id: dossier._id, ip: req.ip, message: `Nouveau dossier chirurgical ${dossier.numero} — ${dossier.patient_nom}` });
    emitActivity({ module: 'chirurgie', action: 'Nouveau dossier chirurgical', detail: `${dossier.patient_nom} — ${dossier.type_intervention || dossier.motif_consultation || ''}`, icon: '🏥', userId: chirurgien_id || null, userName: chirurgien_nom || 'Système' });
    emitDashboardUpdate();
    // AUDIT-M-C7 (Groupe C, Point 7) — seul contrôleur du chantier renvoyant
    // un document brut sans wrapper {success,...} pour ses 5 réponses de
    // succès (les 3 autres contrôleurs du point n'avaient que l'inverse : le
    // wrapper présent partout sauf le champ success lui-même). Chirurgie.jsx
    // était le seul lecteur frontend vivant de createDossier (data.numero) —
    // corrigé en parallèle (data.dossier.numero). chirurgieSlice.js::
    // createSurgery lit aussi cette réponse mais n'est jamais dispatché nulle
    // part dans l'UI (code mort, déjà désynchronisé de la forme actuelle
    // avant ce changement) — laissé tel quel, hors périmètre.
    res.status(201).json({ success: true, dossier });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — numero/patient identifient le dossier ;
// Object.assign(dossier, req.body) les laissait auparavant réassignables
// comme n'importe quel autre champ.
const DOSSIER_CHIR_BLOCKED_FIELDS = ['numero', 'patient'];

// Mise à jour d'un dossier
exports.updateDossier = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier non trouvé' });
    const avant = dossier.toObject();

    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!DOSSIER_CHIR_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    Object.assign(dossier, data);
    if (req.body.ia_risque_score !== undefined) {
      dossier.ia_risque_niveau = updateIaNiveau(req.body.ia_risque_score);
    }
    dossier.updated_at = Date.now();
    await dossier.save();

    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'chirurgie', entite_id: dossier._id, ip: req.ip, message: `Dossier chirurgical ${dossier.numero} modifié`, avant, apres: dossier });
    res.json({ success: true, dossier });
  } catch (err) { next(err); }
};

// Ajout d'un bilan
exports.addBilan = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier non trouvé' });

    const bilan = new Bilan({
      dossier_chirurgical_id: dossier._id,
      ...req.body
    });
    await bilan.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'chirurgie', entite_id: dossier._id, ip: req.ip, message: `Bilan ajouté au dossier ${dossier.numero} (${bilan.type})` });
    res.status(201).json({ success: true, bilan });
  } catch (err) { next(err); }
};

// Ajout d'un suivi postopératoire
exports.addSuivi = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id).select('_id numero');
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier non trouvé' });

    const suivi = new SuiviPostop({
      dossier_chirurgical_id: dossier._id,
      ...req.body
    });
    await suivi.save();

    // SPEC-04 (correction du 12 sept. 2026, audit indépendant) — lecture
    // (dossier.nb_suivis) puis écriture séparée (+=1, save()) : deux ajouts
    // de suivi concurrents sur le même dossier pouvaient tous deux lire la
    // même valeur avant que l'un ou l'autre n'écrive, perdant un
    // incrément. $inc est atomique côté MongoDB, immunisé contre cette
    // course, quel que soit le nombre d'écritures concurrentes.
    await DossierChirurgical.findByIdAndUpdate(dossier._id, { $inc: { nb_suivis: 1 } });

    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'chirurgie', entite_id: dossier._id, ip: req.ip, message: `Suivi postopératoire ajouté au dossier ${dossier.numero}` });
    res.status(201).json({ success: true, suivi });
  } catch (err) { next(err); }
};

// Ajout d'une complication
exports.addComplication = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id).select('_id numero');
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier non trouvé' });

    const complication = new Complication({
      dossier_chirurgical_id: dossier._id,
      ...req.body
    });
    await complication.save();

    // SPEC-04 — même correctif qu'addSuivi ci-dessus : nb_complications ET
    // ia_risque_score/niveau (dérivé du score) étaient lus puis réécrits
    // séparément, perdant un incrément sous concurrence. Pipeline d'update
    // atomique (MongoDB 4.2+) : deux étapes séquentielles dans la même
    // opération — la 2e ($risque_niveau) lit la valeur déjà mise à jour par
    // la 1re ($nb_complications/$ia_risque_score) au sein de la même
    // écriture atomique, jamais de lecture séparée sujette à la course.
    await DossierChirurgical.findByIdAndUpdate(dossier._id, [
      { $set: {
          nb_complications: { $add: [{ $ifNull: ['$nb_complications', 0] }, 1] },
          ia_risque_score:  { $min: [{ $add: [{ $ifNull: ['$ia_risque_score', 0] }, 15] }, 100] },
        },
      },
      { $set: {
          ia_risque_niveau: {
            $switch: {
              branches: [
                { case: { $gte: ['$ia_risque_score', 70] }, then: 'critique' },
                { case: { $gte: ['$ia_risque_score', 50] }, then: 'eleve' },
                { case: { $gte: ['$ia_risque_score', 30] }, then: 'modere' },
              ],
              default: 'faible',
            },
          },
        },
      },
    ]);

    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'chirurgie', entite_id: dossier._id, ip: req.ip, message: `Complication (${complication.type_complication}) enregistrée pour le dossier ${dossier.numero}` });
    res.status(201).json({ success: true, complication });
  } catch (err) { next(err); }
};