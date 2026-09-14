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

    // AUDIT-FAIBLE-F1 — .lean() : aucun virtual/toJSON transform sur
    // Prescription ni sur Patient/User/Medication (populate), vérifié
    // exhaustivement.
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle (un aller-retour réseau
    // MongoDB économisé).
    const [total, prescriptions] = await Promise.all([
      Prescription.countDocuments(filter),
      paginate(
        Prescription.find(filter)
          .populate('patient',  'nom prenom numero_dossier telephone')
          .populate('medecin',  'nom prenom specialite')
          .populate('lignes.medicament', 'nom_commercial dci')
          .sort('-date_prescription')
          .lean(),
        page, limit
      ),
    ]);
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

// CLIN-01 (correction du 12 sept. 2026, audit indépendant) — create()
// passait `...req.body` tel quel : un client pouvait fabriquer directement
// `statut:'dispensee'`, `patient`/`consultation` arbitraires, ou même
// `dispensee_par`/`publie_at`, contournant entièrement le vrai circuit
// pharmacie (pharmacy.controller.js::dispenser, seul endroit qui décrémente
// réellement le stock) — une ordonnance pouvait donc se déclarer "déjà
// dispensée" sans qu'aucun médicament n'ait jamais quitté le stock. Liste
// blanche stricte, même principe que RX_BLOCKED_FIELDS déjà utilisé par
// update() ci-dessous, mais appliquée ici en LISTE POSITIVE (plus sûr par
// défaut qu'une liste négative pour une création).
const RX_CREATE_ALLOWED_FIELDS = [
  'lignes', 'diagnostic', 'date_prescription', 'date_expiration',
  'poids_kg', 'allergies_verifiees', 'chronique', 'maladie_chronique', 'recommandations',
];
const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

exports.create = async (req, res, next) => {
  try {
    if (!req.body.patient || !isObjectId(req.body.patient)) {
      return res.status(400).json({ success: false, message: 'Patient réel obligatoire (référence invalide).' });
    }
    const patientDoc = await Patient.findById(req.body.patient).select('_id');
    if (!patientDoc) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    // PRESC-01 — médecin réel : un ObjectId de User réellement médecin,
    // jamais un texte libre (même principe que consultations.controller.js).
    // Se rabat sur req.user._id (le compte réellement connecté) si absent
    // ou invalide — jamais un nom fabriqué par le client.
    let medecinId = req.user._id;
    if (req.body.medecin && isObjectId(req.body.medecin)) {
      const medecinDoc = await User.findById(req.body.medecin).select('role');
      if (medecinDoc && medecinDoc.role === 'medecin') medecinId = medecinDoc._id;
    }

    // PRESC-01 — "Consultation liée" (Prescriptions.jsx) est saisie comme un
    // numéro humain (Consultation.numero, ex. "CONS-2026-0001"), jamais un
    // ObjectId — recherchée ici par numero+patient, jamais par simple
    // ObjectId de confiance ni par un numéro inventé/orphelin.
    let consultationId;
    if (req.body.consultation) {
      const Consultation = require('../models/Consultation');
      const consultDoc = isObjectId(req.body.consultation)
        ? await Consultation.findById(req.body.consultation).select('patient')
        : await Consultation.findOne({ numero: String(req.body.consultation).trim() }).select('patient');
      if (!consultDoc || String(consultDoc.patient) !== String(patientDoc._id)) {
        return res.status(400).json({ success: false, message: 'Cette consultation ne correspond pas au patient sélectionné (numéro introuvable ou patient différent).' });
      }
      consultationId = consultDoc._id;
    }

    const data = {};
    for (const k of RX_CREATE_ALLOWED_FIELDS) { if (req.body[k] !== undefined) data[k] = req.body[k]; }

    // RX-EMPTY-003 (audit métier du 13 sept. 2026, Phase 4) — ni le schéma
    // (Prescription.lignes, aucune longueur minimale) ni ce contrôleur ne
    // vérifiaient qu'une ordonnance contient au moins un médicament réel ;
    // seul le frontend validait patient/diagnostic (jamais la présence
    // d'une ligne), une protection frontend seule n'étant jamais suffisante
    // (contournable par un appel API direct). Une ordonnance vide n'a pas
    // de sens clinique — exige au moins une ligne avec un medicament_nom
    // non vide.
    const lignesReelles = Array.isArray(data.lignes) ? data.lignes.filter(l => l && String(l.medicament_nom || '').trim()) : [];
    if (lignesReelles.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins un médicament est obligatoire pour créer une ordonnance.' });
    }

    // Détection interactions médicamenteuses — base partagée avec le module
    // IA et la pharmacie (utils/drugInteractions.js), 15 règles au lieu de 2.
    const meds = (data.lignes || []).map(l => (l.medicament_nom || '').toLowerCase());
    const interactions = detectInteractions(meds);

    const prescription = await Prescription.create({
      ...data,
      patient: patientDoc._id,
      consultation: consultationId,
      medecin: medecinId,
      // Jamais accepté du client : une ordonnance ne peut naître que
      // brouillon ou active — 'dispensee'/'publiee'/'annulee' exigent de
      // passer par leur vrai circuit dédié (publier/cancel/dispenser).
      statut: ['brouillon', 'active'].includes(req.body.statut) ? req.body.statut : 'brouillon',
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
    // Correction 2 (relecture du 6 sept. 2026, FE-BUG-004) — le motif saisi
    // dans la modale d'annulation (Prescriptions.jsx) n'était jamais transmis
    // ni persisté ; ce contrôleur ignorait tout req.body.
    const { motif } = req.body || {};
    const avant = await Prescription.findById(req.params.id);
    const prescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      { statut: 'annulee', motif_annulation: motif || undefined },
      { new: true }
    );
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'CANCEL', module: 'prescriptions', entite_id: prescription._id, ip: req.ip, message: motif ? `Ordonnance ${prescription.numero_rx} annulée — motif : ${motif}` : `Ordonnance ${prescription.numero_rx} annulée`, avant, apres: prescription });
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
    // Correction 2 (relecture du 6 sept. 2026, FE-BUG-004) — la nouvelle
    // date d'expiration et la note saisies dans la modale de renouvellement
    // (Prescriptions.jsx) n'étaient jamais transmises ; ce contrôleur
    // ignorait tout req.body et laissait le hook pre('save') imposer +30
    // jours dans tous les cas.
    const { date_expiration, note } = req.body || {};
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
      date_expiration: date_expiration ? new Date(date_expiration) : undefined,
      note_renouvellement: note || undefined,
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

    // Sous-phase 5.1 (relecture du 6 sept. 2026) — onglet Rapports
    // (Prescriptions.jsx) affichait "Total prescriptions ce mois"/
    // "Interactions détectées par IA"/"Renouvellements effectués" et
    // "Ordonnances par service" tous codés en dur, alors que dispensees/
    // annulees (déjà réels ci-dessus) n'étaient même pas récupérés côté
    // frontend, et que kpis.renouvellements/interactions existaient déjà
    // côté état local (jamais alimentés — restés à 0 en permanence, y
    // compris l'alerte sécurité "N ordonnance(s) présentent des
    // interactions médicamenteuses potentielles").
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    const dansSeptJours = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [mois, interactions, renouvellements_effectues, renouvellements_a_bientot, chroniques, specialiteAgg] = await Promise.all([
      Prescription.countDocuments({ date_prescription: { $gte: debutMois } }),
      Prescription.countDocuments({ 'interactions_detectees.0': { $exists: true } }),
      Prescription.countDocuments({ note_renouvellement: { $exists: true, $ne: null } }),
      Prescription.countDocuments({ statut: { $in: ['active', 'publiee'] }, date_expiration: { $ne: null, $lte: dansSeptJours } }),
      // PRESC-01 (correction du 12 sept. 2026) — chronique n'existait pas
      // sur le modèle avant ce correctif : kpis.chroniques (Prescriptions.jsx)
      // était donc câblé sur une valeur jamais renvoyée par l'API, restée
      // bloquée à 0 en permanence — désormais un vrai comptage.
      Prescription.countDocuments({ chronique: true }),
      Prescription.aggregate([
        { $lookup: { from: 'users', localField: 'medecin', foreignField: '_id', as: 'medecinDoc' } },
        { $unwind: { path: '$medecinDoc', preserveNullAndEmptyArrays: false } },
        { $match: { 'medecinDoc.specialite': { $nin: [null, ''] } } },
        { $group: { _id: '$medecinDoc.specialite', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    const totalAvecSpecialite = specialiteAgg.reduce((s, x) => s + x.count, 0);
    const repartition_specialite = specialiteAgg.map(x => ({ specialite: x._id, pct: totalAvecSpecialite ? Math.round((x.count / totalAvecSpecialite) * 100) : 0 }));

    res.json({ success: true, stats: {
      total, actives, publiees, dispensees, expirees, annulees, brouillons, aujourd_hui,
      mois, interactions, renouvellements_effectues, renouvellements_a_bientot, chroniques, repartition_specialite,
    } });
  } catch (err) { next(err); }
};
