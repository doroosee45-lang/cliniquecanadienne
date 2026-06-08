const LabResult = require('../models/LabResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const { logAction, createNotification, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

exports.getStats = async (req, res, next) => {
  try {
    const [total, en_attente, en_cours, valides, critiques] = await Promise.all([
      LabResult.countDocuments(),
      LabResult.countDocuments({ statut: { $in: ['prescrit', 'en_attente'] } }),
      LabResult.countDocuments({ statut: { $in: ['en_cours', 'preleve'] } }),
      LabResult.countDocuments({ statut: 'valide' }),
      LabResult.countDocuments({ est_critique: true }),
    ]);
    res.json({ success: true, kpis: { total, en_attente, en_cours, valides, critiques, termines: valides } });
  } catch (err) { next(err); }
};

exports.getCatalogue = async (req, res, next) => {
  try {
    const examens = await ExamCatalogue.find({ type: 'laboratoire', statut: 'actif' }).sort('nom');
    res.json({ success: true, examens });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, critique } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut)  filter.statut  = statut;
    if (critique !== undefined) filter.est_critique = critique === 'true';

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await LabResult.countDocuments(filter);

    // .lean() retourne des objets JS purs — pas de documents Mongoose, pas d'objets imbriqués après sérialisation
    const raw = await LabResult.find(filter)
      .populate('patient',             'nom prenom numero_dossier date_naissance')
      .populate('medecin_prescripteur','nom prenom')
      .lean()
      .sort('-date_prescription')
      .skip(skip)
      .limit(parseInt(limit));

    const list = raw.map(a => {
      const patientNom      = a.patient_nom      || (a.patient      ? `${a.patient.prenom      || ''} ${a.patient.nom      || ''}`.trim() : '');
      const patientDossier  = a.patient_dossier  || a.patient?.numero_dossier || '';
      const medecinNom      = a.medecin_prescripteur_nom
                              || (a.medecin_prescripteur ? `${a.medecin_prescripteur.prenom || ''} ${a.medecin_prescripteur.nom || ''}`.trim() : '');
      return {
        ...a,
        patient_nom:              patientNom,
        patient_dossier:          patientDossier,
        medecin_prescripteur_nom: medecinNom,
        date_demande:             a.date_demande || a.date_prescription,
        // Remplace les objets peuplés par leurs IDs pour éviter tout crash React côté frontend
        patient:              a.patient?._id            ?? a.patient,
        medecin_prescripteur: a.medecin_prescripteur?._id ?? a.medecin_prescripteur,
        examen:               a.examen?._id             ?? a.examen,
      };
    });

    res.json({ success: true, total, results: list, analyses: list });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const result = await LabResult.findById(req.params.id)
      .populate('patient')
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('examen');
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // ── Normalisation des champs du formulaire ──────────────────
    const patient = req.body.patient || req.body.patient_id;
    if (!patient) return res.status(400).json({ success: false, message: 'Patient obligatoire.' });

    const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v));

    // medecin_prescripteur : ObjectId ou texte libre
    let medecin_prescripteur = null;
    let medecin_prescripteur_nom = req.body.medecin_prescripteur_nom || req.body.medecin_prescripteur || '';
    if (req.body.medecin_prescripteur && isObjectId(req.body.medecin_prescripteur)) {
      medecin_prescripteur = req.body.medecin_prescripteur;
    }
    // fallback : médecin connecté
    if (!medecin_prescripteur) {
      medecin_prescripteur = req.user._id;
      if (!medecin_prescripteur_nom) {
        medecin_prescripteur_nom = `${req.user.prenom || ''} ${req.user.nom || ''}`.trim();
      }
    }

    // examen : premier examen de la liste si disponible comme ObjectId
    let examen = null;
    const examens_demandes = req.body.examens_demandes || [];
    if (examens_demandes.length > 0 && isObjectId(examens_demandes[0])) {
      examen = examens_demandes[0];
    }

    // numéro auto
    const count = await LabResult.countDocuments();
    const numero = `LAB-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const payload = {
      patient,
      medecin_prescripteur,
      medecin_prescripteur_nom,
      examen,
      examens_demandes,
      priorite:                 req.body.niveau_urgence === 'urgent' ? 'urgente' : (req.body.priorite || 'normale'),
      niveau_urgence:           req.body.niveau_urgence,
      statut:                   'en_attente',
      patient_nom:              req.body.patient_nom,
      patient_dossier:          req.body.patient_dossier,
      service_demandeur:        req.body.service_demandeur,
      type_echantillon:         req.body.type_echantillon,
      preleveur:                req.body.preleveur,
      observations_prelevement: req.body.observations_prelevement,
      autres_examens:           req.body.autres_examens,
      sexe:                     req.body.sexe,
      date_naissance:           req.body.date_naissance,
      telephone:                req.body.telephone,
      numero,
      date_demande:             new Date(),
    };

    const result = await LabResult.create(payload);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'laboratory', entite_id: result._id, ip: req.ip });
    emitActivity({ module: 'laboratory', action: 'Nouvelle analyse', detail: `${payload.patient_nom || ''} — ${examens_demandes.length} examen(s)`, icon: '🔬', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, result, analyse: result });
  } catch (err) { next(err); }
};

exports.validate = async (req, res, next) => {
  try {
    const { resultats, commentaires, est_critique, valeurs_critiques } = req.body;
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { resultats, commentaires, est_critique, valeurs_critiques, statut: 'valide', validateur: req.user._id, date_validation: new Date() },
      { new: true }
    ).populate('patient', 'nom prenom').populate('medecin_prescripteur', '_id');

    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });

    if (est_critique && result.medecin_prescripteur) {
      await createNotification({
        destinataire: result.medecin_prescripteur._id,
        type: 'critical',
        titre: `🚨 Résultat critique — ${result.patient?.nom} ${result.patient?.prenom}`,
        message: valeurs_critiques || 'Valeurs critiques détectées.',
        priorite: 'critique',
      });
    }
    await logAction({ utilisateur: req.user._id, action: 'VALIDATE', module: 'laboratory', entite_id: result._id, ip: req.ip, message: `Validation résultat${est_critique ? ' CRITIQUE' : ''}` });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.acquit = async (req, res, next) => {
  try {
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { acquitte_par: req.user._id, acquitte_at: new Date() },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};
