const Setting      = require('../models/Setting');
const User         = require('../models/User');
const Service      = require('../models/Service');
const Insurance    = require('../models/Insurance');
const Patient      = require('../models/Patient');
const Appointment  = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const Hospitalization = require('../models/Hospitalization');
const Invoice      = require('../models/Invoice');
const Room         = require('../models/Room');
const { logAction, createNotification } = require('../utils/helpers');
const mail = require('../utils/mail');

exports.getAll = async (req, res, next) => {
  try {
    const settings = await Setting.find().sort('groupe cle');
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};

exports.upsert = async (req, res, next) => {
  try {
    const { cle, valeur, type, groupe, description } = req.body;
    const avant = await Setting.findOne({ cle }).lean();
    const setting = await Setting.findOneAndUpdate(
      { cle }, { valeur, type, groupe, description }, { upsert: true, new: true }
    );
    await logAction({ utilisateur: req.user._id, action: 'UPDATE_SETTING', module: 'settings', ip: req.ip, message: `${cle} = ${valeur}`, avant, apres: setting });
    res.json({ success: true, setting });
  } catch (err) { next(err); }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort('role nom').select('-password');
    res.json({ success: true, users });
  } catch (err) { next(err); }
};

// AUDIT-11 (audit complet post-Phase 10) — liste blanche partagée par
// createUser ET updateUser : seuls les champs réellement envoyés par le
// formulaire Administration.jsx (EMPTY_USER) sont acceptables ici. Avant ce
// correctif, createUser transmettait req.body quasi tel quel (seuls
// mot_de_passe et password en étaient retirés) — un appel direct à cette
// route (superadmin uniquement, mais sans aucune défense en profondeur)
// pouvait positionner directement role, patient_id, tentatives_echouees,
// verrouille_jusqu_a, reset_password_token/expire, googleId ou preferences
// dès la création du compte. updateUser avait déjà reçu ce correctif lors
// de P2-1 ; createUser avait été manqué.
// must_change_password (AUDIT-P2-3, ticket 0003 piste 2) est ajouté
// explicitement : une case à cocher dédiée d'Administration.jsx le transmet
// désormais, c'est un chemin d'écriture légitime pour ce champ précis — pas
// un relâchement de la liste blanche.
const USER_WRITABLE_FIELDS = ['prenom', 'nom', 'email', 'telephone', 'role', 'service', 'statut', 'must_change_password'];

exports.createUser = async (req, res, next) => {
  try {
    // Suite du balayage T5.2 — Administration.jsx envoie le mot de passe
    // saisi sous `mot_de_passe`, le schéma déclare `password` : User.create
    // (req.body) ignorait silencieusement ce champ, créant un compte sans
    // aucun mot de passe utilisable (le champ est requis à la création côté
    // formulaire, mais jamais réellement enregistré).
    const body = {};
    for (const field of USER_WRITABLE_FIELDS) {
      if (req.body[field] !== undefined) body[field] = req.body[field];
    }
    if (req.body.mot_de_passe) body.password = req.body.mot_de_passe;
    const user = await User.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE_USER', module: 'admin', ip: req.ip, message: `Nouvel utilisateur: ${user.email}` });
    res.status(201).json({ success: true, user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    // Même correctif que createUser — le formulaire d'édition réutilise le
    // même champ `mot_de_passe` (vide = ne pas changer, non vide = réinitialiser).
    const { mot_de_passe } = req.body;
    const password = mot_de_passe || undefined;
    const data = {};
    for (const field of USER_WRITABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    const avant = await User.findById(req.params.id).select('role statut email').lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const user = await User.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (password) { user.password = password; await user.save(); }
    // Modification de compte utilisateur — traçabilité renforcée si le rôle
    // ou le statut change (élévation de privilèges, suspension...).
    await logAction({
      utilisateur: req.user._id, action: 'UPDATE_USER', module: 'admin', entite_id: user._id, ip: req.ip,
      avant: { role: avant.role, statut: avant.statut },
      apres: { role: user.role, statut: user.statut },
      message: `Utilisateur modifié : ${user.email}${avant.role !== user.role ? ` — rôle ${avant.role} → ${user.role}` : ''}${avant.statut !== user.statut ? ` — statut ${avant.statut} → ${user.statut}` : ''}${password ? ' — mot de passe réinitialisé' : ''}`,
    });

    // AUDIT-A-4 — un changement de rôle (élévation/rétrogradation de
    // privilèges) ou de statut (suspension...) était jusqu'ici invisible
    // pour l'intéressé, qui ne l'apprenait qu'en tombant dessus par hasard.
    // Suspendu = ne peut plus se connecter pour voir une notification
    // in-app, d'où l'email en plus, réservé à ce cas précis.
    if (avant.role !== user.role || avant.statut !== user.statut) {
      const changements = [];
      if (avant.role !== user.role) changements.push(`rôle : ${avant.role} → ${user.role}`);
      if (avant.statut !== user.statut) changements.push(`statut : ${avant.statut} → ${user.statut}`);
      const estSuspension = avant.statut !== user.statut && user.statut === 'suspendu';
      await createNotification({
        destinataire: user._id,
        type:    estSuspension ? 'warning' : 'info',
        titre:   'Votre compte a été modifié',
        message: `Un administrateur a modifié votre compte (${changements.join(', ')}).`,
        priorite: estSuspension ? 'haute' : 'normale',
      });
      if (estSuspension && user.email) {
        await mail.sendAccountSuspendedEmail({ email: user.email, prenom: user.prenom, nom: user.nom });
      }
    }

    res.json({ success: true, user });
  } catch (err) { next(err); }
};

exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.find().populate('chef_service', 'nom prenom').sort('nom');
    res.json({ success: true, services });
  } catch (err) { next(err); }
};

exports.createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: service._id, ip: req.ip, message: `Nouveau service : ${service.nom}` });
    res.status(201).json({ success: true, service });
  } catch (err) { next(err); }
};

exports.updateService = async (req, res, next) => {
  try {
    const avant = await Service.findById(req.params.id).lean();
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'settings', entite_id: service._id, ip: req.ip, message: `Service modifié : ${service.nom}`, avant, apres: service });
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().sort('numero').lean();
    res.json({ success: true, rooms });
  } catch (err) { next(err); }
};

exports.getInsurances = async (req, res, next) => {
  try {
    const insurances = await Insurance.find({ statut: 'actif' }).sort('nom');
    res.json({ success: true, insurances });
  } catch (err) { next(err); }
};

exports.createInsurance = async (req, res, next) => {
  try {
    const insurance = await Insurance.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: insurance._id, ip: req.ip, message: `Nouvelle assurance : ${insurance.nom}` });
    res.status(201).json({ success: true, insurance });
  } catch (err) { next(err); }
};

// ── KPIs tableau de bord administration ──────────────────────
exports.getKpis = async (req, res, next) => {
  try {
    const now      = new Date();
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      total_patients,
      rdv_jour,
      consultations_jour,
      hospitalisations,
      personnel_present,
      factures_impayees,
      revenus_jour_agg,
      revenus_mensuels_agg,
      rooms,
      users_by_role,
    ] = await Promise.all([
      Patient.countDocuments({ statut: { $ne: 'decede' } }),
      Appointment.countDocuments({ date_heure: { $gte: today, $lt: tomorrow }, statut: { $nin: ['annule','absent'] } }),
      Consultation.countDocuments({ date_consultation: { $gte: today, $lt: tomorrow } }),
      Hospitalization.countDocuments({ statut: 'en_cours' }),
      User.countDocuments({ statut: 'actif' }),
      Invoice.countDocuments({ statut: { $in: ['emise','partiellement_payee'] } }),
      Invoice.aggregate([
        { $match: { date_facture: { $gte: today, $lt: tomorrow }, statut: { $in: ['payee','partiellement_payee'] } } },
        { $group: { _id: null, total: { $sum: '$montant_ttc' } } },
      ]),
      Invoice.aggregate([
        { $match: { date_facture: { $gte: yearStart }, statut: 'payee' } },
        { $group: { _id: { mois: { $month: '$date_facture' } }, total: { $sum: '$montant_ttc' } } },
        { $sort: { '_id.mois': 1 } },
      ]),
      // Room.statut (actif/maintenance/ferme) est un statut d'ouverture de la
      // chambre — la disponibilité réelle (libre/occupé) vit au niveau de
      // chaque lit (Room.lits[].statut), jamais sur la chambre elle-même.
      Room.find().select('statut type lits').lean(),
      User.aggregate([
        { $match: { statut: 'actif' } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const revenus_par_mois = Array(12).fill(0);
    revenus_mensuels_agg.forEach(r => { revenus_par_mois[r._id.mois - 1] = r.total; });

    const roleMap = {};
    users_by_role.forEach(r => { roleMap[r._id] = r.count; });

    res.json({
      success:            true,
      total_patients,
      rdv_jour,
      consultations_jour,
      hospitalisations,
      personnel_present,
      factures_impayees,
      alertes:            0,
      revenus_jour:       revenus_jour_agg[0]?.total || 0,
      revenus_par_mois,
      rooms: {
        total:        rooms.length,
        // Comptage réel au niveau des lits (Room.lits[].statut), pas de la
        // chambre — voir hospitalization.controller.js::getStats pour la
        // même logique de référence.
        libres:       rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'libre').length || 0), 0),
        occupees:     rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'occupe').length || 0), 0),
        maintenance:  rooms.filter(r => r.statut === 'maintenance').length,
      },
      personnel_par_role: {
        medecins:    roleMap['medecin']    || 0,
        infirmiers:  roleMap['infirmier']  || 0,
        pharmaciens: roleMap['pharmacien'] || 0,
        autres:      (personnel_present) - (roleMap['medecin'] || 0) - (roleMap['infirmier'] || 0) - (roleMap['pharmacien'] || 0),
      },
    });
  } catch (err) { next(err); }
};
