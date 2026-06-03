const DossierChirurgical = require('../models/DossierChirurgical');
const { logAction } = require('../utils/helpers');

// Salles du bloc opératoire (configuration statique)
const SALLES_BLOC = [
  { id: 'BO-1', nom: 'Salle 1 — Chirurgie générale',  type: 'generale',      capacite: 1 },
  { id: 'BO-2', nom: 'Salle 2 — Orthopédie',          type: 'orthopedie',    capacite: 1 },
  { id: 'BO-3', nom: 'Salle 3 — Urgences / Polyvalent',type: 'urgences',     capacite: 1 },
];

// ── GET /planning ─────────────────────────────────────────────────────────────
exports.getPlanning = async (req, res, next) => {
  try {
    const { date, salle } = req.query;

    const filter = { statut: { $in: ['preoperatoire', 'opere'] } };

    // Filtre par date (jour entier)
    if (date) {
      const debut = new Date(date);
      debut.setHours(0, 0, 0, 0);
      const fin = new Date(date);
      fin.setHours(23, 59, 59, 999);
      filter.date_intervention_prev = { $gte: debut, $lte: fin };
    } else {
      // Par défaut : 30 jours glissants
      const debut = new Date();
      debut.setDate(debut.getDate() - 7);
      const fin = new Date();
      fin.setDate(fin.getDate() + 30);
      filter.date_intervention_prev = { $gte: debut, $lte: fin };
    }

    if (salle) filter.salle_prevue = salle;

    const planning = await DossierChirurgical.find(filter)
      .populate('patient_id', 'nom prenom date_naissance groupe_sanguin')
      .populate('chirurgien_id', 'nom prenom specialite')
      .sort('date_intervention_prev')
      .lean();

    // Calcul stats du jour
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const demain = new Date(aujourdhui); demain.setDate(demain.getDate() + 1);

    const [auj, urgences] = await Promise.all([
      DossierChirurgical.countDocuments({
        date_intervention_prev: { $gte: aujourdhui, $lt: demain },
        statut: { $in: ['preoperatoire', 'opere'] },
      }),
      DossierChirurgical.countDocuments({
        niveau_urgence: { $in: ['urgent', 'urgence_absolue'] },
        statut: 'preoperatoire',
      }),
    ]);

    res.json({
      success: true,
      planning,
      stats: { interventions_auj: auj, urgences },
    });
  } catch (err) { next(err); }
};

// ── GET /salles ───────────────────────────────────────────────────────────────
exports.getSalles = async (req, res, next) => {
  try {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const demain = new Date(aujourdhui); demain.setDate(demain.getDate() + 1);

    // Interventions en cours / prévues ce jour par salle
    const interventionsAujourd = await DossierChirurgical.find({
      date_intervention_prev: { $gte: aujourdhui, $lt: demain },
      statut: { $in: ['preoperatoire', 'opere'] },
    }).select('salle_prevue statut patient_nom type_intervention duree_intervention_min').lean();

    const salles = SALLES_BLOC.map(s => {
      const occupee = interventionsAujourd.find(i => i.salle_prevue === s.id);
      return {
        ...s,
        statut:          occupee ? 'occupee' : 'disponible',
        intervention_en_cours: occupee ? occupee.patient_nom : null,
        type:            occupee ? occupee.type_intervention : null,
      };
    });

    res.json({
      success: true,
      salles,
      stats: {
        salles_dispo:   salles.filter(s => s.statut === 'disponible').length,
        salles_occupees: salles.filter(s => s.statut === 'occupee').length,
      },
    });
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

    dossier.salle_prevue            = salle;
    dossier.date_intervention_prev  = new Date(date_intervention);
    dossier.statut                  = 'preoperatoire';
    if (type_intervention) dossier.type_intervention     = type_intervention;
    if (duree_minutes)     dossier.duree_intervention_min = duree_minutes;
    if (chirurgien_id)     dossier.chirurgien_id          = chirurgien_id;
    if (notes)             dossier.cr_operatoire          = notes;

    await dossier.save();

    await logAction({
      utilisateur: req.user._id, action: 'CREATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Intervention programmée au bloc — Salle ${salle} — ${dossier.patient_nom}`,
    });

    const populated = await DossierChirurgical.findById(dossier._id)
      .populate('patient_id', 'nom prenom')
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

    const dossier = await DossierChirurgical.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    )
      .populate('patient_id', 'nom prenom')
      .populate('chirurgien_id', 'nom prenom specialite');

    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'blocoperatoire',
      entite_id: dossier._id, ip: req.ip,
      message: `Intervention mise à jour — ${dossier.patient_nom}`,
    });

    res.json({ success: true, intervention: dossier });
  } catch (err) { next(err); }
};
