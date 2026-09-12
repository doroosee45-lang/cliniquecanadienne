const RecurringProtocol = require('../models/RecurringProtocol');
const Appointment        = require('../models/Appointment');
const { logAction, paginate, checkAppointmentConflict, isAppointmentRaceWinner } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { logger } = require('../utils/logger');

// AUDIT-FAIBLE-G2 — getAll() n'avait aucune pagination (contrairement au
// reste du projet, patients/consultations/prescriptions/audit via
// paginate()) : un find() non borné, correct aujourd'hui (1 protocole actif
// en tout dans la base réelle) mais pas garanti de le rester. Limite haute
// délibérée (200, pas 20) : le frontend (Appointments.jsx::loadProtocols)
// ne demande jamais de page suivante et n'a aucune UI de pagination pour
// cette liste — un plafond à 20 tronquerait silencieusement la liste d'un
// médecin dès son 21e protocole actif. 200 rend la troncature non
// pratique aux volumes réalistes de ce module (protocoles récurrents par
// médecin), sans avoir à toucher au frontend (hors périmètre de ce point).
const RECURRING_LIST_LIMIT = 200;

// ── GET ALL ──────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = RECURRING_LIST_LIMIT } = req.query || {};
    const filter = { actif: true };
    // Médecin ne voit que ses propres protocoles, admin voit tout
    if (!['superadmin','adminclinique'].includes(req.user.role)) {
      filter.medecin = req.user._id;
    }
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, protocols] = await Promise.all([
      RecurringProtocol.countDocuments(filter),
      paginate(
        RecurringProtocol.find(filter)
          .populate('medecin', 'nom prenom specialite')
          .sort('prochaine_date'),
        page, limit
      ),
    ]);
    // Avertissement, pas une erreur — signale si le plafond devient un jour
    // réellement contraignant, plutôt qu'une troncature silencieuse.
    if (protocols.length >= Number(limit)) {
      logger.warn(`recurring.controller.getAll : limite de pagination (${limit}) atteinte — total réel ${total}, résultat potentiellement tronqué`, { filter });
    }
    res.json({ success: true, total, protocols });
  } catch (err) { next(err); }
};

// ── CREATE ───────────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const protocol = await RecurringProtocol.create({
      ...req.body,
      created_by: req.user._id,
    });
    await protocol.populate('medecin', 'nom prenom specialite');
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'recurring', entite_id: protocol._id, ip: req.ip, message: `Protocole récurrent: ${protocol.titre}` });
    emitActivity({ module: 'appointments', action: 'Nouveau protocole récurrent', detail: protocol.titre, icon: '🔄', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    res.status(201).json({ success: true, protocol });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — created_by identifie l'auteur du protocole ;
// nb_patients est un compteur dérivé, pas un champ de formulaire.
const RECURRING_BLOCKED_FIELDS = ['created_by', 'nb_patients'];

// ── UPDATE ───────────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const avant = await RecurringProtocol.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!RECURRING_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const protocol = await RecurringProtocol.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('medecin', 'nom prenom specialite');
    if (!protocol) return res.status(404).json({ success: false, message: 'Protocole introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'recurring', entite_id: protocol._id, ip: req.ip, message: `Protocole récurrent modifié : ${protocol.titre}`, avant, apres: protocol });
    res.json({ success: true, protocol });
  } catch (err) { next(err); }
};

// ── DELETE (soft) ────────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const avant = await RecurringProtocol.findById(req.params.id).lean();
    const protocol = await RecurringProtocol.findByIdAndUpdate(req.params.id, { actif: false });
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'recurring', entite_id: req.params.id, ip: req.ip, message: `Protocole récurrent archivé${protocol ? ` : ${protocol.titre}` : ''}`, avant });
    res.json({ success: true, message: 'Protocole archivé.' });
  } catch (err) { next(err); }
};

// ── PLANIFIER (crée le prochain RDV + met à jour prochaine_date) ─────────────
exports.planifier = async (req, res, next) => {
  try {
    const protocol = await RecurringProtocol.findById(req.params.id);
    if (!protocol) return res.status(404).json({ success: false, message: 'Protocole introuvable.' });

    const { patient, date_heure, notes } = req.body;
    if (!patient || !date_heure)
      return res.status(400).json({ success: false, message: 'patient et date_heure sont requis.' });

    // AUDIT-P7-6 — planifier() créait le rendez-vous sans aucune
    // vérification de conflit, contrairement à
    // appointments.controller.js::create : un protocole récurrent pouvait
    // planifier une occurrence en plein sur un créneau déjà pris du même
    // médecin.
    const conflict = await checkAppointmentConflict({ medecin: protocol.medecin, date_heure, duree_minutes: 30 });
    if (conflict) return res.status(400).json({ success: false, message: 'Conflit: le médecin a déjà un rendez-vous à cette heure.' });

    // Crée le rendez-vous
    // AUDIT-2.1 — même filet de sécurité que appointments.controller.js :
    // l'index unique partiel (medecin+date_heure) ferme la course sur le
    // créneau exact, remontée en 409 plutôt qu'en erreur serveur brute.
    let appt;
    try {
      appt = await Appointment.create({
        patient,
        medecin:       protocol.medecin,
        date_heure:    new Date(date_heure),
        duree_minutes: 30,
        motif:         protocol.titre,
        type:          'suivi',
        statut:        'planifie',
        notes:         notes || protocol.notes,
        created_by:    req.user._id,
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Conflit: ce créneau vient d\'être réservé par une autre requête. Veuillez réessayer.' });
      throw err;
    }

    // AUDIT-M-B4 — même trou que appointments.controller.js::create :
    // chevauchement PARTIEL possible entre deux planifications concurrentes,
    // non couvert par l'index unique (créneau exact seulement). Élimination
    // AVANT de faire avancer prochaine_date du protocole ou tout effet de
    // bord — si ce RDV est annulé après coup, aucune occurrence n'a
    // réellement été planifiée, prochaine_date ne doit pas bouger.
    if (!(await isAppointmentRaceWinner(appt._id))) {
      await Appointment.findByIdAndDelete(appt._id);
      await logAction({ utilisateur: req.user._id, action: 'PLANIFIER', module: 'recurring', entite_id: protocol._id, ip: req.ip, statut: 'echec', message: `Planification annulée après coup — chevauchement partiel détecté en concurrence (médecin ${protocol.medecin})` });
      return res.status(409).json({ success: false, message: 'Conflit: ce créneau chevauche un rendez-vous qui vient d\'être réservé par une autre requête. Veuillez réessayer.' });
    }

    // Calcule la prochaine occurrence
    const DELTAS = {
      quotidien:    1, hebdomadaire: 7, bimensuel: 14,
      mensuel:      30, trimestriel: 90, annuel:    365,
    };
    const delta = protocol.frequence_jours || DELTAS[protocol.frequence] || 30;
    const newDate = new Date(date_heure);
    newDate.setDate(newDate.getDate() + delta);
    const avant = protocol.toObject();
    const updatedProtocol = await RecurringProtocol.findByIdAndUpdate(req.params.id, { prochaine_date: newDate }, { new: true });

    await logAction({ utilisateur: req.user._id, action: 'PLANIFIER', module: 'recurring', entite_id: protocol._id, ip: req.ip, message: `RDV planifié pour ${protocol.titre}`, avant, apres: updatedProtocol });
    emitActivity({ module: 'appointments', action: 'RDV récurrent planifié', detail: protocol.titre, icon: '📅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.status(201).json({ success: true, appointment: appt, next_date: newDate });
  } catch (err) { next(err); }
};
