const Pregnancy = require('../models/Pregnancy');
const Delivery  = require('../models/Delivery');
const Newborn   = require('../models/Newborn');
const Child     = require('../models/Child');
const Patient   = require('../models/Patient');
const { emitDashboardUpdate } = require('../utils/socket');
const { logAction, escapeRegex } = require('../utils/helpers');

// ── Stats / KPIs ─────────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
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
  } catch (err) { next(err); }
};

// ── Grossesses ────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, q = '', statut = '' } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { patient_nom: { $regex: qRe, $options: 'i' } },
        { patient_prenom: { $regex: qRe, $options: 'i' } },
        { numero: { $regex: qRe, $options: 'i' } },
        { telephone: { $regex: qRe, $options: 'i' } },
      ];
    }
    const total      = await Pregnancy.countDocuments(filter);
    const grossesses = await Pregnancy.find(filter)
      .populate('patient_id', 'nom prenom numero_dossier')
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, grossesses, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    const accouchement = await Delivery.findOne({ grossesse_id: g._id }).sort('-date_heure');
    const nb           = await Newborn.findOne({ grossesse_id: g._id });
    res.json({ success: true, grossesse: g, accouchement, nouveau_ne: nb });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { patient_id, ddr, medecin_responsable, sage_femme, nb_grossesses, nb_accouchements, nb_fausses_couches, nb_cesariennes, nb_morts_nes, antecedents_medicaux, antecedents_chirurgicaux, groupe_sanguin, facteurs_risque, notes } = req.body;
    const body = { medecin_responsable, sage_femme, nb_grossesses, nb_accouchements, nb_fausses_couches, nb_cesariennes, nb_morts_nes, antecedents_medicaux, antecedents_chirurgicaux, groupe_sanguin, facteurs_risque: facteurs_risque || [], notes, created_by: req.user._id };
    if (ddr) { body.ddr = new Date(ddr); body.date_debut = new Date(ddr); }

    // AUDIT-3.4 — si patient_id était fourni mais introuvable, le dossier de
    // grossesse était créé silencieusement sans aucun lien patient ni erreur
    // (faute de frappe sur l'ID, ou patient supprimé entre-temps passait
    // inaperçue). Retourne désormais une erreur explicite.
    if (patient_id) {
      const pat = await Patient.findById(patient_id);
      if (!pat) return res.status(400).json({ success: false, message: 'Patient introuvable pour l\'identifiant fourni.' });
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

    if (facteurs_risque && facteurs_risque.length > 0) body.statut = 'a_risque';
    if (facteurs_risque && facteurs_risque.length > 2) body.niveau_risque = 'eleve';
    else if (facteurs_risque && facteurs_risque.length > 0) body.niveau_risque = 'modere';

    const g = await Pregnancy.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'maternite', entite_id: g._id, ip: req.ip, message: `Nouveau dossier de grossesse ${g.numero} — ${g.patient_prenom || ''} ${g.patient_nom || ''}`.trim() });
    emitDashboardUpdate();
    res.status(201).json({ success: true, grossesse: g });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — patient_id/numero/created_by identifient le
// dossier. cpns/echographies/consultations_postnatales/salle_travail sont
// des sous-tableaux/sous-objet gérés par addCPN/addEcho/addPostnatal/
// updateTravail (chacun avec sa propre logique d'ajout) — les laisser
// passer par cette édition générique permettrait d'écraser tout
// l'historique de suivi d'un seul appel.
const PREGNANCY_BLOCKED_FIELDS = [
  'patient_id', 'numero', 'created_by',
  'cpns', 'echographies', 'consultations_postnatales', 'salle_travail',
];

exports.update = async (req, res, next) => {
  try {
    const avant = await Pregnancy.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!PREGNANCY_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const g = await Pregnancy.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'maternite', entite_id: g._id, ip: req.ip, message: `Dossier de grossesse ${g.numero} modifié`, avant, apres: g });
    res.json({ success: true, grossesse: g });
  } catch (err) { next(err); }
};

// ── CPN ───────────────────────────────────────────────────────────────────────
exports.addCPN = async (req, res, next) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    g.cpns.push({ ...req.body, date: req.body.date ? new Date(req.body.date) : new Date() });
    await g.save();
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'maternite', entite_id: g._id, ip: req.ip, message: `Consultation prénatale ajoutée au dossier ${g.numero}` });
    res.status(201).json({ success: true, grossesse: g, cpn: g.cpns[g.cpns.length - 1] });
  } catch (err) { next(err); }
};

// ── Échographies ──────────────────────────────────────────────────────────────
exports.addEcho = async (req, res, next) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    g.echographies.push({ ...req.body, date: req.body.date ? new Date(req.body.date) : new Date() });
    await g.save();
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'maternite', entite_id: g._id, ip: req.ip, message: `Échographie obstétricale ajoutée au dossier ${g.numero}` });
    res.status(201).json({ success: true, grossesse: g, echo: g.echographies[g.echographies.length - 1] });
  } catch (err) { next(err); }
};

// ── Salle de travail ──────────────────────────────────────────────────────────
exports.updateTravail = async (req, res, next) => {
  try {
    const avant = await Pregnancy.findById(req.params.id).lean();
    const g = await Pregnancy.findByIdAndUpdate(req.params.id, { salle_travail: { ...req.body, en_travail: true } }, { new: true });
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'maternite', entite_id: g._id, ip: req.ip, message: `Admission en salle de travail — dossier ${g.numero}`, avant, apres: g });
    res.json({ success: true, grossesse: g });
  } catch (err) { next(err); }
};

// ── Postnatal ──────────────────────────────────────────────────────────────────
exports.addPostnatal = async (req, res, next) => {
  try {
    const g = await Pregnancy.findById(req.params.id);
    if (!g) return res.status(404).json({ message: 'Dossier introuvable' });
    g.consultations_postnatales.push({ ...req.body, date: req.body.date ? new Date(req.body.date) : new Date() });
    g.statut = 'suivi_postnatal';
    await g.save();
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'maternite', entite_id: g._id, ip: req.ip, message: `Consultation postnatale ajoutée au dossier ${g.numero}` });
    res.status(201).json({ success: true, grossesse: g });
  } catch (err) { next(err); }
};

// ── Accouchements ─────────────────────────────────────────────────────────────
exports.getDeliveries = async (req, res, next) => {
  try {
    const { limit = 50, q = '' } = req.query;
    const filter = {};
    if (q) filter.patient_nom = { $regex: escapeRegex(q), $options: 'i' };
    const accouchements = await Delivery.find(filter).sort('-date_heure').limit(parseInt(limit));
    const total = await Delivery.countDocuments(filter);
    res.json({ success: true, accouchements, total });
  } catch (err) { next(err); }
};

exports.createDelivery = async (req, res, next) => {
  try {
    const { grossesse_id } = req.body;
    const body = { ...req.body, created_by: req.user._id };
    if (body.date_heure) body.date_heure = new Date(body.date_heure);
    // AUDIT-3.4 — si grossesse_id était fourni mais introuvable, l'accouchement
    // était enregistré silencieusement sans lien fiable vers la grossesse/
    // patiente (faute de frappe passait inaperçue). grossesse_id reste
    // optionnel (accouchement sans dossier prénatal préexistant), mais s'il
    // est fourni il doit être résolvable.
    if (grossesse_id) {
      const g = await Pregnancy.findById(grossesse_id);
      if (!g) return res.status(400).json({ success: false, message: 'Dossier de grossesse introuvable pour l\'identifiant fourni.' });
      if (!body.patient_nom) body.patient_nom = `${g.patient_prenom || ''} ${g.patient_nom || ''}`.trim();
      body.patient_id = g.patient_id;
      g.statut = 'accouchee';
      await g.save();
    }
    const acc = await Delivery.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'maternite', entite_id: acc._id, ip: req.ip, message: `Accouchement enregistré ${acc.numero} — ${acc.patient_nom || 'patiente'} (${acc.type_accouchement})` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, accouchement: acc });
  } catch (err) { next(err); }
};

// ── Nouveau-nés ───────────────────────────────────────────────────────────────
exports.getNewborns = async (req, res, next) => {
  try {
    const { limit = 50, q = '' } = req.query;
    const filter = {};
    if (q) { const qRe = escapeRegex(q); filter.$or = [{ prenom: { $regex: qRe, $options: 'i' } }, { mere_nom: { $regex: qRe, $options: 'i' } }]; }
    const nouveaunes = await Newborn.find(filter).sort('-date_naissance').limit(parseInt(limit));
    const total = await Newborn.countDocuments(filter);
    res.json({ success: true, nouveaunes, total });
  } catch (err) { next(err); }
};

exports.createNewborn = async (req, res, next) => {
  try {
    const body = { ...req.body, created_by: req.user._id };
    if (body.date_naissance) body.date_naissance = new Date(body.date_naissance);
    if (!body.vaccinations) body.vaccinations = [
      { vaccin: 'BCG', date: new Date(), dose: '0,1ml intradermique' },
      { vaccin: 'VPO 0 (Polio naissance)', date: new Date(), dose: '2 gouttes' },
      { vaccin: 'Hépatite B naissance', date: new Date(), dose: '0,5ml intramusculaire' },
    ];

    // AUDIT-MATERNITE-PATIENT (extension nouveau-nés) — mere_nom était repris
    // tel quel du frontend (construit depuis patient_nom/patient_prenom de la
    // grossesse), donc vide dès que la grossesse elle-même n'a pas de
    // patiente identifiée (mêmes 2 dossiers historiques). Même principe que
    // le bloc "if (patient_id)" ci-dessus pour Pregnancy : si la grossesse
    // liée a bien un patient_id réel, on re-dérive mere_nom/patient_id
    // depuis elle plutôt que de faire confiance à ce que le frontend a
    // envoyé — source unique de vérité, jamais de duplication qui diverge.
    if (body.grossesse_id) {
      const g = await Pregnancy.findById(body.grossesse_id);
      if (g?.patient_id) {
        body.patient_id = g.patient_id;
        body.mere_nom   = `${g.patient_prenom || ''} ${g.patient_nom || ''}`.trim();
      }
    }

    const nb = await Newborn.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'maternite', entite_id: nb._id, ip: req.ip, message: `Nouveau-né enregistré ${nb.numero} — ${nb.prenom || ''} (mère : ${nb.mere_nom || '—'})` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, nouveau_ne: nb });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — identifiants/liens (numero, accouchement_id,
// grossesse_id, patient_id, created_by, child_id) ne doivent pas être
// réassignables via l'édition générique ; child_id est explicitement posé
// une seule fois par la création dédiée du dossier pédiatrique (R-10d, cf.
// commentaire du modèle) pour empêcher d'en créer un second par erreur —
// le laisser passer ici casserait cette garantie. vaccinations est un
// sous-tableau géré ailleurs.
const NEWBORN_BLOCKED_FIELDS = ['numero', 'accouchement_id', 'grossesse_id', 'patient_id', 'created_by', 'child_id', 'vaccinations'];

exports.updateNewborn = async (req, res, next) => {
  try {
    const avant = await Newborn.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!NEWBORN_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const nb = await Newborn.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!nb) return res.status(404).json({ message: 'Nouveau-né introuvable' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'maternite', entite_id: nb._id, ip: req.ip, message: `Dossier nouveau-né ${nb.numero} modifié`, avant, apres: nb });
    res.json({ success: true, nouveau_ne: nb });
  } catch (err) { next(err); }
};

// R-10d — création du dossier pédiatrique (Child) à partir d'un nouveau-né,
// sur action explicite du personnel plutôt qu'automatiquement à la création
// du Newborn (voir commentaire sur Newborn.child_id).
const ETAT_TO_STATUT = { bon: 'normal', surveillance: 'surveillance', critique: 'a_risque' };

exports.createChildDossier = async (req, res, next) => {
  try {
    const nb = await Newborn.findById(req.params.id);
    if (!nb) return res.status(404).json({ message: 'Nouveau-né introuvable' });
    if (nb.child_id) {
      return res.status(400).json({ message: 'Un dossier pédiatrique existe déjà pour ce nouveau-né.', child_id: nb.child_id });
    }

    const child = await Child.create({
      nom: nb.nom || nb.mere_nom || 'Nouveau-né',
      prenom: nb.prenom,
      date_naissance: nb.date_naissance,
      sexe: nb.sexe,
      parent_nom: nb.mere_nom,
      parent_relation: 'mère',
      statut: ETAT_TO_STATUT[nb.etat] || 'normal',
      poids_actuel: nb.poids ? nb.poids / 1000 : undefined, // Newborn.poids en grammes, Child en kg
      taille_actuelle: nb.taille,
      vaccinations: nb.vaccinations,
      notes: nb.observations,
      created_by: req.user._id,
    });

    nb.child_id = child._id;
    await nb.save();

    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pediatrie', entite_id: child._id, ip: req.ip, message: `Dossier pédiatrique ${child.numero} créé depuis le nouveau-né ${nb.numero}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, enfant: child });
  } catch (err) { next(err); }
};
