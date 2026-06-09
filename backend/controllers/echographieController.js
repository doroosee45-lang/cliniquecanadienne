const Echographie = require('../models/Echographie');

// ── GET /echographie/stats
exports.getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [all, planifAujourd_hui, realisAujourd_hui] = await Promise.all([
      Echographie.find({ statut: { $ne: 'annulee' } }).select('statut priorite type createdAt updatedAt'),
      Echographie.countDocuments({ statut: 'planifiee', date_planif: { $gte: today, $lt: tomorrow } }),
      Echographie.countDocuments({ statut: { $in: ['realisee', 'validee'] }, updatedAt: { $gte: today } }),
    ]);

    const kpis = {
      total:                   all.length,
      en_attente:              all.filter(d => d.statut === 'en_attente').length,
      planifiees:              all.filter(d => d.statut === 'planifiee').length,
      realisees:               all.filter(d => d.statut === 'realisee').length,
      validees:                all.filter(d => d.statut === 'validee').length,
      urgentes:                all.filter(d => d.priorite === 'urgente').length,
      planifiees_aujourd_hui:  planifAujourd_hui,
      realisees_aujourd_hui:   realisAujourd_hui,
    };

    const typeMap = {};
    all.forEach(d => { if (d.type) typeMap[d.type] = (typeMap[d.type] || 0) + 1; });

    const now = new Date();
    const labels = [];
    const data   = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      labels.push(start.toLocaleString('fr-FR', { month: 'short' }));
      data.push(all.filter(e => new Date(e.createdAt) >= start && new Date(e.createdAt) < end).length);
    }

    res.json({ success: true, kpis, typeMap, chart: { labels, data } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /echographie
exports.getAll = async (req, res) => {
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
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      Echographie.countDocuments(filter),
    ]);

    res.json({ success: true, demandes, total, page: +page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /echographie/:id
exports.getOne = async (req, res) => {
  try {
    const demande = await Echographie.findById(req.params.id);
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    res.json({ success: true, demande });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /echographie
exports.create = async (req, res) => {
  try {
    const demande = await Echographie.create(req.body);
    res.status(201).json({ success: true, demande });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── PUT /echographie/:id
exports.update = async (req, res) => {
  try {
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    res.json({ success: true, demande });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── PUT /echographie/:id/planifier
exports.planifier = async (req, res) => {
  try {
    const { date_planif, echographiste, salle } = req.body;
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id,
      { statut: 'planifiee', date_planif, echographiste, salle },
      { new: true }
    );
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    res.json({ success: true, demande });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── PUT /echographie/:id/rapport
exports.saveRapport = async (req, res) => {
  try {
    const { rapport_texte, conclusion, recommandations, rapport_statut } = req.body;
    const update = { rapport_texte, conclusion, recommandations };
    if (rapport_statut) {
      update.rapport_statut = rapport_statut;
      if (rapport_statut === 'valide') update.statut = 'validee';
    }
    const demande = await Echographie.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    res.json({ success: true, demande });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── PUT /echographie/:id/annuler
exports.annuler = async (req, res) => {
  try {
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id, { statut: 'annulee' }, { new: true }
    );
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });
    res.json({ success: true, demande });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
