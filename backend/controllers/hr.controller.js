const crypto = require('crypto');
const Staff = require('../models/Staff');
const User = require('../models/User');
const Candidature = require('../models/Candidature');
const Evaluation = require('../models/Evaluation');
const Formation = require('../models/Formation');
const Sanction = require('../models/Sanction');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const mail = require('../utils/mail');
const sms = require('../utils/sms');
const { logger } = require('../utils/logger');
const ai = require('../utils/openai');

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
    adresse:        s.adresse        || '',
    service:        s.service        || null,
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
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, rawStaff] = await Promise.all([
      Staff.countDocuments(filter),
      paginate(
        Staff.find(filter)
          .populate('utilisateur', 'nom prenom role email telephone specialite')
          .populate('service', 'nom')
          .sort('statut'),
        page, limit
      ),
    ]);
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
      adresse, poste, contrat, type_contrat, service,
      date_embauche, statut, salaire_base,
    } = req.body;

    const staffData = {
      prenom, nom, telephone, sexe, nationalite, adresse,
      poste: poste || 'infirmier',
      type_contrat: contrat || type_contrat,
      service: service || undefined,
      date_embauche: date_embauche || undefined,
      statut: statut || 'actif',
      salaire_base: salaire_base ? Number(salaire_base) : 0,
    };
    if (date_naissance) staffData.date_naissance = date_naissance;

    // Créer/trouver un User si email fourni
    // AUDIT-P2-3 (ticket 0003, piste 1) — le mot de passe généré ici n'était
    // renvoyé nulle part (ni réponse, ni log, ni email) : aucune personne ne
    // pouvait le connaître, rendant le compte inutilisable dès sa création
    // tant qu'un admin ne passait pas explicitement par updateUser pour en
    // fixer un connu. must_change_password force en plus son changement dès
    // la première connexion (cohérent avec le flux patient existant).
    let tempPassword = null;
    if (email) {
      staffData.email = email.toLowerCase();
      let user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        const roleMap = {
          medecin:'medecin', infirmier:'infirmier', laborantin:'laborantin',
          radiologue:'radiologue', pharmacien:'pharmacien', sage_femme:'sage_femme',
          administratif:'receptionniste', aide_soignant:'infirmier', maintenance:'receptionniste',
        };
        tempPassword = `Clinique${crypto.randomBytes(4).toString('hex')}!`;
        try {
          user = await User.create({
            email: email.toLowerCase(),
            password: tempPassword,
            nom: nom || '',
            prenom: prenom || '',
            role: roleMap[poste] || 'infirmier',
            telephone: telephone || '',
            must_change_password: true,
          });
        } catch (_) { tempPassword = null; /* email déjà pris ou erreur user — on continue sans lien user */ }
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

    res.status(201).json({ success: true, staff: normalizeStaff(populated), temp_password: tempPassword || undefined });
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
  'adresse', 'poste', 'service', 'date_embauche', 'type_contrat', 'statut',
];

exports.update = async (req, res, next) => {
  try {
    const body = {};
    for (const field of STAFF_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) body[field] = req.body[field];
    }
    if (req.body.contrat !== undefined) body.type_contrat = req.body.contrat;
    // service est désormais une vraie référence ObjectId — une chaîne vide
    // (aucun service sélectionné) doit effacer la référence, pas être castée.
    if (body.service === '') body.service = null;
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
// AUDIT-RH-PLANNING-NOTIF — créé systématiquement en statut 'brouillon' :
// tant statut que notifie_publication/rappel_2h_envoye sont ignorés du body
// (jamais acceptés en entrée) pour qu'un créneau ne puisse être marqué
// "déjà notifié" qu'en passant réellement par publishSchedules ci-dessous.
// AUDIT-20-8 (19 sept. 2026) — staff.planning.push(...) + staff.save() —
// même risque de VersionError sous écriture concurrente que le reste de ce
// chantier (AUDIT-20-6/7) : deux créneaux ajoutés simultanément au planning
// du même employé pouvaient faire échouer l'un des deux .save(). $push
// atomique. Contrat de réponse inchangé ({ success, staff }, document
// complet).
exports.addSchedule = async (req, res, next) => {
  try {
    const { date, heure_debut, heure_fin, type } = req.body;
    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { $push: { planning: { date, heure_debut, heure_fin, type, statut: 'brouillon' } } },
      { new: true, runValidators: true }
    );
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'SCHEDULE_ADD', module: 'hr', entite_id: staff._id, ip: req.ip, message: `Créneau planning (${type || '—'}) assigné — ${staff.prenom || ''} ${staff.nom || ''}`.trim() });
    emitDashboardUpdate();
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};

const PLANNING_TYPE_LABELS = { travail: 'Travail', garde: 'Garde', astreinte: 'Astreinte', repos: 'Repos', conge: 'Congé' };

// PUT /hr/:id/planning/publier — publie tous les créneaux brouillon d'un
// employé. AUDIT-RH-PLANNING-NOTIF — décision explicite : une notification
// (email + SMS) par créneau publié, jamais un message consolidé — l'idempotence
// (notifie_publication) est donc posée par créneau, pas au niveau de
// l'employé, pour qu'un second appel (ex. nouveaux créneaux ajoutés entre
// temps) ne renotifie jamais les créneaux déjà publiés.
exports.publishSchedules = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id).populate('utilisateur', 'email telephone');
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });

    // Même repli que normalizeStaff : le champ direct sur Staff prime,
    // l'email/téléphone du compte utilisateur lié sert de secours.
    const email = staff.email || staff.utilisateur?.email || '';
    const telephone = staff.telephone || staff.utilisateur?.telephone || '';

    const brouillons = staff.planning.filter(p => p.statut !== 'publie');
    if (brouillons.length === 0) {
      return res.json({ success: true, publies: 0, message: 'Aucun créneau brouillon à publier.' });
    }

    let emailOk = 0, emailFail = 0, smsOk = 0, smsSimule = 0, smsFail = 0;
    for (const slot of brouillons) {
      const dateStr = slot.date
        ? new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '—';
      const typeLabel = PLANNING_TYPE_LABELS[slot.type] || slot.type || '—';

      if (email) {
        try {
          await mail.sendPlanningPublishedEmail({
            email, prenom: staff.prenom || '', nom: staff.nom || '', poste: staff.poste,
            date: dateStr, heure_debut: slot.heure_debut, heure_fin: slot.heure_fin, type: typeLabel,
          });
          emailOk++;
        } catch (err) {
          emailFail++;
          logger.error('[planning] Échec email publication créneau', { staffId: staff._id.toString(), error: err.message });
        }
      }

      if (telephone) {
        const body = `Bonjour ${staff.prenom || ''}, votre créneau du ${dateStr} (${slot.heure_debut || '—'}-${slot.heure_fin || '—'}, ${typeLabel}) a été publié. Clinique Canadienne.`;
        try {
          const result = await sms.sendSms({ to: telephone, body });
          if (result?.simulated) smsSimule++; else smsOk++;
        } catch (err) {
          smsFail++;
          logger.error('[planning] Échec SMS publication créneau', { staffId: staff._id.toString(), error: err.message });
        }
      }

      slot.statut = 'publie';
      slot.notifie_publication = true;
    }

    await staff.save();

    await logAction({
      utilisateur: req.user._id, action: 'PLANNING_PUBLISH', module: 'hr', entite_id: staff._id, ip: req.ip,
      message: `${brouillons.length} créneau(x) publié(s) — ${staff.prenom || ''} ${staff.nom || ''} — email: ${emailOk} ok/${emailFail} échec (${email ? 'destinataire connu' : 'aucun email'}), SMS: ${smsOk} ok/${smsSimule} simulé/${smsFail} échec (${telephone ? 'destinataire connu' : 'aucun téléphone'})`.trim(),
    });
    emitDashboardUpdate();

    res.json({ success: true, staff, publies: brouillons.length });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Sous-phase 5.5.a — Recrutement (Candidature)
// Remplace le CRUD purement local de HR.jsx (onglet "Recrutement" et sa
// bannière "en développement" posée en 5.7) par une vraie persistance.
// ─────────────────────────────────────────────────────────────

// GET /hr/candidatures
exports.getCandidatures = async (req, res, next) => {
  try {
    const candidatures = await Candidature.find().sort('-date_depot').lean();
    res.json({ success: true, candidatures });
  } catch (err) { next(err); }
};

// POST /hr/candidatures
exports.createCandidature = async (req, res, next) => {
  try {
    const { nom, poste, experience, diplome, email, telephone } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ success: false, message: 'Le nom du candidat est obligatoire.' });
    }
    const candidature = await Candidature.create({
      nom: nom.trim(), poste, experience, diplome,
      email: email ? email.toLowerCase() : '', telephone,
      cree_par: req.user._id,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hr', entite_id: candidature._id, ip: req.ip, message: `Nouvelle candidature — ${nom}` });
    emitActivity({ module: 'hr', action: 'Nouvelle candidature', detail: nom, icon: '👤', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, candidature });
  } catch (err) { next(err); }
};

// PUT /hr/candidatures/:id — changer le statut ("Convoquer" → entretien,
// "Sélectionner" → selectionne, ou tout autre statut valide du workflow).
const CANDIDATURE_STATUTS = ['recu', 'en_analyse', 'entretien', 'selectionne', 'refuse'];
exports.updateCandidatureStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!CANDIDATURE_STATUTS.includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    const avant = await Candidature.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Candidature introuvable.' });
    const candidature = await Candidature.findByIdAndUpdate(req.params.id, { statut }, { new: true, runValidators: true }).lean();
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'hr', entite_id: candidature._id, ip: req.ip, message: `Statut candidature (${candidature.nom}) : ${avant.statut} → ${statut}`, avant, apres: candidature });
    emitDashboardUpdate();
    res.json({ success: true, candidature });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Sous-phase 5.5.a — Évaluations
// ─────────────────────────────────────────────────────────────

// Aplatit une Evaluation populée en objet frontend-compatible (mêmes clés
// que l'ancien state local : employe_id, employe_nom, evaluateur en texte).
function normalizeEvaluation(e) {
  const emp = e.employe && typeof e.employe === 'object' ? e.employe : null;
  const user = e.evaluateur && typeof e.evaluateur === 'object' ? e.evaluateur : null;
  return {
    ...e,
    employe_id: emp ? emp._id : e.employe,
    employe_nom: emp ? `${emp.prenom || ''} ${emp.nom || ''}`.trim() : '—',
    evaluateur: user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : '—',
  };
}

// GET /hr/evaluations
exports.getEvaluations = async (req, res, next) => {
  try {
    const rows = await Evaluation.find()
      .populate('employe', 'prenom nom poste')
      .populate('evaluateur', 'prenom nom')
      .sort('-createdAt')
      .lean();
    res.json({ success: true, evaluations: rows.map(normalizeEvaluation) });
  } catch (err) { next(err); }
};

// POST /hr/evaluations
exports.createEvaluation = async (req, res, next) => {
  try {
    const { employe_id, periode, ponctualite, qualite, productivite, discipline, relation_patient, commentaire } = req.body;
    const employe = await Staff.findById(employe_id).lean();
    if (!employe) return res.status(404).json({ success: false, message: 'Employé introuvable.' });

    const evaluation = await Evaluation.create({
      employe: employe_id, periode, ponctualite, qualite, productivite, discipline, relation_patient,
      commentaire, evaluateur: req.user._id,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hr', entite_id: evaluation._id, ip: req.ip, message: `Évaluation (${periode}) — ${employe.prenom || ''} ${employe.nom || ''}`.trim() });
    emitActivity({ module: 'hr', action: 'Nouvelle évaluation', detail: `${employe.prenom || ''} ${employe.nom || ''} — ${periode}`, icon: '⭐', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await Evaluation.findById(evaluation._id)
      .populate('employe', 'prenom nom poste')
      .populate('evaluateur', 'prenom nom')
      .lean();
    res.status(201).json({ success: true, evaluation: normalizeEvaluation(populated) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// Sous-phase 5.5.a — Formations
// ─────────────────────────────────────────────────────────────

// Aplatit une Formation populée : participants → tableau {_id, nom}, statut
// dérivé de la date (jamais stocké — ne peut donc jamais devenir obsolète
// par rapport à la date réelle de la formation).
function normalizeFormation(f) {
  const participants = (f.participants || []).map(p => (
    typeof p === 'object' && p !== null
      ? { _id: p._id, nom: `${p.prenom || ''} ${p.nom || ''}`.trim() }
      : { _id: p, nom: '—' }
  ));
  return {
    ...f,
    participants,
    statut: f.date && new Date(f.date) < new Date() ? 'termine' : 'planifie',
  };
}

// GET /hr/formations
exports.getFormations = async (req, res, next) => {
  try {
    const rows = await Formation.find()
      .populate('participants', 'prenom nom')
      .sort('-date')
      .lean();
    res.json({ success: true, formations: rows.map(normalizeFormation) });
  } catch (err) { next(err); }
};

// POST /hr/formations
exports.createFormation = async (req, res, next) => {
  try {
    const { titre, type, date, duree_h, participants, certificat } = req.body;
    if (!titre || !titre.trim()) {
      return res.status(400).json({ success: false, message: 'Le titre de la formation est obligatoire.' });
    }
    if (!date) {
      return res.status(400).json({ success: false, message: 'La date de la formation est obligatoire.' });
    }
    const participantIds = Array.isArray(participants) ? participants : [];
    if (participantIds.length) {
      const count = await Staff.countDocuments({ _id: { $in: participantIds } });
      if (count !== participantIds.length) {
        return res.status(400).json({ success: false, message: 'Un ou plusieurs participants sélectionnés sont introuvables.' });
      }
    }

    const formation = await Formation.create({
      titre: titre.trim(), type, date, duree_h: duree_h ? Number(duree_h) : 0,
      participants: participantIds, certificat: !!certificat, cree_par: req.user._id,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hr', entite_id: formation._id, ip: req.ip, message: `Formation planifiée — ${titre}` });
    emitActivity({ module: 'hr', action: 'Formation planifiée', detail: titre, icon: '🎓', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await Formation.findById(formation._id).populate('participants', 'prenom nom').lean();
    res.status(201).json({ success: true, formation: normalizeFormation(populated) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Sous-phase 5.5.a — Discipline / Sanctions
// ─────────────────────────────────────────────────────────────

function normalizeSanction(s) {
  const emp = s.employe && typeof s.employe === 'object' ? s.employe : null;
  return {
    ...s,
    employe_id: emp ? emp._id : s.employe,
    employe_nom: emp ? `${emp.prenom || ''} ${emp.nom || ''}`.trim() : '—',
  };
}

// GET /hr/sanctions
exports.getSanctions = async (req, res, next) => {
  try {
    const rows = await Sanction.find()
      .populate('employe', 'prenom nom poste')
      .sort('-date')
      .lean();
    res.json({ success: true, sanctions: rows.map(normalizeSanction) });
  } catch (err) { next(err); }
};

// POST /hr/sanctions
exports.createSanction = async (req, res, next) => {
  try {
    const { employe_id, type, motif } = req.body;
    if (!motif || !motif.trim()) {
      return res.status(400).json({ success: false, message: 'Le motif de la sanction est obligatoire.' });
    }
    const employe = await Staff.findById(employe_id).lean();
    if (!employe) return res.status(404).json({ success: false, message: 'Employé introuvable.' });

    const sanction = await Sanction.create({ employe: employe_id, type, motif: motif.trim(), decide_par: req.user._id });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hr', entite_id: sanction._id, ip: req.ip, message: `Sanction (${type}) — ${employe.prenom || ''} ${employe.nom || ''}`.trim() });
    emitActivity({ module: 'hr', action: 'Mesure disciplinaire', detail: `${employe.prenom || ''} ${employe.nom || ''} — ${type}`, icon: '⚠️', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await Sanction.findById(sanction._id).populate('employe', 'prenom nom poste').lean();
    res.status(201).json({ success: true, sanction: normalizeSanction(populated) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ── PLANNING GÉNÉRÉ PAR IA ──────────────────────────────────────────────
// POST /hr/planning/generer-ia — propose une répartition Matin(07-15h)/
// Soir(15-23h)/Nuit(23-07h, type 'garde') sur une période, pour un service
// donné, en tenant compte des congés déjà approuvés et des créneaux déjà
// posés. Toujours créé en statut 'brouillon' — jamais publié automatiquement.
// Si OPENAI_API_KEY n'est pas configurée : simulated:true, aucun créneau créé.
const CRENEAUX_HORAIRES = {
  matin: { heure_debut: '07:00', heure_fin: '15:00', type: 'travail' },
  soir:  { heure_debut: '15:00', heure_fin: '23:00', type: 'travail' },
  nuit:  { heure_debut: '23:00', heure_fin: '07:00', type: 'garde' },
};

function dateEstEnConge(staff, dateStr) {
  const d = new Date(dateStr);
  return (staff.conges || []).some(c =>
    c.statut === 'approuve' &&
    new Date(c.date_debut) <= d && d <= new Date(c.date_fin)
  );
}

function dejaPlanifie(staff, dateStr) {
  const d = new Date(dateStr).toDateString();
  return (staff.planning || []).some(p => new Date(p.date).toDateString() === d);
}

exports.genererPlanningIA = async (req, res, next) => {
  try {
    const { service_id, date_debut, date_fin } = req.body;
    if (!service_id || !date_debut || !date_fin) {
      return res.status(400).json({ success: false, message: 'service_id, date_debut et date_fin sont requis.' });
    }
    const debut = new Date(date_debut);
    const fin = new Date(date_fin);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin < debut) {
      return res.status(400).json({ success: false, message: 'Plage de dates invalide.' });
    }
    const nbJours = Math.round((fin - debut) / (24 * 3600 * 1000)) + 1;
    if (nbJours > 14) {
      return res.status(400).json({ success: false, message: 'La génération IA est limitée à 14 jours maximum par appel.' });
    }

    const staffList = await Staff.find({ service: service_id, statut: 'actif' });
    if (staffList.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun employé actif dans ce service.' });
    }

    const dates = Array.from({ length: nbJours }, (_, i) => {
      const d = new Date(debut);
      d.setDate(debut.getDate() + i);
      return d.toISOString().substring(0, 10);
    });

    const employesContext = staffList.map(s => ({
      employe_id: s._id.toString(),
      nom: ((s.prenom || '') + ' ' + (s.nom || '')).trim(),
      poste: s.poste,
      dates_indisponibles: dates.filter(d => dateEstEnConge(s, d) || dejaPlanifie(s, d)),
    }));

    if (!ai.isConfigured()) {
      logger.warn('[HR-PLANNING-IA] OPENAI_API_KEY non configurée — génération simulée, aucun créneau créé');
      return res.json({
        success: true, simulated: true,
        message: "Génération IA simulée — clé OpenAI non configurée côté serveur. Aucun créneau n'a été créé.",
      });
    }

    const systemPrompt = "Tu es un planificateur RH pour une clinique. Tu dois répartir le personnel d'un service sur des créneaux Matin/Soir/Nuit, jour par jour, en respectant STRICTEMENT ces règles :\n" +
      "1. Un employé \"dates_indisponibles\" ne peut RIEN se voir assigner ce jour-là.\n" +
      "2. Un employé qui travaille \"nuit\" un jour J ne peut pas être assigné \"matin\" le jour J+1.\n" +
      "3. Répartis la charge le plus équitablement possible entre les employés du service.\n" +
      "4. Vise au moins 1 employé par créneau (matin/soir/nuit) chaque jour si l'effectif le permet.\n" +
      "5. Ne planifie QUE des jours de travail (n'invente pas d'entrées \"repos\").\n\n" +
      "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises markdown, de cette forme exacte :\n" +
      "[{\"employe_id\":\"...\",\"date\":\"YYYY-MM-DD\",\"creneau\":\"matin|soir|nuit\"}, ...]";

    const userPrompt = JSON.stringify({ periode: { debut: dates[0], fin: dates[dates.length - 1] }, employes: employesContext });

    const result = await ai.generateReport({ systemPrompt, userPrompt });

    let propositions;
    try {
      let cleaned = result.content.trim();
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      propositions = JSON.parse(cleaned);
      if (!Array.isArray(propositions)) throw new Error('not an array');
    } catch (parseErr) {
      logger.error('[HR-PLANNING-IA] Réponse IA non parsable', { error: parseErr.message });
      return res.status(502).json({ success: false, message: "La réponse de l'IA n'a pas pu être interprétée. Réessayez." });
    }

    const staffMap = new Map(staffList.map(s => [s._id.toString(), s]));
    let creees = 0;
    const rejetees = [];

    for (const prop of propositions) {
      const staff = staffMap.get(String(prop.employe_id));
      const horaire = CRENEAUX_HORAIRES[prop.creneau];
      if (!staff || !horaire || !dates.includes(prop.date)) {
        rejetees.push(Object.assign({}, prop, { raison: 'Employé, créneau ou date invalide.' }));
        continue;
      }
      if (dateEstEnConge(staff, prop.date)) {
        rejetees.push(Object.assign({}, prop, { raison: 'Employé en congé approuvé à cette date.' }));
        continue;
      }
      if (dejaPlanifie(staff, prop.date)) {
        rejetees.push(Object.assign({}, prop, { raison: 'Un créneau existe déjà pour cet employé à cette date.' }));
        continue;
      }
      const veille = new Date(prop.date);
      veille.setDate(veille.getDate() - 1);
      const veilleStr = veille.toISOString().substring(0, 10);
      const aTravailleNuitVeille = (staff.planning || []).some(p =>
        new Date(p.date).toISOString().substring(0, 10) === veilleStr && p.heure_debut === '23:00'
      );
      if (prop.creneau === 'matin' && aTravailleNuitVeille) {
        rejetees.push(Object.assign({}, prop, { raison: 'Repos obligatoire après une garde de nuit.' }));
        continue;
      }

      staff.planning.push(Object.assign({ date: prop.date }, horaire, { statut: 'brouillon' }));
      creees++;
    }

    await Promise.all(staffList.map(s => s.save()));

    await logAction({
      utilisateur: req.user._id, action: 'SCHEDULE_ADD', module: 'hr', ip: req.ip,
      message: 'Planning généré par IA pour le service (' + date_debut + ' -> ' + date_fin + ') : ' + creees + ' créneau(x) créé(s) en brouillon, ' + rejetees.length + ' rejeté(s).',
    });
    emitDashboardUpdate();

    res.json({
      success: true, simulated: false,
      creneaux_crees: creees,
      creneaux_rejetes: rejetees,
      message: creees + ' créneau(x) généré(s) en brouillon.' + (rejetees.length ? (' ' + rejetees.length + ' proposition(s) rejetée(s) (voir détail).') : ''),
    });
  } catch (err) { next(err); }
};
