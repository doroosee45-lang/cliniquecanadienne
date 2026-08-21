const Consultation = require('../models/Consultation');
const Prescription  = require('../models/Prescription');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { detectInteractions } = require('../utils/drugInteractions');

// Liste explicite plutôt que ...req.body : documente précisément ce que ce
// contrôleur accepte (aligné champ à champ sur le payload réel envoyé par
// Consultations.jsx), et évite de faire planter la création sur une chaîne
// vide envoyée pour un champ Date (rdv_date="" → CastError si transmis tel
// quel à Mongoose).
const buildConsultationFields = (body) => ({
  patient: body.patient,
  numero: body.numero,
  appointment: body.appointment,
  date_consultation: body.date_consultation,
  type_consultation: body.type_consultation,
  service: body.service,
  signes_vitaux: body.signes_vitaux,
  anamnese: body.anamnese,
  examen_clinique: body.examen_clinique,
  examen_cardiovasculaire: body.examen_cardiovasculaire,
  examen_pulmonaire: body.examen_pulmonaire,
  examen_abdominal: body.examen_abdominal,
  examen_neurologique: body.examen_neurologique,
  examen_orl: body.examen_orl,
  examen_dermatologie: body.examen_dermatologie,
  diagnostic: body.diagnostic,
  diagnostic_code: body.diagnostic_code,
  gravite: body.gravite,
  recommandations: body.recommandations,
  prescriptions: body.prescriptions,
  examens_complementaires: body.examens_complementaires,
  decision: body.decision,
  rdv_date: body.rdv_date || undefined,
  rdv_note: body.rdv_note,
  frais_consultation: body.frais_consultation,
  statut_paiement: body.statut_paiement,
  statut: body.statut,
});

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, medecin, statut } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (medecin) filter.medecin = medecin;
    if (statut) filter.statut = statut;
    const total = await Consultation.countDocuments(filter);
    const consultations = await paginate(
      Consultation.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('medecin', 'nom prenom specialite')
        .sort('-date_consultation'),
      page, limit
    );
    res.json({ success: true, total, consultations });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const c = await Consultation.findById(req.params.id)
      .populate('patient')
      .populate('medecin', 'nom prenom specialite');
    if (!c) return res.status(404).json({ success: false, message: 'Consultation introuvable.' });
    res.json({ success: true, consultation: c });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const iaSuggestions = [];
    const sv = req.body.signes_vitaux || {};
    if (sv.temperature > 38.5) iaSuggestions.push({ diagnostic: 'Syndrome fébrile probable', confidence: 85 });
    if (sv.spo2 < 95) iaSuggestions.push({ diagnostic: 'Hypoxémie — évaluer insuffisance respiratoire', confidence: 78 });
    if (sv.tension_systolique > 140) iaSuggestions.push({ diagnostic: 'HTA — surveiller', confidence: 72 });
    if (sv.glycemie > 7) iaSuggestions.push({ diagnostic: 'Hyperglycémie — évaluer diabète', confidence: 69 });

    const consultation = await Consultation.create({
      ...buildConsultationFields(req.body),
      medecin: req.user._id,
      ia_suggestions: iaSuggestions,
    });

    // T5.2 (R-04a) — une consultation terminée avec des lignes de
    // prescription doit générer un document Prescription formel, pas
    // laisser ces lignes dormir uniquement dans Consultation.prescriptions.
    // numero_rx/date_expiration sont posés par le hook pre('save') de
    // Prescription — rien à générer ici. statut 'active' (pas le
    // 'brouillon' par défaut du modèle) : à ce stade la consultation est
    // terminée, le médecin a déjà tranché, il ne s'agit pas d'un brouillon
    // à valider plus tard.
    let prescriptionGeneree = null;
    if (consultation.statut === 'terminee' && consultation.prescriptions?.length) {
      const lignes = consultation.prescriptions.map(p => ({
        medicament_nom: p.medicament_nom,
        posologie: p.posologie,
        duree: p.duree,
        notes: p.notes,
      }));
      prescriptionGeneree = await Prescription.create({
        patient: consultation.patient,
        medecin: consultation.medecin,
        consultation: consultation._id,
        lignes,
        statut: 'active',
        interactions_detectees: detectInteractions(lignes.map(l => (l.medicament_nom || '').toLowerCase())),
      });
      await logAction({
        utilisateur: req.user._id, action: 'CREATE', module: 'prescriptions',
        entite_id: prescriptionGeneree._id, ip: req.ip,
        message: `Ordonnance ${prescriptionGeneree.numero_rx} générée automatiquement depuis la consultation ${consultation._id}`,
      });
    }

    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'consultations', entite_id: consultation._id, ip: req.ip });
    emitActivity({ module: 'consultations', action: 'Nouvelle consultation', detail: req.body.motif || 'Consultation médicale', icon: '🩺', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, consultation, prescription: prescriptionGeneree });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — patient/medecin identifient la consultation ;
// aucun formulaire d'édition ne les réassigne.
const CONSULT_BLOCKED_FIELDS = ['patient', 'medecin'];

exports.update = async (req, res, next) => {
  try {
    const avant = await Consultation.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!CONSULT_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const consultation = await Consultation.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!consultation) return res.status(404).json({ success: false, message: 'Consultation introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'consultations', entite_id: consultation._id, ip: req.ip, avant, apres: consultation });
    res.json({ success: true, consultation });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const c = await Consultation.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Consultation introuvable.' });
    // AUDIT-3.4 — une prescription générée automatiquement à la clôture de
    // cette consultation (create(), ci-dessus) référence consultation._id ;
    // sans ce détachement, la suppression laissait une référence orpheline
    // (Prescription.consultation pointant vers un document inexistant). La
    // prescription elle-même reste un document médical valide et n'est
    // jamais supprimée — seul le lien vers la consultation d'origine l'est.
    const detached = await Prescription.updateMany({ consultation: c._id }, { $unset: { consultation: 1 } });
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'consultations', entite_id: req.params.id, ip: req.ip, message: `Consultation supprimée — patient ${c.patient}${detached.modifiedCount ? ` (${detached.modifiedCount} ordonnance(s) détachée(s))` : ''}`, avant: c });
    res.json({ success: true, message: 'Consultation supprimée.' });
  } catch (err) { next(err); }
};
