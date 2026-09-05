const Hospitalization = require('../models/Hospitalization');
const Room    = require('../models/Room');
const User    = require('../models/User');
const Urgence = require('../models/Urgence');
const Invoice = require('../models/Invoice');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate, emitTo } = require('../utils/socket');

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().populate('service', 'nom').populate('lits.patient_actuel', 'nom prenom');
    res.json({ success: true, rooms });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const [total, en_cours, sortis, transferes, decedes] = await Promise.all([
      Hospitalization.countDocuments(),
      Hospitalization.countDocuments({ statut: 'en_cours' }),
      Hospitalization.countDocuments({ statut: 'sorti' }),
      Hospitalization.countDocuments({ statut: 'transfere' }),
      Hospitalization.countDocuments({ statut: 'decede' }),
    ]);
    // Taux d'occupation (lits occupés / total lits)
    const rooms = await Room.find().populate('service', 'nom');
    const totalLits    = rooms.reduce((s, r) => s + (r.lits?.length || 0), 0);
    const litsOccupes  = rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'occupe').length || 0), 0);
    const litsLibres   = totalLits - litsOccupes;
    const taux_occ     = totalLits > 0 ? Math.round(litsOccupes / totalLits * 100) : 0;

    // Aujourd'hui
    const debut = new Date(); debut.setHours(0,0,0,0);
    const fin   = new Date(); fin.setHours(23,59,59,999);
    const aujourd_hui = await Hospitalization.countDocuments({ date_entree: { $gte: debut, $lte: fin } });

    // Sous-phase 5.1 (relecture du 6 sept. 2026) — l'onglet Statistiques
    // (Hospitalization.jsx) affichait "Durée moyenne" (4.8 j), "Taux de
    // réadmission" (3.2%), "Recettes/mois" (2.4M CFA), le graphique
    // "Admissions par mois", "Répartition services", "Taux d'occupation par
    // service" et "Statuts de sortie" TOUS codés en dur. Calculés ici
    // réellement, dans le même endpoit déjà réel (taux_occ ci-dessus).
    const all = await Hospitalization.find()
      .select('patient date_entree date_sortie statut etat_patient service service_nom cout_total')
      .populate('service', 'nom')
      .lean();

    // Durée moyenne réelle des séjours terminés (date_sortie réellement posée).
    const termines = all.filter(h => h.date_sortie);
    const duree_moyenne_jours = termines.length
      ? parseFloat((termines.reduce((s, h) => s + (new Date(h.date_sortie) - new Date(h.date_entree)) / 86400000, 0) / termines.length).toFixed(1))
      : null;

    // Taux de réadmission réel sur 30 jours : pour chaque patient ayant
    // plusieurs séjours, un séjour est une "réadmission" si son
    // date_entree suit de <= 30 jours le date_sortie du séjour précédent du
    // même patient. Jamais un taux inventé — null si aucun patient n'a plus
    // d'un séjour terminé (rien à comparer).
    const parPatient = {};
    all.forEach(h => { if (h.patient) (parPatient[h.patient] ||= []).push(h); });
    let readmissions = 0, eligibles = 0;
    Object.values(parPatient).forEach(sejours => {
      sejours.sort((a, b) => new Date(a.date_entree) - new Date(b.date_entree));
      for (let i = 1; i < sejours.length; i++) {
        if (!sejours[i - 1].date_sortie) continue; // séjour précédent encore en cours, pas comparable
        eligibles++;
        const ecartJours = (new Date(sejours[i].date_entree) - new Date(sejours[i - 1].date_sortie)) / 86400000;
        if (ecartJours >= 0 && ecartJours <= 30) readmissions++;
      }
    });
    const taux_readmission = eligibles > 0 ? Math.round((readmissions / eligibles) * 1000) / 10 : null;

    // Recettes réelles du mois — cout_total réellement finalisé (posé à la
    // sortie, discharge()) pour les séjours sortis ce mois-ci.
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    const recettes_mois = all
      .filter(h => h.date_sortie && new Date(h.date_sortie) >= debutMois && (h.cout_total || 0) > 0)
      .reduce((s, h) => s + h.cout_total, 0);

    // Admissions par mois (12 derniers mois réels, par date_entree).
    const now = new Date();
    const moisLabels = [], admissions_par_mois = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      moisLabels.push(d.toLocaleString('fr-FR', { month: 'short' }));
      admissions_par_mois.push(all.filter(h => {
        const de = new Date(h.date_entree);
        return de.getFullYear() === d.getFullYear() && de.getMonth() === d.getMonth();
      }).length);
    }

    // Répartition par service (toutes hospitalisations réelles, nom réel du
    // service — ref peuplée en priorité, sinon le texte libre déjà saisi).
    const parService = {};
    all.forEach(h => {
      const nom = h.service?.nom || h.service_nom;
      if (!nom) return;
      parService[nom] = (parService[nom] || 0) + 1;
    });
    const totalAvecService = Object.values(parService).reduce((s, n) => s + n, 0);
    const repartition_services = Object.entries(parService)
      .sort((a, b) => b[1] - a[1])
      .map(([nom, n]) => ({ nom, pct: totalAvecService ? Math.round((n / totalAvecService) * 100) : 0 }));

    // Taux d'occupation par service réel (Room.service réel, lits réels).
    const occParService = {};
    rooms.forEach(r => {
      const nom = r.service?.nom;
      if (!nom) return;
      occParService[nom] ||= { total: 0, occupes: 0 };
      occParService[nom].total += (r.lits?.length || 0);
      occParService[nom].occupes += (r.lits?.filter(l => l.statut === 'occupe').length || 0);
    });
    const occupation_par_service = Object.entries(occParService)
      .filter(([, v]) => v.total > 0)
      .map(([nom, v]) => ({ nom, pct: Math.round((v.occupes / v.total) * 100) }))
      .sort((a, b) => b.pct - a.pct);

    // Statuts de sortie réels (etat_patient réellement saisi à la sortie).
    const parEtat = {};
    all.forEach(h => { if (h.etat_patient) parEtat[h.etat_patient] = (parEtat[h.etat_patient] || 0) + 1; });
    const totalAvecEtat = Object.values(parEtat).reduce((s, n) => s + n, 0);
    const statuts_sortie = Object.entries(parEtat).map(([etat, n]) => ({ etat, pct: totalAvecEtat ? Math.round((n / totalAvecEtat) * 100) : 0 }));

    res.json({ success: true, stats: {
      total, en_cours, sortis, transferes, decedes, taux_occ, totalLits, litsOccupes, litsLibres, aujourd_hui,
      duree_moyenne_jours, taux_readmission, recettes_mois,
      admissions_par_mois: { labels: moisLabels, data: admissions_par_mois },
      repartition_services, occupation_par_service, statuts_sortie,
    } });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, statut, patient, q } = req.query;
    const filter = {};
    if (statut)  filter.statut  = statut;
    if (patient) filter.patient = patient;
    const total = await Hospitalization.countDocuments(filter);
    const hospitalizations = await paginate(
      Hospitalization.find(filter)
        .populate('patient', 'nom prenom numero_dossier date_naissance telephone email')
        .populate('medecin_responsable', 'nom prenom specialite')
        .populate('chambre', 'numero type batiment')
        .sort('-date_entree'),
      page, limit
    );
    res.json({ success: true, total, hospitalizations });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // ── Normalisation des champs du formulaire ──────────────────
    const isObjectId = v => /^[a-f\d]{24}$/i.test(v);

    const patient          = req.body.patient || req.body.patient_id;
    const motif_entree     = req.body.motif_entree || req.body.motif;
    const lit_numero       = req.body.lit_numero   || req.body.lit;
    const chambreRaw       = req.body.chambre;

    if (!patient)      return res.status(400).json({ success: false, message: 'Patient obligatoire.' });
    if (!motif_entree) return res.status(400).json({ success: false, message: 'Motif d\'hospitalisation obligatoire.' });

    // ADR-0005 — workflow complet Urgences → Hospitalisation (remplace
    // l'option 2 du ticket 0018) : lien vers le passage aux urgences
    // toujours posé par une action humaine explicite ("Préparer
    // l'admission"), jamais automatique à la seule pose de
    // Urgence.decision='hospitalisation'. Une seule hospitalisation active
    // par passage aux urgences — empêche une double admission par erreur
    // (ex. double clic, deux membres du personnel) pour le même épisode.
    let urgence_id;
    if (req.body.urgence_id) {
      const urgenceExiste = await Urgence.findById(req.body.urgence_id).select('_id');
      if (!urgenceExiste) return res.status(400).json({ success: false, message: 'Dossier urgences introuvable pour la référence fournie.' });
      const dejaHospitalise = await Hospitalization.findOne({ urgence_id: req.body.urgence_id, statut: 'en_cours' }).select('_id');
      if (dejaHospitalise) return res.status(409).json({ success: false, message: 'Une hospitalisation est déjà en cours pour ce passage aux urgences.' });
      urgence_id = req.body.urgence_id;
    }

    // ── Médecin responsable ─────────────────────────────────────
    let medecin_responsable = null;
    let medecin_nom         = req.body.medecin || req.body.medecin_nom || '';
    if (req.body.medecin_responsable && isObjectId(req.body.medecin_responsable)) {
      medecin_responsable = req.body.medecin_responsable;
    } else {
      // Fallback : médecin connecté
      medecin_responsable = req.user._id;
      if (!medecin_nom) medecin_nom = `${req.user.prenom || ''} ${req.user.nom || ''}`.trim();
    }

    // ── Service ────────────────────────────────────────────────
    let service     = null;
    let service_nom = req.body.service_nom || '';
    if (req.body.service && isObjectId(req.body.service)) {
      service = req.body.service;
    } else {
      service_nom = req.body.service || service_nom;
    }

    // ── Chambre et lit ─────────────────────────────────────────
    let chambre     = null;
    let chambre_num = chambreRaw || '';
    let room        = null;

    if (chambreRaw && isObjectId(chambreRaw)) {
      // AUDIT-P7-5 — l'ancienne séquence (findById → vérifier bed.statut en
      // mémoire → room.save()) laissait une fenêtre entre la lecture et
      // l'écriture : deux admissions concurrentes sur le même lit libre
      // pouvaient toutes les deux lire statut:'libre' avant que la première
      // n'ait sauvegardé, aboutissant à une double occupation. Remplacé par
      // un findOneAndUpdate atomique filtré sur lits.statut:'libre' au
      // niveau de la requête elle-même : Mongo ne peut matcher/modifier
      // qu'un seul des deux appels concurrents, l'autre reçoit 0 document
      // modifié et un échec explicite, pas un succès silencieux erroné.
      if (!lit_numero) return res.status(400).json({ success: false, message: 'Numéro de lit obligatoire si une chambre est sélectionnée.' });
      room = await Room.findOneAndUpdate(
        { _id: chambreRaw, lits: { $elemMatch: { numero: lit_numero, statut: 'libre' } } },
        { $set: { 'lits.$[bed].statut': 'occupe', 'lits.$[bed].patient_actuel': patient } },
        { new: true, arrayFilters: [{ 'bed.numero': lit_numero }] }
      );
      if (!room) {
        const exists = await Room.findOne({ _id: chambreRaw, 'lits.numero': lit_numero }).select('lits.$');
        const message = exists
          ? `Le lit ${lit_numero} n'est plus disponible (${exists.lits[0].statut}).`
          : 'Chambre ou lit introuvable.';
        return res.status(exists ? 409 : 404).json({ success: false, message });
      }
      chambre     = chambreRaw;
      chambre_num = room.numero || chambreRaw;
    }

    const payload = {
      patient,
      urgence_id,
      motif_entree,
      lit_numero,
      chambre,
      chambre_num,
      medecin_responsable,
      medecin_nom,
      service,
      service_nom,
      diagnostic_entree: req.body.diagnostic_entree,
      date_entree:       req.body.date_admission || req.body.date_entree,
      provenance:        req.body.provenance,
      type_chambre:      req.body.type_chambre,
      batiment:          req.body.batiment,
      contact_urgence:   req.body.contact_urgence,
      tel_urgence:       req.body.tel_urgence,
      created_by:        req.user._id,
    };

    const hosp = await Hospitalization.create(payload);

    // ADR-0005 — clôt le suivi du workflow côté dossier urgences : le
    // personnel consultant ce dossier voit que la préparation d'admission a
    // bien abouti à une hospitalisation réelle, pas seulement à une
    // décision en attente.
    if (urgence_id) {
      await Urgence.findByIdAndUpdate(urgence_id, { admission_status: 'terminee' });
    }

    // Peupler pour la réponse
    await hosp.populate('patient', 'nom prenom numero_dossier date_naissance telephone email');
    await hosp.populate('medecin_responsable', 'nom prenom specialite');
    await hosp.populate('chambre', 'numero type batiment');

    // ── Notification au patient ───────────────────────────────
    const pat = await require('../models/Patient').findById(patient).select('nom prenom email');
    if (pat?.email) {
      const userPatient = await User.findOne({ email: pat.email, role: 'patient' });
      if (userPatient) {
        await createNotification({
          destinataire: userPatient._id,
          type:    'info',
          titre:   'Admission hospitalière confirmée',
          message: `Vous avez été admis(e) à la Clinique Canadienne de Souanké. Chambre : ${chambre_num || chambre}, Lit : ${lit_numero}. Motif : ${motif_entree}`,
          lien:    '/portal',
          priorite:'haute',
        });
      }
    }

    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, message: `Admission ${pat?.prenom} ${pat?.nom} — Lit ${lit_numero}` });
    emitActivity({ module: 'hospitalization', action: 'Nouvelle admission', detail: `${pat?.prenom || ''} ${pat?.nom || ''} — Lit ${lit_numero}`, icon: '🛏️', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.status(201).json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — patient identifie le séjour ; aucun formulaire
// d'édition (dossier, adresse, changement de chambre, sortie) ne le
// réassigne. runValidators activé (désactivé jusqu'ici sans raison
// documentée) pour que statut/etat_patient respectent leurs enums.
const HOSP_BLOCKED_FIELDS = ['patient'];

exports.update = async (req, res, next) => {
  try {
    const avant = await Hospitalization.findById(req.params.id);
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!HOSP_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const hosp = await Hospitalization.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('patient', 'nom prenom numero_dossier')
      .populate('medecin_responsable', 'nom prenom')
      .populate('chambre', 'numero type');
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, avant, apres: hosp });
    emitDashboardUpdate();
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

exports.addNote = async (req, res, next) => {
  try {
    const hosp = await Hospitalization.findById(req.params.id);
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
    hosp.notes_cliniques.push({ ...req.body, auteur: req.user._id });
    await hosp.save();
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, message: 'Note clinique ajoutée' });
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

// P7-2 — sous-ressources du dossier de séjour (constantes, traitements,
// examens, visites, prescriptions saisies en cours de séjour). Même schéma
// GET (liste triée -date desc) / POST (push + save + logAction) pour les 5,
// sur le modèle de addNote ci-dessus — fabriqué une fois pour éviter de
// dupliquer 5 fois la même mécanique.
// field  : nom du tableau sur HospitalizationSchema
// singular/plural : clés de la réponse JSON (POST retourne { [singular]: item },
//   GET retourne { [plural]: [...] }) — alignées sur ce que le frontend lit déjà
//   (data.constante/data.constantes, data.traitement/data.traitements, etc.)
function makeSubResource(field, singular, plural, { withAuteur = false, updatableFields = null } = {}) {
  return {
    get: async (req, res, next) => {
      try {
        const hosp = await Hospitalization.findById(req.params.id).select(field).lean();
        if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
        const items = [...(hosp[field] || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, [plural]: items });
      } catch (err) { next(err); }
    },
    add: async (req, res, next) => {
      try {
        const hosp = await Hospitalization.findById(req.params.id);
        if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
        const entry = { ...req.body, date: req.body.date || new Date() };
        if (withAuteur) entry.auteur = req.user._id;
        hosp[field].push(entry);
        await hosp.save();
        const created = hosp[field][hosp[field].length - 1];
        await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, message: `${singular} ajouté(e) au dossier de séjour` });
        res.status(201).json({ success: true, [singular]: created });
      } catch (err) { next(err); }
    },
    // Correction 3 (relecture du 6 sept. 2026, FE-BUG-005) — "Valider
    // traitement"/"Saisir résultat examen" (Hospitalization.jsx) ne
    // mettaient à jour que l'état React local (setTraitements/setExamens) :
    // aucune route ne permettait de modifier un élément déjà ajouté, la
    // saisie était donc perdue au rechargement. updatableFields limite
    // explicitement ce qu'un client peut réassigner sur un sous-document
    // déjà créé (jamais `date`/`personnel` a posteriori, par exemple).
    update: updatableFields ? async (req, res, next) => {
      try {
        const hosp = await Hospitalization.findById(req.params.id);
        if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
        const item = hosp[field].id(req.params.sid);
        if (!item) return res.status(404).json({ success: false, message: `${singular.charAt(0).toUpperCase()}${singular.slice(1)} introuvable.` });
        for (const k of updatableFields) {
          if (Object.prototype.hasOwnProperty.call(req.body || {}, k)) item[k] = req.body[k];
        }
        await hosp.save();
        await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, message: `${singular} mis à jour dans le dossier de séjour` });
        res.json({ success: true, [singular]: item });
      } catch (err) { next(err); }
    } : undefined,
  };
}

const constanteRes    = makeSubResource('constantes', 'constante', 'constantes', { withAuteur: true });
const traitementRes   = makeSubResource('traitements', 'traitement', 'traitements', { updatableFields: ['statut'] });
const examenRes       = makeSubResource('examens', 'examen', 'examens', { updatableFields: ['statut', 'resultat'] });
const visiteRes       = makeSubResource('visites', 'visite', 'visites');
const prescriptionRes = makeSubResource('prescriptions_sejour', 'prescription', 'prescriptions');

exports.getConstantes          = constanteRes.get;
exports.addConstante           = constanteRes.add;
exports.getTraitements         = traitementRes.get;
exports.addTraitement          = traitementRes.add;
exports.updateTraitement       = traitementRes.update;
exports.getExamens             = examenRes.get;
exports.addExamen              = examenRes.add;
exports.updateExamen           = examenRes.update;
exports.getVisites             = visiteRes.get;
exports.addVisite              = visiteRes.add;
exports.getPrescriptionsSejour = prescriptionRes.get;
exports.addPrescriptionSejour  = prescriptionRes.add;

// AUDIT-11-9 — discharge() fusionnait req.body sans liste blanche (un client
// pouvait réassigner le séjour à un autre patient, contrairement à update()
// qui bloque déjà ce cas) et ne vérifiait jamais le statut courant avant la
// transition : un second appel sur un dossier déjà sorti/transféré/décédé
// écrasait silencieusement date_sortie (avec l'heure de CE second appel),
// corrompant la seule vraie source de vérité de la date de sortie. Corrigé
// avec le même principe déjà établi ailleurs dans ce fichier (admission,
// libération de lit) et dans finance.controller.js::addPayment : la garde
// (statut encore 'en_cours') fait partie du filtre du findOneAndUpdate
// atomique lui-même, jamais une vérification séparée avant l'écriture — deux
// appels concurrents (double-clic, ou deux membres du personnel) ne peuvent
// plus tous deux passer.
const DISCHARGE_STATUT_MESSAGES = {
  sorti: 'Ce séjour a déjà été clôturé — une sortie a déjà été enregistrée.',
  transfere: 'Ce séjour est déjà marqué comme transféré.',
  decede: 'Ce séjour est déjà marqué comme décédé.',
};

exports.discharge = async (req, res, next) => {
  try {
    const avant = await Hospitalization.findById(req.params.id);
    if (!avant) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });

    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!HOSP_BLOCKED_FIELDS.includes(k)) data[k] = v; }

    const hosp = await Hospitalization.findOneAndUpdate(
      { _id: req.params.id, statut: 'en_cours' },
      { ...data, statut: 'sorti', date_sortie: new Date() },
      { new: true, runValidators: true }
    ).populate('chambre');
    if (!hosp) {
      return res.status(409).json({ success: false, message: DISCHARGE_STATUT_MESSAGES[avant.statut] || `Ce séjour n'est plus en cours (statut actuel : ${avant.statut}).` });
    }

    // Free the bed — uniquement si le séjour référence une chambre structurée
    // (un séjour peut avoir été admis avec une simple chambre_num en texte libre,
    // auquel cas hosp.chambre est null et il n'y a pas de lit à libérer).
    // AUDIT-2.1 — l'ancienne séquence (findById → modifier le lit en mémoire →
    // room.save()) réécrit le document Room entier : deux sorties concurrentes
    // sur des lits différents de la MÊME chambre pouvaient s'écraser
    // mutuellement (la seconde sauvegarde, basée sur une lecture antérieure à
    // la première, annule silencieusement la libération déjà faite par la
    // première). Remplacé par le même motif atomique que l'admission
    // (AUDIT-P7-5, ligne ~107 plus haut) : mise à jour ciblée du sous-document
    // via arrayFilters, jamais de réécriture du tableau lits complet.
    if (hosp.chambre?._id) {
      await Room.findOneAndUpdate(
        { _id: hosp.chambre._id, 'lits.numero': hosp.lit_numero },
        { $set: { 'lits.$[bed].statut': 'libre' }, $unset: { 'lits.$[bed].patient_actuel': '' } },
        { arrayFilters: [{ 'bed.numero': hosp.lit_numero }] }
      );
    }
    // Notification patient à la sortie
    const pat = await require('../models/Patient').findById(hosp.patient).select('nom prenom email');
    if (pat?.email) {
      const userPatient = await User.findOne({ email: pat.email, role: 'patient' });
      if (userPatient) {
        await createNotification({
          destinataire: userPatient._id,
          type:    'success',
          titre:   'Sortie de l\'hôpital confirmée',
          message: `Votre sortie de la Clinique Canadienne a été enregistrée. Nous vous souhaitons un prompt rétablissement. N'oubliez pas votre rendez-vous de contrôle.`,
          lien:    '/portal',
          priorite:'normale',
        });
      }
    }
    // FLOW-002 (audit du 4 sept. 2026) — aucun contrôleur clinique ne créait
    // de Invoice à la sortie : l'onglet "Facturation" de Hospitalization.jsx
    // calculait un montant côté client (tarifs + ratio de paiement fixes
    // arbitraires), sans lien réel avec le module Finance. Lien réel posé
    // ici, à partir de hosp.cout_total (champ réel du schéma) — jamais un
    // tarif journalier ou un ratio inventés ici.
    //
    // Correction A (relecture du 5 sept. 2026) — hosp.cout_total n'était
    // alimenté par aucun mécanisme réel (ni saisie, ni calcul). Une vraie
    // source de tarif existait déjà ailleurs dans le schéma, vérifiée avant
    // d'en inventer une : Room.lits[].prix_par_jour, un tarif journalier réel
    // par lit (8000 à 45000 CFA selon type/service dans les données réelles,
    // cf. utils/seed.js), déjà branché sur un vrai sélecteur chambre→lit à
    // l'admission (AUDIT-P7-5, Hospitalization.jsx::loadLits) — hosp.chambre
    // et hosp.lit_numero référencent donc un vrai lit dans le cas normal.
    // Si aucun cout_total réel n'a été saisi manuellement (nouveau champ
    // optionnel du formulaire de sortie, transmis tel quel via ce même
    // endpoint), il est calculé ici : tarif journalier réel du lit occupé ×
    // durée réelle du séjour (date_sortie − date_entree, arrondie au jour
    // supérieur, minimum 1). Persisté sur hosp.cout_total pour que la facture
    // et le dossier restent cohérents à la relecture.
    // LIMITE qui subsiste, documentée plutôt que masquée : un séjour admis
    // avec une chambre en texte libre (hosp.chambre non renseigné — cas
    // encore possible, ex. saisie historique ou admission d'urgence sans
    // attribution de lit) n'a aucune source de tarif réelle ; cout_total y
    // reste à 0 et aucune facture n'est générée (garde ci-dessous), plutôt
    // que d'inventer un tarif par défaut.
    if (!(Number(hosp.cout_total) > 0) && hosp.chambre?.lits?.length && hosp.lit_numero) {
      const bed = hosp.chambre.lits.find(l => l.numero === hosp.lit_numero);
      if (bed && Number(bed.prix_par_jour) > 0) {
        const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
        const dureeJours = Math.max(1, Math.ceil((hosp.date_sortie - hosp.date_entree) / MS_PAR_JOUR));
        hosp.cout_total = bed.prix_par_jour * dureeJours;
        hosp.cout_detail = `${dureeJours} jour(s) × ${bed.prix_par_jour} CFA (lit ${bed.numero}, tarif réel)`;
        await hosp.save();
      }
    }
    let factureGeneree = null;
    const coutTotal = Number(hosp.cout_total) || 0;
    if (coutTotal > 0) {
      factureGeneree = await Invoice.create({
        patient: hosp.patient,
        patient_nom: pat ? `${pat.prenom} ${pat.nom}`.trim() : undefined,
        service_label: 'Hospitalisation',
        hospitalisation: hosp._id,
        created_by: req.user._id,
        lignes: [{
          libelle: `Séjour hospitalier${hosp.service_nom ? ` — ${hosp.service_nom}` : ''}${hosp.cout_detail ? ` (${hosp.cout_detail})` : ''}`,
          categorie: 'hospitalisation', prix_unitaire: coutTotal, quantite: 1, montant: coutTotal,
        }],
        montant_ht: coutTotal,
        montant_ttc: coutTotal,
      });
      await logAction({
        utilisateur: req.user._id, action: 'CREATE', module: 'finance',
        entite_id: factureGeneree._id, ip: req.ip,
        message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la sortie du séjour ${hosp._id}`,
      });
    }

    await logAction({ utilisateur: req.user._id, action: 'DISCHARGE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, avant, apres: hosp });
    emitActivity({ module: 'hospitalization', action: 'Sortie patient', detail: `${pat?.prenom || ''} ${pat?.nom || ''}`, icon: '🚪', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, hospitalization: hosp, invoice: factureGeneree });
  } catch (err) { next(err); }
};

// ── GET /:id/facture ───────────────────────────────────────────────────────
// Sous-phase 5.2 (suite) — l'onglet "Facturation" de Hospitalization.jsx
// calculait un montant entièrement fabriqué côté client (prixChambre
// {standard:15000, privee:35000, vip:75000}, frais de consultation fixe à
// 25000, actes à un prix unitaire inventé, et paye = totalF*0.65, un taux de
// paiement fictif), jamais lié à la vraie Invoice que discharge() (ci-dessus)
// crée réellement à la sortie via Invoice.hospitalisation (champ dédié posé
// par FLOW-002, distinct du couple source_module/source_id générique utilisé
// par chirurgie/urgences/blocoperatoire). Même principe que Correction 2
// (Blocoperatoire/Chirurgie/Urgences) : n'invente jamais de facture, expose
// uniquement la vraie facture si la sortie l'a déjà générée.
// Pour un séjour encore en cours (donc sans facture — discharge() est le seul
// mécanisme qui en crée une), retourne à la place une estimation calculée
// avec exactement la même formule réelle que discharge() (tarif réel du lit
// occupé × durée réelle écoulée, Room.lits[].prix_par_jour), jamais un tarif
// ou un ratio inventés — clairement distinguée d'une facture (jamais un
// numero_facture, jamais persistée).
exports.getFacture = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ hospitalisation: req.params.id });
    if (invoice) return res.json({ success: true, invoice, estimation: null });

    const hosp = await Hospitalization.findById(req.params.id).populate('chambre');
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });

    let estimation = null;
    if (hosp.statut === 'en_cours' && hosp.chambre?.lits?.length && hosp.lit_numero) {
      const bed = hosp.chambre.lits.find(l => l.numero === hosp.lit_numero);
      if (bed && Number(bed.prix_par_jour) > 0) {
        const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
        const dureeJours = Math.max(1, Math.ceil((Date.now() - hosp.date_entree) / MS_PAR_JOUR));
        estimation = {
          tarif_jour: bed.prix_par_jour, jours: dureeJours,
          montant: bed.prix_par_jour * dureeJours, lit: bed.numero,
        };
      }
    }
    res.json({ success: true, invoice: null, estimation });
  } catch (err) { next(err); }
};
