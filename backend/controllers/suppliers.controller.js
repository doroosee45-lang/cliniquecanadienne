const Supplier = require('../models/Supplier');
const { logAction } = require('../utils/helpers');

// AUDIT-11-8 — Administration.jsx (loadAll) appelle déjà GET /admin/suppliers,
// jusqu'ici inexistant (repli silencieux sur une liste vide). Pas de liste
// blanche de champs sur create : endpoint déjà réservé à ADMIN
// (superadmin/adminclinique), même principe que createService/createInsurance
// (settings.controller.js).
exports.getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find().sort('nom');
    res.json({ success: true, suppliers });
  } catch (err) { next(err); }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create({ ...req.body, created_by: req.user._id });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'suppliers', entite_id: supplier._id, ip: req.ip, message: `Nouveau fournisseur : ${supplier.nom}` });
    res.status(201).json({ success: true, supplier });
  } catch (err) { next(err); }
};
