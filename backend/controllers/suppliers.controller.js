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

// POST5-014 (audit indépendant post-Phase 5, 14 sept. 2026) — le bouton
// "Modifier" (Administration.jsx, section Fournisseurs) n'avait aucun
// handler : aucune route de mise à jour n'existait pour ce module. Même
// principe/liste de champs éditables que createSupplier ci-dessus (pas de
// liste blanche stricte : endpoint déjà réservé aux rôles autorisés par la
// permission "modification"), created_by/timestamps jamais réécrits par le
// client.
exports.updateSupplier = async (req, res, next) => {
  try {
    const { nom, contact, telephone, email, adresse, produits } = req.body;
    const avant = await Supplier.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Fournisseur introuvable.' });
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: { nom, contact, telephone, email, adresse, produits } },
      { new: true, runValidators: true }
    );
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'suppliers', entite_id: supplier._id, ip: req.ip, message: `Fournisseur modifié : ${supplier.nom}`, avant, apres: supplier });
    res.json({ success: true, supplier });
  } catch (err) { next(err); }
};
