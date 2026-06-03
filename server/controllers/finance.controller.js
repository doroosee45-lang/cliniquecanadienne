const Invoice = require('../models/Invoice');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut, patient } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (patient) filter.patient = patient;
    const total = await Invoice.countDocuments(filter);
    const invoices = await paginate(
      Invoice.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('created_by', 'nom prenom')
        .sort('-date_facture'),
      page, limit
    );
    res.json({ success: true, total, invoices });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('patient').populate('created_by', 'nom prenom');
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, created_by: req.user._id };
    // Calculate totals
    data.montant_ht = data.lignes?.reduce((s, l) => s + (l.prix_unitaire * (l.quantite || 1)), 0) || 0;
    data.montant_ttc = data.montant_ht * (1 + (data.tva || 0) / 100);
    data.montant_restant = data.montant_ttc;
    // AI risk score
    const days = data.date_echeance ? Math.round((new Date(data.date_echeance) - Date.now()) / 86400000) : 30;
    data.score_risque = days < 7 ? 80 : days < 14 ? 50 : 20;

    const invoice = await Invoice.create(data);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Facture ${invoice.numero_facture}` });
    res.status(201).json({ success: true, invoice });
  } catch (err) { next(err); }
};

exports.addPayment = async (req, res, next) => {
  try {
    const { montant, mode, reference } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    if (montant > invoice.montant_restant)
      return res.status(400).json({ success: false, message: 'Montant supérieur au solde restant.' });

    invoice.paiements.push({ montant, mode, reference, enregistre_par: req.user._id });
    await invoice.save();
    await logAction({ utilisateur: req.user._id, action: 'PAYMENT', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Paiement ${montant} (${mode})` });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

exports.stats = async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, payees, impayees, partiel, caMonth] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ statut: 'payee' }),
      Invoice.countDocuments({ statut: 'emise' }),
      Invoice.countDocuments({ statut: 'partiellement_payee' }),
      Invoice.aggregate([
        { $match: { date_facture: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$montant_paye' } } },
      ]),
    ]);

    res.json({ success: true, stats: {
      total, payees, impayees, partiellement_payees: partiel,
      ca_mois: caMonth[0]?.total || 0,
      taux_recouvrement: total > 0 ? Math.round((payees / total) * 100) : 0,
    }});
  } catch (err) { next(err); }
};
