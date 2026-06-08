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
const { logAction } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const settings = await Setting.find().sort('groupe cle');
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};

exports.upsert = async (req, res, next) => {
  try {
    const { cle, valeur, type, groupe, description } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { cle }, { valeur, type, groupe, description }, { upsert: true, new: true }
    );
    await logAction({ utilisateur: req.user._id, action: 'UPDATE_SETTING', module: 'settings', ip: req.ip, message: `${cle} = ${valeur}` });
    res.json({ success: true, setting });
  } catch (err) { next(err); }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort('role nom').select('-password');
    res.json({ success: true, users });
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE_USER', module: 'admin', ip: req.ip, message: `Nouvel utilisateur: ${user.email}` });
    res.status(201).json({ success: true, user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { password, ...data } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    if (password) { user.password = password; await user.save(); }
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
    res.status(201).json({ success: true, service });
  } catch (err) { next(err); }
};

exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable.' });
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
      Room.find().select('statut type').lean(),
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
        libres:       rooms.filter(r => r.statut === 'libre').length,
        occupees:     rooms.filter(r => r.statut === 'occupe').length,
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
