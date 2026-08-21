const Urgence   = require('../models/Urgence');
const { emitDashboardUpdate } = require('../utils/socket');
const { logAction, escapeRegex } = require('../utils/helpers');

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
exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    // AUDIT-B3 — seul ce bloc (attente/consultation/observation/critique +
    // temps d'attente moyen) chargeait encore la collection filtrée en
    // mémoire pour compter en JS ; par_triage et le graphique 6 mois
    // utilisaient déjà .aggregate(). Fusionné dans une agrégation unique,
    // même pattern que dashboard.controller.js/analytics.controller.js.
    const [actives, admissionsJour, sortiesJour, par_triage, statsAgg] = await Promise.all([
      Urgence.countDocuments({ statut: { $nin: ['sorti','decede','transfere'] } }),
      Urgence.countDocuments({ date_arrivee: { $gte: today, $lt: tomorrow } }),
      Urgence.countDocuments({ date_sortie: { $gte: today, $lt: tomorrow }, statut: { $in: ['sorti','hospitalise','transfere','decede'] } }),
      Urgence.aggregate([
        { $match: { statut: { $nin: ['sorti','decede','transfere'] } } },
        { $group: { _id: '$niveau_triage', count: { $sum: 1 } } },
      ]),
      Urgence.aggregate([
        { $match: { statut: { $nin: ['sorti','decede','transfere'] } } },
        { $group: {
            _id: null,
            attente:      { $sum: { $cond: [{ $in: ['$statut', ['attente','triage']] }, 1, 0] } },
            consultation: { $sum: { $cond: [{ $in: ['$statut', ['consultation','soins']] }, 1, 0] } },
            observation:  { $sum: { $cond: [{ $eq: ['$statut', 'observation'] }, 1, 0] } },
            critique:     { $sum: { $cond: [{ $eq: ['$niveau_triage', 'rouge'] }, 1, 0] } },
            tempsAttenteSum:   { $sum: { $cond: [
                { $and: [{ $eq: ['$statut', 'attente'] }, { $ne: ['$date_arrivee', null] }] },
                { $divide: [{ $subtract: ['$$NOW', '$date_arrivee'] }, 60000] },
                0,
            ] } },
            tempsAttenteCount: { $sum: { $cond: [
                { $and: [{ $eq: ['$statut', 'attente'] }, { $ne: ['$date_arrivee', null] }] }, 1, 0,
            ] } },
        } },
      ]),
    ]);

    const s = statsAgg[0] || { attente: 0, consultation: 0, observation: 0, critique: 0, tempsAttenteSum: 0, tempsAttenteCount: 0 };
    const { attente, consultation, observation, critique } = s;

    const triageMap = {};
    par_triage.forEach(t => { triageMap[t._id] = t.count; });

    // Temps d'attente moyen (minutes)
    const temps_attente_moy = s.tempsAttenteCount > 0 ? Math.round(s.tempsAttenteSum / s.tempsAttenteCount) : 0;

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
  } catch (err) { next(err); }
};

// GET /urgences
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, niveau_triage, statut, patient } = req.query;
    const filter = {};
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { patient_nom: { $regex: qRe, $options: 'i' } },
        { numero:      { $regex: qRe, $options: 'i' } },
        { motif:       { $regex: qRe, $options: 'i' } },
      ];
    }
    if (niveau_triage) filter.niveau_triage = niveau_triage;
    if (statut)        filter.statut        = statut;
    if (patient)       filter.patient       = patient;

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
  } catch (err) { next(err); }
};

// GET /urgences/:id
exports.getOne = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id)
      .populate('patient', 'prenom nom numero_dossier date_naissance')
      .populate('medecin_responsable', 'prenom nom');
    if (!u) return res.status(404).json({ message: 'Dossier urgence introuvable' });
    res.json({ urgence: normalize(u) });
  } catch (err) { next(err); }
};

// POST /urgences
exports.create = async (req, res, next) => {
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
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Admission urgences ${u.numero} — ${u.patient_nom} (triage ${u.niveau_triage})` });
    emitDashboardUpdate();
    await u.populate('patient', 'prenom nom numero_dossier');
    res.status(201).json({ urgence: normalize(u), message: `Patient ${u.numero} admis aux urgences` });
  } catch (err) { next(err); }
};

// PUT /urgences/:id
exports.update = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });

    // ADR-0005 — admission_status n'est jamais réassignable directement par
    // le client (retiré des champs génériques, comme soins/prescriptions/
    // examens/timeline ci-dessous) : il ne suit que decision (transitions
    // automatiques ci-après) ou la création réelle d'une hospitalisation
    // (hospitalization.controller.js::create).
    const { soins, prescriptions, examens, timeline, admission_status, ...fields } = req.body;
    const decisionAvant = u.decision;
    Object.assign(u, fields);

    if (fields.decision !== undefined && fields.decision !== decisionAvant && u.admission_status !== 'terminee') {
      if (fields.decision === 'hospitalisation') {
        u.admission_status = 'preparation';
      } else if (decisionAvant === 'hospitalisation') {
        // Décision d'hospitaliser retirée avant toute création réelle.
        u.admission_status = 'annulee';
      }
    }

    if (fields.statut && fields.statut !== u.statut) {
      u.timeline.push({
        action:    `Statut → ${fields.statut}`,
        heure:     new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        personnel: fields.medecin || 'Médecin',
        date:      new Date(),
      });
    }

    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Dossier urgences ${u.numero} modifié${fields.statut ? ` — statut → ${fields.statut}` : ''}` });
    emitDashboardUpdate();
    await u.populate('patient', 'prenom nom numero_dossier');
    await u.populate('medecin_responsable', 'prenom nom');
    res.json({ urgence: normalize(u) });
  } catch (err) { next(err); }
};

// GET /urgences/:id/soins
exports.getSoins = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('soins');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ soins: u.soins.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (err) { next(err); }
};

// POST /urgences/:id/soins
exports.addSoin = async (req, res, next) => {
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
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Soin (${soin.acte || 'acte'}) ajouté au dossier urgences ${u.numero}` });
    res.status(201).json({ soin: u.soins[0], message: 'Soin enregistré' });
  } catch (err) { next(err); }
};

// GET /urgences/:id/prescriptions
exports.getPrescriptions = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('prescriptions');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ prescriptions: u.prescriptions });
  } catch (err) { next(err); }
};

// POST /urgences/:id/prescriptions
exports.addPrescription = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    u.prescriptions.push(req.body);
    u.timeline.push({ action: `Prescription : ${req.body.designation || req.body.type}`, heure: new Date().toTimeString().substring(0,5), personnel: req.body.medecin || 'Médecin' });
    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Prescription (${req.body.designation || req.body.type || '—'}) ajoutée au dossier urgences ${u.numero}` });
    res.status(201).json({ prescription: u.prescriptions[u.prescriptions.length - 1] });
  } catch (err) { next(err); }
};

// GET /urgences/:id/examens
exports.getExamens = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('examens');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ examens: u.examens });
  } catch (err) { next(err); }
};

// POST /urgences/:id/examens
exports.addExamen = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    u.examens.push(req.body);
    u.timeline.push({ action: `Examen demandé : ${req.body.designation}${req.body.urgent ? ' 🚨URGENT' : ''}`, heure: new Date().toTimeString().substring(0,5), personnel: 'Médecin' });
    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Examen demandé (${req.body.designation || '—'}) — dossier urgences ${u.numero}` });
    res.status(201).json({ examen: u.examens[u.examens.length - 1] });
  } catch (err) { next(err); }
};

// GET /urgences/:id/timeline
exports.getTimeline = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('timeline');
    if (!u) return res.status(404).json({ message: 'Dossier introuvable' });
    res.json({ timeline: u.timeline.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (err) { next(err); }
};
