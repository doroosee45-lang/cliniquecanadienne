const Patient      = require('../models/Patient');
const Appointment  = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const LabResult    = require('../models/LabResult');
const ImagingResult= require('../models/ImagingResult');
const Invoice      = require('../models/Invoice');
const Notification = require('../models/Notification');
const Consultation = require('../models/Consultation');
const Child        = require('../models/Child');
const User         = require('../models/User');
const Service      = require('../models/Service');
const HospitalizationModel = require('../models/Hospitalization');
const DocumentModel = require('../models/Document');
const { logAction, countUnreadConversations, checkAppointmentConflict, isAppointmentRaceWinner } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { logger } = require('../utils/logger');
const path = require('path');
const fs   = require('fs');
const cloudinaryUtil = require('../utils/cloudinary');

// R-07 — Trouve le dossier patient lié au User connecté. patient_id
// d'abord : référence directe par ObjectId, stable même si Patient.email
// change après coup (staff pouvant éditer un dossier patient sans que
// User.email soit resynchronisé — l'email seul peut alors désigner le
// mauvais dossier, ou plus aucun). Repli sur l'email uniquement pour les
// comptes dont patient_id n'est pas encore peuplé (vérifié sur les
// données réelles avant cette migration : 4 comptes sur 7 — pas un cas
// rare). Si patient_id est renseigné mais ne résout plus rien (dossier
// supprimé), c'est une anomalie de données réelle, pas un simple compte
// non lié — journalisée plutôt que silencieusement absorbée par le repli.
const findPatient = async (user) => {
  if (user.patient_id) {
    const patient = await Patient.findById(user.patient_id);
    if (patient) return patient;
    await logAction({
      utilisateur: user._id, action: 'DATA_ANOMALY', module: 'portal',
      message: `patient_id (${user.patient_id}) renseigné sur le compte ${user.email} mais aucun dossier Patient correspondant — repli sur l'email`,
      statut: 'echec',
    });
  }
  const patientViaEmail = await Patient.findOne({ email: user.email.toLowerCase().trim() });
  // DASHBOARD-VIDE-001 (13 sept. 2026) — auto-guérison : un compte dont
  // patient_id n'était jamais renseigné (anomalie de création — voir le
  // renforcement de patients.controller.js::create ci-dessous, qui
  // n'empêche pas les comptes déjà affectés avant ce correctif) retombait
  // sur cette correspondance par email à CHAQUE appel, indéfiniment
  // fragile (un email différent, un espace parasite ou une casse
  // différente entre les deux documents suffirait à casser le repli sans
  // avertissement). Persiste ici le lien une fois trouvé, pour que les
  // appels suivants empruntent le chemin direct et stable (patient_id),
  // exactement comme googleAuth.controller.js::ensurePatientDossier le
  // fait déjà pour les comptes Google. N'invente jamais de lien : ne
  // persiste que ce que ce repli a déjà, de toute façon, décidé d'utiliser.
  if (patientViaEmail && !user.patient_id) {
    user.patient_id = patientViaEmail._id;
    await user.save();
    await logAction({
      utilisateur: user._id, action: 'LINK_PATIENT_DOSSIER', module: 'portal',
      entite_id: patientViaEmail._id,
      message: `patient_id absent sur le compte ${user.email} — lié automatiquement au dossier patient trouvé par correspondance d'email (${patientViaEmail.numero_dossier || patientViaEmail._id}), pour ne plus dépendre de ce repli aux appels suivants`,
    });
  }
  return patientViaEmail;
};

// Statuts couvrant un RDV pas encore soldé (ni terminé, ni annulé, ni
// absent) — source unique, partagée entre getMe (KPI "Rendez-vous à
// venir") et getDashboard, pour qu'elles ne puissent plus diverger
// silencieusement. Corrige un bug réel : getMe ne comptait auparavant que
// ['planifie','confirme'], jamais 'en_attente' — le statut initial posé
// par createAppointment ci-dessous — si bien qu'un RDV réellement créé
// par le patient n'incrémentait jamais ce compteur tant qu'un membre du
// staff ne l'avait pas traité.
const RDV_ACTIFS = ['planifie','en_attente','confirme','arrive','en_consultation','en_cours','reporte'];

// ── ME : profil + statistiques ────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const [nbRdv, nbOrd, nbLabo, nbImag, nbFact, nbFactImpayees] = await Promise.all([
      Appointment.countDocuments({ patient: patient._id, statut: { $in: RDV_ACTIFS } }),
      Prescription.countDocuments({ patient: patient._id, statut: 'active' }),
      LabResult.countDocuments({ patient: patient._id, statut: 'valide' }),
      ImagingResult.countDocuments({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }),
      Invoice.countDocuments({ patient: patient._id }),
      Invoice.countDocuments({ patient: patient._id, statut: { $in: ['emise','partiellement_payee'] } }),
    ]);

    res.json({
      success: true,
      patient,
      must_change_password: req.user.must_change_password || false,
      stats: { nbRdv, nbOrd, nbLabo, nbImag, nbFact, nbFactImpayees },
    });
  } catch (err) { next(err); }
};

// ── RENDEZ-VOUS ───────────────────────────────────────────────────────────────
exports.getAppointments = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const appointments = await Appointment.find({ patient: patient._id })
      .populate('medecin', 'nom prenom specialite')
      .populate('service', 'nom')
      .sort('-date_heure')
      .lean();
    res.json({ success: true, appointments });
  } catch (err) { next(err); }
};

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// PORTAL-RDV-001 — "Prendre un rendez-vous" (Portal.jsx) n'avait aucun
// déclencheur réel (AUDIT-11) : la modale n'était reliée à aucune route.
// Options de prise de RDV patient-safe : mêmes sources réelles que le
// personnel (consultations.controller.js::getMedecins,
// settings.controller.js::getServices) mais projection volontairement plus
// stricte (aucun champ interne — chef_service, capacite, etc. — exposé à un
// compte role:'patient').
exports.getBookingOptions = async (req, res, next) => {
  try {
    const [services, medecins] = await Promise.all([
      Service.find({ statut: 'actif' }).select('nom').sort('nom').lean(),
      User.find({ role: 'medecin', statut: 'actif' }).select('nom prenom specialite').sort('nom').lean(),
    ]);
    res.json({ success: true, services, medecins });
  } catch (err) { next(err); }
};

// Liste blanche stricte, alignée sur APPT_CREATE_ALLOWED_FIELDS
// (appointments.controller.js) MOINS `patient` — un patient ne choisit
// jamais pour qui est le rendez-vous, uniquement pour lui-même (voir
// affectation forcée patient: patient._id ci-dessous, req.body.patient
// n'est jamais lu). `salle`/`notes` retirés : décisions internes à la
// clinique, aucun cas d'usage patient légitime.
const PORTAL_APPT_ALLOWED_FIELDS = ['medecin', 'service', 'date_heure', 'duree_minutes', 'type', 'motif'];

// POST /portal/appointments — prise de RDV patient-initiée. Réutilise
// exactement les mêmes garanties anti-conflit que le personnel
// (checkAppointmentConflict + isAppointmentRaceWinner, utils/helpers.js) :
// aucune seconde logique de détection de créneau n'est inventée ici. Le
// statut est toujours 'en_attente' (jamais 'confirme' directement) — cohérent
// avec le texte déjà affiché à l'écran ("Votre demande sera confirmée par la
// clinique dans les 24h").
exports.createAppointment = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const { medecin, date_heure, duree_minutes = 30, motif } = req.body;
    if (!isObjectId(medecin)) {
      return res.status(400).json({ success: false, message: 'Médecin invalide.' });
    }
    if (!motif || !String(motif).trim()) {
      return res.status(400).json({ success: false, message: 'Le motif de consultation est requis.' });
    }
    const dateReq = new Date(date_heure);
    if (isNaN(dateReq) || dateReq.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Merci de choisir une date et une heure futures.' });
    }
    if (req.body.service !== undefined && req.body.service !== '' && !isObjectId(req.body.service)) {
      return res.status(400).json({ success: false, message: 'Service invalide.' });
    }

    const medecinDoc = await User.findOne({ _id: medecin, role: 'medecin', statut: 'actif' }).select('_id');
    if (!medecinDoc) return res.status(404).json({ success: false, message: 'Médecin introuvable ou indisponible.' });

    if (req.body.service) {
      const serviceDoc = await Service.findOne({ _id: req.body.service, statut: 'actif' }).select('_id');
      if (!serviceDoc) return res.status(404).json({ success: false, message: 'Service introuvable ou indisponible.' });
    }

    const conflict = await checkAppointmentConflict({ medecin, date_heure: dateReq, duree_minutes });
    if (conflict) {
      return res.status(400).json({ success: false, message: 'Ce médecin a déjà un rendez-vous à cette heure. Merci de choisir un autre créneau.' });
    }

    const data = {};
    for (const k of PORTAL_APPT_ALLOWED_FIELDS) { if (req.body[k] !== undefined && req.body[k] !== '') data[k] = req.body[k]; }
    data.date_heure = dateReq;
    // Jamais lu depuis req.body : un patient ne peut réserver que pour son
    // propre dossier, quelle que soit la valeur envoyée par le client.
    data.patient = patient._id;
    data.statut = 'en_attente';
    data.created_by = req.user._id;

    let appt;
    try {
      appt = await Appointment.create(data);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Ce créneau vient d\'être réservé par une autre requête. Veuillez réessayer.' });
      }
      throw err;
    }

    // AUDIT-M-B4 (même filet que appointments.controller.js::create) —
    // élimine un chevauchement partiel gagné en concurrence AVANT tout effet
    // de bord.
    if (!(await isAppointmentRaceWinner(appt._id))) {
      await Appointment.findByIdAndDelete(appt._id);
      return res.status(409).json({ success: false, message: 'Ce créneau chevauche un rendez-vous qui vient d\'être réservé par une autre requête. Veuillez réessayer.' });
    }

    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'portal', entite_id: appt._id, ip: req.ip, message: `Patient ${patient.nom} ${patient.prenom} a demandé un RDV (${appt.type})` });
    emitActivity({ module: 'appointments', action: 'Nouvelle demande de rendez-vous', detail: appt.motif, icon: '📅', userId: req.user._id, userName: `${patient.prenom} ${patient.nom}` });
    emitDashboardUpdate();

    const populated = await Appointment.findById(appt._id).populate('medecin', 'nom prenom specialite').populate('service', 'nom').lean();
    res.status(201).json({ success: true, appointment: populated });
  } catch (err) { next(err); }
};

// PUT /portal/appointments/:id/cancel — annulation patient-initiée.
// SÉCURITÉ (Section 12 de l'audit) : vérifie explicitement que le RDV
// appartient bien au patient connecté avant toute écriture — jamais une
// confiance dans un identifiant fourni par le client sans revérification
// d'appartenance (un patient A ne peut pas annuler le RDV d'un patient B en
// devinant/énumérant un _id).
const APPT_CANCEL_BLOCKED_STATUTS = ['termine', 'annule', 'absent'];
exports.cancelAppointment = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant invalide.' });

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
    if (appt.patient.toString() !== patient._id.toString()) {
      await logAction({ utilisateur: req.user._id, action: 'CANCEL', module: 'portal', entite_id: appt._id, ip: req.ip, statut: 'echec', message: `Tentative d'annulation d'un RDV n'appartenant pas au patient connecté (${patient.numero_dossier})` });
      return res.status(403).json({ success: false, message: "Vous ne pouvez annuler que vos propres rendez-vous." });
    }
    if (APPT_CANCEL_BLOCKED_STATUTS.includes(appt.statut)) {
      return res.status(400).json({ success: false, message: 'Ce rendez-vous ne peut plus être annulé.' });
    }
    if (new Date(appt.date_heure).getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Ce rendez-vous est déjà passé et ne peut plus être annulé.' });
    }

    const avant = appt.toObject();
    appt.statut = 'annule';
    await appt.save();

    await logAction({ utilisateur: req.user._id, action: 'CANCEL', module: 'portal', entite_id: appt._id, ip: req.ip, message: `Patient ${patient.nom} ${patient.prenom} a annulé son rendez-vous`, avant, apres: appt.toObject() });
    emitActivity({ module: 'appointments', action: 'Rendez-vous annulé par le patient', detail: appt.motif, icon: '🚫', userId: req.user._id, userName: `${patient.prenom} ${patient.nom}` });
    emitDashboardUpdate();

    const populated = await Appointment.findById(appt._id).populate('medecin', 'nom prenom specialite').populate('service', 'nom').lean();
    res.json({ success: true, appointment: populated });
  } catch (err) { next(err); }
};

// ── ORDONNANCES ───────────────────────────────────────────────────────────────
// AUDIT-P7-7 — aucun filtre de statut : un brouillon (statut par défaut à la
// création, avant que le médecin ne la publie) était visible au patient
// comme n'importe quelle ordonnance réelle. 'active' est inclus en plus de
// la liste 'publiee'/'dispensee'/'expiree' suggérée par l'audit initial :
// c'est un état réellement atteint par de vraies ordonnances (seed.js,
// plusieurs tests), pas un résidu — même défense en profondeur déjà
// appliquée par prescriptions.controller.js::dispenser() (accepte
// 'publiee' ET 'active', cf. audit2-9/P7-3). Exclut brouillon (le bug) et
// annulee (ordonnance annulée, ne doit pas apparaître comme valide).
exports.getPrescriptions = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const prescriptions = await Prescription.find({ patient: patient._id, statut: { $in: ['active', 'publiee', 'dispensee', 'expiree'] } })
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament', 'nom forme')
      .sort('-date_prescription')
      .lean();
    res.json({ success: true, prescriptions });
  } catch (err) { next(err); }
};

// ── RÉSULTATS LABORATOIRE ────────────────────────────────────────────────────
exports.getLabResults = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const labResults = await LabResult.find({ patient: patient._id, statut: 'valide' })
      .populate('medecin_prescripteur', 'nom prenom specialite')
      .populate('examen', 'nom code categorie')
      .sort('-date_validation')
      .lean();
    res.json({ success: true, labResults });
  } catch (err) { next(err); }
};

// ── IMAGERIES ─────────────────────────────────────────────────────────────────
exports.getImaging = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const imaging = await ImagingResult.find({ patient: patient._id, statut: { $in: ['rapporte','valide'] } })
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('radiologue', 'nom prenom')
      .sort('-date_rapport')
      .lean();
    res.json({ success: true, imaging });
  } catch (err) { next(err); }
};

// ── FACTURES ──────────────────────────────────────────────────────────────────
exports.getInvoices = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const invoices = await Invoice.find({ patient: patient._id })
      .sort('-date_facture')
      .lean();
    res.json({ success: true, invoices });
  } catch (err) { next(err); }
};

// ── VACCINATIONS ──────────────────────────────────────────────────────────────
// Sous-phase 5.4 — "Mon Carnet Vaccinal" (Portal.jsx) affichait VACCINS, une
// constante 100% statique avec des vaccins et des dates entièrement inventés
// (Grippe saisonnière, COVID-19, Tétanos, Hépatite B "en retard"), montrée
// identique à TOUT patient connecté, quelle que soit sa réalité clinique.
// Seule source réelle de vaccination dans ce système :
// Child.vaccinations[] (module Pédiatrie — vaccin/date/rappel_prevu réels,
// alimentés par pediatrie.controller.js::addVaccination). Un patient adulte
// sans dossier pédiatrique lié n'a donc réellement aucune vaccination
// enregistrée dans ce système — retourne un tableau vide plutôt que
// d'inventer, jamais une simulation.
exports.getVaccinations = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const child = await Child.findOne({ patient_id: patient._id }).select('vaccinations').lean();
    res.json({ success: true, vaccinations: child?.vaccinations || [] });
  } catch (err) { next(err); }
};

// ── CONSULTATIONS ─────────────────────────────────────────────────────────────
// PORTAL-DOSSIER-001 (audit du 12 sept. 2026, mission "Compléter Mon dossier
// du portail patient") — le modèle Consultation existe et est réellement
// alimenté (Consultations.jsx, module personnel) mais aucun endpoint du
// portail ne l'exposait au patient : "Mon dossier" n'affichait ni historique
// de consultations, ni hospitalisations, ni documents. Même périmètre strict
// que le reste de ce contrôleur (findPatient) — jamais un identifiant fourni
// par le client, jamais une deuxième source de vérité pour "quel est le bon
// patient".
exports.getConsultations = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const consultations = await Consultation.find({ patient: patient._id })
      .populate('medecin', 'nom prenom specialite')
      .sort('-date_consultation')
      .lean();
    res.json({ success: true, consultations });
  } catch (err) { next(err); }
};

// ── HOSPITALISATIONS ──────────────────────────────────────────────────────────
exports.getHospitalizations = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const hospitalizations = await HospitalizationModel.find({ patient: patient._id })
      .populate('chambre', 'numero')
      .populate('service', 'nom')
      .populate('medecin_responsable', 'nom prenom specialite')
      .sort('-date_entree')
      .lean();
    res.json({ success: true, hospitalizations });
  } catch (err) { next(err); }
};

// ── DOCUMENTS MÉDICAUX ────────────────────────────────────────────────────────
// document.controller.js/document.routes.js réservent tout le module à
// ADMIN (SEC-B-04, décision déjà documentée : un administrateur gère le
// dépôt à travers tous les patients). Ici au contraire, un seul patient —
// celui réellement connecté — jamais un accès par rôle : liste strictement
// filtrée sur patient._id, et fichier_path/hash_integrite volontairement
// exclus de la réponse (chemin de stockage interne, aucune utilité
// frontend — le téléchargement passe exclusivement par downloadDocument
// ci-dessous, qui revérifie l'appartenance).
exports.getDocuments = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const documents = await DocumentModel.find({ patient: patient._id })
      .select('nom type taille mime_type commentaire tags createdAt')
      .sort('-createdAt')
      .lean();
    res.json({ success: true, documents });
  } catch (err) { next(err); }
};

// GET /portal/documents/:id/download
// SÉCURITÉ CRITIQUE — jamais une confiance dans req.params.id seul : un
// Document existant mais appartenant à un autre patient doit être refusé
// (403), pas seulement "non listé" côté frontend. Réutilise la même racine
// de résolution que uploads.controller.js::serveUpload (uploadsRoot exporté
// depuis ce contrôleur, jamais un second calcul de chemin) avec la même
// garde anti-traversée de chemin, mais un contrôle d'accès différent et
// volontaire : appartenance réelle au patient connecté, pas un rôle.
const { uploadsRoot } = require('./uploads.controller');
exports.downloadDocument = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant invalide.' });

    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document introuvable.' });
    if (String(doc.patient) !== String(patient._id)) {
      await logAction({
        utilisateur: req.user._id, action: 'READ', module: 'portal', entite_id: doc._id, ip: req.ip, statut: 'echec',
        message: `Tentative de téléchargement d'un document n'appartenant pas au patient connecté (${patient.numero_dossier})`,
      });
      return res.status(403).json({ success: false, message: 'Vous ne pouvez accéder qu\'à vos propres documents.' });
    }

    // Jamais un fichier simulé : si aucun chemin réel n'est associé (ne
    // devrait pas arriver — document.controller.js::create exige un
    // upload — mais un état de données incohérent doit échouer
    // honnêtement, pas fabriquer un téléchargement).
    if (!doc.fichier_path) return res.status(404).json({ success: false, message: 'Aucun fichier associé à ce document.' });

    // MIGRATION-CLOUDINARY — un document créé (ou migré) après le passage à
    // Cloudinary porte une URL absolue, plus un chemin local : le contrôle
    // d'appartenance ci-dessus reste identique (déjà effectué avant ce
    // point), seule la façon de livrer le fichier diffère — redirection vers
    // Cloudinary plutôt qu'un fs.existsSync/res.download local.
    // SEC-DOC-01 (audit métier du 13 sept. 2026, Phase 4) — fichier_path
    // seul était une URL signée valide indéfiniment (jamais d'expires_at à
    // l'upload) : une fois obtenue par ce téléchargement légitime, elle
    // restait utilisable pour toujours, y compris après révocation de
    // l'accès du patient. Une URL fraîche à courte durée de vie est
    // désormais régénérée à CHAQUE téléchargement autorisé (jamais
    // persistée) quand l'asset est sur Cloudinary (cloudinary_public_id
    // présent) ; un document en repli disque local (public_id absent, ou
    // déposé avant ce correctif) continue d'utiliser fichier_path tel quel.
    if (/^https?:\/\//.test(doc.fichier_path)) {
      await logAction({ utilisateur: req.user._id, action: 'READ', module: 'portal', entite_id: doc._id, ip: req.ip, message: `Patient ${patient.nom} ${patient.prenom} a téléchargé le document "${doc.nom}"` });
      const deliveryUrl = doc.cloudinary_public_id
        ? cloudinaryUtil.getSignedDeliveryUrl({
            public_id: doc.cloudinary_public_id,
            resource_type: doc.cloudinary_resource_type,
            format: doc.cloudinary_format,
            version: doc.cloudinary_version,
          })
        : doc.fichier_path;
      return res.redirect(deliveryUrl);
    }

    const relative = doc.fichier_path.replace(/^\/?uploads\//, '');
    const resolved = path.resolve(path.join(uploadsRoot, relative));
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
      return res.status(400).json({ success: false, message: 'Chemin de fichier invalide.' });
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable sur le serveur.' });
    }

    await logAction({ utilisateur: req.user._id, action: 'READ', module: 'portal', entite_id: doc._id, ip: req.ip, message: `Patient ${patient.nom} ${patient.prenom} a téléchargé le document "${doc.nom}"` });
    res.download(resolved, doc.nom);
  } catch (err) { next(err); }
};

// ── MESSAGERIE PATIENT ─────────────────────────────────────────────────────────
// PORTAL-MSG-001 (audit du 12 sept. 2026, mission "Correction stricte de la
// messagerie patient") — l'onglet "Messagerie" (Portal.jsx) était
// honnêtement désactivé depuis Correction 3 : Conversation/Message n'avaient
// jamais de canal patient↔personnel réel, et POST /messages (getOrCreate,
// messages.routes.js) est réservé à STAFF (SEC-005) — un patient ne pouvait
// jamais devenir membre d'une conversation. Réactivé ici en réutilisant
// EXACTEMENT la même architecture (Conversation/Message, messages.controller.js)
// plutôt qu'une deuxième messagerie parallèle : GET /messages (liste),
// GET /messages/:id (lecture, marque lu), POST /messages/:id/send (envoi)
// n'ont AUCUNE restriction de rôle dans messages.routes.js — déjà
// utilisables tels quels par un patient une fois membre d'une conversation,
// aucune modification de ces trois routes/contrôleurs. Seule pièce
// manquante : un moyen, pour le patient, de DEVENIR membre d'une
// conversation avec un destinataire réellement autorisé — c'est tout ce que
// ce bloc ajoute.
const messagesController = require('./messages.controller');

// Règle métier (déterminée depuis les données réelles existantes, aucun
// nouveau champ) : un patient ne peut contacter que les membres du
// personnel ayant un lien de soin réel et vérifiable avec lui — jamais
// l'annuaire complet du personnel (getDirectory, réservé au personnel).
// Deux sources déjà présentes sur le schéma : patient.medecin_referent
// (médecin référent déclaré) et tout médecin ayant réellement eu un
// rendez-vous ou une consultation avec ce patient (Appointment.medecin /
// Consultation.medecin). Recalculé côté serveur à chaque appel — jamais un
// snapshot mis en cache qui pourrait dériver des vraies données.
const getAuthorizedContactIds = async (patient) => {
  const [apptMedecins, consMedecins] = await Promise.all([
    Appointment.find({ patient: patient._id }).distinct('medecin'),
    Consultation.find({ patient: patient._id }).distinct('medecin'),
  ]);
  const ids = new Set([...apptMedecins, ...consMedecins].map(String));
  if (patient.medecin_referent) ids.add(String(patient.medecin_referent));
  return ids;
};

// GET /portal/messages/contacts
exports.getMessageContacts = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const ids = await getAuthorizedContactIds(patient);
    const contacts = await User.find({ _id: { $in: [...ids] }, statut: 'actif' })
      .select('nom prenom role specialite avatar')
      .sort('nom');
    res.json({ success: true, contacts });
  } catch (err) { next(err); }
};

// POST /portal/messages — ouvre (ou récupère) une conversation directe avec
// un contact réellement autorisé. SÉCURITÉ : userId revérifié contre
// getAuthorizedContactIds recalculé depuis le patient réellement connecté —
// jamais une confiance dans un rôle affiché côté client. Une fois
// l'autorisation confirmée, délègue à messages.controller.js::getOrCreate
// tel quel (même recherche/déduplication de conversation directe que le
// personnel, aucune deuxième logique de création écrite ici).
exports.getOrCreatePatientConversation = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });
    const { userId } = req.body;
    if (!isObjectId(userId)) return res.status(400).json({ success: false, message: 'Destinataire invalide.' });

    const authorized = await getAuthorizedContactIds(patient);
    if (!authorized.has(String(userId))) {
      await logAction({
        utilisateur: req.user._id, action: 'CREATE', module: 'portal', ip: req.ip, statut: 'echec',
        message: `Tentative de contact d'un destinataire non autorisé (${userId}) par le patient ${patient.numero_dossier}`,
      });
      return res.status(403).json({ success: false, message: 'Vous ne pouvez contacter que les membres de votre équipe soignante.' });
    }

    return messagesController.getOrCreate(req, res, next);
  } catch (err) { next(err); }
};

// ── DASHBOARD (agrégat pour Dashboard.jsx::PatientDashboard) ─────────────────
// AUDIT-DASHBOARD-PATIENT — Dashboard.jsx appelle déjà GET /portal/dashboard en
// repli pour role==='patient', mais cette route n'existait pas : chaque appel
// échouait en 404, silencieusement absorbé par le frontend (`catch { result =
// {} }`), donc le dashboard patient affichait TOUJOURS l'état vide sur chacun
// de ses widgets (KPI à 0, aucun RDV, aucune ordonnance…), quel que soit
// l'état réel du dossier. Même principe de périmètre strict que le reste de
// ce contrôleur (findPatient) : uniquement les données du patient connecté,
// jamais une statistique globale de la clinique.
exports.getDashboard = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const now = new Date();
    // RDV_ACTIFS : constante partagée définie en tête de fichier (voir getMe).

    const [
      rdv_a_venir,
      ordonnances_actives,
      resultats_labo_dispo,
      resultats_imagerie_dispo,
      factures_impayees,
      consultations_total,
      messages_non_lus,
      prochainRdvDoc,
      rdvListeRaw,
      ordonnancesRaw,
      labResultsRaw,
      imagingRaw,
      facturesRaw,
      consultationsRecentes,
    ] = await Promise.all([
      Appointment.countDocuments({ patient: patient._id, date_heure: { $gte: now }, statut: { $in: RDV_ACTIFS } }),
      Prescription.countDocuments({ patient: patient._id, statut: { $in: ['active','publiee'] } }),
      LabResult.countDocuments({ patient: patient._id, statut: 'valide' }),
      ImagingResult.countDocuments({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }),
      Invoice.countDocuments({ patient: patient._id, statut: { $in: ['emise','partiellement_payee'] } }),
      Consultation.countDocuments({ patient: patient._id }),
      // Même règle que receptionnisteStats (dashboard.controller.js) : un
      // membre de la conversation avec au moins un message qu'il n'a ni
      // envoyé, ni encore lu — AUDIT-ELEVE-5, requête factorisée après la
      // migration de Conversation.messages vers la collection Message.
      countUnreadConversations(req.user._id),
      Appointment.findOne({ patient: patient._id, date_heure: { $gte: now }, statut: { $in: RDV_ACTIFS } })
        .populate('medecin', 'nom')
        .sort('date_heure'),
      Appointment.find({ patient: patient._id }).populate('medecin', 'nom').sort('-date_heure').limit(10),
      Prescription.find({ patient: patient._id, statut: { $in: ['active','publiee','dispensee','expiree'] } })
        .sort('-date_prescription').limit(10),
      LabResult.find({ patient: patient._id, statut: 'valide' }).populate('examen', 'nom').sort('-date_validation').limit(6),
      ImagingResult.find({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }).sort('-date_rapport').limit(6),
      Invoice.find({ patient: patient._id }).sort('-date_facture').limit(8),
      // Sous-phase 5.1 (relecture du 6 sept. 2026) — Portal.jsx affichait
      // jusqu'ici un historique de constantes entièrement fabriqué (CONSTANTES,
      // 3 lignes fixes). Remplacé par les vraies consultations récentes du
      // patient (limit 8, filtrées ensuite aux seules ayant de vraies
      // constantes saisies) plutôt qu'une seule (findOne), pour permettre un
      // vrai historique, pas juste le dernier point.
      Consultation.find({ patient: patient._id }).sort('-date_consultation').limit(8).select('signes_vitaux date_consultation'),
    ]);

    const medecin_ref = patient.medecin_referent
      ? await User.findById(patient.medecin_referent).select('nom prenom specialite telephone')
      : null;

    const prochain_rdv = prochainRdvDoc ? {
      date: new Date(prochainRdvDoc.date_heure).toLocaleDateString('fr-FR'),
      heure: new Date(prochainRdvDoc.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: prochainRdvDoc.type || 'consultation',
      medecin: prochainRdvDoc.medecin?.nom || '—',
    } : null;

    const mes_rdv = rdvListeRaw.map(r => ({
      date: r.date_heure,
      heure: new Date(r.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: r.type || 'consultation',
      medecin: r.medecin?.nom || '—',
      statut: r.statut,
    }));

    const ordonnances = ordonnancesRaw.map(o => ({
      medicament: (o.lignes || []).map(l => l.medicament_nom).filter(Boolean).join(', ') || '—',
      posologie: (o.lignes || [])[0]?.posologie || '—',
      fin: o.date_expiration,
    }));

    const resultats = [
      ...labResultsRaw.map(r => ({
        type: 'laboratoire',
        examen: r.examen?.nom || 'Analyse de laboratoire',
        date: r.date_validation || r.date_prescription,
        statut: 'disponible',
      })),
      ...imagingRaw.map(r => ({
        type: 'radiologie',
        examen: r.type_examen || 'Imagerie médicale',
        date: r.date_rapport || r.date_prescription,
        statut: 'disponible',
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

    const factures = facturesRaw.map(f => ({
      date: f.date_facture,
      prestation: f.service_label || f.lignes?.[0]?.libelle || 'Facture',
      montant: f.montant_ttc,
      statut: f.statut === 'payee' ? 'payee' : (f.montant_paye > 0 ? 'en_attente' : 'impayee'),
    }));

    const shapeConstantes = (c) => {
      const sv = c.signes_vitaux || {};
      if (!(sv.poids || sv.tension_systolique || sv.glycemie || sv.temperature)) return null;
      // IMC calculé à la volée depuis poids/taille réels (même formule/
      // convention — taille en cm — que pediatrieController.js::addMesure),
      // jamais une valeur inventée quand l'un des deux manque.
      const imc = (sv.poids && sv.taille) ? parseFloat((sv.poids / ((sv.taille / 100) ** 2)).toFixed(1)) : undefined;
      return {
        poids: sv.poids,
        tension: (sv.tension_systolique && sv.tension_diastolique) ? `${sv.tension_systolique}/${sv.tension_diastolique}` : undefined,
        glycemie: sv.glycemie,
        temp: sv.temperature,
        taille: sv.taille,
        fc: sv.pouls,
        imc,
        date: c.date_consultation,
      };
    };
    // Sous-phase 5.1 — historique réel (jusqu'à 5 consultations les plus
    // récentes portant de vraies constantes saisies), plus le dernier point
    // isolé pour les widgets qui n'ont besoin que de la valeur la plus
    // récente. Jamais de ligne fabriquée si le patient a moins de vraies
    // constantes que la limite d'affichage.
    const constantesHistorique = consultationsRecentes.map(shapeConstantes).filter(Boolean).slice(0, 5);
    const constantes = constantesHistorique[0] || {};

    // Alertes réelles uniquement : aucune injection de contenu clinique
    // sensible (ex. résultat critique) côté patient sans validation médicale.
    const alertes = [];
    if (factures_impayees > 0) {
      alertes.push({ type: 'warn', msg: `${factures_impayees} facture(s) impayée(s)`, heure: 'À régler' });
    }
    const ordonnanceExpireBientot = ordonnancesRaw.find(o =>
      o.date_expiration && new Date(o.date_expiration) > now && (new Date(o.date_expiration) - now) < 3 * 86400000
    );
    if (ordonnanceExpireBientot) {
      alertes.push({ type: 'info', msg: 'Une ordonnance active arrive bientôt à expiration', heure: 'À renouveler' });
    }

    res.json({ success: true, stats: {
      kpis: {
        rdv_a_venir, ordonnances_actives,
        resultats_disponibles: resultats_labo_dispo + resultats_imagerie_dispo,
        factures_impayees, consultations_total, messages_non_lus,
      },
      // AUDIT-D2 (ticket 0002) — vérification manuelle réelle (Phase G2) a
      // montré qu'un patient atterrit sur Dashboard.jsx (/) après connexion,
      // jamais sur Portal.jsx (/portal) où vivait jusqu'ici la bannière
      // "Profil à compléter" : la bannière n'était donc en pratique jamais
      // vue à la connexion, l'objectif du ticket ("à la connexion
      // suivante"). Exposé ici pour que Dashboard.jsx puisse afficher la
      // même alerte sans dupliquer la logique de complétion (le patient est
      // renvoyé vers /portal pour la remplir, seul endroit où le formulaire
      // existe).
      profil_a_completer: patient.profil_a_completer || false,
      prochain_rdv, mes_rdv, ordonnances, resultats, factures, alertes, constantes, constantes_historique: constantesHistorique,
      medecin_ref: medecin_ref ? {
        nom: medecin_ref.nom, prenom: medecin_ref.prenom,
        specialite: medecin_ref.specialite, telephone: medecin_ref.telephone,
      } : null,
    }});
  } catch (err) { next(err); }
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ destinataire: req.user._id })
      .sort('-createdAt')
      .limit(50)
      .lean();
    res.json({ success: true, notifications });
  } catch (err) { next(err); }
};

// ── MARQUER NOTIFICATIONS LUES ────────────────────────────────────────────────
exports.markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { destinataire: req.user._id, lu: false },
      { lu: true }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── MODIFIER PROFIL ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });
    const avant = patient.toObject();

    // Champs modifiables par le patient lui-même
    const allowed = ['telephone', 'adresse', 'contact_urgence'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    // AUDIT-D2 (ticket 0002) — date_naissance/sexe ne sont modifiables par le
    // patient QUE pour compléter un dossier créé via Google OAuth (T3.1,
    // profil_a_completer:true, ces deux champs alors absents) — jamais en
    // usage général, pour ne pas ouvrir un canal de modification libre de
    // l'identité administrative d'un patient déjà admis normalement (gérée
    // par la réception dans ce cas). Une fois les deux renseignés,
    // profil_a_completer repasse à false.
    if (patient.profil_a_completer) {
      if (req.body.date_naissance !== undefined) update.date_naissance = req.body.date_naissance;
      if (req.body.sexe !== undefined) update.sexe = req.body.sexe;
      const dateFinale = update.date_naissance !== undefined ? update.date_naissance : patient.date_naissance;
      const sexeFinal  = update.sexe !== undefined ? update.sexe : patient.sexe;
      if (dateFinale && sexeFinal) update.profil_a_completer = false;
    }

    const updated = await Patient.findByIdAndUpdate(patient._id, update, { new: true, runValidators: true });

    // Sync téléphone dans User si modifié
    if (update.telephone) {
      await User.findOneAndUpdate({ email: req.user.email }, { telephone: update.telephone });
    }

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'portal',
      entite_id: patient._id, ip: req.ip,
      message: `Patient ${patient.nom} ${patient.prenom} a mis à jour son profil`,
      avant, apres: updated,
    });

    res.json({ success: true, patient: updated });
  } catch (err) { next(err); }
};

// T9.9 — même cache court (30s) que dashboard.controller.js pour les 9
// tableaux de bord staff, appliqué ici pour la même raison : Dashboard.jsx
// interroge cet endpoint au montage, toutes les 30s, et à chaque événement
// dashboard:refresh — sans cache, chaque patient connecté déclenche la même
// dizaine de requêtes en boucle. Clé de cache par utilisateur (personalized)
// puisque la réponse est strictement propre au patient connecté.
const { cacheStats } = require('../utils/dashboardCache');
exports.getDashboard = cacheStats('portalDashboard', true, exports.getDashboard);

// ── CHANGER MOT DE PASSE ──────────────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });

    user.password             = newPassword;
    user.must_change_password = false;
    await user.save();

    // T9.3 — pas de avant/apres ici, volontairement : le seul champ modifié
    // est `password` (hash bcrypt), et `must_change_password`. Journaliser un
    // instantané avant/après stockerait le hash de l'ancien ET du nouveau mot
    // de passe dans AuditLog, ce que R-08b/T3.3 ont justement cherché à
    // éliminer pour le mot de passe en clair — même logique appliquée ici par
    // précaution au hash, qui n'a pas besoin de circuler dans les logs pour
    // que cette action reste traçable (le message suffit).
    await logAction({
      utilisateur: req.user._id, action: 'UPDATE_PASSWORD', module: 'portal',
      ip: req.ip, message: `Patient ${user.email} a changé son mot de passe`,
    });

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) { next(err); }
};

// ── ASSISTANT IA (patient) ────────────────────────────────────────────────────
// PORTAL-IA-001 — l'onglet "Assistant IA" (Portal.jsx) n'appelait aucune API
// réelle : les 5 cartes "Fonctions disponibles" étaient purement décoratives
// (curseur pointeur + survol, aucun handler). Réutilise
// utils/openai.js::generateReport() tel quel (même service déjà utilisé par
// ai.controller.js::chat pour le personnel et par le rapport hebdomadaire
// Analytics) — aucune seconde intégration OpenAI créée. Volontairement une
// route distincte de POST /ai/chat (réservée au personnel, ai.routes.js) :
// prompt système différent, adressé directement à un PATIENT plutôt qu'à un
// professionnel, et cette fonction ne reçoit ni ne lit aucune donnée d'un
// autre patient (aucun patientId dans le payload) — la portée est donc déjà
// strictement individuelle par construction, pas seulement par filtrage.
const openai = require('../utils/openai');
const PORTAL_AI_SYSTEM_PROMPT = "Tu es l'assistant IA santé de MediSync, à la Clinique Canadienne de Souanké. Tu réponds directement à un PATIENT, jamais à un professionnel de santé. Réponds en français, simplement et avec bienveillance. Tu n'établis JAMAIS de diagnostic, ne prescris jamais de traitement, et rappelles systématiquement que tes réponses sont uniquement informatives et ne remplacent pas l'avis d'un professionnel de santé — invite le patient à consulter son médecin pour toute décision médicale ou en cas de doute, d'urgence ou de symptôme préoccupant.";
const PORTAL_AI_MAX_MESSAGE_LEN = 2000;
const PORTAL_AI_MAX_HISTORY = 6;

exports.aiChat = async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message vide.' });
  }
  if (message.length > PORTAL_AI_MAX_MESSAGE_LEN) {
    return res.status(400).json({ success: false, message: `Message trop long (max ${PORTAL_AI_MAX_MESSAGE_LEN} caractères).` });
  }
  const histArr = Array.isArray(history) ? history.slice(-PORTAL_AI_MAX_HISTORY) : [];
  const transcript = histArr
    .filter(h => h && typeof h.content === 'string' && (h.role === 'user' || h.role === 'bot'))
    .map(h => `${h.role === 'user' ? 'Patient' : 'Assistant'}: ${h.content}`)
    .join('\n');
  const userPrompt = transcript ? `${transcript}\nPatient: ${message}` : message;

  try {
    const result = await openai.generateReport({ systemPrompt: PORTAL_AI_SYSTEM_PROMPT, userPrompt });
    if (result.simulated) {
      return res.json({ success: false, simulated: true, message: 'Assistant IA indisponible — non configuré sur le serveur.' });
    }
    res.json({
      success: true,
      reply: result.content,
      disclaimer: 'Réponse générée par IA — à titre informatif uniquement, ne remplace pas l\'avis d\'un professionnel de santé.',
    });
  } catch (err) {
    // SEC-AI-ERROR-LEAK (13 sept. 2026, découvert en test navigateur réel) —
    // err.message peut porter le texte brut renvoyé par l'API OpenAI
    // (ex. "You have no credits remaining. Add credits ... at
    // https://platform.openai.com/settings/organization/billing"), un détail
    // d'infrastructure interne (lien de facturation du compte OpenAI de la
    // clinique) qui n'a aucune raison d'atteindre un patient. L'erreur réelle
    // reste tracée (log + AuditLog, même principe qu'ailleurs dans ce
    // module) — seul le message renvoyé au client est désormais générique.
    logger.error('[PORTAL AI] Échec appel assistant IA', { error: err.message, patientUserId: req.user?._id?.toString() });
    await logAction({
      utilisateur: req.user?._id, action: 'PORTAL_AI_CHAT', module: 'portal', ip: req.ip, statut: 'echec',
      message: `Échec appel assistant IA (patient ${req.user?.email}) : ${err.message}`,
    });
    res.status(502).json({ success: false, message: "Assistant IA temporairement indisponible. Réessayez plus tard." });
  }
};
