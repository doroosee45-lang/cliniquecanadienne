const DossierChirurgical = require('../models/DossierChirurgical');
const Patient = require('../models/Patient');
const User    = require('../models/User');
const Invoice = require('../models/Invoice');
const MaterielMedical = require('../models/MaterielMedical');
const { logAction, escapeRegex } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { nextSequence } = require('../utils/counter');

// Correction 2 (module 6/6, relecture du 6 sept. 2026) — LIMITE DOCUMENTÉE,
// même constat que Chirurgie (Correction 2/5) : aucun catalogue tarifaire
// réel n'existe dans ce système pour les actes de bloc opératoire (salle,
// honoraires, consommables, anesthésie) — DossierChirurgical ne porte aucun
// champ tarifaire réel, seulement du texte libre. Génère automatiquement
// une facture ici obligerait à inventer un prix, exclu par ce chantier.
// Expose uniquement une Invoice réelle si le personnel de facturation en a
// créé une manuellement via le module Finance, en la liant à cette
// intervention (source_module:'blocoperatoire' — distinct de 'chirurgie'
// pour permettre de facturer séparément le volet bloc opératoire du volet
// consultation/suivi chirurgical du même dossier).
// GET /blocoperatoire/:id/facture
exports.getFacture = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ source_module: 'blocoperatoire', source_id: req.params.id });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

// Salles du bloc opératoire (configuration statique)
const SALLES_BLOC = [
  { id: 'BO-1', nom: 'Salle 1 — Chirurgie générale',   type: 'generale',   capacite: 1 },
  { id: 'BO-2', nom: 'Salle 2 — Orthopédie',           type: 'orthopedie', capacite: 1 },
  { id: 'BO-3', nom: 'Salle 3 — Urgences / Polyvalent', type: 'urgences',  capacite: 1 },
];

// Mapping statut frontend → modèle
// Sous-phase 5.1 (relecture du 6 sept. 2026) — 'terminee' pointait vers
// 'opere', exactement comme 'en_cours' : sélectionner "Terminée" dans
// Blocoperatoire.jsx ne produisait donc jamais d'état réellement distinct
// d'"En cours" en base, ce qui obligeait getPlanning() à figer
// stats.terminees à 0 (aucune requête ne pouvait jamais la calculer,
// l'enum réel du modèle n'ayant que 'cloture' comme état final distinct,
// jusqu'ici jamais utilisé par ce mapping). 'preparation' n'a quant à lui
// jamais eu d'entrée ici : sélectionné dans le formulaire (STATUT_BO),
// il retombait sur l'identité 'preparation', une valeur absente de l'enum
// du modèle — runValidators (findByIdAndUpdate) rejetait alors la
// sauvegarde en erreur 500. Fixé en le faisant pointer vers 'preoperatoire'
// (aucun signal réel ne distingue "en préparation" de "programmée" dans ce
// schéma ; l'option a été retirée des menus déroulants côté frontend
// plutôt que de laisser un état fictif "en préparation" qui n'existerait
// jamais réellement en base).
function toModelStatut(s) {
  const map = { programmee:'preoperatoire', preparation:'preoperatoire', en_cours:'opere', terminee:'cloture', reveil:'suivi_postop', annulee:'consultation' };
  return map[s] || s;
}

// AUDIT-2.1 — factorisé sur le modèle de utils/helpers.js::checkAppointmentConflict :
// aucune détection de conflit de salle/créneau n'existait jusqu'ici, deux
// interventions pouvaient être programmées dans la même salle au même
// moment. Ne s'applique qu'aux dossiers réellement occupant la salle
// (preoperatoire/opere) — un dossier clôturé/annulé ne bloque plus le
// créneau.
async function checkBlocConflict({ salle, date_intervention_prev, duree_intervention_min = 60, excludeId }) {
  if (!salle || !date_intervention_prev) return null;
  const start = new Date(date_intervention_prev);
  const end = new Date(start.getTime() + (duree_intervention_min || 60) * 60000);
  const filter = {
    salle_prevue: salle,
    statut: { $in: ['preoperatoire', 'opere'] },
    date_intervention_prev: { $lt: end },
    $expr: {
      $gt: [
        { $add: ['$date_intervention_prev', { $multiply: [{ $ifNull: ['$duree_intervention_min', 60] }, 60000] }] },
        start,
      ],
    },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return DossierChirurgical.findOne(filter);
}

// SPEC-05 (correction du 12 sept. 2026, audit indépendant) —
// checkBlocConflict() ci-dessus reste une lecture avant écriture séparée
// (TOCTOU) : deux planifications sur des créneaux DIFFÉRENTS mais qui se
// chevauchent partiellement pouvaient toutes deux la franchir avant que
// l'une n'ait écrit — l'index unique partiel du modèle (salle_prevue +
// date_intervention_prev) ne protège que le créneau EXACT, jamais un
// chevauchement partiel. Même correctif que AUDIT-M-B4 pour les rendez-vous
// (utils/helpers.js::isAppointmentRaceWinner) : écriture optimiste +
// relecture + élimination déterministe. DossierChirurgical porte tout
// l'historique clinique du patient (contrairement à Appointment) : le
// perdant ne doit jamais être supprimé, seulement ses champs de
// planification restaurés à leur état d'avant cet appel — fourni par
// l'appelant (avantPlanning), jamais deviné ici.
async function isBlocRaceWinner(dossierId) {
  const dossier = await DossierChirurgical.findById(dossierId).select('salle_prevue date_intervention_prev duree_intervention_min statut').lean();
  if (!dossier || !dossier.salle_prevue || !dossier.date_intervention_prev || !['preoperatoire', 'opere'].includes(dossier.statut)) return true;
  const start = new Date(dossier.date_intervention_prev);
  const end = new Date(start.getTime() + (dossier.duree_intervention_min || 60) * 60000);
  const overlapping = await DossierChirurgical.find({
    salle_prevue: dossier.salle_prevue,
    statut: { $in: ['preoperatoire', 'opere'] },
    date_intervention_prev: { $lt: end },
    $expr: { $gt: [{ $add: ['$date_intervention_prev', { $multiply: [{ $ifNull: ['$duree_intervention_min', 60] }, 60000] }] }, start] },
  }).select('_id').lean();
  if (overlapping.length <= 1) return true;
  const survivorId = overlapping.reduce((min, o) => (o._id.toString() < min ? o._id.toString() : min), overlapping[0]._id.toString());
  return survivorId === dossierId.toString();
}

// SPEC-05 — restaure un snapshot de champs de planification pour le
// perdant de la course. { salle_prevue: undefined } via $set ne ferait
// RIEN : Mongoose/MongoDB ignorent silencieusement les valeurs undefined
// dans une mise à jour, laissant l'ancienne valeur en place (bogue vérifié
// empiriquement lors de l'écriture de ce correctif). $unset est requis
// pour réellement effacer un champ auparavant renseigné.
async function revertPlanning(dossierId, avantPlanning) {
  const toSet = {};
  const toUnset = {};
  for (const [k, v] of Object.entries(avantPlanning)) {
    if (v === undefined) toUnset[k] = ''; else toSet[k] = v;
  }
  const update = {};
  if (Object.keys(toSet).length)   update.$set   = toSet;
  if (Object.keys(toUnset).length) update.$unset = toUnset;
  await DossierChirurgical.findByIdAndUpdate(dossierId, update);
}

// Numéro d'intervention bloc — compteur atomique (voir chirurgieController.js)
async function generateNumeroBloc() {
  const yr = new Date().getFullYear();
  const seq = await nextSequence(`bloc-${yr}`);
  return `BLOC-${yr}-${String(seq).padStart(4, '0')}`;
}

// ── GET /planning  (ou GET /) ─────────────────────────────────────────────────
exports.getPlanning = async (req, res, next) => {
  try {
    const { date, salle, q, statut, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { statut: { $in: ['preoperatoire', 'opere', 'suivi_postop'] } };

    if (statut) filter.statut = toModelStatut(statut);
    if (salle)  filter.salle_prevue = salle;
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { patient_nom:        { $regex: qRe, $options: 'i' } },
        { type_intervention:  { $regex: qRe, $options: 'i' } },
        { numero:             { $regex: qRe, $options: 'i' } },
      ];
    }
    if (date) {
      const debut = new Date(date); debut.setHours(0, 0, 0, 0);
      const fin   = new Date(date); fin.setHours(23, 59, 59, 999);
      filter.date_intervention_prev = { $gte: debut, $lte: fin };
    }

    const [planning, total] = await Promise.all([
      DossierChirurgical.find(filter)
        .populate('patient',      'nom prenom date_naissance groupe_sanguin numero_dossier')
        .populate('chirurgien_id','nom prenom specialite')
        .sort({ date_intervention_prev: 1, created_at: -1 })
        .skip(skip).limit(parseInt(limit))
        .lean(),
      DossierChirurgical.countDocuments(filter),
    ]);

    // Stats rapides
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const demain = new Date(today); demain.setDate(demain.getDate() + 1);
    const il3Mois = new Date(today); il3Mois.setMonth(il3Mois.getMonth() - 3);
    const il12Mois = new Date(today); il12Mois.setMonth(il12Mois.getMonth() - 11); il12Mois.setDate(1); il12Mois.setHours(0,0,0,0);

    const [
      auj, urgences,
      // Sous-phase 5.1 — "Terminées" (KPI + strip de statut) était figé à 0,
      // faute de tout état modèle réellement distinct pour ce concept avant
      // la correction de toModelStatut() ci-dessus. Réellement compté ici
      // maintenant que 'terminee' (UI) persiste bien 'cloture' (modèle).
      terminees,
      interventionsSur3Mois,
      operes,
      operesAvecComplications,
      cloturesAvecEtat,
      cloturesReussies,
      dureeAgg,
      volumeBrut,
    ] = await Promise.all([
      DossierChirurgical.countDocuments({ date_intervention_prev: { $gte: today, $lt: demain }, statut: { $in: ['preoperatoire','opere'] } }),
      DossierChirurgical.countDocuments({ niveau_urgence: { $in: ['urgent','urgence_absolue'] }, statut: 'preoperatoire' }),
      DossierChirurgical.countDocuments({ statut: 'cloture', updated_at: { $gte: today, $lt: demain } }),
      DossierChirurgical.countDocuments({ date_intervention_prev: { $gte: il3Mois, $lt: demain } }),
      DossierChirurgical.countDocuments({ statut: { $in: ['opere', 'suivi_postop', 'cloture'] } }),
      DossierChirurgical.countDocuments({ statut: { $in: ['opere', 'suivi_postop', 'cloture'] }, nb_complications: { $gt: 0 } }),
      DossierChirurgical.countDocuments({ statut: 'cloture', etat_sortie: { $exists: true, $ne: null } }),
      DossierChirurgical.countDocuments({ statut: 'cloture', etat_sortie: { $in: ['guerison', 'amelioration'] } }),
      DossierChirurgical.aggregate([
        { $match: { salle_entree_at: { $ne: null }, salle_sortie_at: { $ne: null }, $expr: { $gt: ['$salle_sortie_at', '$salle_entree_at'] } } },
        { $group: { _id: null, moyenneMs: { $avg: { $subtract: ['$salle_sortie_at', '$salle_entree_at'] } } } },
      ]),
      // AUDIT-ANALYTICS (Sous-phase 5.1) — "Volume opératoire — 12 mois"
      // (Dashboard ET onglet Stats) était un chartData=[3,5,4,7,...] codé en
      // dur. type_intervention étant renseigné dès la création (créée ou
      // programmée au bloc), on compte réellement toute intervention ayant
      // atteint le bloc (date_intervention_prev renseignée), tous statuts
      // confondus (y compris annulée/clôturée), sur les 12 derniers mois.
      DossierChirurgical.find({ date_intervention_prev: { $gte: il12Mois } }).select('date_intervention_prev').lean(),
    ]);

    const dureeMoyenneMin = dureeAgg[0] ? Math.round(dureeAgg[0].moyenneMs / 60000) : 0;
    const tauxComplications = operes > 0 ? Math.round((operesAvecComplications / operes) * 1000) / 10 : 0;
    const tauxSucces = cloturesAvecEtat > 0 ? Math.round((cloturesReussies / cloturesAvecEtat) * 100) : 0;

    const parSpecialiteAgg = await DossierChirurgical.aggregate([
      { $match: { specialite: { $nin: [null, ''] } } },
      { $group: { _id: '$specialite', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const parSpecialite = parSpecialiteAgg.map(x => ({ specialite: x._id, nombreInterventions: x.count }));

    const volumeLabels = [];
    const volumeData = new Array(12).fill(0);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      volumeLabels.push(d.toLocaleDateString('fr-FR', { month: 'short' }));
    }
    volumeBrut.forEach(d => {
      const diffMois = (today.getFullYear() - d.date_intervention_prev.getFullYear()) * 12 + (today.getMonth() - d.date_intervention_prev.getMonth());
      const idx = 11 - diffMois;
      if (idx >= 0 && idx < 12) volumeData[idx]++;
    });

    res.json({
      success: true,
      planning,
      interventions: planning,
      total,
      stats: {
        interventions_auj: auj,
        urgences,
        total,
        programmees:  planning.filter(p => p.statut === 'preoperatoire').length,
        en_cours:     planning.filter(p => p.statut === 'opere').length,
        terminees,
        reveil:       planning.filter(p => p.statut === 'suivi_postop').length,
        interventions_mois_moy: Math.round((interventionsSur3Mois / 3) * 10) / 10,
        taux_complications: tauxComplications,
        taux_succes: tauxSucces,
        duree_moyenne_min: dureeMoyenneMin,
        volume_12_mois: { labels: volumeLabels, data: volumeData },
        par_specialite: parSpecialite,
      },
    });
  } catch (err) { next(err); }
};

// ── POST / — Créer une intervention (depuis patient ou dossier_id) ────────────
exports.createIntervention = async (req, res, next) => {
  try {
    const { patient: patient_id, dossier_id, salle, date_heure_op, type_intervention,
            specialite, niveau_urgence, chirurgien, chirurgien_id, diagnostic_preop,
            duree_estimee, statut = 'preoperatoire', assistant, anesthesiste,
            infirmier_instru, infirmier_circu, notes, service_demandeur } = req.body;

    let dossier;

    if (dossier_id) {
      // Programmer un dossier existant
      dossier = await DossierChirurgical.findById(dossier_id);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
    } else {
      // Créer un nouveau dossier chirurgical depuis le bloc
      if (!patient_id) return res.status(400).json({ success: false, message: 'patient requis.' });
      const patient = await Patient.findById(patient_id);
      if (!patient) return res.status(400).json({ success: false, message: 'Patient introuvable.' });

      const chirurgienDoc = chirurgien_id ? await User.findById(chirurgien_id) : null;
      const numero = await generateNumeroBloc();

      dossier = new DossierChirurgical({
        numero,
        patient: patient._id,
        patient_nom: `${patient.prenom} ${patient.nom}`,
        date_naissance: patient.date_naissance,
        sexe: patient.sexe === 'M' ? 'homme' : patient.sexe === 'F' ? 'femme' : 'autre',
        groupe_sanguin: patient.groupe_sanguin,
        allergies: Array.isArray(patient.allergies) ? patient.allergies.join(', ') : (patient.allergies || ''),
        telephone: patient.telephone,
        chirurgien_id: chirurgien_id || null,
        chirurgien_nom: chirurgienDoc ? `Dr. ${chirurgienDoc.prenom} ${chirurgienDoc.nom}` : (chirurgien || null),
        diagnostic_chirurgical: diagnostic_preop || '',
        motif_consultation: diagnostic_preop || type_intervention || '',
        type_intervention: type_intervention || '',
        ia_risque_score: 0,
        ia_risque_niveau: 'faible',
      });
    }

    // SPEC-05 — snapshot des champs de planification AVANT modification, pour
    // pouvoir les restaurer si cette écriture perd la course déterministe
    // ci-dessous (isBlocRaceWinner). Pour un nouveau dossier (branche
    // ci-dessus), ces champs sont simplement absents — "avant" = non planifié.
    const avantPlanning = {
      salle_prevue: dossier.salle_prevue,
      date_intervention_prev: dossier.date_intervention_prev,
      duree_intervention_min: dossier.duree_intervention_min,
      statut: dossier.statut,
    };

    // Champs planning
    if (salle)            dossier.salle_prevue            = salle;
    if (date_heure_op)    dossier.date_intervention_prev  = new Date(date_heure_op);
    if (type_intervention)dossier.type_intervention       = type_intervention;
    if (specialite)        dossier.specialite               = specialite;
    if (duree_estimee)    dossier.duree_intervention_min  = duree_estimee;
    if (chirurgien_id)    dossier.chirurgien_id            = chirurgien_id;
    if (diagnostic_preop) dossier.diagnostic_chirurgical  = diagnostic_preop;
    if (notes)            dossier.cr_operatoire            = notes;
    if (assistant)         dossier.assistant               = assistant;
    if (anesthesiste)      dossier.anesthesiste             = anesthesiste;
    if (infirmier_instru)  dossier.infirmier_instru         = infirmier_instru;
    if (infirmier_circu)   dossier.infirmier_circu          = infirmier_circu;
    if (service_demandeur) dossier.service_demandeur        = service_demandeur;

    const niveauMap = { programmee:'electif', electif:'electif', urgent:'urgent', urgence_absolue:'urgence_absolue' };
    dossier.niveau_urgence = niveauMap[niveau_urgence] || 'electif';
    dossier.statut         = toModelStatut(statut) || 'preoperatoire';

    // AUDIT-2.1 — détection de conflit de salle/créneau, uniquement si ce
    // dossier occupe réellement une salle à une date donnée.
    if (dossier.salle_prevue && dossier.date_intervention_prev && ['preoperatoire','opere'].includes(dossier.statut)) {
      const conflict = await checkBlocConflict({
        salle: dossier.salle_prevue,
        date_intervention_prev: dossier.date_intervention_prev,
        duree_intervention_min: dossier.duree_intervention_min,
        excludeId: dossier._id,
      });
      if (conflict) return res.status(400).json({ success: false, message: `Conflit : la salle ${dossier.salle_prevue} est déjà occupée par une autre intervention à ce créneau.` });
    }

    // AUDIT-2.1 — filet de sécurité atomique (index unique partiel du
    // modèle) : la vérification ci-dessus n'est pas atomique avec l'écriture.
    try {
      await dossier.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Conflit : cette salle vient d\'être réservée par une autre requête à ce créneau. Veuillez réessayer.' });
      throw err;
    }

    // SPEC-05 — élimination déterministe pour un chevauchement PARTIEL
    // (l'index unique ci-dessus ne couvre que le créneau exact). AVANT tout
    // effet de bord (log, Socket.IO, réponse), pour qu'une planification
    // finalement annulée n'ait jamais notifié personne.
    if (!(await isBlocRaceWinner(dossier._id))) {
      await revertPlanning(dossier._id, avantPlanning);
      return res.status(409).json({ success: false, message: 'Conflit : ce créneau chevauche une intervention qui vient d\'être réservée par une autre requête. Veuillez réessayer.' });
    }

    await logAction({
      utilisateur: req.user._id, action: 'CREATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Intervention programmée — ${dossier.patient_nom} — Salle ${salle || '?'}`,
    });
    emitActivity({ module: 'blocoperatoire', action: 'Nouvelle intervention', detail: `${dossier.patient_nom} — ${type_intervention || ''}`, icon: '🔪', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await DossierChirurgical.findById(dossier._id)
      .populate('patient',       'nom prenom date_naissance groupe_sanguin')
      .populate('chirurgien_id', 'nom prenom specialite')
      .lean();

    res.status(201).json({ success: true, intervention: populated });
  } catch (err) { next(err); }
};

// ── POST /:id/cr — Sauvegarder le compte rendu opératoire ─────────────────────
exports.saveCR = async (req, res, next) => {
  try {
    const { diagnostic_postop, resume, cr_detail, recommandations, saignement_ml, materiel_implante, transfusion_ml, incidents } = req.body;
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
    const avant = dossier.toObject();

    if (diagnostic_postop)  dossier.diagnostic_final   = diagnostic_postop;
    if (cr_detail || resume)dossier.cr_operatoire       = cr_detail || resume;
    if (recommandations)    dossier.recommandations     = recommandations;
    if (materiel_implante)  dossier.materiel_implante   = materiel_implante;
    if (saignement_ml !== undefined && saignement_ml !== '')   dossier.saignement_ml   = saignement_ml;
    if (transfusion_ml !== undefined && transfusion_ml !== '') dossier.transfusion_ml  = transfusion_ml;
    if (incidents)          dossier.cr_operatoire       = (dossier.cr_operatoire || '') + '\n\nIncidents: ' + incidents;
    if (dossier.statut === 'opere') dossier.statut = 'suivi_postop';

    await dossier.save();
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire', entite_id: dossier._id, ip: req.ip, message: `CR opératoire enregistré — ${dossier.patient_nom}`, avant, apres: dossier });

    res.json({ success: true, intervention: dossier });
  } catch (err) { next(err); }
};

// ── POST /:id/reveil — Sauvegarder les données de réveil ──────────────────────
// AUDIT-20-3 (18 sept. 2026) — nb_complications était lu puis réécrit
// séparément (+=, dossier.save()) — exactement le même bug déjà trouvé et
// corrigé une fois dans chirurgieController.js::addComplication (SPEC-04),
// réapparu ici via un point d'entrée différent sur le même modèle : deux
// appels saveReveil concurrents sur le même dossier pouvaient tous deux lire
// le même nb_complications de départ, perdant un incrément. $inc atomique,
// dans la MÊME opération que evolution_immediate (jamais une lecture
// séparée) — puis relecture du document réellement mis à jour
// (dossierFinal, via { new: true }) pour que la réponse et le logAction
// reflètent la vraie valeur post-incrément, jamais l'objet en mémoire
// périmé d'avant l'écriture atomique.
exports.saveReveil = async (req, res, next) => {
  try {
    const avant = await DossierChirurgical.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    const { etat_patient, observations, complications, temperature, tension_sys, tension_dia, pouls } = req.body;
    const reveilNote = `Réveil: état=${etat_patient||'stable'}, T°=${temperature||'—'}, TA=${tension_sys||'—'}/${tension_dia||'—'}, Pouls=${pouls||'—'}. ${observations||''}`;
    const nbNouvellesComplications = Array.isArray(complications) ? complications.length : 0;

    const dossierFinal = await DossierChirurgical.findByIdAndUpdate(
      req.params.id,
      {
        $set: { evolution_immediate: reveilNote },
        $inc: { nb_complications: nbNouvellesComplications },
      },
      { new: true }
    );

    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire', entite_id: dossierFinal._id, ip: req.ip, message: `Réveil enregistré — ${dossierFinal.patient_nom}`, avant, apres: dossierFinal });

    res.json({ success: true, intervention: dossierFinal });
  } catch (err) { next(err); }
};

// ── GET /salles ───────────────────────────────────────────────────────────────
// AUDIT-ANALYTICS-P5 — occupation réelle (salle_entree_at renseigné,
// salle_sortie_at vide), remplace l'ancienne heuristique "programmé
// aujourd'hui" (statut+date_intervention_prev), qui ne reflétait pas si une
// salle était RÉELLEMENT occupée au moment de l'appel. Conception validée :
// une salle occupée maintenant = un dossier avec un épisode d'occupation
// ouvert (entrée capturée, sortie pas encore capturée).
exports.getSalles = async (req, res, next) => {
  try {
    const occupees = await DossierChirurgical.find({
      salle_prevue: { $in: SALLES_BLOC.map(s => s.id) },
      salle_entree_at: { $ne: null },
      salle_sortie_at: null,
    }).select('salle_prevue patient_nom type_intervention salle_entree_at').lean();

    const salles = SALLES_BLOC.map(s => {
      const occ = occupees.find(o => o.salle_prevue === s.id);
      return {
        ...s,
        statut:                occ ? 'occupee' : 'disponible',
        intervention_en_cours: occ ? occ.patient_nom : null,
        type:                  occ ? occ.type_intervention : null,
        depuis:                occ ? occ.salle_entree_at : null,
      };
    });

    const salles_occupees = salles.filter(s => s.statut === 'occupee').length;
    res.json({
      success: true,
      salles,
      stats: {
        salles_dispo:    salles.length - salles_occupees,
        salles_occupees,
        taux_occ:        Math.round((salles_occupees / salles.length) * 100),
      },
    });
  } catch (err) { next(err); }
};

// ── PUT /:id/entree-salle — capture réelle du début d'occupation ─────────────
exports.entreeSalle = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
    if (!dossier.salle_prevue) return res.status(400).json({ success: false, message: 'Aucune salle assignée à cette intervention.' });
    if (dossier.salle_entree_at) return res.status(400).json({ success: false, message: 'Cette intervention est déjà entrée en salle.' });

    const avant = dossier.toObject();
    dossier.salle_entree_at = new Date();
    await dossier.save();

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Entrée en salle ${dossier.salle_prevue} — ${dossier.patient_nom}`,
      avant, apres: dossier,
    });
    // REALTIME-SALLES-001 (rapport de clôture du 11 sept. 2026) — c'est ici,
    // pas dans create() (déjà émis ligne ~290), que l'occupation réelle
    // d'une salle change (getSalles() la calcule depuis salle_entree_at/
    // salle_sortie_at). Réutilise le mécanisme Socket.IO déjà existant
    // (dashboard:refresh, déjà écouté par défaut par useRealtimeRefresh sur
    // toutes les pages consommatrices) — aucun second système temps réel.
    emitDashboardUpdate();

    res.json({ success: true, intervention: dossier });
  } catch (err) { next(err); }
};

// ── PUT /:id/sortie-salle — capture réelle de la fin d'occupation ────────────
exports.sortieSalle = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
    if (!dossier.salle_entree_at) return res.status(400).json({ success: false, message: "Cette intervention n'est pas encore entrée en salle." });
    if (dossier.salle_sortie_at) return res.status(400).json({ success: false, message: 'Cette intervention est déjà sortie de salle.' });

    const avant = dossier.toObject();
    dossier.salle_sortie_at = new Date();
    await dossier.save();

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Sortie de salle ${dossier.salle_prevue} — ${dossier.patient_nom}`,
      avant, apres: dossier,
    });
    // REALTIME-SALLES-001 — voir le même commentaire dans entreeSalle().
    emitDashboardUpdate();

    res.json({ success: true, intervention: dossier });
  } catch (err) { next(err); }
};

// ── POST /planning — programmer une intervention au bloc ──────────────────────
exports.scheduleIntervention = async (req, res, next) => {
  try {
    const {
      dossier_id, salle, date_intervention, type_intervention,
      duree_minutes, chirurgien_id, notes,
    } = req.body;

    if (!dossier_id || !salle || !date_intervention)
      return res.status(400).json({ success: false, message: 'dossier_id, salle et date_intervention sont requis.' });

    const dossier = await DossierChirurgical.findById(dossier_id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier chirurgical introuvable.' });
    const avant = dossier.toObject();

    dossier.salle_prevue            = salle;
    dossier.date_intervention_prev  = new Date(date_intervention);
    dossier.statut                  = 'preoperatoire';
    if (type_intervention) dossier.type_intervention     = type_intervention;
    if (duree_minutes)     dossier.duree_intervention_min = duree_minutes;
    if (chirurgien_id)     dossier.chirurgien_id          = chirurgien_id;
    if (notes)             dossier.cr_operatoire          = notes;

    // AUDIT-2.1 — détection de conflit de salle/créneau (voir checkBlocConflict
    // ci-dessus), + filet de sécurité atomique (index unique partiel du modèle)
    // sur l'écriture qui suit, non atomique avec cette vérification.
    const conflict = await checkBlocConflict({
      salle: dossier.salle_prevue,
      date_intervention_prev: dossier.date_intervention_prev,
      duree_intervention_min: dossier.duree_intervention_min,
      excludeId: dossier._id,
    });
    if (conflict) return res.status(400).json({ success: false, message: `Conflit : la salle ${salle} est déjà occupée par une autre intervention à ce créneau.` });

    try {
      await dossier.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Conflit : cette salle vient d\'être réservée par une autre requête à ce créneau. Veuillez réessayer.' });
      throw err;
    }

    // SPEC-05 — même élimination déterministe que createIntervention
    // ci-dessus, pour un chevauchement partiel non couvert par l'index
    // unique. Restaure les champs de planification d'origine (avant),
    // jamais une suppression du dossier (tout son historique clinique).
    if (!(await isBlocRaceWinner(dossier._id))) {
      await revertPlanning(dossier._id, {
        salle_prevue: avant.salle_prevue,
        date_intervention_prev: avant.date_intervention_prev,
        duree_intervention_min: avant.duree_intervention_min,
        statut: avant.statut,
      });
      return res.status(409).json({ success: false, message: 'Conflit : ce créneau chevauche une intervention qui vient d\'être réservée par une autre requête. Veuillez réessayer.' });
    }

    await logAction({
      utilisateur: req.user._id, action: 'CREATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Intervention programmée au bloc — Salle ${salle} — ${dossier.patient_nom}`,
      // Action historiquement étiquetée CREATE, mais programme un dossier
      // chirurgical déjà existant (dossier_id) — une vraie modification de
      // données pré-existantes, donc avant/apres pertinent malgré le label.
      avant, apres: dossier,
    });

    const populated = await DossierChirurgical.findById(dossier._id)
      .populate('patient', 'nom prenom')
      .populate('chirurgien_id', 'nom prenom specialite')
      .lean();

    res.status(201).json({ success: true, intervention: populated });
  } catch (err) { next(err); }
};

// ── PUT /planning/:id — mettre à jour une intervention ────────────────────────
exports.updateIntervention = async (req, res, next) => {
  try {
    const allowed = [
      'salle_prevue', 'date_intervention_prev', 'date_intervention_reelle',
      'statut', 'type_intervention', 'specialite', 'duree_intervention_min',
      'cr_operatoire', 'evolution_immediate', 'chirurgien_id', 'niveau_urgence',
      'service_demandeur',
    ];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    // AUDIT-CRIT-2 — Blocoperatoire.jsx envoie salle/date_heure_op (même
    // convention que createIntervention), jamais salle_prevue/
    // date_intervention_prev : sans cet alias, la liste blanche ci-dessus
    // ignorait silencieusement tout changement de salle/heure à la
    // replanification — seul statut persistait réellement, alors que
    // l'interface affichait un succès optimiste. Traduit ici plutôt que de
    // changer le frontend, pour rester cohérent avec createIntervention qui
    // utilise déjà ces mêmes noms.
    if (req.body.salle !== undefined) update.salle_prevue = req.body.salle || undefined;
    if (req.body.date_heure_op !== undefined) update.date_intervention_prev = req.body.date_heure_op ? new Date(req.body.date_heure_op) : undefined;

    const avant = await DossierChirurgical.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    // AUDIT-C1 (ticket 0022) — updateIntervention appliquait req.body.statut
    // tel quel (vocabulaire UI : programmee/en_cours/reveil/terminee/annulee)
    // au lieu de le traduire vers l'enum réel du modèle via toModelStatut(),
    // comme le fait déjà createIntervention. `annulee` (UI) → 'consultation'
    // (modèle) échouait donc systématiquement en 400 (enum invalide).
    //
    // Règle de transition adoptée par défaut (à valider avec l'équipe
    // clinique — non tranchée dans le ticket) : une annulation ne peut se
    // faire que depuis 'consultation' ou 'preoperatoire', jamais depuis
    // 'opere'/'suivi_postop'/'cloture'. Sans cette garde, traduire
    // aveuglément 'annulee' → 'consultation' ferait régresser une
    // intervention déjà opérée au tout premier statut du parcours — un
    // chirurgien qui clique "Annulée" par erreur sur un dossier déjà
    // clôturé corromprait silencieusement l'historique chirurgical.
    if (update.statut === 'annulee' && !['consultation', 'preoperatoire'].includes(avant.statut)) {
      return res.status(400).json({ success: false, message: "Impossible d'annuler une intervention déjà opérée, en suivi post-opératoire ou clôturée." });
    }
    // ANL-03 — voir DossierChirurgical.js pour le détail : horodatage réel
    // posé ici, seul moyen de distinguer après coup une annulation réelle
    // d'un dossier simplement jamais encore programmé (les deux partagent
    // le même statut modèle 'consultation').
    if (update.statut === 'annulee') update.date_annulation = new Date();
    if (update.statut !== undefined) update.statut = toModelStatut(update.statut);

    // AUDIT-CRIT-2 — même détection de conflit que createIntervention/
    // scheduleIntervention (checkBlocConflict, en tête de fichier), absente
    // ici jusqu'à présent : replanifier une intervention vers une salle/un
    // créneau déjà occupé par une autre n'était jamais vérifié.
    const salleFinale = update.salle_prevue !== undefined ? update.salle_prevue : avant.salle_prevue;
    const dateFinale  = update.date_intervention_prev !== undefined ? update.date_intervention_prev : avant.date_intervention_prev;
    const dureeFinale = update.duree_intervention_min !== undefined ? update.duree_intervention_min : avant.duree_intervention_min;
    const statutFinal = update.statut !== undefined ? update.statut : avant.statut;
    if (salleFinale && dateFinale && ['preoperatoire', 'opere'].includes(statutFinal)) {
      const conflict = await checkBlocConflict({
        salle: salleFinale,
        date_intervention_prev: dateFinale,
        duree_intervention_min: dureeFinale,
        excludeId: req.params.id,
      });
      if (conflict) return res.status(400).json({ success: false, message: `Conflit : la salle ${salleFinale} est déjà occupée par une autre intervention à ce créneau.` });
    }

    let dossier;
    try {
      dossier = await DossierChirurgical.findByIdAndUpdate(
        req.params.id, update, { new: true, runValidators: true }
      )
        .populate('patient', 'nom prenom')
        .populate('chirurgien_id', 'nom prenom specialite');
    } catch (err) {
      // AUDIT-CRIT-2 — même filet de sécurité atomique (index unique partiel
      // du modèle) que createIntervention/scheduleIntervention.
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Conflit : cette salle vient d\'être réservée par une autre requête à ce créneau. Veuillez réessayer.' });
      throw err;
    }

    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    // SPEC-05 — même élimination déterministe que createIntervention/
    // scheduleIntervention ci-dessus, pour un chevauchement partiel non
    // couvert par l'index unique.
    if (!(await isBlocRaceWinner(dossier._id))) {
      await revertPlanning(dossier._id, {
        salle_prevue: avant.salle_prevue,
        date_intervention_prev: avant.date_intervention_prev,
        duree_intervention_min: avant.duree_intervention_min,
        statut: avant.statut,
      });
      return res.status(409).json({ success: false, message: 'Conflit : ce créneau chevauche une intervention qui vient d\'être réservée par une autre requête. Veuillez réessayer.' });
    }

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Intervention mise à jour — ${dossier.patient_nom}`,
      avant, apres: dossier,
    });

    res.json({ success: true, intervention: dossier });
  } catch (err) { next(err); }
};


// ── GET /materiels — catalogue des consommables ──────────────────────────
exports.getMateriels = async (req, res, next) => {
  try {
    const materiels = await MaterielMedical.find().sort('designation').lean();
    res.json({ success: true, materiels });
  } catch (err) { next(err); }
};

// ── POST /:id/materiel — enregistrer une consommation réelle ─────────────
exports.addConsommation = async (req, res, next) => {
  try {
    const { materiel_id, quantite } = req.body;
    if (!materiel_id || !quantite || quantite < 1)
      return res.status(400).json({ success: false, message: 'materiel_id et quantite (\u22651) requis.' });

    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    const materiel = await MaterielMedical.findById(materiel_id);
    if (!materiel) return res.status(404).json({ success: false, message: 'Matériel introuvable.' });
    if (materiel.stock_actuel < quantite)
      return res.status(400).json({ success: false, message: `Stock insuffisant pour ${materiel.designation} (disponible: ${materiel.stock_actuel}).` });

    dossier.materiel_utilise.push({
      materiel: materiel._id, designation: materiel.designation, quantite,
      unite: materiel.unite, utilisateur: req.user._id,
    });
    materiel.stock_actuel -= quantite;
    if (materiel.stock_actuel <= materiel.stock_minimum) materiel.statut = 'rupture';

    await Promise.all([dossier.save(), materiel.save()]);

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Consommation enregistrée — ${materiel.designation} ×${quantite} — ${dossier.patient_nom}`,
    });
    emitDashboardUpdate();

    res.json({ success: true, intervention: dossier, materiel });
  } catch (err) { next(err); }
};

// ── GET /statistiques/consommation — consommation réelle agrégée ─────────
exports.getConsommationStats = async (req, res, next) => {
  try {
    const { startDate, endDate, specialite } = req.query;
    const matchDossier = {};
    if (specialite) matchDossier.specialite = specialite;

    const pipeline = [
      { $match: matchDossier },
      { $unwind: '$materiel_utilise' },
    ];
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);
    if (Object.keys(dateFilter).length) pipeline.push({ $match: { 'materiel_utilise.date': dateFilter } });

    pipeline.push(
      { $group: { _id: '$materiel_utilise.designation', quantite: { $sum: '$materiel_utilise.quantite' } } },
      { $sort: { quantite: -1 } },
    );

    const parMateriel = await DossierChirurgical.aggregate(pipeline);
    const totalConsomme = parMateriel.reduce((s, x) => s + x.quantite, 0);

    res.json({
      success: true,
      data: parMateriel.map(x => ({ materiel: x._id, quantite: x.quantite })),
      total_consomme: totalConsomme,
    });
  } catch (err) { next(err); }
};
