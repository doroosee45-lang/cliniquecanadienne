const DossierChirurgical = require('../models/DossierChirurgical');
const Patient = require('../models/Patient');
const User    = require('../models/User');
const { logAction, escapeRegex } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { nextSequence } = require('../utils/counter');

// Salles du bloc opératoire (configuration statique)
const SALLES_BLOC = [
  { id: 'BO-1', nom: 'Salle 1 — Chirurgie générale',   type: 'generale',   capacite: 1 },
  { id: 'BO-2', nom: 'Salle 2 — Orthopédie',           type: 'orthopedie', capacite: 1 },
  { id: 'BO-3', nom: 'Salle 3 — Urgences / Polyvalent', type: 'urgences',  capacite: 1 },
];

// Mapping statut frontend → modèle
function toModelStatut(s) {
  const map = { programmee:'preoperatoire', en_cours:'opere', terminee:'opere', reveil:'suivi_postop', annulee:'consultation' };
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
    const [auj, urgences] = await Promise.all([
      DossierChirurgical.countDocuments({ date_intervention_prev: { $gte: today, $lt: demain }, statut: { $in: ['preoperatoire','opere'] } }),
      DossierChirurgical.countDocuments({ niveau_urgence: { $in: ['urgent','urgence_absolue'] }, statut: 'preoperatoire' }),
    ]);

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
        terminees:    0,
        reveil:       planning.filter(p => p.statut === 'suivi_postop').length,
      },
    });
  } catch (err) { next(err); }
};

// ── POST / — Créer une intervention (depuis patient ou dossier_id) ────────────
exports.createIntervention = async (req, res, next) => {
  try {
    const { patient: patient_id, dossier_id, salle, date_heure_op, type_intervention,
            niveau_urgence, chirurgien, chirurgien_id, diagnostic_preop,
            duree_estimee, statut = 'preoperatoire', assistant, anesthesiste,
            infirmier_instru, infirmier_circu, notes } = req.body;

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

    // Champs planning
    if (salle)            dossier.salle_prevue            = salle;
    if (date_heure_op)    dossier.date_intervention_prev  = new Date(date_heure_op);
    if (type_intervention)dossier.type_intervention       = type_intervention;
    if (duree_estimee)    dossier.duree_intervention_min  = duree_estimee;
    if (chirurgien_id)    dossier.chirurgien_id            = chirurgien_id;
    if (diagnostic_preop) dossier.diagnostic_chirurgical  = diagnostic_preop;
    if (notes)            dossier.cr_operatoire            = notes;
    if (assistant)         dossier.assistant               = assistant;
    if (anesthesiste)      dossier.anesthesiste             = anesthesiste;
    if (infirmier_instru)  dossier.infirmier_instru         = infirmier_instru;
    if (infirmier_circu)   dossier.infirmier_circu          = infirmier_circu;

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
exports.saveReveil = async (req, res, next) => {
  try {
    const dossier = await DossierChirurgical.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
    const avant = dossier.toObject();

    const { etat_patient, observations, complications, temperature, tension_sys, tension_dia, pouls } = req.body;
    const reveilNote = `Réveil: état=${etat_patient||'stable'}, T°=${temperature||'—'}, TA=${tension_sys||'—'}/${tension_dia||'—'}, Pouls=${pouls||'—'}. ${observations||''}`;
    dossier.evolution_immediate = reveilNote;
    if (complications && complications.length > 0) {
      dossier.nb_complications += complications.length;
    }
    await dossier.save();
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire', entite_id: dossier._id, ip: req.ip, message: `Réveil enregistré — ${dossier.patient_nom}`, avant, apres: dossier });

    res.json({ success: true, intervention: dossier });
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
      'statut', 'type_intervention', 'duree_intervention_min',
      'cr_operatoire', 'evolution_immediate', 'chirurgien_id', 'niveau_urgence',
    ];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const avant = await DossierChirurgical.findById(req.params.id).lean();
    const dossier = await DossierChirurgical.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    )
      .populate('patient', 'nom prenom')
      .populate('chirurgien_id', 'nom prenom specialite');

    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Intervention mise à jour — ${dossier.patient_nom}`,
      avant, apres: dossier,
    });

    res.json({ success: true, intervention: dossier });
  } catch (err) { next(err); }
};
