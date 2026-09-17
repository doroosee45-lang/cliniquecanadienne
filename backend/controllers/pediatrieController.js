const Child                  = require('../models/Child');
const PediatricConsultation  = require('../models/PediatricConsultation');
const Patient                = require('../models/Patient');
const { emitDashboardUpdate } = require('../utils/socket');
const { logAction, escapeRegex } = require('../utils/helpers');

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// ── Stats / KPIs ──────────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
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

    // AUDIT-B3 — chargeait toute la collection Child et tous les
    // PediatricConsultation du mois en mémoire pour les compter en JS.
    // Remplacé par deux agrégations ciblées, même pattern que
    // dashboard.controller.js/analytics.controller.js.
    const moisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const MS_PAR_AN = 365.25 * 86400000;

    const [repartitionAgg, topPathoAgg] = await Promise.all([
      // Répartition par âge — mêmes seuils que l'ancien helper JS ageEnAns()
      // (âge en années < 1/5/10 ans), calculée côté serveur MongoDB.
      Child.aggregate([
        { $project: {
            ageAns: { $divide: [{ $subtract: ['$$NOW', '$date_naissance'] }, MS_PAR_AN] },
        } },
        { $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$ageAns', 1] }, then: 'nourr' },
                  { case: { $lt: ['$ageAns', 5] }, then: 'enfant_petit' },
                  { case: { $lt: ['$ageAns', 10] }, then: 'enfant_grand' },
                ],
                default: 'ado',
              },
            },
            count: { $sum: 1 },
        } },
      ]),
      // Top pathologies (mois courant)
      PediatricConsultation.aggregate([
        { $match: { date: { $gte: moisStart } } },
        { $project: { diagnosticLower: { $toLower: { $ifNull: ['$diagnostic', 'inconnu'] } } } },
        { $group: { _id: '$diagnosticLower', nb: { $sum: 1 } } },
        { $sort: { nb: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const repartition = { nourr: 0, enfant_petit: 0, enfant_grand: 0, ado: 0 };
    repartitionAgg.forEach(r => { repartition[r._id] = r.count; });
    const topPatho = topPathoAgg.map(r => ({ nom: r._id, nb: r.nb }));

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
  } catch (err) { next(err); }
};

// ── Patients (enfants) ────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, q = '', statut = '', age = '' } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { nom:    { $regex: qRe, $options: 'i' } },
        { prenom: { $regex: qRe, $options: 'i' } },
        { numero: { $regex: qRe, $options: 'i' } },
        { parent_nom: { $regex: qRe, $options: 'i' } },
      ];
    }
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

    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, enfants] = await Promise.all([
      Child.countDocuments(filter),
      Child.find(filter)
        .populate('patient_id', 'nom prenom numero_dossier')
        .sort('-createdAt')
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

    res.json({ success: true, enfants, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    const consultations = await PediatricConsultation.find({ child_id: child._id }).sort('-date').limit(20);
    res.json({ success: true, enfant: child, consultations });
  } catch (err) { next(err); }
};

// SPEC-10 (correction du 12 sept. 2026, audit indépendant) — create()
// persistait ...req.body tel quel (mass-assignment) et patient_id n'était
// jamais validé, ni même requis, alors que Pediatrie.jsx::ModalDossier
// exige déjà réellement un patient existant avant tout envoi (aucun
// dossier enfant anonyme n'est un workflow clinique réel ici, même
// raisonnement que SPEC-03 pour Pregnancy). Un appel API direct pouvait
// donc créer un dossier sans lien réel vers un Patient, ou avec un
// patient_id fabriqué/orphelin.
exports.create = async (req, res, next) => {
  try {
    if (!req.body.patient_id) return res.status(400).json({ message: 'Patient obligatoire pour créer un dossier pédiatrique.' });
    if (!isObjectId(req.body.patient_id)) return res.status(400).json({ message: 'Référence patient invalide.' });
    const patientDoc = await Patient.findById(req.body.patient_id).select('_id prenom nom');
    if (!patientDoc) return res.status(404).json({ message: 'Patient introuvable.' });

    // Même liste blanche que CHILD_BLOCKED_FIELDS ci-dessous (les champs
    // bloqués à l'édition ne doivent pas non plus être fabricables à la
    // création — numero est déjà auto-généré, vaccinations/mesures/
    // maladies gérés par leurs propres endpoints dédiés).
    const body = {};
    for (const [k, v] of Object.entries(req.body)) { if (!CHILD_BLOCKED_FIELDS.includes(k)) body[k] = v; }
    body.patient_id = patientDoc._id;
    // POST5-016 (audit indépendant post-Phase 5, 14 sept. 2026) — nom/prenom
    // étaient pris bruts du client même quand patient_id référence un
    // Patient réellement vérifié ci-dessus : un client pouvait envoyer un
    // patient_id réel avec un nom/prénom arbitraires, créant une
    // incohérence nom/ID jamais détectée. patient_id est obligatoire pour ce
    // module (contrairement à Urgences, aucun intake anonyme ici) : dérivés
    // sans condition du Patient vérifié, jamais du client. parent_nom
    // (personne différente de l'enfant, aucune référence Patient/ID
    // vérifiable pour un parent dans ce schéma) reste hors périmètre de ce
    // garde-fou — rien à vérifier contre.
    body.nom = patientDoc.nom;
    body.prenom = patientDoc.prenom;
    body.created_by = req.user._id;
    if (body.date_naissance) body.date_naissance = new Date(body.date_naissance);
    const child = await Child.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pediatrie', entite_id: child._id, ip: req.ip, message: `Nouveau dossier pédiatrique ${child.numero} — ${child.prenom || ''} ${child.nom}`.trim() });
    emitDashboardUpdate();
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — patient_id/numero/created_by identifient le
// dossier. vaccinations/mesures_croissance/maladies_chroniques sont des
// sous-tableaux gérés par addVaccination/addMesureCroissance/
// addMaladieChron (chacun avec sa propre validation, cf. P6-4 pour
// mesures_croissance) — les laisser passer par cette édition générique
// permettrait d'écraser tout l'historique en un seul appel.
// POST5-016 — nom/prenom rejoignent ce blocage : dérivés une fois pour
// toutes du Patient vérifié à la création (voir create() ci-dessus),
// jamais indépendamment réécrits via cette édition générique (patient_id
// lui-même déjà bloqué, immuable après création — nom/prenom doivent
// rester cohérents avec lui en permanence, jamais un second point de
// vérité éditable côté client).
const CHILD_BLOCKED_FIELDS = ['patient_id', 'numero', 'created_by', 'nom', 'prenom', 'vaccinations', 'mesures_croissance', 'maladies_chroniques'];

exports.update = async (req, res, next) => {
  try {
    const avant = await Child.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!CHILD_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const child = await Child.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pediatrie', entite_id: child._id, ip: req.ip, message: `Dossier pédiatrique ${child.numero} modifié`, avant, apres: child });
    emitDashboardUpdate();
    res.json({ success: true, enfant: child });
  } catch (err) { next(err); }
};

// ── Vaccinations ──────────────────────────────────────────────────────────────
exports.addVaccination = async (req, res, next) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    const vacc = { ...req.body };
    if (vacc.date) vacc.date = new Date(vacc.date);
    if (vacc.rappel_prevu) vacc.rappel_prevu = new Date(vacc.rappel_prevu);
    child.vaccinations.push(vacc);
    await child.save();
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pediatrie', entite_id: child._id, ip: req.ip, message: `Vaccination (${vacc.vaccin || '—'}) ajoutée au dossier ${child.numero}` });
    res.status(201).json({ success: true, enfant: child, vaccination: child.vaccinations[child.vaccinations.length - 1] });
  } catch (err) { next(err); }
};

// ── Mesures de croissance ─────────────────────────────────────────────────────
exports.addMesure = async (req, res, next) => {
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
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pediatrie', entite_id: child._id, ip: req.ip, message: `Mesure de croissance ajoutée au dossier ${child.numero}` });
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { next(err); }
};

// ── Maladies chroniques ───────────────────────────────────────────────────────
exports.addMaladieChron = async (req, res, next) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ message: 'Dossier introuvable' });
    child.maladies_chroniques.push(req.body);
    child.statut = 'chronique';
    await child.save();
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pediatrie', entite_id: child._id, ip: req.ip, message: `Maladie chronique enregistrée au dossier ${child.numero}` });
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { next(err); }
};

// ── Consultations ─────────────────────────────────────────────────────────────
exports.getConsultations = async (req, res, next) => {
  try {
    const { limit = 50, q = '', type = '', child_id = '' } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (child_id) filter.child_id = child_id;
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { patient_nom: { $regex: qRe, $options: 'i' } },
        { diagnostic:  { $regex: qRe, $options: 'i' } },
      ];
    }
    // PERF-001 (audit de performance du 12 sept. 2026) — indépendants, en parallèle.
    const [consultations, total] = await Promise.all([
      PediatricConsultation.find(filter)
        .sort('-date')
        .limit(parseInt(limit))
        .populate('child_id', 'nom prenom date_naissance sexe'),
      PediatricConsultation.countDocuments(filter),
    ]);
    res.json({ success: true, consultations, total });
  } catch (err) { next(err); }
};

exports.createConsultation = async (req, res, next) => {
  try {
    const { child_id } = req.body;
    const body = { ...req.body, created_by: req.user._id };
    if (body.date) body.date = new Date(body.date);

    // AUDIT-3.4 — child_id est requis par le schéma mais Mongoose ne vérifie
    // que le format ObjectId, pas l'existence : une consultation pouvait donc
    // être créée avec un child_id syntaxiquement valide mais ne correspondant
    // à aucun dossier enfant réel, orpheline dans toute vue qui peuple
    // child_id.
    if (child_id) {
      const child = await Child.findById(child_id);
      if (!child) return res.status(400).json({ success: false, message: 'Dossier enfant introuvable pour l\'identifiant fourni.' });
      body.patient_nom = `${child.prenom || ''} ${child.nom}`.trim();
      if (body.poids) {
        child.poids_actuel = body.poids;
        await child.save();
      }
    }

    const consult = await PediatricConsultation.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pediatrie', entite_id: consult._id, ip: req.ip, message: `Consultation pédiatrique ${consult.numero} — ${consult.patient_nom || 'enfant'} (${consult.type})` });
    res.status(201).json({ success: true, consultation: consult });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — child_id/numero/created_by identifient la
// consultation et son dossier enfant.
const PEDCONSULT_BLOCKED_FIELDS = ['child_id', 'numero', 'created_by'];

exports.updateConsultation = async (req, res, next) => {
  try {
    const avant = await PediatricConsultation.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!PEDCONSULT_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const c = await PediatricConsultation.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!c) return res.status(404).json({ message: 'Consultation introuvable' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pediatrie', entite_id: c._id, ip: req.ip, message: `Consultation pédiatrique ${c.numero} modifiée`, avant, apres: c });
    res.json({ success: true, consultation: c });
  } catch (err) { next(err); }
};

// ── Urgences actives ──────────────────────────────────────────────────────────
exports.getUrgences = async (req, res, next) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const urgences = await PediatricConsultation.find({ type: 'urgence', date: { $gte: start } })
      .sort('-date')
      .populate('child_id', 'nom prenom date_naissance sexe');
    res.json({ success: true, urgences, total: urgences.length });
  } catch (err) { next(err); }
};
