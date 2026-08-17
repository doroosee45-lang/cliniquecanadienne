const crypto = require('crypto');
const Staff = require('../models/Staff');
const User = require('../models/User');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// Aplatir Staff + utilisateur populé en un objet frontend-compatible
function normalizeStaff(s) {
  const u = s.utilisateur && typeof s.utilisateur === 'object' ? s.utilisateur : null;
  return {
    ...s,
    prenom:         s.prenom         || u?.prenom      || '',
    nom:            s.nom            || u?.nom         || '',
    email:          s.email          || u?.email       || '',
    telephone:      s.telephone      || u?.telephone   || '',
    sexe:           s.sexe           || 'homme',
    date_naissance: s.date_naissance || null,
    nationalite:    s.nationalite    || '',
    departement:    s.departement    || '',
    adresse:        s.adresse        || '',
    service:        s.service        || '',
    contrat:        s.type_contrat   || '',
    conge_solde:    s.conges_restants != null ? s.conges_restants : 20,
    note_eval:      s.note_eval      ?? 0,
    absences_mois:  s.absences_mois  ?? 0,
  };
}

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut } = req.query;
    const filter = statut ? { statut } : {};
    const total = await Staff.countDocuments(filter);
    const rawStaff = await paginate(
      Staff.find(filter)
        .populate('utilisateur', 'nom prenom role email telephone specialite')
        .sort('statut'),
      page, limit
    );
    const staff = rawStaff.map(s => normalizeStaff(s.toObject ? s.toObject() : s));
    res.json({ success: true, total, staff });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const s = await Staff.findById(req.params.id)
      .populate('utilisateur', '-password')
      .populate('service', 'nom');
    if (!s) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    res.json({ success: true, staff: normalizeStaff(s.toObject()) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      prenom, nom, email, telephone, sexe, date_naissance, nationalite,
      departement, adresse, poste, contrat, type_contrat, service,
      date_embauche, statut, salaire_base,
    } = req.body;

    const staffData = {
      prenom, nom, telephone, sexe, nationalite, departement, adresse,
      poste: poste || 'infirmier',
      type_contrat: contrat || type_contrat,
      service: service || undefined,
      date_embauche: date_embauche || undefined,
      statut: statut || 'actif',
      salaire_base: salaire_base ? Number(salaire_base) : 0,
    };
    if (date_naissance) staffData.date_naissance = date_naissance;

    // Créer/trouver un User si email fourni
    if (email) {
      staffData.email = email.toLowerCase();
      let user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        const roleMap = {
          medecin:'medecin', infirmier:'infirmier', laborantin:'laborantin',
          radiologue:'radiologue', pharmacien:'pharmacien', sage_femme:'sage_femme',
          administratif:'receptionniste', aide_soignant:'infirmier', maintenance:'receptionniste',
        };
        try {
          user = await User.create({
            email: email.toLowerCase(),
            password: `Clinique${crypto.randomBytes(4).toString('hex')}!`,
            nom: nom || '',
            prenom: prenom || '',
            role: roleMap[poste] || 'infirmier',
            telephone: telephone || '',
          });
        } catch (_) { /* email déjà pris ou erreur user — on continue sans lien user */ }
      }
      if (user) staffData.utilisateur = user._id;
    }

    const staff = await Staff.create(staffData);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hr', entite_id: staff._id, ip: req.ip });
    emitActivity({ module: 'hr', action: 'Nouveau personnel', detail: `${prenom || ''} ${nom || ''} — ${poste || ''}`, icon: '👥', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await Staff.findById(staff._id)
      .populate('utilisateur', 'nom prenom role email telephone specialite')
      .populate('service', 'nom')
      .lean();

    res.status(201).json({ success: true, staff: normalizeStaff(populated) });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 — liste blanche : avant ce correctif, req.body était transmis
// quasi tel quel à Staff.findByIdAndUpdate. salaire_base (donnée
// financière), matricule (identifiant auto-généré), et les sous-documents
// planning/conges/competences (gérés par des routes dédiées ailleurs dans
// ce contrôleur) étaient donc modifiables via ce seul endpoint générique,
// sans validation (runValidators absent) ni contrôle particulier.
const STAFF_UPDATE_FIELDS = [
  'prenom', 'nom', 'email', 'telephone', 'sexe', 'date_naissance', 'nationalite',
  'departement', 'adresse', 'poste', 'service', 'date_embauche', 'type_contrat', 'statut',
];

exports.update = async (req, res, next) => {
  try {
    const body = {};
    for (const field of STAFF_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) body[field] = req.body[field];
    }
    if (req.body.contrat !== undefined) body.type_contrat = req.body.contrat;
    const avant = await Staff.findById(req.params.id).lean();
    const staff = await Staff.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
      .populate('utilisateur', 'nom prenom role email telephone specialite')
      .populate('service', 'nom');
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'hr', entite_id: staff._id, ip: req.ip, message: `Fiche personnel modifiée : ${staff.prenom || ''} ${staff.nom || ''}`.trim(), avant, apres: staff });
    res.json({ success: true, staff: normalizeStaff(staff.toObject()) });
  } catch (err) { next(err); }
};

exports.leave = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });

    // Seul un admin RH ou l'employé lui-même (fiche Staff liée à son compte User)
    // peut soumettre une demande de congé sur cette fiche.
    const isAdmin = ['superadmin','adminclinique'].includes(req.user.role);
    const isSelf  = staff.utilisateur && staff.utilisateur.toString() === req.user._id.toString();
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Vous ne pouvez pas soumettre de congé pour un autre employé.' });
    }

    const { type, date_debut, date_fin, motif } = req.body;
    const nb_jours = date_debut && date_fin
      ? Math.round((new Date(date_fin) - new Date(date_debut)) / 86400000) + 1
      : undefined;

    staff.conges.push({ type, date_debut, date_fin, motif, nb_jours, statut: 'en_attente' });
    await staff.save();
    await logAction({ utilisateur: req.user._id, action: 'LEAVE_REQUEST', module: 'hr', entite_id: staff._id, ip: req.ip, message: `Demande de congé (${type || '—'}) — ${staff.prenom || ''} ${staff.nom || ''}`.trim() });
    emitDashboardUpdate();
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};

// GET /hr/leaves — toutes les demandes de congé, tous employés confondus
exports.getLeaves = async (req, res, next) => {
  try {
    const staffList = await Staff.find({ 'conges.0': { $exists: true } }).select('prenom nom conges').lean();
    const leaves = [];
    for (const s of staffList) {
      for (const c of s.conges) {
        leaves.push({ ...c, employe_id: s._id, employe_nom: `${s.prenom || ''} ${s.nom || ''}`.trim() });
      }
    }
    leaves.sort((a, b) => new Date(b.date_debut || 0) - new Date(a.date_debut || 0));
    res.json({ success: true, leaves });
  } catch (err) { next(err); }
};

// PUT /hr/:id/conge/:congeId — approuver/refuser une demande de congé
exports.updateLeaveStatus = async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!['approuve', 'refuse'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide — approuve ou refuse attendu.' });
    }
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    const conge = staff.conges.id(req.params.congeId);
    if (!conge) return res.status(404).json({ success: false, message: 'Demande de congé introuvable.' });
    if (conge.statut !== 'en_attente') {
      return res.status(400).json({ success: false, message: 'Cette demande a déjà été traitée.' });
    }
    const avant = staff.toObject();

    conge.statut = statut;
    conge.approuve_par = req.user._id;
    if (statut === 'approuve' && conge.nb_jours) {
      staff.conges_restants = Math.max(0, (staff.conges_restants || 0) - conge.nb_jours);
    }
    await staff.save();
    await logAction({ utilisateur: req.user._id, action: statut === 'approuve' ? 'LEAVE_APPROVE' : 'LEAVE_REFUSE', module: 'hr', entite_id: staff._id, ip: req.ip, message: `Congé ${statut === 'approuve' ? 'approuvé' : 'refusé'} — ${staff.prenom || ''} ${staff.nom || ''}`.trim(), avant, apres: staff });
    emitDashboardUpdate();
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};

// GET /hr/schedules — planning de tous les employés, filtrable par plage de dates
exports.getSchedules = async (req, res, next) => {
  try {
    const { date_debut, date_fin } = req.query;
    const staffList = await Staff.find({ 'planning.0': { $exists: true } }).select('prenom nom poste planning').lean();
    const schedules = [];
    for (const s of staffList) {
      for (const p of s.planning) {
        if (date_debut && new Date(p.date) < new Date(date_debut)) continue;
        if (date_fin && new Date(p.date) > new Date(date_fin)) continue;
        schedules.push({ ...p, employe_id: s._id, employe_nom: `${s.prenom || ''} ${s.nom || ''}`.trim(), poste: s.poste });
      }
    }
    schedules.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    res.json({ success: true, schedules });
  } catch (err) { next(err); }
};

// POST /hr/:id/planning — assigner un créneau à un employé
exports.addSchedule = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    const { date, heure_debut, heure_fin, type } = req.body;
    staff.planning.push({ date, heure_debut, heure_fin, type });
    await staff.save();
    await logAction({ utilisateur: req.user._id, action: 'SCHEDULE_ADD', module: 'hr', entite_id: staff._id, ip: req.ip, message: `Créneau planning (${type || '—'}) assigné — ${staff.prenom || ''} ${staff.nom || ''}`.trim() });
    emitDashboardUpdate();
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};
