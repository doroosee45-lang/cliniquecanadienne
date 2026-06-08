const Hospitalization = require('../models/Hospitalization');
const Room   = require('../models/Room');
const User   = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate, emitTo } = require('../utils/socket');

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().populate('service', 'nom').populate('lits.patient_actuel', 'nom prenom');
    res.json({ success: true, rooms });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const [total, en_cours, sortis, transferes, decedes] = await Promise.all([
      Hospitalization.countDocuments(),
      Hospitalization.countDocuments({ statut: 'en_cours' }),
      Hospitalization.countDocuments({ statut: 'sorti' }),
      Hospitalization.countDocuments({ statut: 'transfere' }),
      Hospitalization.countDocuments({ statut: 'decede' }),
    ]);
    // Taux d'occupation (lits occupés / total lits)
    const rooms = await Room.find();
    const totalLits    = rooms.reduce((s, r) => s + (r.lits?.length || 0), 0);
    const litsOccupes  = rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'occupe').length || 0), 0);
    const litsLibres   = totalLits - litsOccupes;
    const taux_occ     = totalLits > 0 ? Math.round(litsOccupes / totalLits * 100) : 0;

    // Aujourd'hui
    const debut = new Date(); debut.setHours(0,0,0,0);
    const fin   = new Date(); fin.setHours(23,59,59,999);
    const aujourd_hui = await Hospitalization.countDocuments({ date_entree: { $gte: debut, $lte: fin } });

    res.json({ success: true, stats: { total, en_cours, sortis, transferes, decedes, taux_occ, totalLits, litsOccupes, litsLibres, aujourd_hui } });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, statut, patient, q } = req.query;
    const filter = {};
    if (statut)  filter.statut  = statut;
    if (patient) filter.patient = patient;
    const total = await Hospitalization.countDocuments(filter);
    const hospitalizations = await paginate(
      Hospitalization.find(filter)
        .populate('patient', 'nom prenom numero_dossier date_naissance telephone email')
        .populate('medecin_responsable', 'nom prenom specialite')
        .populate('chambre', 'numero type batiment')
        .sort('-date_entree'),
      page, limit
    );
    // retourner les deux clés pour compatibilité frontend (hospitalisations/hospitalizations)
    res.json({ success: true, total, hospitalizations, hospitalisations: hospitalizations });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // ── Normalisation des champs du formulaire ──────────────────
    const isObjectId = v => /^[a-f\d]{24}$/i.test(v);

    const patient          = req.body.patient || req.body.patient_id;
    const motif_entree     = req.body.motif_entree || req.body.motif;
    const lit_numero       = req.body.lit_numero   || req.body.lit;
    const chambreRaw       = req.body.chambre;

    if (!patient)      return res.status(400).json({ success: false, message: 'Patient obligatoire.' });
    if (!motif_entree) return res.status(400).json({ success: false, message: 'Motif d\'hospitalisation obligatoire.' });

    // ── Médecin responsable ─────────────────────────────────────
    let medecin_responsable = null;
    let medecin_nom         = req.body.medecin || req.body.medecin_nom || '';
    if (req.body.medecin_responsable && isObjectId(req.body.medecin_responsable)) {
      medecin_responsable = req.body.medecin_responsable;
    } else {
      // Fallback : médecin connecté
      medecin_responsable = req.user._id;
      if (!medecin_nom) medecin_nom = `${req.user.prenom || ''} ${req.user.nom || ''}`.trim();
    }

    // ── Service ────────────────────────────────────────────────
    let service     = null;
    let service_nom = req.body.service_nom || '';
    if (req.body.service && isObjectId(req.body.service)) {
      service = req.body.service;
    } else {
      service_nom = req.body.service || service_nom;
    }

    // ── Chambre et lit ─────────────────────────────────────────
    let chambre     = null;
    let chambre_num = chambreRaw || '';
    let room        = null;

    if (chambreRaw && isObjectId(chambreRaw)) {
      room = await Room.findById(chambreRaw);
      if (!room) return res.status(404).json({ success: false, message: 'Chambre introuvable.' });
      const bed = room.lits.find(l => l.numero === lit_numero);
      if (bed && bed.statut !== 'libre') {
        return res.status(400).json({ success: false, message: `Le lit ${lit_numero} n'est pas disponible (${bed.statut}).` });
      }
      if (bed) { bed.statut = 'occupe'; bed.patient_actuel = patient; await room.save(); }
      chambre     = chambreRaw;
      chambre_num = room.numero || chambreRaw;
    }

    const payload = {
      patient,
      motif_entree,
      lit_numero,
      chambre,
      chambre_num,
      medecin_responsable,
      medecin_nom,
      service,
      service_nom,
      diagnostic_entree: req.body.diagnostic_entree,
      date_entree:       req.body.date_admission || req.body.date_entree,
      provenance:        req.body.provenance,
      type_chambre:      req.body.type_chambre,
      batiment:          req.body.batiment,
      contact_urgence:   req.body.contact_urgence,
      tel_urgence:       req.body.tel_urgence,
      created_by:        req.user._id,
    };

    const hosp = await Hospitalization.create(payload);

    // Peupler pour la réponse
    await hosp.populate('patient', 'nom prenom numero_dossier date_naissance telephone email');
    await hosp.populate('medecin_responsable', 'nom prenom specialite');
    await hosp.populate('chambre', 'numero type batiment');

    // ── Notification au patient ───────────────────────────────
    const pat = await require('../models/Patient').findById(patient).select('nom prenom email');
    if (pat?.email) {
      const userPatient = await User.findOne({ email: pat.email, role: 'patient' });
      if (userPatient) {
        await createNotification({
          destinataire: userPatient._id,
          type:    'info',
          titre:   'Admission hospitalière confirmée',
          message: `Vous avez été admis(e) à la Clinique Canadienne de Souanké. Chambre : ${chambre_num || chambre}, Lit : ${lit_numero}. Motif : ${motif_entree}`,
          lien:    '/portal',
          priorite:'haute',
        });
      }
    }

    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, message: `Admission ${pat?.prenom} ${pat?.nom} — Lit ${lit_numero}` });
    emitActivity({ module: 'hospitalization', action: 'Nouvelle admission', detail: `${pat?.prenom || ''} ${pat?.nom || ''} — Lit ${lit_numero}`, icon: '🛏️', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.status(201).json({ success: true, hospitalization: hosp, hospitalisation: hosp });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const hosp = await Hospitalization.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false })
      .populate('patient', 'nom prenom numero_dossier')
      .populate('medecin_responsable', 'nom prenom')
      .populate('chambre', 'numero type');
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip });
    emitDashboardUpdate();
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

exports.addNote = async (req, res, next) => {
  try {
    const hosp = await Hospitalization.findById(req.params.id);
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
    hosp.notes_cliniques.push({ ...req.body, auteur: req.user._id });
    await hosp.save();
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

exports.discharge = async (req, res, next) => {
  try {
    const hosp = await Hospitalization.findByIdAndUpdate(
      req.params.id,
      { ...req.body, statut: 'sorti', date_sortie: new Date() },
      { new: true }
    ).populate('chambre');
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });

    // Free the bed
    const room = await Room.findById(hosp.chambre._id);
    if (room) {
      const bed = room.lits.find(l => l.numero === hosp.lit_numero);
      if (bed) { bed.statut = 'libre'; bed.patient_actuel = undefined; }
      await room.save();
    }
    // Notification patient à la sortie
    const pat = await require('../models/Patient').findById(hosp.patient).select('nom prenom email');
    if (pat?.email) {
      const userPatient = await User.findOne({ email: pat.email, role: 'patient' });
      if (userPatient) {
        await createNotification({
          destinataire: userPatient._id,
          type:    'success',
          titre:   'Sortie de l\'hôpital confirmée',
          message: `Votre sortie de la Clinique Canadienne a été enregistrée. Nous vous souhaitons un prompt rétablissement. N'oubliez pas votre rendez-vous de contrôle.`,
          lien:    '/portal',
          priorite:'normale',
        });
      }
    }
    await logAction({ utilisateur: req.user._id, action: 'DISCHARGE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip });
    emitActivity({ module: 'hospitalization', action: 'Sortie patient', detail: `${pat?.prenom || ''} ${pat?.nom || ''}`, icon: '🚪', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};
