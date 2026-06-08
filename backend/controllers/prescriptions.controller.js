const Prescription = require('../models/Prescription');
const Patient      = require('../models/Patient');
const User         = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate, emitTo } = require('../utils/socket');
const { sendPrescriptionEmail } = require('../utils/mail');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, medecin } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut)  filter.statut  = statut;
    if (medecin) filter.medecin = medecin;

    const total = await Prescription.countDocuments(filter);
    const prescriptions = await paginate(
      Prescription.find(filter)
        .populate('patient',  'nom prenom numero_dossier telephone')
        .populate('medecin',  'nom prenom specialite')
        .populate('lignes.medicament', 'nom_commercial dci')
        .sort('-date_prescription'),
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
    // Détection interactions médicamenteuses (règle simple)
    const meds = (req.body.lignes || []).map(l => (l.medicament_nom || '').toLowerCase());
    const interactions = [];
    if (meds.includes('warfarine') && meds.includes('aspirine'))
      interactions.push({ medicaments: ['Warfarine', 'Aspirine'], risque: 'Élevé', description: 'Risque hémorragique majeur — surveillance INR obligatoire' });
    if (meds.includes('metformine') && meds.includes('alcool'))
      interactions.push({ medicaments: ['Metformine', 'Alcool'], risque: 'Modéré', description: 'Risque d\'acidose lactique accru' });

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

exports.update = async (req, res, next) => {
  try {
    const prescription = await Prescription.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    const prescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      { statut: 'annulee' },
      { new: true }
    );
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'CANCEL', module: 'prescriptions', entite_id: prescription._id, ip: req.ip });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

// ── PUBLIER (rend visible pour le patient + notif + email) ───────────────────
exports.publier = async (req, res, next) => {
  try {
    const rx = await Prescription.findById(req.params.id)
      .populate('patient', 'nom prenom email telephone')
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament', 'nom_commercial');

    if (!rx) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    if (rx.statut === 'annulee') return res.status(400).json({ success: false, message: 'Impossible de publier une ordonnance annulée.' });

    rx.statut   = 'publiee';
    rx.publie_at  = new Date();
    rx.publie_par = req.user._id;

    // ── Email patient ─────────────────────────────────────────
    let emailEnvoye = false;
    const patientEmail = rx.patient?.email;
    if (patientEmail) {
      try {
        const lienPortail = `${process.env.CLIENT_URL}/portal`;
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
        console.error('[MAIL prescription]', mailErr.message);
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
