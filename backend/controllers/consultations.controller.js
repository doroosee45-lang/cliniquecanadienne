const Consultation = require('../models/Consultation');
const Appointment   = require('../models/Appointment');
const Prescription  = require('../models/Prescription');
const Invoice       = require('../models/Invoice');
const Patient       = require('../models/Patient');
const User          = require('../models/User');
const ExamCatalogue = require('../models/ExamCatalogue');
const LabResult      = require('../models/LabResult');
const ImagingResult  = require('../models/ImagingResult');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { detectInteractions } = require('../utils/drugInteractions');
const { matchExamCatalogue } = require('../utils/examLibelleVersCatalogue');
const { nextSequence } = require('../utils/counter');
const mail = require('../utils/mail');

// Correction 4 — priorité de l'examen saisi en consultation (normal/
// semi_urgent/urgent) vers la priorité réelle attendue par LabResult/
// ImagingResult (vocabulaires distincts, pas un simple renommage 1:1).
const PRIORITE_LABO    = { normal: 'normale', semi_urgent: 'urgente', urgent: 'urgente' };
const PRIORITE_IMAGERIE = { normal: 'normale', semi_urgent: 'urgente', urgent: 'urgente' };

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// Correction 6 (relecture du 6 sept. 2026, FE-BUG-008) — le sélecteur
// "Médecin consultant" (Consultations.jsx) était peuplé par 5 noms fictifs
// codés en dur, jamais liés à un vrai User ; create() ignorait de toute
// façon ce champ et attribuait systématiquement la consultation à
// req.user._id — correct pour un médecin connecté, mais faux dès qu'un
// infirmier ou un superadmin crée la consultation pour le compte d'un vrai
// médecin (POST /consultations leur est ouvert, cf. routes).
// GET /consultations/medecins
exports.getMedecins = async (req, res, next) => {
  try {
    const medecins = await User.find({ role: 'medecin', statut: 'actif' }).select('nom prenom specialite').sort('nom').lean();
    res.json({ success: true, medecins });
  } catch (err) { next(err); }
};

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
  mode_paiement: body.mode_paiement,
  statut: body.statut,
});

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, medecin, statut } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (medecin) filter.medecin = medecin;
    if (statut) filter.statut = statut;
    // AUDIT-FAIBLE-F1 — .lean() : aucun virtual/toJSON transform sur
    // Consultation ni sur Patient/User (populate), vérifié exhaustivement.
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find sont indépendants : exécutés en parallèle plutôt que l'un après
    // l'autre (un aller-retour réseau MongoDB économisé, mesuré réellement
    // sur ce même correctif appliqué à appointments.controller.js::getAll).
    const [total, consultations] = await Promise.all([
      Consultation.countDocuments(filter),
      paginate(
        Consultation.find(filter)
          .populate('patient', 'nom prenom numero_dossier')
          .populate('medecin', 'nom prenom specialite')
          .sort('-date_consultation')
          .lean(),
        page, limit
      ),
    ]);
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

// FACTURATION-CONSULTATION-001 (rapport de clôture du 11 sept. 2026) — la
// facture est déjà réellement créée par create() (FLOW-002, ci-dessous) via
// le champ dédié Invoice.consultation — jamais un montant recalculé/inventé
// ici. Ce qui manquait réellement : aucune route ne permettait de la
// RETROUVER ensuite pour l'afficher/l'imprimer (Consultations.jsx —
// ConsultationDetail). Même convention que blocoperatoireController.js::
// getFacture / echographieController (recherche par référence directe,
// jamais un montant recomposé côté client).
exports.getFacture = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ consultation: req.params.id });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

// POST /consultations/:id/facture/envoyer — envoie la facture RÉELLEMENT
// déjà générée par email au patient (utils/mail.js, même service que
// sendPrescriptionEmail/sendAppointmentEmail ci-dessous — aucune seconde
// intégration email créée). Jamais un « succès » si aucune facture n'existe
// ou si le patient n'a pas d'email réel enregistré.
exports.envoyerFacture = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ consultation: req.params.id });
    if (!invoice) return res.status(404).json({ success: false, message: "Aucune facture n'a été générée pour cette consultation." });

    const patient = await Patient.findById(invoice.patient).select('nom prenom email').lean();
    if (!patient?.email) return res.status(400).json({ success: false, message: "Ce patient n'a pas d'adresse email enregistrée — impossible d'envoyer la facture." });

    const result = await mail.sendInvoiceEmail({
      email: patient.email, prenom: patient.prenom, nom: patient.nom,
      numero_facture: invoice.numero_facture, montant_ttc: invoice.montant_ttc,
      lignes: invoice.lignes, date_facture: invoice.date_facture,
    });
    const simulated = !!result?.simulated;

    await logAction({ utilisateur: req.user._id, action: 'SEND_INVOICE_EMAIL', module: 'consultations', entite_id: invoice._id, ip: req.ip, message: `Facture ${invoice.numero_facture} ${simulated ? 'SIMULÉE (Resend non configuré)' : 'envoyée'} par email à ${patient.email}` });
    res.json({ success: true, simulated, message: simulated ? `Email simulé (Resend non configuré) — la facture n'a pas réellement été envoyée à ${patient.email}.` : `Facture envoyée à ${patient.email}.` });
  } catch (err) { next(err); }
};



exports.create = async (req, res, next) => {
  try {
    // CLIN-07 (correction du 12 sept. 2026, audit indépendant) — `patient`
    // n'était jamais vérifié comme référençant un vrai Patient avant
    // écriture : un ObjectId fabriqué/orphelin produisait une consultation
    // durablement rattachée à aucun dossier réel.
    if (!req.body.patient || !isObjectId(req.body.patient)) {
      return res.status(400).json({ success: false, message: 'Référence patient invalide.' });
    }
    const patientDoc = await Patient.findById(req.body.patient).select('_id');
    if (!patientDoc) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    // RDV-CONSULT-002 (audit métier du 13 sept. 2026, Phase 4) — appointment
    // n'était jamais vérifié : un ObjectId fabriqué/orphelin, ou un
    // rendez-vous appartenant à un AUTRE patient, était accepté tel quel
    // (buildConsultationFields ci-dessus ne fait qu'un passthrough). Reste
    // optionnel — une consultation peut toujours être créée sans rendez-vous
    // — mais s'il est fourni, doit référencer un vrai Appointment du MÊME
    // patient, et ne peut être lié qu'à UNE seule Consultation (même
    // principe qu'Invoice.consultation : index unique sparse empêchant une
    // double facture pour le même acte, ici appliqué en contrôleur faute
    // d'unicité déclarée au schéma Consultation).
    let appointmentId;
    if (req.body.appointment) {
      if (!isObjectId(req.body.appointment)) {
        return res.status(400).json({ success: false, message: 'Référence de rendez-vous invalide.' });
      }
      const apptDoc = await Appointment.findById(req.body.appointment).select('patient');
      if (!apptDoc) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
      if (String(apptDoc.patient) !== String(req.body.patient)) {
        return res.status(400).json({ success: false, message: "Ce rendez-vous n'appartient pas au patient indiqué." });
      }
      const dejaLiee = await Consultation.findOne({ appointment: req.body.appointment }).select('_id');
      if (dejaLiee) {
        return res.status(409).json({ success: false, message: 'Ce rendez-vous a déjà une consultation liée.' });
      }
      appointmentId = req.body.appointment;
    }

    const iaSuggestions = [];
    const sv = req.body.signes_vitaux || {};
    if (sv.temperature > 38.5) iaSuggestions.push({ diagnostic: 'Syndrome fébrile probable', confidence: 85 });
    if (sv.spo2 < 95) iaSuggestions.push({ diagnostic: 'Hypoxémie — évaluer insuffisance respiratoire', confidence: 78 });
    if (sv.tension_systolique > 140) iaSuggestions.push({ diagnostic: 'HTA — surveiller', confidence: 72 });
    if (sv.glycemie > 7) iaSuggestions.push({ diagnostic: 'Hyperglycémie — évaluer diabète', confidence: 69 });

    // Correction 6 (relecture du 6 sept. 2026, FE-BUG-008) — un vrai médecin
    // choisi dans le formulaire (ObjectId réel, jamais un nom en texte
    // libre) prime désormais sur req.user._id — nécessaire pour qu'un
    // infirmier créant la consultation l'attribue au bon médecin, pas à
    // lui-même.
    const medecin = (req.body.medecin && isObjectId(req.body.medecin)) ? req.body.medecin : req.user._id;
    const consultation = await Consultation.create({
      ...buildConsultationFields(req.body),
      medecin,
      appointment: appointmentId,
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

    // FLOW-002 (audit du 4 sept. 2026) — aucun contrôleur clinique ne créait
    // de Invoice : l'onglet "Facturation" de Consultations.jsx calculait un
    // montant côté client, sans lien réel avec le module Finance. Même
    // principe que la génération automatique de Prescription ci-dessus :
    // une consultation clôturée (statut 'terminee', seul moment où ce
    // contrôleur reçoit un statut final — Consultations.jsx soumet tout le
    // formulaire en un seul POST, il n'y a pas de transition ultérieure via
    // update()) avec des frais renseignés (frais_consultation, champ réel du
    // formulaire — pas une valeur inventée ici) génère une vraie facture
    // persistée, liée par consultation._id. Gardé sur > 0 : une consultation
    // sans frais renseignés (frais_consultation absent/0, ex. suivi
    // gratuit) ne doit pas produire une facture fantôme à 0 CFA.
    let factureGeneree = null;
    const fraisConsultation = Number(consultation.frais_consultation) || 0;
    if (consultation.statut === 'terminee' && fraisConsultation > 0) {
      const patientDoc = await Patient.findById(consultation.patient).select('nom prenom').lean();
      factureGeneree = await Invoice.create({
        patient: consultation.patient,
        patient_nom: patientDoc ? `${patientDoc.prenom} ${patientDoc.nom}`.trim() : undefined,
        service_label: 'Consultation',
        consultation: consultation._id,
        created_by: req.user._id,
        lignes: [{
          libelle: `Consultation médicale${consultation.type_consultation ? ` — ${consultation.type_consultation}` : ''}`,
          categorie: 'consultation', prix_unitaire: fraisConsultation, quantite: 1, montant: fraisConsultation,
        }],
        montant_ht: fraisConsultation,
        montant_ttc: fraisConsultation,
      });
      await logAction({
        utilisateur: req.user._id, action: 'CREATE', module: 'finance',
        entite_id: factureGeneree._id, ip: req.ip,
        message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la consultation ${consultation._id}`,
      });
    }

    // Correction 4 (pont examens_complementaires ↔ Laboratoire/Radiology) —
    // même principe que Prescription/Invoice ci-dessus : à la clôture d'une
    // consultation (statut 'terminee'), chaque examen complémentaire
    // reconnu par une correspondance EXACTE et curatée (voir
    // utils/examLibelleVersCatalogue.js — même liste que la facturation
    // Sous-phase 5.7) génère un vrai LabResult ou ImagingResult, lié à la
    // consultation ET au patient. Les examens saisis en texte libre sans
    // correspondance ne sont jamais rattachés artificiellement — retournés
    // dans `examens_non_pontes` pour que l'appelant sache honnêtement ce qui
    // n'a pas pu être ponté, plutôt que de le laisser disparaître en
    // silence.
    const labsGeneres = [];
    const imagesGenerees = [];
    const examensNonPontes = [];
    if (consultation.statut === 'terminee' && consultation.examens_complementaires?.length) {
      const catalogue = await ExamCatalogue.find({ statut: 'actif' }).lean();
      const year = new Date().getFullYear();

      for (const exam of consultation.examens_complementaires) {
        const match = matchExamCatalogue(exam.libelle, catalogue);
        if (!match) { examensNonPontes.push(exam.libelle); continue; }

        if (match.type === 'laboratoire') {
          // CLIN-04 — numéro auto via compteur atomique, jamais
          // countDocuments()+incrément en mémoire (condition de course :
          // deux consultations clôturées en même temps pouvaient générer le
          // même numéro). Même compteur (`lab-${year}`) que
          // laboratory.controller.js::create, pour une séquence unique
          // partagée entre les deux voies de création.
          const seq = await nextSequence(`lab-${year}`);
          const lab = await LabResult.create({
            patient: consultation.patient,
            consultation: consultation._id,
            medecin_prescripteur: consultation.medecin,
            examen: match._id,
            examens_demandes: [match._id],
            priorite: PRIORITE_LABO[exam.priorite] || 'normale',
            statut: 'en_attente',
            numero: `LAB-${year}-${String(seq).padStart(4, '0')}`,
            date_demande: new Date(),
            commentaires: exam.note || undefined,
          });
          labsGeneres.push(lab._id);
        } else if (match.type === 'imagerie') {
          // CLIN-04 — voir ci-dessus ; même compteur (`img-${year}`) que
          // radiology.controller.js::create.
          const seq = await nextSequence(`img-${year}`);
          const img = await ImagingResult.create({
            patient: consultation.patient,
            consultation: consultation._id,
            medecin_prescripteur: consultation.medecin,
            examen: match._id,
            type_examen: exam.libelle,
            priorite: PRIORITE_IMAGERIE[exam.priorite] || 'normale',
            statut: 'programme',
            numero: `IMG-${year}-${String(seq).padStart(4, '0')}`,
            motif: exam.note || undefined,
          });
          imagesGenerees.push(img._id);
        } else {
          // ExamCatalogue.type ne connaît que laboratoire/imagerie (schéma) —
          // ne devrait jamais arriver, mais honnêtement non ponté si un jour
          // un 3e type apparaît sans code correspondant ici.
          examensNonPontes.push(exam.libelle);
        }
      }

      if (labsGeneres.length || imagesGenerees.length) {
        await logAction({
          utilisateur: req.user._id, action: 'CREATE', module: 'consultations', entite_id: consultation._id, ip: req.ip,
          message: `${labsGeneres.length} analyse(s) + ${imagesGenerees.length} examen(s) d'imagerie généré(s) depuis la consultation (${examensNonPontes.length} examen(s) sans correspondance catalogue, non ponté(s))`,
        });
      }
    }

    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'consultations', entite_id: consultation._id, ip: req.ip });
    emitActivity({ module: 'consultations', action: 'Nouvelle consultation', detail: req.body.motif || 'Consultation médicale', icon: '🩺', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({
      success: true, consultation, prescription: prescriptionGeneree, invoice: factureGeneree,
      lab_results: labsGeneres, imaging_results: imagesGenerees, examens_non_pontes: examensNonPontes,
    });
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
    // POST5-006 (audit indépendant post-Phase 5, 14 sept. 2026) — remove()
    // supprimait la Consultation sans jamais vérifier Invoice.consultation
    // (le champ dédié que create() renseigne réellement, ligne ~262) : une
    // consultation ayant déjà produit une facture pouvait être supprimée,
    // laissant la facture — payée ou non — référencer un acte clinique
    // inexistant, détruisant sa justification et sa traçabilité
    // comptables. Aucun mécanisme d'archivage/désactivation n'existe
    // aujourd'hui pour Consultation (statut n'a que en_cours/terminee/
    // suspendue — vérifié sur le schéma) : plutôt que d'inventer un tel
    // mécanisme sans qu'aucune règle métier ne le spécifie, même principe
    // que le garde-fou déjà établi pour Patient
    // (models/Patient.js::pre('findOneAndDelete')) — refus explicite tant
    // qu'un historique financier réel existe, quel que soit son statut de
    // paiement (une facture impayée orpheline resterait tout autant une
    // incohérence comptable qu'une facture payée orpheline).
    const factureExistante = await Invoice.findOne({ consultation: req.params.id }).select('_id numero_facture statut');
    if (factureExistante) {
      return res.status(409).json({
        success: false,
        message: `Impossible de supprimer cette consultation : la facture ${factureExistante.numero_facture} (statut : ${factureExistante.statut}) y fait encore référence.`,
      });
    }

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
