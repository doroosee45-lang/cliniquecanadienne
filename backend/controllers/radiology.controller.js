const ImagingResult = require('../models/ImagingResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const Consultation = require('../models/Consultation');
const Invoice = require('../models/Invoice');
const { logAction, createNotification, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { nextSequence } = require('../utils/counter');

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
    res.json({ success: true, total, examens: list });
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
    // Correction 2 — vraie facture liée (créée par validation() plus bas),
    // jamais un recalcul côté frontend à partir de TARIFS fictif. null si
    // l'examen n'est pas encore validé ou ne référence aucun vrai examen du
    // catalogue (limite documentée dans validation()).
    const invoice = await Invoice.findOne({ source_module: 'imagerie', source_id: raw._id });
    res.json({ success: true, examen: normalize(raw), invoice });
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

    // CLIN-04 — numéro auto via compteur atomique ($inc + upsert), jamais
    // countDocuments()+1 (condition de course sous créations concurrentes).
    const year   = new Date().getFullYear();
    const seq    = await nextSequence(`img-${year}`);
    const numero = `IMG-${year}-${String(seq).padStart(4, '0')}`;

    // Correction 2 (relecture du 6 sept. 2026) — examen (ObjectId réel
    // ExamCatalogue) n'était jamais accepté ici, seul type_examen (texte
    // libre) l'était : la facturation ajoutée ci-dessous (validation())
    // n'avait donc aucune référence réelle à exploiter. Radiology.jsx
    // envoie désormais ce champ quand l'examen est sélectionné depuis le
    // vrai catalogue (GET /radiology/catalogue) — jamais fabriqué ici si
    // absent ou invalide.
    const examen = (req.body.examen && isObjectId(req.body.examen)) ? req.body.examen : null;

    // Correction 12 (FLOW-003) — consultation d'origine : vérifiée réelle
    // (existe, même patient) avant d'être liée, jamais acceptée à l'aveugle.
    let consultation = null;
    if (req.body.consultation && isObjectId(req.body.consultation)) {
      const cons = await Consultation.findById(req.body.consultation).select('patient').lean();
      if (!cons || String(cons.patient) !== String(patient)) {
        return res.status(400).json({ success: false, message: 'Consultation invalide ou non liée à ce patient.' });
      }
      consultation = req.body.consultation;
    }

    const payload = {
      patient,
      consultation,
      medecin_prescripteur,
      medecin_prescripteur_nom,
      examen,
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
    res.status(201).json({ success: true, examen: result });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — statut/date_validation/signature sont gérés par
// le circuit de validation dédié (validate(), qui pose la signature et
// déclenche la notification d'anomalie) ; les laisser passer par cette
// édition générique permettrait de valider un examen sans jamais passer
// par ce circuit. patient et numero identifient l'examen.
const IMAGING_BLOCKED_FIELDS = ['patient', 'numero', 'statut', 'date_validation', 'signature'];

exports.update = async (req, res, next) => {
  try {
    const avant = await ImagingResult.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!IMAGING_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const examen = await ImagingResult.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'radiology', entite_id: examen._id, ip: req.ip, avant, apres: examen });
    res.json({ success: true, examen: normalize(examen) });
  } catch (err) { next(err); }
};

exports.saveCR = async (req, res, next) => {
  try {
    const { compte_rendu, conclusion, recommandations, observations, incidents, operateur, date_realisation, anomalie_detectee } = req.body;
    const avant = await ImagingResult.findById(req.params.id).lean();
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { compte_rendu, conclusion, recommandations, observations, incidents, operateur, date_realisation, anomalie_detectee, statut: 'realise', date_rapport: new Date() },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'CR', module: 'radiology', entite_id: examen._id, ip: req.ip, avant, apres: examen });
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
    const avant = await ImagingResult.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    // SPEC-07 (correction du 12 sept. 2026, audit indépendant) — validation()
    // ne vérifiait jamais le statut courant : un examen encore programme/
    // en_attente (jamais réalisé) pouvait être directement validé et
    // facturé. saveCR()/rapport() (ci-dessus) sont les seuls chemins réels
    // qui amènent le statut à 'realise'/'rapporte' — seule précondition
    // honnête pour autoriser la validation.
    if (!['realise', 'rapporte'].includes(avant.statut)) {
      return res.status(400).json({ success: false, message: `Impossible de valider : l'examen doit d'abord être réellement réalisé (statut actuel : ${avant.statut}).` });
    }
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { radiologue: radiologue_id, radiologue_nom, date_validation: date_validation || new Date(), signature, statut: 'valide' },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });

    // Correction 2 (relecture du 6 sept. 2026) — l'onglet "Facturation" de
    // Radiology.jsx calculait un montant côté client depuis TARIFS, une
    // grille tarifaire codée en dur — le même pattern déjà corrigé pour
    // Laboratoire (Correction 1/5). Source de tarif réelle déjà existante
    // et vérifiée avant d'en inventer une : ExamCatalogue.prix
    // (type:'imagerie'), déjà exposé par GET /radiology/catalogue et
    // réellement peuplé (utils/seed.js, 4 examens réels). Facture générée
    // uniquement si examen référence un vrai ObjectId du catalogue — jamais
    // de tarif inventé pour un examen en texte libre (ancien format).
    let factureGeneree = null;
    if (examen.examen && isObjectId(String(examen.examen))) {
      const cat = await ExamCatalogue.findById(examen.examen);
      const prix = Number(cat?.prix) || 0;
      if (prix > 0) {
        factureGeneree = await Invoice.create({
          patient: examen.patient,
          patient_nom: examen.patient_nom,
          service_label: 'Imagerie',
          source_module: 'imagerie',
          source_id: examen._id,
          created_by: req.user._id,
          lignes: [{ libelle: cat.nom, categorie: 'imagerie', prix_unitaire: prix, quantite: 1, montant: prix }],
          montant_ht: prix,
          montant_ttc: prix,
        });
        await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: factureGeneree._id, ip: req.ip, message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la validation de l'examen ${examen.numero}` });
      }
    }

    // AUDIT-A-5 — laboratory.controller.js::validate notifie le médecin
    // prescripteur sur résultat critique (est_critique) ; radiology n'avait
    // aucune notification équivalente à la validation, malgré
    // anomalie_detectee (positionné par saveCR, avant cette validation) qui
    // en est l'analogue exact côté imagerie — asymétrie entre deux
    // circuits de validation par ailleurs très proches.
    if (examen.anomalie_detectee && examen.medecin_prescripteur) {
      await createNotification({
        destinataire: examen.medecin_prescripteur,
        type: 'critical',
        titre: `🚨 Anomalie détectée — ${examen.patient_nom || 'Patient'}`,
        message: examen.conclusion || examen.observations || 'Anomalie détectée à l\'examen d\'imagerie.',
        priorite: 'critique',
      });
    }

    await logAction({ utilisateur: req.user._id, action: 'VALIDATE', module: 'radiology', entite_id: examen._id, ip: req.ip, message: `Validation examen${examen.anomalie_detectee ? ' ANOMALIE' : ''}`, avant, apres: examen });
    emitDashboardUpdate();
    res.json({ success: true, examen: normalize(examen), invoice: factureGeneree });
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

    const avant = await ImagingResult.findById(req.params.id).lean();
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { $push: { images: { $each: nouvelles } } },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });

    await logAction({ utilisateur: req.user._id, action: 'UPLOAD_IMAGES', module: 'radiology', entite_id: examen._id, ip: req.ip, avant, apres: examen });
    res.json({ success: true, images: examen.images, examen: normalize(examen) });
  } catch (err) { next(err); }
};

exports.rapport = async (req, res, next) => {
  try {
    const { compte_rendu, conclusion, anomalie_detectee, ia_anomalie, ia_confidence, ia_details } = req.body;
    const avant = await ImagingResult.findById(req.params.id).lean();
    const examen = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { compte_rendu, conclusion, anomalie_detectee, ia_anomalie, ia_confidence, ia_details, radiologue: req.user._id, date_rapport: new Date(), statut: 'rapporte' },
      { new: true }
    ).lean();
    if (!examen) return res.status(404).json({ success: false, message: 'Examen introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'RAPPORT', module: 'radiology', entite_id: examen._id, ip: req.ip, avant, apres: examen });
    res.json({ success: true, examen: normalize(examen) });
  } catch (err) { next(err); }
};
