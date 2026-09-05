const Urgence   = require('../models/Urgence');
const ExamCatalogue = require('../models/ExamCatalogue');
const Medication = require('../models/Medication');
const Invoice   = require('../models/Invoice');
const { emitDashboardUpdate } = require('../utils/socket');
const { logAction, escapeRegex } = require('../utils/helpers');

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// Correction 2 (module 4/6, relecture du 6 sept. 2026) — statuts de clôture
// réelle d'un épisode d'urgences facturable par CE module. 'hospitalise' en
// est exclu : la facturation continue alors sous Hospitalization (cout_total
// → Invoice, cf. Phase 0), jamais doublée ici.
const TERMINAL_FACTURABLE = ['sorti', 'transfere', 'decede'];

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

    // Sous-phase 5.1 (relecture du 6 sept. 2026) — l'onglet Statistiques
    // (Urgences.jsx) affichait "Durée moy. séjour" (3h12), "Retours
    // domicile"/"Hospitalisés"/"Transférés" (78%/18%/4%), "Flux horaire" et
    // "Répartition motifs" TOUS codés en dur — alors que ce même endpoint
    // calcule déjà réellement temps_attente_moy et chart (6 mois), jamais
    // câblés côté frontend (import selectUrgencesChart resté mort). Complété
    // ici, même endpoint réel prolongé plutôt que dupliqué.
    const [dureeAgg, decisionAgg, motifAgg, fluxHoraireAgg] = await Promise.all([
      // Durée moyenne réelle des passages terminés (date_sortie réellement
      // posée). $expr: date_sortie > date_arrivee exclut les documents dont
      // les dates sont incohérentes (donnée corrompue/de test résiduelle) —
      // une durée de passage négative ou nulle n'est jamais une vraie
      // mesure, jamais moyennée avec les mesures réelles.
      Urgence.aggregate([
        { $match: { date_sortie: { $ne: null }, $expr: { $gt: ['$date_sortie', '$date_arrivee'] } } },
        { $project: { dureeMin: { $divide: [{ $subtract: ['$date_sortie', '$date_arrivee'] }, 60000] } } },
        { $group: { _id: null, sum: { $sum: '$dureeMin' }, count: { $sum: 1 } } },
      ]),
      // Issues réelles des passages (Urgence.decision, jamais deviné).
      Urgence.aggregate([
        { $match: { decision: { $ne: '' } } },
        { $group: { _id: '$decision', count: { $sum: 1 } } },
      ]),
      // Motifs réels les plus fréquents (texte exact — aucune taxonomie de
      // catégorie clinique n'existe réellement sur ce modèle, contrairement
      // à niveau_triage/decision qui sont de vrais enums).
      Urgence.aggregate([
        { $match: { motif: { $ne: null, $ne: '' } } },
        { $group: { _id: '$motif', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      // Flux horaire réel (arrivées par heure de la journée, tous jours confondus).
      Urgence.aggregate([
        { $group: { _id: { $hour: '$date_arrivee' }, count: { $sum: 1 } } },
      ]),
    ]);

    const d = dureeAgg[0];
    const duree_moy_min = d && d.count > 0 ? Math.round(d.sum / d.count) : null;

    const decisionMap = {};
    decisionAgg.forEach(x => { decisionMap[x._id] = x.count; });
    const totalDecisions = Object.values(decisionMap).reduce((sum, n) => sum + n, 0);
    const issues = ['retour_domicile', 'hospitalisation', 'transfert', 'deces']
      .filter(k => decisionMap[k])
      .map(k => ({ decision: k, pct: totalDecisions ? Math.round((decisionMap[k] / totalDecisions) * 100) : 0 }));

    const totalMotifs = motifAgg.reduce((sum, m) => sum + m.count, 0);
    const repartition_motifs = motifAgg.map(m => ({ motif: m._id, pct: totalMotifs ? Math.round((m.count / totalMotifs) * 100) : 0 }));

    const fluxParHeure = {};
    fluxHoraireAgg.forEach(h => { fluxParHeure[h._id] = h.count; });
    const flux_horaire = { labels: [], data: [] };
    for (let h = 0; h < 24; h += 2) {
      flux_horaire.labels.push(String(h).padStart(2, '0'));
      flux_horaire.data.push((fluxParHeure[h] || 0) + (fluxParHeure[h + 1] || 0));
    }

    // AUDIT-M-C7 (Groupe C, Point 7) — ce contrôleur ne renvoyait jamais
    // `success` (0/21 réponses) — seul du fichier avec ambulances.controller.js
    // et chirurgieController.js à s'écarter du format standard {success,...}
    // utilisé partout ailleurs. Ajouté ici et sur toutes les réponses
    // ci-dessous, purement additif (aucune clé existante retirée/renommée) —
    // vérifié qu'aucun code frontend ne s'en trouve cassé
    // (store/slices/urgencesSlice.js lit déjà les clés nommées directement,
    // jamais data.success).
    res.json({
      success: true,
      kpis: { actives, attente, consultation, observation, critique, admissions_jour: admissionsJour, sorties_jour: sortiesJour, temps_attente_moy, duree_moy_min },
      triageMap,
      chart: { labels, data: chartValues },
      issues, repartition_motifs, flux_horaire,
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

    res.json({ success: true, urgences: urgences.map(normalize), total, page: Number(page) });
  } catch (err) { next(err); }
};

// GET /urgences/:id
exports.getOne = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id)
      .populate('patient', 'prenom nom numero_dossier date_naissance')
      .populate('medecin_responsable', 'prenom nom');
    if (!u) return res.status(404).json({ success: false, message: 'Dossier urgence introuvable' });
    const invoice = await Invoice.findOne({ source_module: 'urgences', source_id: u._id });
    res.json({ success: true, urgence: normalize(u), invoice });
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
    res.status(201).json({ success: true, urgence: normalize(u), message: `Patient ${u.numero} admis aux urgences` });
  } catch (err) { next(err); }
};

// PUT /urgences/:id
exports.update = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });

    // ADR-0005 — admission_status n'est jamais réassignable directement par
    // le client (retiré des champs génériques, comme soins/prescriptions/
    // examens/timeline ci-dessous) : il ne suit que decision (transitions
    // automatiques ci-après) ou la création réelle d'une hospitalisation
    // (hospitalization.controller.js::create).
    const { soins, prescriptions, examens, timeline, admission_status, ...fields } = req.body;
    const decisionAvant = u.decision;
    const statutAvant   = u.statut;
    // AUDIT-URG-STATUT-BUG — la comparaison `fields.statut !== u.statut` ci-
    // dessous ne détectait plus jamais de changement une fois Object.assign
    // déjà exécuté (u.statut valait déjà fields.statut). Capturé avant
    // Object.assign (statutAvant), même correctif nécessaire pour que la
    // génération de facture ci-dessous (Correction 2) détecte réellement la
    // transition vers un statut terminal.
    Object.assign(u, fields);

    if (fields.decision !== undefined && fields.decision !== decisionAvant && u.admission_status !== 'terminee') {
      if (fields.decision === 'hospitalisation') {
        u.admission_status = 'preparation';
      } else if (decisionAvant === 'hospitalisation') {
        // Décision d'hospitaliser retirée avant toute création réelle.
        u.admission_status = 'annulee';
      }
    }

    if (fields.statut && fields.statut !== statutAvant) {
      u.timeline.push({
        action:    `Statut → ${fields.statut}`,
        heure:     new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        personnel: fields.medecin || 'Médecin',
        date:      new Date(),
      });
    }

    await u.save();

    // Correction 2 (module 4/6, relecture du 6 sept. 2026) — l'onglet
    // Facturation d'Urgences.jsx calculait un montant entièrement inventé
    // (tarifs fixes par catégorie d'acte + "payé = 60% du total", une
    // formule arbitraire), sans qu'aucune Invoice n'existe jamais en base.
    // Génère désormais une vraie facture à la clôture réelle de l'épisode
    // (sortie/transfert/décès — jamais à l'hospitalisation, déjà facturée
    // par Hospitalization), uniquement à partir des examens/prescriptions
    // référençant un vrai ExamCatalogue/Medication. LIMITE DOCUMENTÉE,
    // jamais simulée : les soins infirmiers (soins[]) et les prescriptions
    // de type perfusion/soin n'ont aujourd'hui aucun catalogue tarifaire
    // réel dans ce codebase — exclus de cette facture, pas de valeur
    // inventée pour les couvrir.
    let factureGeneree = null;
    if (fields.statut && fields.statut !== statutAvant && TERMINAL_FACTURABLE.includes(fields.statut)) {
      const dejaFacture = await Invoice.findOne({ source_module: 'urgences', source_id: u._id });
      if (!dejaFacture) {
        const lignes = [];
        for (const ex of u.examens) {
          if (ex.examen && isObjectId(String(ex.examen))) {
            const cat = await ExamCatalogue.findById(ex.examen);
            const prix = Number(cat?.prix) || 0;
            if (prix > 0) lignes.push({ libelle: cat.nom, categorie: ex.type === 'labo' ? 'laboratoire' : 'imagerie', prix_unitaire: prix, quantite: 1, montant: prix });
          }
        }
        for (const pr of u.prescriptions) {
          if (pr.medicament && isObjectId(String(pr.medicament))) {
            const med = await Medication.findById(pr.medicament);
            const prix = Number(med?.prix_vente) || 0;
            if (prix > 0) lignes.push({ libelle: med.nom_commercial, categorie: 'pharmacie', prix_unitaire: prix, quantite: 1, montant: prix });
          }
        }
        if (lignes.length > 0) {
          const montant = lignes.reduce((s, l) => s + l.montant, 0);
          factureGeneree = await Invoice.create({
            patient: u.patient || undefined,
            patient_nom: u.patient_nom,
            service_label: 'Urgences',
            source_module: 'urgences',
            source_id: u._id,
            created_by: req.user._id,
            lignes,
            montant_ht: montant,
            montant_ttc: montant,
          });
          await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: factureGeneree._id, ip: req.ip, message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la clôture du dossier urgences ${u.numero}` });
        }
      }
    }

    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Dossier urgences ${u.numero} modifié${fields.statut ? ` — statut → ${fields.statut}` : ''}` });
    emitDashboardUpdate();
    await u.populate('patient', 'prenom nom numero_dossier');
    await u.populate('medecin_responsable', 'prenom nom');
    res.json({ success: true, urgence: normalize(u), invoice: factureGeneree });
  } catch (err) { next(err); }
};

// GET /urgences/:id/soins
exports.getSoins = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('soins');
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    res.json({ success: true, soins: u.soins.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (err) { next(err); }
};

// POST /urgences/:id/soins
exports.addSoin = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    const soin = { ...req.body, heure: req.body.heure || new Date().toTimeString().substring(0, 5) };
    u.soins.unshift(soin);
    u.timeline.push({
      action: `Soin : ${req.body.acte || 'Acte infirmier'}`,
      heure:  soin.heure,
      personnel: req.body.personnel || 'Infirmier',
    });
    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Soin (${soin.acte || 'acte'}) ajouté au dossier urgences ${u.numero}` });
    res.status(201).json({ success: true, soin: u.soins[0], message: 'Soin enregistré' });
  } catch (err) { next(err); }
};

// GET /urgences/:id/prescriptions
exports.getPrescriptions = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('prescriptions');
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    res.json({ success: true, prescriptions: u.prescriptions });
  } catch (err) { next(err); }
};

// POST /urgences/:id/prescriptions
exports.addPrescription = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    // Correction 2 (module 4/6) — n'accepte `medicament` que si c'est un vrai
    // ObjectId Medication, jamais fabriqué s'il est absent ou invalide.
    const medicament = (req.body.medicament && isObjectId(req.body.medicament)) ? req.body.medicament : undefined;
    u.prescriptions.push({ ...req.body, medicament });
    u.timeline.push({ action: `Prescription : ${req.body.designation || req.body.type}`, heure: new Date().toTimeString().substring(0,5), personnel: req.body.medecin || 'Médecin' });
    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Prescription (${req.body.designation || req.body.type || '—'}) ajoutée au dossier urgences ${u.numero}` });
    res.status(201).json({ success: true, prescription: u.prescriptions[u.prescriptions.length - 1] });
  } catch (err) { next(err); }
};

// GET /urgences/:id/examens
exports.getExamens = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('examens');
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    res.json({ success: true, examens: u.examens });
  } catch (err) { next(err); }
};

// POST /urgences/:id/examens
exports.addExamen = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    // Correction 2 (module 4/6) — n'accepte `examen` que si c'est un vrai
    // ObjectId ExamCatalogue, jamais fabriqué s'il est absent ou invalide.
    const examen = (req.body.examen && isObjectId(req.body.examen)) ? req.body.examen : undefined;
    u.examens.push({ ...req.body, examen });
    u.timeline.push({ action: `Examen demandé : ${req.body.designation}${req.body.urgent ? ' 🚨URGENT' : ''}`, heure: new Date().toTimeString().substring(0,5), personnel: 'Médecin' });
    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Examen demandé (${req.body.designation || '—'}) — dossier urgences ${u.numero}` });
    res.status(201).json({ success: true, examen: u.examens[u.examens.length - 1] });
  } catch (err) { next(err); }
};

// Correction 3 (relecture du 6 sept. 2026, FE-BUG-005) — "Saisir résultat"
// (Urgences.jsx) ne faisait que dispatch(setExamenResultat(...)), un reducer
// local (urgencesSlice.js) sans aucun appel réseau : le résultat saisi était
// perdu au rechargement, et de toute façon systématiquement écrasé par le
// polling temps réel (30s) qui recharge l'examen depuis le serveur.
// PUT /urgences/:id/examens/:sid
exports.updateExamen = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    const exam = u.examens.id(req.params.sid);
    if (!exam) return res.status(404).json({ success: false, message: 'Examen introuvable' });
    if (Object.prototype.hasOwnProperty.call(req.body, 'resultat')) exam.resultat = req.body.resultat;
    if (Object.prototype.hasOwnProperty.call(req.body, 'statut')) exam.statut = req.body.statut;
    await u.save();
    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'urgences', entite_id: u._id, ip: req.ip, message: `Résultat saisi pour l'examen (${exam.designation || '—'}) — dossier urgences ${u.numero}` });
    res.json({ success: true, examen: exam });
  } catch (err) { next(err); }
};

// GET /urgences/:id/timeline
exports.getTimeline = async (req, res, next) => {
  try {
    const u = await Urgence.findById(req.params.id).select('timeline');
    if (!u) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    res.json({ success: true, timeline: u.timeline.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (err) { next(err); }
};
