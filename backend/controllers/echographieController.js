const Echographie = require('../models/Echographie');
const { emitDashboardUpdate } = require('../utils/socket');
const { logAction } = require('../utils/helpers');

// AUDIT-B3 — chargeait toute la collection (hors annulées) en mémoire pour
// compter/bucketer en JS, y compris le graphique 6 mois. Remplacé par des
// agrégations ciblées, même pattern que dashboard.controller.js/
// analytics.controller.js.
// ── GET /echographie/stats
exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [kpisAgg, typeAgg, monthlyAgg, planifAujourd_hui, realisAujourd_hui] = await Promise.all([
      Echographie.aggregate([
        { $match: { statut: { $ne: 'annulee' } } },
        { $group: {
            _id: null,
            total: { $sum: 1 },
            en_attente: { $sum: { $cond: [{ $eq: ['$statut', 'en_attente'] }, 1, 0] } },
            planifiees: { $sum: { $cond: [{ $eq: ['$statut', 'planifiee'] }, 1, 0] } },
            realisees:  { $sum: { $cond: [{ $eq: ['$statut', 'realisee'] }, 1, 0] } },
            validees:   { $sum: { $cond: [{ $eq: ['$statut', 'validee'] }, 1, 0] } },
            urgentes:   { $sum: { $cond: [{ $eq: ['$priorite', 'urgente'] }, 1, 0] } },
        } },
      ]),
      Echographie.aggregate([
        { $match: { statut: { $ne: 'annulee' } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      Echographie.aggregate([
        { $match: { statut: { $ne: 'annulee' }, createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      Echographie.countDocuments({ statut: 'planifiee', date_planif: { $gte: today, $lt: tomorrow } }),
      Echographie.countDocuments({ statut: { $in: ['realisee', 'validee'] }, updatedAt: { $gte: today } }),
    ]);

    const k = kpisAgg[0] || { total: 0, en_attente: 0, planifiees: 0, realisees: 0, validees: 0, urgentes: 0 };
    const kpis = {
      total:                   k.total,
      en_attente:              k.en_attente,
      planifiees:              k.planifiees,
      realisees:               k.realisees,
      validees:                k.validees,
      urgentes:                k.urgentes,
      planifiees_aujourd_hui:  planifAujourd_hui,
      realisees_aujourd_hui:   realisAujourd_hui,
    };

    const typeMap = {};
    typeAgg.forEach(t => { if (t._id) typeMap[t._id] = t.count; });

    const now = new Date();
    const labels = [];
    const data   = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(start.toLocaleString('fr-FR', { month: 'short' }));
      const entry = monthlyAgg.find(m => m._id.year === start.getFullYear() && m._id.month === start.getMonth() + 1);
      data.push(entry ? entry.count : 0);
    }

    res.json({ success: true, kpis, typeMap, chart: { labels, data } });
  } catch (err) { next(err); }
};

// ── GET /echographie
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, q, type, statut, priorite } = req.query;
    const filter = {};
    if (q) {
      const re = new RegExp(q, 'i');
      filter.$or = [{ patient: re }, { numero: re }, { source: re }, { medecin_presc: re }];
    }
    if (type)     filter.type     = type;
    if (statut)   filter.statut   = statut;
    if (priorite) filter.priorite = priorite;

    const [demandes, total] = await Promise.all([
      Echographie.find(filter)
        .populate('patient_ref', 'nom prenom numero_dossier')
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      Echographie.countDocuments(filter),
    ]);

    res.json({ success: true, demandes, total, page: +page });
  } catch (err) { next(err); }
};

// ── GET /echographie/:id
exports.getOne = async (req, res, next) => {
  try {
    const demande = await Echographie.findById(req.params.id);
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    res.json({ success: true, demande });
  } catch (err) { next(err); }
};

// ── POST /echographie
exports.create = async (req, res, next) => {
  try {
    const demande = await Echographie.create(req.body);
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Nouvelle demande d'échographie ${demande.numero} — ${demande.patient || 'patient'}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, demande });
  } catch (err) { next(err); }
};

// ── PUT /echographie/:id
exports.update = async (req, res, next) => {
  try {
    const avant = await Echographie.findById(req.params.id).lean();
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Demande d'échographie ${demande.numero} modifiée`, avant, apres: demande });
    emitDashboardUpdate();
    res.json({ success: true, demande });
  } catch (err) { next(err); }
};

// ── PUT /echographie/:id/planifier
exports.planifier = async (req, res, next) => {
  try {
    const { date_planif, echographiste, salle } = req.body;
    const avant = await Echographie.findById(req.params.id).lean();
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id,
      { statut: 'planifiee', date_planif, echographiste, salle },
      { new: true }
    );
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Échographie ${demande.numero} planifiée — ${echographiste || 'à assigner'}`, avant, apres: demande });
    res.json({ success: true, demande });
  } catch (err) { next(err); }
};

// ── PUT /echographie/:id/rapport
exports.saveRapport = async (req, res, next) => {
  try {
    const { rapport_texte, conclusion, recommandations, rapport_statut } = req.body;
    const update = { rapport_texte, conclusion, recommandations };
    if (rapport_statut) {
      update.rapport_statut = rapport_statut;
      if (rapport_statut === 'valide') update.statut = 'validee';
    }
    const avant = await Echographie.findById(req.params.id).lean();
    const demande = await Echographie.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Rapport d'échographie ${demande.numero} enregistré${rapport_statut === 'valide' ? ' et validé' : ''}`, avant, apres: demande });
    res.json({ success: true, demande });
  } catch (err) { next(err); }
};

// ── PUT /echographie/:id/annuler
exports.annuler = async (req, res, next) => {
  try {
    const avant = await Echographie.findById(req.params.id).lean();
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id, { statut: 'annulee' }, { new: true }
    );
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    await logAction({ utilisateur: req.user?._id, action: 'CANCEL', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Demande d'échographie ${demande.numero} annulée`, avant, apres: demande });
    res.json({ success: true, demande });
  } catch (err) { next(err); }
};
