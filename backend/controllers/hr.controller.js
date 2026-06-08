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
          radiologue:'radiologue', pharmacien:'pharmacien',
          administratif:'receptionniste', aide_soignant:'infirmier', maintenance:'receptionniste',
        };
        try {
          user = await User.create({
            email: email.toLowerCase(),
            password: `Clinique${Math.random().toString(36).slice(-6)}!`,
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

exports.update = async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.contrat) { body.type_contrat = body.contrat; delete body.contrat; }
    const staff = await Staff.findByIdAndUpdate(req.params.id, body, { new: true })
      .populate('utilisateur', 'nom prenom role email telephone specialite')
      .populate('service', 'nom');
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    res.json({ success: true, staff: normalizeStaff(staff.toObject()) });
  } catch (err) { next(err); }
};

exports.leave = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    staff.conges.push({ ...req.body, statut: 'demande' });
    await staff.save();
    await logAction({ utilisateur: req.user._id, action: 'LEAVE_REQUEST', module: 'hr', entite_id: staff._id, ip: req.ip });
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};
