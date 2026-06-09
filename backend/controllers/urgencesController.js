const Urgence   = require('../models/Urgence');
const Ambulance = require('../models/Ambulance');

const normalize = (u) => ({
  ...u.toObject({ virtuals: true }),
  patient_nom: u.patient
    ? `${u.patient.prenom || ''} ${u.patient.nom || ''}`.trim() || u.patient_nom
    : u.patient_nom,
  medecin_label: u.medecin_responsable
    ? `${u.medecin_responsable.prenom || ''} ${u.medecin_responsable.nom || ''}`.trim()
    : u.medecin || '',
});

// GET /urgences/stats
exports.getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [actives, admissionsJour, sortiesJour, par_triage] = await Promise.all([
      Urgence.countDocuments({ statut: { $nin: ['sorti','decede','transfere'] } }),
      Urgence.countDocuments({ date_arrivee: { $gte: today, $lt: tomorrow } }),
      Urgence.countDocuments({ date_sortie: { $gte: today, $lt: tomorrow }, statut: { $in: ['sorti','hospitalise','transfere','decede'] } }),
      Urgence.aggregate([
        { $match: { statut: { $nin: ['sorti','decede','transfere'] } } },
        { $group: { _id: '$niveau_triage', count: { $sum: 1 } } },
      ]),
    ]);

    const actuel = await Urgence.find({ statut: { $nin: ['sorti','decede','transfere'] } }).select('statut niveau_triage date_arrivee');
    const attente     = actuel.filter(u => u.statut === 'attente' || u.statut === 'triage').length;
    const consultation= actuel.filter(u => u.statut === 'consultation' || u.statut === 'soins').length;
    const observation = actuel.filter(u => u.statut === 'observation').length;
    const critique    = actuel.filter(u => u.niveau_triage === 'rouge').length;

    const triageMap = {};
    par_triage.forEach(t => { triageMap[t._id] = t.count; });

    // Temps d'attente moyen (minutes)
    const enAttente = actuel.filter(u => u.statut === 'attente' && u.date_arrivee);
    const temps_attente_moy = enAttente.length > 0
      ? Math.round(enAttente.reduce((s, u) => s + Math.floor((Date.now() - new Date(u.date_arrivee)) / 60000), 0) / enAttente.length)
      : 0;

    // Chart flux 6 derniers mois
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0,0,0,0);
    const chartData = await Urgence.aggregate([
      { $match: { date_arrivee: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$date_arrivee' }, month: { $month: '$date_arrivee' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const moisFr = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const labels = []; const chartValues = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      labels.push(moisFr[d.getMonth()]);
      const entry = chartData.find(c => c._id.year === d.getFullYear() && c._id.month === d.getMonth() + 1);
      chartValues.push(entry ? entry.count : 0);
    }

    res.json({
      kpis: { actives, attente, consultation, observation, critique, admissions_jour: admissionsJour, sorties_jour: sortiesJour, temps_attente_moy },
      triageMap,
      chart: { labels, data: chartValues },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /urgences
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, niveau_triage, statut } = req.query;
    const filter = {};
    if (q) filter.$or = [
      { patient_nom: { $regex: q, $options: 'i' } },
      { numero:      { $regex: q, $options: 'i' } },
      { motif:       { $regex: q, $options: 'i' } },
    ];
    if (niveau_triage) filter.niveau_triage = niveau_triage;
    if (statut)        filter.statut        = statut;

    const skip  = (Number(page) - 1) * Number(limit);
    const [urgences, total] = await Promise.all([
      Urgence.find(filter)
        .populate('patient', 'prenom nom numero_dossier date_naissance')
        .populate('medecin_responsable', 'prenom nom')
        .sort({ date_arrivee: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Urgence.countDocuments(filter),
    ]);

    res.json({ urgences: urgences.map(normalize), total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /urgences/:id
exports.getOne = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id)
      .populate('patient', 'prenom nom numero_dossier date_naissance')
      .populate('medecin_responsable', 'prenom nom');
    if (!u) return res.status(404).json({ message: 'Dossier urgence introuvable' });
    res.json({ urgence: normalize(u) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /urgences
exports.create = async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.date_arrivee) body.date_arrivee = new Date();
    const u = new Urgence(body);

    u.timeline.push({
      action:    'Admission aux urgences',
      heure:     new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      personnel: body.medecin || 'Accueil',
      date:      new Date(),
    });

    await u.save();
    await u.populate('patient', 'prenom nom numero_dossier');
    res.status(201).json({ urgence: normalize(u), message: `Patient ${u.numero} admis aux urgences` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /urgences/:id
exports.update = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });

    const { soins, prescriptions, examens, timeline, ...fields } = req.body;
    Object.assign(u, fields);

    if (fields.statut && fields.statut !== u.statut) {
      u.timeline.push({
        action:    `Statut → ${fields.statut}`,
        heure:     new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        personnel: fields.medecin || 'Médecin',
        date:      new Date(),
      });
    }

    await u.save();
    await u.populate('patient', 'prenom nom numero_dossier');
    await u.populate('medecin_responsable', 'prenom nom');
    res.json({ urgence: normalize(u) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET /urgences/:id/soins
exports.getSoins = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id).select('soins');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ soins: u.soins.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /urgences/:id/soins
exports.addSoin = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    const soin = { ...req.body, heure: req.body.heure || new Date().toTimeString().substring(0, 5) };
    u.soins.unshift(soin);
    u.timeline.push({
      action: `Soin : ${req.body.acte || 'Acte infirmier'}`,
      heure:  soin.heure,
      personnel: req.body.personnel || 'Infirmier',
    });
    await u.save();
    res.status(201).json({ soin: u.soins[0], message: 'Soin enregistré' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// GET /urgences/:id/prescriptions
exports.getPrescriptions = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id).select('prescriptions');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ prescriptions: u.prescriptions });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /urgences/:id/prescriptions
exports.addPrescription = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    u.prescriptions.push(req.body);
    u.timeline.push({ action: `Prescription : ${req.body.designation || req.body.type}`, heure: new Date().toTimeString().substring(0,5), personnel: req.body.medecin || 'Médecin' });
    await u.save();
    res.status(201).json({ prescription: u.prescriptions[u.prescriptions.length - 1] });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// GET /urgences/:id/examens
exports.getExamens = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id).select('examens');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ examens: u.examens });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /urgences/:id/examens
exports.addExamen = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    u.examens.push(req.body);
    u.timeline.push({ action: `Examen demandé : ${req.body.designation}${req.body.urgent ? ' 🚨URGENT' : ''}`, heure: new Date().toTimeString().substring(0,5), personnel: 'Médecin' });
    await u.save();
    res.status(201).json({ examen: u.examens[u.examens.length - 1] });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// GET /urgences/:id/timeline
exports.getTimeline = async (req, res) => {
  try {
    const u = await Urgence.findById(req.params.id).select('timeline');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ timeline: u.timeline.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── AMBULANCES ─────────────────────────────────────────────────────────────

// GET /ambulances
exports.getAmbulances = async (req, res) => {
  try {
    const ambulances = await Ambulance.find().sort({ numero: 1 });
    res.json({ ambulances });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /ambulances/missions
exports.assignMission = async (req, res) => {
  try {
    const { numero, conducteur, destination, motif_mission } = req.body;
    const heure_depart = new Date().toTimeString().substring(0, 5);
    let amb = await Ambulance.findOne({ numero });
    if (!amb) {
      amb = new Ambulance({ numero, conducteur, statut: 'en_route', destination, heure_depart });
    } else {
      amb.statut = 'en_route';
      amb.conducteur = conducteur || amb.conducteur;
      amb.destination = destination;
      amb.heure_depart = heure_depart;
    }
    amb.missions.push({ destination, motif_mission, heure_depart });
    await amb.save();
    res.status(201).json({ ambulance: amb, message: `Mission ambulance ${numero} assignée` });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// PUT /ambulances/:numero/retour
exports.retourAmbulance = async (req, res) => {
  try {
    const amb = await Ambulance.findOne({ numero: req.params.numero });
    if (!amb) return res.status(404).json({ message: 'Ambulance introuvable' });
    amb.statut = 'disponible';
    amb.destination = '';
    const dernier = amb.missions[amb.missions.length - 1];
    if (dernier) dernier.heure_retour = new Date().toTimeString().substring(0, 5);
    await amb.save();
    res.json({ ambulance: amb });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
