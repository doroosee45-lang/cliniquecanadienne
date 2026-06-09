const Pregnancy = require('../models/Pregnancy');
const Delivery  = require('../models/Delivery');
const Newborn   = require('../models/Newborn');
const Patient   = require('../models/Patient');

// ── Stats / KPIs ─────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(start.getTime() + 86400000);
    const next7 = new Date(now.getTime() + 7 * 86400000);

    const [
      totalGrossesses,
      aRisque,
      accouchementsAujourdhui,
      cesariennes,
      nouveaunes,
      cpnAujourdhui,
      rdvAVenir,
    ] = await Promise.all([
      Pregnancy.countDocuments({ statut: { $in: ['active', 'a_risque'] } }),
      Pregnancy.countDocuments({ statut: 'a_risque' }),
      Delivery.countDocuments({ date_heure: { $gte: start, $lt: end } }),
      Delivery.countDocuments({ type_accouchement: 'cesarienne', createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } }),
      Newborn.countDocuments({ createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } }),
      Pregnancy.countDocuments({ 'cpns.0.date': { $gte: start, $lt: end } }),
      Pregnancy.countDocuments({ dpa: { $gte: now, $lte: next7 }, statut: { $in: ['active', 'a_risque'] } }),
    ]);

    const moisLabels = [];
    const moisData   = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '');
      moisLabels.push(label);
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const c = await Delivery.countDocuments({ date_heure: { $gte: s, $lte: e } });
      moisData.push(c);
    }

    res.json({
      success: true,
      stats: { totalGrossesses, aRisque, accouchementsAujourdhui, cesariennes, nouveaunes, cpnAujourdhui, rdvAVenir },
      chart: { labels: moisLabels, data: moisData },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Grossesses ────────────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, q = '', statut = '' } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) filter.$or = [
      { patient_nom: { $regex: q, $options: 'i' } },
      { patient_prenom: { $regex: q, $options: 'i' } },
      { numero: { $regex: q, $options: 'i' } },
      { telephone: { $regex: q, $options: 'i' } },
    ];
    const total      = await Pregnancy.countDocuments(filter);
    const grossesses = await Pregnancy.find(filter)
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, grossesses, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    const accouchement = await Delivery.findOne({ grossesse_id: g._id }).sort('-date_heure');
    const nb           = await Newborn.findOne({ grossesse_id: g._id });
    res.json({ success: true, grossesse: g, accouchement, nouveau_ne: nb });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const { patient_id, ddr, medecin_responsable, sage_femme, nb_grossesses, nb_accouchements, nb_fausses_couches, nb_cesariennes, nb_morts_nes, antecedents_medicaux, antecedents_chirurgicaux, groupe_sanguin, facteurs_risque, notes } = req.body;
    const body = { medecin_responsable, sage_femme, nb_grossesses, nb_accouchements, nb_fausses_couches, nb_cesariennes, nb_morts_nes, antecedents_medicaux, antecedents_chirurgicaux, groupe_sanguin, facteurs_risque: facteurs_risque || [], notes, created_by: req.user._id };
    if (ddr) { body.ddr = new Date(ddr); body.date_debut = new Date(ddr); }

    if (patient_id) {
      const pat = await Patient.findById(patient_id);
      if (pat) {
        body.patient_id     = pat._id;
        body.patient_nom    = pat.nom;
        body.patient_prenom = pat.prenom;
        body.telephone      = pat.telephone;
        body.date_naissance = pat.date_naissance;
        if (!body.groupe_sanguin) body.groupe_sanguin = pat.groupe_sanguin;
        if (!body.antecedents_medicaux && pat.antecedents_medicaux) {
          body.antecedents_medicaux = Array.isArray(pat.antecedents_medicaux) ? pat.antecedents_medicaux.join(', ') : pat.antecedents_medicaux;
        }
      }
    }

    if (facteurs_risque && facteurs_risque.length > 0) body.statut = 'a_risque';
    if (facteurs_risque && facteurs_risque.length > 2) body.niveau_risque = 'eleve';
    else if (facteurs_risque && facteurs_risque.length > 0) body.niveau_risque = 'modere';

    const g = await Pregnancy.create(body);
    res.status(201).json({ success: true, grossesse: g });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const g = await Pregnancy.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ success: true, grossesse: g });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CPN ───────────────────────────────────────────────────────────────────────
exports.addCPN = async (req, res) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    g.cpns.push({ ...req.body, date: req.body.date ? new Date(req.body.date) : new Date() });
    await g.save();
    res.status(201).json({ success: true, grossesse: g, cpn: g.cpns[g.cpns.length - 1] });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Échographies ──────────────────────────────────────────────────────────────
exports.addEcho = async (req, res) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    g.echographies.push({ ...req.body, date: req.body.date ? new Date(req.body.date) : new Date() });
    await g.save();
    res.status(201).json({ success: true, grossesse: g, echo: g.echographies[g.echographies.length - 1] });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Salle de travail ──────────────────────────────────────────────────────────
exports.updateTravail = async (req, res) => {
  try {
    const g = await Pregnancy.findByIdAndUpdate(req.params.id, { salle_travail: { ...req.body, en_travail: true } }, { new: true });
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ success: true, grossesse: g });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Postnatal ──────────────────────────────────────────────────────────────────
exports.addPostnatal = async (req, res) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    g.consultations_postnatales.push({ ...req.body, date: req.body.date ? new Date(req.body.date) : new Date() });
    g.statut = 'suivi_postnatal';
    await g.save();
    res.status(201).json({ success: true, grossesse: g });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Accouchements ─────────────────────────────────────────────────────────────
exports.getDeliveries = async (req, res) => {
  try {
    const { limit = 50, q = '' } = req.query;
    const filter = {};
    if (q) filter.patient_nom = { $regex: q, $options: 'i' };
    const accouchements = await Delivery.find(filter).sort('-date_heure').limit(parseInt(limit));
    const total = await Delivery.countDocuments(filter);
    res.json({ success: true, accouchements, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createDelivery = async (req, res) => {
  try {
    const { grossesse_id } = req.body;
    const body = { ...req.body, created_by: req.user._id };
    if (body.date_heure) body.date_heure = new Date(body.date_heure);
    if (grossesse_id) {
      const g = await Pregnancy.findById(grossesse_id);
      if (g) {
        if (!body.patient_nom) body.patient_nom = `${g.patient_prenom || ''} ${g.patient_nom || ''}`.trim();
        body.patient_id = g.patient_id;
        g.statut = 'accouchee';
        await g.save();
      }
    }
    const acc = await Delivery.create(body);
    res.status(201).json({ success: true, accouchement: acc });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Nouveau-nés ───────────────────────────────────────────────────────────────
exports.getNewborns = async (req, res) => {
  try {
    const { limit = 50, q = '' } = req.query;
    const filter = {};
    if (q) filter.$or = [{ prenom: { $regex: q, $options: 'i' } }, { mere_nom: { $regex: q, $options: 'i' } }];
    const nouveaunes = await Newborn.find(filter).sort('-date_naissance').limit(parseInt(limit));
    const total = await Newborn.countDocuments(filter);
    res.json({ success: true, nouveaunes, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createNewborn = async (req, res) => {
  try {
    const body = { ...req.body, created_by: req.user._id };
    if (body.date_naissance) body.date_naissance = new Date(body.date_naissance);
    if (!body.vaccinations) body.vaccinations = [
      { vaccin: 'BCG', date: new Date(), dose: '0,1ml intradermique' },
      { vaccin: 'VPO 0 (Polio naissance)', date: new Date(), dose: '2 gouttes' },
      { vaccin: 'Hépatite B naissance', date: new Date(), dose: '0,5ml intramusculaire' },
    ];
    const nb = await Newborn.create(body);
    res.status(201).json({ success: true, nouveau_ne: nb });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateNewborn = async (req, res) => {
  try {
    const nb = await Newborn.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!nb) return res.status(404).json({ message: 'Nouveau-né introuvable' });
    res.json({ success: true, nouveau_ne: nb });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
