const Invoice = require('../models/Invoice');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// Mapper Invoice (modèle) → objet frontend
function normalizeInvoice(inv) {
  const pat = inv.patient && typeof inv.patient === 'object' ? inv.patient : null;
  const statutMap = { emise:'non_paye', payee:'paye', partiellement_payee:'partiellement_paye', annulee:'annule', contentieux:'non_paye', brouillon:'non_paye' };
  return {
    ...inv,
    numero:   inv.numero_facture  || inv.numero   || '—',
    date:     inv.date_facture    || inv.date      || inv.createdAt,
    echeance: inv.date_echeance   || inv.echeance  || null,
    patient:  inv.patient_nom     || (pat ? `${pat.prenom} ${pat.nom}` : (typeof inv.patient === 'string' ? inv.patient : '—')),
    service:  inv.service_label   || inv.service   || '—',
    montant:  inv.montant_direct  || inv.montant_ttc || inv.montant || 0,
    statut:   statutMap[inv.statut] || inv.statut  || 'non_paye',
  };
}

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut, patient } = req.query;
    const filter = {};
    const statutRevMap = { non_paye:'emise', paye:'payee', partiellement_paye:'partiellement_payee', annule:'annulee' };
    if (statut) filter.statut = statutRevMap[statut] || statut;
    if (patient) filter.$or = [{ patient }, { patient_nom: { $regex: patient, $options: 'i' } }];
    const total = await Invoice.countDocuments(filter);
    const raw = await paginate(
      Invoice.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('created_by', 'nom prenom')
        .sort('-date_facture'),
      page, limit
    );
    const invoices = raw.map(i => normalizeInvoice(i.toObject ? i.toObject() : i));
    res.json({ success: true, total, invoices, factures: invoices });
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
    const mongoose = require('mongoose');
    const body = { ...req.body, created_by: req.user._id };

    // Mapper statuts frontend → modèle (enum valide)
    const VALID_STATUTS = ['brouillon','emise','partiellement_payee','payee','annulee','contentieux'];
    const statutMap = { non_paye:'emise', paye:'payee', partiellement_paye:'partiellement_payee', annule:'annulee', annulee:'annulee', payee:'payee', emise:'emise' };
    if (body.statut) body.statut = statutMap[body.statut] || (VALID_STATUTS.includes(body.statut) ? body.statut : 'emise');

    // patient_nom passé directement (formulaire avec sélecteur)
    if (body.patient_nom && !body.patient) {
      body.service_label = body.service || body.service_label || '';
    }
    // patient : texte libre → patient_nom, ObjectId valide → garder
    if (body.patient) {
      if (!mongoose.Types.ObjectId.isValid(String(body.patient))) {
        body.patient_nom   = String(body.patient);
        body.service_label = body.service || body.service_label || '';
        delete body.patient;
      }
      // sinon ObjectId valide — on garde tel quel
    }
    delete body.service;

    // Si montant direct fourni (sans lignes détaillées), créer une ligne synthétique
    const montantDirect = Number(body.montant) || 0;
    if (montantDirect > 0 && (!body.lignes || body.lignes.length === 0)) {
      body.lignes = [{ libelle: body.service_label || 'Prestation médicale', categorie: 'autre', prix_unitaire: montantDirect, quantite: 1, montant: montantDirect }];
      body.montant_direct = montantDirect;
    }
    delete body.montant;

    // Echeance
    if (body.echeance) { body.date_echeance = body.echeance; delete body.echeance; }

    body.montant_ht      = body.lignes?.reduce((s, l) => s + (Number(l.prix_unitaire) * (l.quantite || 1)), 0) || montantDirect;
    body.montant_ttc     = body.montant_ht * (1 + (body.tva || 0) / 100);
    body.montant_restant = body.statut === 'payee' ? 0 : body.montant_ttc;
    if (body.statut === 'payee') body.montant_paye = body.montant_ttc;

    const days = body.date_echeance ? Math.round((new Date(body.date_echeance) - Date.now()) / 86400000) : 30;
    body.score_risque = days < 7 ? 80 : days < 14 ? 50 : 20;

    const invoice = await Invoice.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Facture ${invoice.numero_facture}` });
    emitActivity({ module: 'finance', action: 'Nouvelle facture', detail: `${invoice.numero_facture} — ${invoice.montant_ttc?.toLocaleString('fr-FR')} CFA`, icon: '💰', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await Invoice.findById(invoice._id)
      .populate('patient', 'nom prenom numero_dossier')
      .lean();
    const facture = normalizeInvoice(populated);
    res.status(201).json({ success: true, invoice: facture, facture });
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
    emitActivity({ module: 'finance', action: 'Paiement reçu', detail: `${Number(montant).toLocaleString('fr-FR')} CFA — ${mode}`, icon: '✅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
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
