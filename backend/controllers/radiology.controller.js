const ImagingResult = require('../models/ImagingResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// Aplatit un document peuplé en objet safe pour le frontend (pas d'objets imbriqués)
const normalize = a => {
  const patientNom     = a.patient_nom     || (a.patient     ? `${a.patient.prenom || ''} ${a.patient.nom || ''}`.trim()     : '');
  const patientDossier = a.patient_dossier || a.patient?.numero_dossier || '';
  const medecinNom     = a.medecin_prescripteur_nom
                         || (a.medecin_prescripteur ? `${a.medecin_prescripteur.prenom || ''} ${a.medecin_prescripteur.nom || ''}`.trim() : '');
  const radiologueNom  = a.radiologue_nom
                         || (a.radiologue ? `${a.radiologue.prenom || ''} ${a.radiologue.nom || ''}`.trim() : '');
  return {
    ...a,
    patient_nom:              patientNom,
    patient_dossier:          patientDossier,
    medecin_prescripteur_nom: medecinNom,
    radiologue_nom:           radiologueNom,
    // Remplacer les objets peuplés par leurs IDs (évite crash React)
    patient:              a.patient?._id      ?? a.patient,
    medecin_prescripteur: a.medecin_prescripteur?._id ?? a.medecin_prescripteur,
    radiologue:           a.radiologue?._id   ?? a.radiologue,
    examen:               a.examen?._id       ?? a.examen,
  };
};

exports.getStats = async (req, res, next) => {
  try {
    const [total, programme, en_attente, realise, valide, urgents] = await Promise.all([
      ImagingResult.countDocuments(),
      ImagingResult.countDocuments({ statut: 'programme' }),
      ImagingResult.countDocuments({ statut: 'en_attente' }),
      ImagingResult.countDocuments({ statut: { $in: ['realise', 'rapporte'] } }),
      ImagingResult.countDocuments({ statut: 'valide' }),
      ImagingResult.countDocuments({ priorite: 'tres_urgente' }),
    ]);
    res.json({ success: true, kpis: { total, programme, en_attente, realise, valide, urgents } });
  } catch (err) { next(err); }
};

exports.getCatalogue = async (req, res, next) => {
  try {
    const examens = await ExamCatalogue.find({ type: 'imagerie', statut: 'actif' }).sort('nom');
    res.json({ success: true, examens });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, type_categorie } = req.query;
    const filter = {};
    if (patient)        filter.patient        = patient;
    if (statut)         filter.statut         = statut;
    if (type_categorie) filter.type_categorie = type_categorie;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await ImagingResult.countDocuments(filter);

    const raw = await ImagingResult.find(filter)
      .populate('patient',             'nom prenom numero_dossier date_naissance')
      .populate('medecin_prescripteur','nom prenom')
      .populate('radiologue',          'nom prenom')
      .lean()
      .sort('-date_prescription')
      .skip(skip)
      .limit(parseInt(limit));

    const list = raw.map(normalize);
    // retourner les deux clés pour compatibilité frontend
    res.json({ success: true, total, results: list, examens: list });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const raw = await ImagingResult.findById(req.params.id)
      .populate('patient',             'nom prenom numero_dossier date_naissance telephone')
      .populate('medecin_prescripteur','nom prenom')
      .populate('radiologue',          'nom prenom')
      .lean();
    if (!raw) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    res.json({ success: true, examen: normalize(raw) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const patient = req.body.patient || req.body.patient_id;
    if (!patient) return res.status(400).json({ success: false, message: 'Patient obligatoire.' });

    // Médecin prescripteur
    let medecin_prescripteur     = null;
    let medecin_prescripteur_nom = req.body.medecin_prescripteur_nom || '';
    if (req.body.medecin_prescripteur && isObjectId(req.body.medecin_prescripteur)) {
      medecin_prescripteur = req.body.medecin_prescripteur;
    } else {
      medecin_prescripteur     = req.user._id;
      medecin_prescripteur_nom = medecin_prescripteur_nom
        || req.body.medecin_prescripteur
        || `${req.user.prenom || ''} ${req.user.nom || ''}`.trim();
    }

    const count  = await ImagingResult.countDocuments();
    const numero = `IMG-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const payload = {
      patient,
      medecin_prescripteur,
      medecin_prescripteur_nom,
      patient_nom:     req.body.patient_nom,
      patient_dob:     req.body.patient_dob || req.body.date_naissance,
      patient_dossier: req.body.patient_dossier,
      sexe:            req.body.sexe,
      telephone:       req.body.telephone,
      type_categorie:  req.body.type_categorie,
      type_examen:     req.body.type_examen,
      priorite:        req.body.priorite || 'normale',
      motif:           req.body.motif,
      service_demandeur: req.body.service_demandeur,
      salle:           req.body.salle,
      operateur:       req.body.operateur,
      date_rdv:        req.body.date_rdv,
      heure_rdv:       req.body.heure_rdv,
      statut:          req.body.statut || 'programme',
      numero,
    };

    const result = await ImagingResult.create(payload);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'radiology', entite_id: result._id, ip: req.ip });
    emitActivity({ module: 'radiology', action: 'Nouvel examen imagerie', detail: `${payload.patient_nom || ''} — ${payload.type_examen || ''}`, icon: '🩻', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, result, examen: result });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const examen = await ImagingResult.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'radiology', entite_id: examen._id, ip: req.ip });
    res.json({ success: true, examen: normalize(examen) });
  } catch (err) { next(err); }
};

exports.saveCR = async (req, res, next) => {
  try {
    const { compte_rendu, conclusion, recommandations, observations, incidents, operateur, date_realisation, anomalie_detectee } = req.body;
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { compte_rendu, conclusion, recommandations, observations, incidents, operateur, date_realisation, anomalie_detectee, statut: 'realise', date_rapport: new Date() },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'CR', module: 'radiology', entite_id: examen._id, ip: req.ip });
    res.json({ success: true, examen: normalize(examen) });
  } catch (err) { next(err); }
};

exports.validation = async (req, res, next) => {
  try {
    const { radiologue, date_validation, signature } = req.body;
    let radiologue_id  = null;
    let radiologue_nom = radiologue || '';
    if (radiologue && isObjectId(radiologue)) {
      radiologue_id = radiologue;
    } else {
      radiologue_nom = radiologue || `${req.user.prenom || ''} ${req.user.nom || ''}`.trim();
      radiologue_id  = req.user._id;
    }
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { radiologue: radiologue_id, radiologue_nom, date_validation: date_validation || new Date(), signature, statut: 'valide' },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'VALIDATE', module: 'radiology', entite_id: examen._id, ip: req.ip });
    emitDashboardUpdate();
    res.json({ success: true, examen: normalize(examen) });
  } catch (err) { next(err); }
};

exports.uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });

    const nouvelles = req.files.map(f => ({
      filename:  f.filename,
      path:      `/uploads/radiology/${f.filename}`,
      type_mime: f.mimetype,
      taille:    f.size,
    }));

    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { $push: { images: { $each: nouvelles } } },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });

    await logAction({ utilisateur: req.user._id, action: 'UPLOAD_IMAGES', module: 'radiology', entite_id: examen._id, ip: req.ip });
    res.json({ success: true, images: examen.images, examen: normalize(examen) });
  } catch (err) { next(err); }
};

exports.rapport = async (req, res, next) => {
  try {
    const { compte_rendu, conclusion, anomalie_detectee, ia_anomalie, ia_confidence, ia_details } = req.body;
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { compte_rendu, conclusion, anomalie_detectee, ia_anomalie, ia_confidence, ia_details, radiologue: req.user._id, date_rapport: new Date(), statut: 'rapporte' },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'RAPPORT', module: 'radiology', entite_id: examen._id, ip: req.ip });
    res.json({ success: true, examen: normalize(examen) });
  } catch (err) { next(err); }
};
