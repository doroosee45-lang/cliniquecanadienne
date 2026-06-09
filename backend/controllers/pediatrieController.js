const Child                  = require('../models/Child');
const PediatricConsultation  = require('../models/PediatricConsultation');

// ── Helpers ───────────────────────────────────────────────────────────────────
function ageEnAns(ddn) {
  return Math.floor((Date.now() - new Date(ddn)) / (365.25 * 86400000));
}

// ── Stats / KPIs ──────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(start.getTime() + 86400000);

    const [
      totalEnfants,
      aRisque,
      urgences,
      consultationsAujourdhui,
      vaccinationsAujourdhui,
      chroniqueCount,
    ] = await Promise.all([
      Child.countDocuments({}),
      Child.countDocuments({ statut: 'a_risque' }),
      PediatricConsultation.countDocuments({ type: 'urgence', date: { $gte: start, $lt: end } }),
      PediatricConsultation.countDocuments({ date: { $gte: start, $lt: end } }),
      PediatricConsultation.countDocuments({ type: 'vaccination', date: { $gte: start, $lt: end } }),
      Child.countDocuments({ statut: 'chronique' }),
    ]);

    // Répartition par âge
    const allEnfants = await Child.find({}, 'date_naissance');
    const repartition = { nourr: 0, enfant_petit: 0, enfant_grand: 0, ado: 0 };
    allEnfants.forEach(e => {
      const a = ageEnAns(e.date_naissance);
      if (a < 1) repartition.nourr++;
      else if (a < 5) repartition.enfant_petit++;
      else if (a < 10) repartition.enfant_grand++;
      else repartition.ado++;
    });

    // Top pathologies (mois courant)
    const moisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const consults  = await PediatricConsultation.find({ date: { $gte: moisStart } }, 'diagnostic');
    const pathoCounts = {};
    consults.forEach(c => {
      const k = c.diagnostic?.toLowerCase() || 'inconnu';
      pathoCounts[k] = (pathoCounts[k] || 0) + 1;
    });
    const topPatho = Object.entries(pathoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([nom, nb]) => ({ nom, nb }));

    // Consultations 6 derniers mois
    const moisLabels = [];
    const moisData   = [];
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }).replace('.', '');
      const s  = new Date(d.getFullYear(), d.getMonth(), 1);
      const e  = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const nb = await PediatricConsultation.countDocuments({ date: { $gte: s, $lte: e } });
      moisLabels.push(label);
      moisData.push(nb);
    }

    res.json({
      success: true,
      stats: { totalEnfants, aRisque, urgences, consultationsAujourdhui, vaccinationsAujourdhui, chroniqueCount },
      repartitionAge: [repartition.nourr, repartition.enfant_petit, repartition.enfant_grand, repartition.ado],
      topPatho,
      chart: { labels: moisLabels, data: moisData },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Patients (enfants) ────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, q = '', statut = '', age = '' } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) filter.$or = [
      { nom:    { $regex: q, $options: 'i' } },
      { prenom: { $regex: q, $options: 'i' } },
      { numero: { $regex: q, $options: 'i' } },
      { parent_nom: { $regex: q, $options: 'i' } },
    ];
    if (age === 'nourr') {
      const limit1 = new Date(); limit1.setFullYear(limit1.getFullYear() - 1);
      filter.date_naissance = { $gte: limit1 };
    } else if (age === 'enfant') {
      const max = new Date(); max.setFullYear(max.getFullYear() - 1);
      const min = new Date(); min.setFullYear(min.getFullYear() - 5);
      filter.date_naissance = { $gte: min, $lte: max };
    } else if (age === 'grand') {
      const max = new Date(); max.setFullYear(max.getFullYear() - 5);
      const min = new Date(); min.setFullYear(min.getFullYear() - 12);
      filter.date_naissance = { $gte: min, $lte: max };
    }

    const total   = await Child.countDocuments(filter);
    const enfants = await Child.find(filter)
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({ success: true, enfants, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    const consultations = await PediatricConsultation.find({ child_id: child._id }).sort('-date').limit(20);
    res.json({ success: true, enfant: child, consultations });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const body = { ...req.body, created_by: req.user._id };
    if (body.date_naissance) body.date_naissance = new Date(body.date_naissance);
    const child = await Child.create(body);
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const child = await Child.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ success: true, enfant: child });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Vaccinations ──────────────────────────────────────────────────────────────
exports.addVaccination = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    const vacc = { ...req.body };
    if (vacc.date) vacc.date = new Date(vacc.date);
    if (vacc.rappel_prevu) vacc.rappel_prevu = new Date(vacc.rappel_prevu);
    child.vaccinations.push(vacc);
    await child.save();
    res.status(201).json({ success: true, enfant: child, vaccination: child.vaccinations[child.vaccinations.length - 1] });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Mesures de croissance ─────────────────────────────────────────────────────
exports.addMesure = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    const mesure = { ...req.body };
    if (mesure.date) mesure.date = new Date(mesure.date);
    if (mesure.poids && mesure.taille) {
      const h = mesure.taille / 100;
      mesure.imc = parseFloat((mesure.poids / (h * h)).toFixed(1));
    }
    child.mesures_croissance.push(mesure);
    // Mise à jour mesures actuelles
    if (mesure.poids)  child.poids_actuel    = mesure.poids;
    if (mesure.taille) child.taille_actuelle = mesure.taille;
    await child.save();
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Maladies chroniques ───────────────────────────────────────────────────────
exports.addMaladieChron = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    child.maladies_chroniques.push(req.body);
    child.statut = 'chronique';
    await child.save();
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Consultations ─────────────────────────────────────────────────────────────
exports.getConsultations = async (req, res) => {
  try {
    const { limit = 50, q = '', type = '', child_id = '' } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (child_id) filter.child_id = child_id;
    if (q) filter.$or = [
      { patient_nom: { $regex: q, $options: 'i' } },
      { diagnostic:  { $regex: q, $options: 'i' } },
    ];
    const consultations = await PediatricConsultation.find(filter)
      .sort('-date')
      .limit(parseInt(limit))
      .populate('child_id', 'nom prenom date_naissance sexe');
    const total = await PediatricConsultation.countDocuments(filter);
    res.json({ success: true, consultations, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createConsultation = async (req, res) => {
  try {
    const { child_id } = req.body;
    const body = { ...req.body, created_by: req.user._id };
    if (body.date) body.date = new Date(body.date);

    if (child_id) {
      const child = await Child.findById(child_id);
      if (child) {
        body.patient_nom = `${child.prenom || ''} ${child.nom}`.trim();
        if (body.poids) {
          child.poids_actuel = body.poids;
          await child.save();
        }
      }
    }

    const consult = await PediatricConsultation.create(body);
    res.status(201).json({ success: true, consultation: consult });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateConsultation = async (req, res) => {
  try {
    const c = await PediatricConsultation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!c) return res.status(404).json({ message: 'Consultation introuvable' });
    res.json({ success: true, consultation: c });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Urgences actives ──────────────────────────────────────────────────────────
exports.getUrgences = async (req, res) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const urgences = await PediatricConsultation.find({ type: 'urgence', date: { $gte: start } })
      .sort('-date')
      .populate('child_id', 'nom prenom date_naissance sexe');
    res.json({ success: true, urgences, total: urgences.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
