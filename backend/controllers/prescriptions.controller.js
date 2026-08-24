const Prescription = require('../models/Prescription');
const Patient      = require('../models/Patient');
const User         = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate, emitTo } = require('../utils/socket');
const { sendPrescriptionEmail } = require('../utils/mail');
const { logger } = require('../utils/logger');
const { detectInteractions } = require('../utils/drugInteractions');
const env = require('../config/env');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, medecin } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut)  filter.statut  = statut;
    if (medecin) filter.medecin = medecin;

    const total = await Prescription.countDocuments(filter);
    // AUDIT-FAIBLE-F1 — .lean() : aucun virtual/toJSON transform sur
    // Prescription ni sur Patient/User/Medication (populate), vérifié
    // exhaustivement.
    const prescriptions = await paginate(
      Prescription.find(filter)
        .populate('patient',  'nom prenom numero_dossier telephone')
        .populate('medecin',  'nom prenom specialite')
        .populate('lignes.medicament', 'nom_commercial dci')
        .sort('-date_prescription')
        .lean(),
      page, limit
    );
    res.json({ success: true, total, prescriptions });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient')
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament');
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Détection interactions médicamenteuses — base partagée avec le module
    // IA et la pharmacie (utils/drugInteractions.js), 15 règles au lieu de 2.
    const meds = (req.body.lignes || []).map(l => (l.medicament_nom || '').toLowerCase());
    const interactions = detectInteractions(meds);

    const prescription = await Prescription.create({
      ...req.body,
      medecin: req.user._id,
      interactions_detectees: interactions,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'prescriptions', entite_id: prescription._id, ip: req.ip, message: `Ordonnance ${prescription.numero_rx}` });
    emitActivity({ module: 'prescriptions', action: 'Nouvelle ordonnance', detail: prescription.numero_rx || 'Ordonnance créée', icon: '📋', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, prescription });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — statut/dispensee_par/date_dispensation/publie_*
// sont la machine à états que publier()/dispenser()/cancel()/renouveler()
// gèrent avec leurs propres effets de bord (email, notification, contrôle
// de stock — cf. P7-3). Les laisser passer par cette édition générique
// permettrait de contourner entièrement ce circuit (ex. passer directement
// à 'dispensee' sans jamais toucher au stock). patient/medecin/consultation
// identifient l'ordonnance et son origine ; numero_rx est auto-généré.
const RX_BLOCKED_FIELDS = [
  'patient', 'medecin', 'consultation', 'numero_rx', 'statut',
  'dispensee_par', 'date_dispensation', 'publie_at', 'publie_par',
  'email_patient_envoye', 'notif_patient_envoyee',
];

exports.update = async (req, res, next) => {
  try {
    const avant = await Prescription.findById(req.params.id);
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!RX_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const prescription = await Prescription.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'prescriptions', entite_id: prescription._id, ip: req.ip, message: `Ordonnance ${prescription.numero_rx} modifiée`, avant, apres: prescription });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    const avant = await Prescription.findById(req.params.id);
    const prescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      { statut: 'annulee' },
      { new: true }
    );
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'CANCEL', module: 'prescriptions', entite_id: prescription._id, ip: req.ip, avant, apres: prescription });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

// ── PUBLIER (rend visible pour le patient + notif + email) ───────────────────
exports.publier = async (req, res, next) => {
  try {
    const rxAvant = await Prescription.findById(req.params.id)
      .populate('patient', 'nom prenom email telephone')
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament', 'nom_commercial');

    if (!rxAvant) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    if (rxAvant.statut === 'annulee') return res.status(400).json({ success: false, message: 'Impossible de publier une ordonnance annulée.' });

    const avant = rxAvant.toObject();

    // AUDIT-M-B6 — la vérification ci-dessus n'était pas atomique avec
    // rx.save() en fin de fonction (email/notification compris) : cancel()
    // n'a lui-même aucune garde de statut, donc une annulation concurrente
    // pouvait s'intercaler entre cette lecture et l'écriture finale —
    // publier() écrasait alors silencieusement statut:'annulee' avec
    // 'publiee', ressuscitant une ordonnance annulée (intégrité clinique,
    // pas juste une question de dette technique). Transition atomique EN
    // PREMIER, avant tout effet de bord (email, notification) — même
    // principe que finance.controller.js::addPayment et
    // pharmacy.controller.js::dispenser : le filtre porte la garde
    // (statut != 'annulee'), jamais une vérification séparée avant l'écriture.
    const rx = await Prescription.findOneAndUpdate(
      { _id: rxAvant._id, statut: { $ne: 'annulee' } },
      { $set: { statut: 'publiee', publie_at: new Date(), publie_par: req.user._id } },
      { new: true }
    )
      .populate('patient', 'nom prenom email telephone')
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament', 'nom_commercial');

    if (!rx) {
      await logAction({ utilisateur: req.user._id, action: 'PUBLISH', module: 'prescriptions', entite_id: rxAvant._id, ip: req.ip, statut: 'echec', message: `Publication refusée — ordonnance annulée entre-temps (course concurrente)` });
      return res.status(400).json({ success: false, message: 'Impossible de publier une ordonnance annulée.' });
    }

    // ── Email patient ─────────────────────────────────────────
    let emailEnvoye = false;
    const patientEmail = rx.patient?.email;
    if (patientEmail) {
      try {
        const lienPortail = `${env.CLIENT_URL}/portal`;
        await sendPrescriptionEmail({
          email:      patientEmail,
          prenom:     rx.patient.prenom,
          nom:        rx.patient.nom,
          numero_rx:  rx.numero_rx,
          date:       rx.date_prescription,
          medecin:    `Dr. ${rx.medecin?.prenom} ${rx.medecin?.nom}`,
          lignes:     rx.lignes || [],
          diagnostic: rx.diagnostic,
          lienPortail,
        });
        emailEnvoye = true;
        rx.email_patient_envoye = true;
      } catch (mailErr) {
        logger.error('[MAIL prescription] Échec envoi email ordonnance', { error: mailErr.message });
      }
    }

    // ── Notification interne vers le compte patient ───────────
    // Chercher l'User correspondant au patient (email commun)
    if (patientEmail) {
      const userPatient = await User.findOne({ email: patientEmail, role: 'patient' });
      if (userPatient) {
        await createNotification({
          destinataire: userPatient._id,
          type:    'success',
          titre:   `Ordonnance ${rx.numero_rx} disponible`,
          message: `Votre médecin Dr. ${rx.medecin?.prenom} ${rx.medecin?.nom} a publié une ordonnance vous concernant. Connectez-vous au portail pour la consulter.`,
          lien:    '/portal',
          priorite:'haute',
        });
        rx.notif_patient_envoyee = true;
      }
    }

    await rx.save();

    await logAction({
      utilisateur: req.user._id, action: 'PUBLISH', module: 'prescriptions',
      entite_id: rx._id, ip: req.ip,
      message: `Ordonnance ${rx.numero_rx} publiée — email${emailEnvoye ? '' : ' non'} envoyé`,
      avant, apres: rx,
    });
    emitActivity({ module: 'prescriptions', action: 'Ordonnance publiée', detail: `${rx.numero_rx} → ${rx.patient?.prenom} ${rx.patient?.nom}`, icon: '📨', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.json({ success: true, prescription: rx, email_envoye: emailEnvoye });
  } catch (err) { next(err); }
};

// ── RENOUVELER ────────────────────────────────────────────────────────────────
exports.renouveler = async (req, res, next) => {
  try {
    const original = await Prescription.findById(req.params.id)
      .populate('patient', 'nom prenom email')
      .populate('medecin', 'nom prenom');
    if (!original) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });

    const renouvellement = await Prescription.create({
      patient:    original.patient._id,
      medecin:    req.user._id,
      lignes:     original.lignes,
      diagnostic: original.diagnostic,
      statut:     'brouillon',
      interactions_detectees: original.interactions_detectees,
    });
    await logAction({ utilisateur: req.user._id, action: 'RENEW', module: 'prescriptions', entite_id: renouvellement._id, ip: req.ip, message: `Renouvellement de ${original.numero_rx}` });
    emitActivity({ module: 'prescriptions', action: 'Renouvellement ordonnance', detail: `Depuis ${original.numero_rx}`, icon: '🔄', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    res.status(201).json({ success: true, prescription: renouvellement });
  } catch (err) { next(err); }
};

// ── STATS ────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [total, actives, publiees, dispensees, expirees, annulees, brouillons] = await Promise.all([
      Prescription.countDocuments(),
      Prescription.countDocuments({ statut: 'active' }),
      Prescription.countDocuments({ statut: 'publiee' }),
      Prescription.countDocuments({ statut: 'dispensee' }),
      Prescription.countDocuments({ statut: 'expiree' }),
      Prescription.countDocuments({ statut: 'annulee' }),
      Prescription.countDocuments({ statut: 'brouillon' }),
    ]);
    // Consultations du jour
    const debut = new Date(); debut.setHours(0,0,0,0);
    const fin   = new Date(); fin.setHours(23,59,59,999);
    const aujourd_hui = await Prescription.countDocuments({ createdAt: { $gte: debut, $lte: fin } });

    res.json({ success: true, stats: { total, actives, publiees, dispensees, expirees, annulees, brouillons, aujourd_hui } });
  } catch (err) { next(err); }
};
