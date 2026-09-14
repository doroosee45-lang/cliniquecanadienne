const path = require('path');
const Echographie = require('../models/Echographie');
const ExamCatalogue = require('../models/ExamCatalogue');
const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const { emitDashboardUpdate } = require('../utils/socket');
const { logAction, escapeRegex } = require('../utils/helpers');
const { storeUploadedFile } = require('../utils/fileStorage');

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// Correction 2 (module 3/6) — même source de tarif réelle que Radiology
// (ExamCatalogue.type:'imagerie'), déjà réellement peuplée avec des entrées
// d'échographie (utils/seed.js : ECH-ABD/ECH-OB/ECH-CAR). ExamCatalogue ne
// porte pas de champ categorie persistant (lacune déjà documentée en
// Correction 1/2 — categorie est envoyé par seed.js mais absent du schéma,
// donc silencieusement perdu par Mongoose) : filtrer par le nom réel
// ("Échographie ...") est la seule façon non arbitraire de ne proposer ici
// que les entrées effectivement pertinentes, sans inventer de nouvelle
// valeur d'enum ni de nouveau champ.
// ── GET /echographie/catalogue
exports.getCatalogue = async (req, res, next) => {
  try {
    const examens = await ExamCatalogue.find({ type: 'imagerie', statut: 'actif', nom: /^Échographie/i }).sort('nom');
    res.json({ success: true, examens });
  } catch (err) { next(err); }
};

// Correction 2 (module 3/6) — expose les vraies factures liées au module,
// jamais la collection Invoice entière (GET /finance reste réservé à
// superadmin/adminclinique/comptable) : même principe que
// laboratory.controller.js/radiology.controller.js::getOne, généralisé ici
// à une liste car l'onglet Facturation d'Echographie.jsx est un tableau de
// bord agrégé sur toutes les demandes, pas une seule fiche.
// ── GET /echographie/factures
exports.getFactures = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ source_module: 'echographie' }).sort('-date_facture').limit(200);
    res.json({ success: true, invoices });
  } catch (err) { next(err); }
};

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
    const { page = 1, limit = 50, q, type, statut, priorite, patient } = req.query;
    const filter = {};
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ patient_nom: re }, { numero: re }, { source: re }, { medecin_presc: re }];
    }
    if (type)     filter.type     = type;
    if (statut)   filter.statut   = statut;
    if (priorite) filter.priorite = priorite;
    // Module « Dossiers Médicaux » (recherche transversale) — PatientDetail.jsx
    // récupère désormais aussi les échographies du patient dans son onglet
    // "Imagerie" (voir PatientDetail.jsx) ; ce filtre manquait alors que
    // toutes les collections sœurs (laboratory/radiology/hospitalization/...)
    // le supportent déjà.
    if (patient)  filter.patient  = patient;

    const [demandes, total] = await Promise.all([
      Echographie.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
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
    const invoice = await Invoice.findOne({ source_module: 'echographie', source_id: demande._id });
    res.json({ success: true, demande, invoice });
  } catch (err) { next(err); }
};

// POST5-001 (audit indépendant post-Phase 5, 14 sept. 2026) — create()
// persistait `{...req.body}` sans aucun filtre, contrairement à update()
// (ECHO_BLOCKED_FIELDS ci-dessous) : n'importe quel rôle autorisé sur cette
// route (dont infirmier/sage_femme — echographie.routes.js) pouvait
// soumettre directement statut:'validee', rapport_radiologue, rapport_texte,
// conclusion, recommandations en un seul appel, sans jamais passer par
// saveRapport() (réservé à radiologue/superadmin). Liste blanche stricte
// (jamais une liste noire pour une création — plus sûre par défaut si le
// schéma évolue), dérivée du payload réellement envoyé par le formulaire
// réel (NouvelleDemandeModal, Echographie.jsx) : seuls les champs
// descriptifs de la demande initiale, jamais le statut ni le contenu du
// rapport, qui restent exclusivement gérés par ce contrôleur / saveRapport().
const ECHO_CREATE_ALLOWED_FIELDS = [
  'patient_nom', 'dossier', 'age', 'sexe', 'source', 'medecin_presc',
  'date_prescription', 'type', 'sous_type', 'motif', 'priorite',
];

// ── POST /echographie
exports.create = async (req, res, next) => {
  try {
    // Correction 2 (module 3/6) — n'accepte `examen` que si c'est un vrai
    // ObjectId ExamCatalogue, jamais fabriqué s'il est absent ou invalide
    // (même garde que radiology.controller.js::create).
    const examen = (req.body.examen && isObjectId(req.body.examen)) ? req.body.examen : undefined;

    // Correction 13 (DATA-001) — `patient` est désormais la vraie référence
    // (ObjectId), jamais un texte libre : vérifiée réelle avant persistance,
    // le libellé affiché (patient_nom) reste du texte libre indépendant.
    if (!req.body.patient || !isObjectId(req.body.patient)) {
      return res.status(400).json({ success: false, message: 'Patient réel obligatoire (aucune saisie libre).' });
    }
    const patientDoc = await Patient.findById(req.body.patient).select('_id').lean();
    if (!patientDoc) return res.status(400).json({ success: false, message: 'Patient introuvable.' });

    const data = {};
    for (const k of ECHO_CREATE_ALLOWED_FIELDS) { if (req.body[k] !== undefined) data[k] = req.body[k]; }

    // Une demande ne peut jamais naître ailleurs qu'à l'état initial —
    // statut/rapport_statut/rapport_radiologue/rapport_texte/conclusion/
    // recommandations/numero sont exclus de la liste blanche ci-dessus,
    // et statut est explicitement forcé ici (jamais lu de req.body).
    const demande = await Echographie.create({ ...data, examen, patient: patientDoc._id, statut: 'en_attente' });
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Nouvelle demande d'échographie ${demande.numero} — ${demande.patient_nom || 'patient'}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, demande });
  } catch (err) { next(err); }
};

// AUDIT-ELEVE-2 — miroir de radiology.controller.js::IMAGING_BLOCKED_FIELDS /
// prescriptions.controller.js::RX_BLOCKED_FIELDS : update() n'avait jusqu'ici
// aucune liste noire, contrairement à tous les autres contrôleurs cliniques —
// n'importe lequel des rôles autorisés sur cette route générique (dont
// infirmier/sage_femme) pouvait positionner statut:'validee', rapport_statut,
// rapport_radiologue ou conclusion directement, sans jamais passer par le
// circuit de validation dédié. Ces champs doivent exclusivement transiter par
// saveRapport(), désormais restreint à radiologue/superadmin au niveau de la
// route (echographie.routes.js) — même schéma que radiology.controller.js
// (update générique bloque statut/date_validation/signature, /cr /rapport
// /validation réservés au rôle radiologue).
const ECHO_BLOCKED_FIELDS = [
  'numero', 'patient', 'patient_nom',
  'statut', 'rapport_statut', 'rapport_radiologue',
  'rapport_texte', 'conclusion', 'recommandations',
];

// ── PUT /echographie/:id
exports.update = async (req, res, next) => {
  try {
    const avant = await Echographie.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!ECHO_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id, data, { new: true, runValidators: true }
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
    const { rapport_texte, conclusion, recommandations, rapport_statut, echographiste, salle } = req.body;
    const update = { rapport_texte, conclusion, recommandations };
    // PARAM-ECHO-001 (rapport de clôture du 11 sept. 2026) — echographiste/
    // salle sont déjà de vrais champs du modèle (positionnés à la
    // planification, PlanifierModal). Le formulaire "Paramètres d'examen" de
    // Realisation permet de corriger qui a RÉELLEMENT réalisé l'examen/dans
    // quelle salle (peut différer de l'assignation initiale) — persisté ici
    // uniquement si explicitement fourni, jamais un champ vide n'écrase une
    // valeur déjà réelle.
    if (echographiste) update.echographiste = echographiste;
    if (salle) update.salle = salle;
    if (rapport_statut) {
      update.rapport_statut = rapport_statut;
      if (rapport_statut === 'valide') update.statut = 'validee';
    }
    const avant = await Echographie.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ message: 'Demande non trouvée' });
    // SPEC-07 (correction du 12 sept. 2026, audit indépendant) — saveRapport
    // pouvait valider (statut→'validee') et facturer une demande encore
    // 'en_attente' (jamais planifiée, donc jamais réellement réalisée), et
    // sans le moindre contenu clinique réel (rapport_texte/conclusion vides)
    // — aucune fonction ne fait ici transiter le statut vers un équivalent
    // "réalisée" distinct (l'enum 'realisee' existe sur le schéma mais
    // n'est positionné par aucun contrôleur, vérifié par recherche
    // projet-wide) : les deux seuls signaux réels disponibles pour honorer
    // l'intention de l'audit sont donc (1) la demande a bien été planifiée
    // au préalable, et (2) un contenu de rapport réel accompagne la
    // validation — jamais une simple validation à vide.
    if (rapport_statut === 'valide') {
      if (avant.statut === 'en_attente') {
        return res.status(400).json({ message: "Impossible de valider : la demande doit d'abord être planifiée et réalisée." });
      }
      const contenuReel = (rapport_texte ?? avant.rapport_texte) || (conclusion ?? avant.conclusion);
      if (!contenuReel) {
        return res.status(400).json({ message: 'Impossible de valider : aucun compte-rendu réel (rapport ou conclusion) n\'a été saisi.' });
      }
    }
    const demande = await Echographie.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!demande) return res.status(404).json({ message: 'Demande non trouvée' });

    // Correction 2 (module 3/6) — facture réelle générée uniquement à la
    // validation du rapport (même moment du cycle de vie que
    // radiology.controller.js::validation), uniquement si la demande
    // référence un vrai ExamCatalogue — jamais de tarif inventé pour un
    // type/sous_type en texte libre (ancien format, ou catégorie sans
    // équivalent réel dans le catalogue aujourd'hui, ex: Doppler/Mammaire).
    let factureGeneree = null;
    if (rapport_statut === 'valide' && demande.examen && isObjectId(String(demande.examen))) {
      const cat = await ExamCatalogue.findById(demande.examen);
      const prix = Number(cat?.prix) || 0;
      if (prix > 0) {
        factureGeneree = await Invoice.create({
          patient: demande.patient || undefined,
          patient_nom: demande.patient_nom,
          service_label: 'Échographie',
          source_module: 'echographie',
          source_id: demande._id,
          created_by: req.user._id,
          lignes: [{ libelle: cat.nom, categorie: 'imagerie', prix_unitaire: prix, quantite: 1, montant: prix }],
          montant_ht: prix,
          montant_ttc: prix,
        });
        await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: factureGeneree._id, ip: req.ip, message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la validation du rapport d'échographie ${demande.numero}` });
      }
    }

    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Rapport d'échographie ${demande.numero} enregistré${rapport_statut === 'valide' ? ' et validé' : ''}`, avant, apres: demande });
    res.json({ success: true, demande, invoice: factureGeneree });
  } catch (err) { next(err); }
};

// AUDIT-ECHOGRAPHIE-IMAGES — l'étape "Images" du wizard de réalisation
// capturait les fichiers en local (FileReader, state React) sans jamais les
// envoyer ici : perdus au rafraîchissement/à la navigation. Même pattern
// que radiology.controller.js::uploadImages.
// ── POST /echographie/:id/images
exports.uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });

    const nouvelles = await Promise.all(req.files.map(async (f, i) => {
      const ext = path.extname(f.originalname);
      const base = path.basename(f.originalname, ext).replace(/\s+/g, '_').slice(0, 40);
      const { url } = await storeUploadedFile(f, { folder: 'echographie', filenameBase: `${Date.now()}-${i}-${base}` });
      return { url, description: f.originalname, date: new Date() };
    }));

    const avant = await Echographie.findById(req.params.id).lean();
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id,
      { $push: { images: { $each: nouvelles } } },
      { new: true }
    );
    if (!demande) return res.status(404).json({ success: false, message: 'Demande non trouvée' });

    await logAction({ utilisateur: req.user?._id, action: 'UPLOAD_IMAGES', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `${nouvelles.length} image(s) ajoutée(s) à la demande ${demande.numero}`, avant, apres: demande });
    res.json({ success: true, images: demande.images, demande });
  } catch (err) { next(err); }
};

// ── PUT /echographie/:id/annuler
exports.annuler = async (req, res, next) => {
  try {
    const avant = await Echographie.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ message: 'Demande non trouvée' });
    const demande = await Echographie.findByIdAndUpdate(
      req.params.id, { statut: 'annulee' }, { new: true }
    );

    // SPEC-09 (correction du 12 sept. 2026, audit indépendant) — annuler()
    // ne touchait jamais une facture réelle déjà générée (saveRapport,
    // rapport_statut:'valide') pour cette demande : une demande annulée
    // après facturation laissait une facture active pour un acte qui
    // n'aura jamais lieu. Contrepassée ici uniquement si rien n'a encore
    // été réellement encaissé (brouillon/emise) — un acompte déjà réglé
    // (partiellement_payee/payee) implique un vrai remboursement, une
    // décision de politique financière non déterminable depuis le code
    // actuel : jamais annulée automatiquement dans ce cas (signalé
    // explicitement dans la réponse plutôt que silencieusement ignoré).
    let factureAnnulee = null;
    let factureNonAnnuleeDejaReglee = false;
    const invoice = await Invoice.findOne({ source_module: 'echographie', source_id: demande._id });
    if (invoice) {
      if (['brouillon', 'emise'].includes(invoice.statut)) {
        factureAnnulee = await Invoice.findByIdAndUpdate(invoice._id, { statut: 'annulee' }, { new: true });
        await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Facture ${invoice.numero_facture} annulée suite à l'annulation de la demande d'échographie ${demande.numero}` });
      } else {
        factureNonAnnuleeDejaReglee = true;
      }
    }

    await logAction({ utilisateur: req.user?._id, action: 'CANCEL', module: 'echographie', entite_id: demande._id, ip: req.ip, message: `Demande d'échographie ${demande.numero} annulée${factureAnnulee ? ` — facture ${factureAnnulee.numero_facture} contrepassée` : ''}`, avant, apres: demande });
    res.json({ success: true, demande, facture_annulee: factureAnnulee, facture_non_annulee_deja_reglee: factureNonAnnuleeDejaReglee });
  } catch (err) { next(err); }
};
