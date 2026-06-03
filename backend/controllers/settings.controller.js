const Setting = require('../models/Setting');
const User = require('../models/User');
const Service = require('../models/Service');
const Insurance = require('../models/Insurance');
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
