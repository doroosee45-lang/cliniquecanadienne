const LabResult = require('../models/LabResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const Invoice = require('../models/Invoice');
const { logAction, createNotification, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

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

    res.json({ success: true, total, results: list });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const result = await LabResult.findById(req.params.id)
      .populate('patient')
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('examen');
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    // Correction 5 — vraie facture liée (créée par validate() ci-dessous),
    // jamais un calcul recomposé côté frontend à partir d'un catalogue
    // fictif. null si l'analyse n'est pas encore validée ou n'a donné lieu
    // à aucune facture réelle (cf. limite documentée dans validate()).
    const invoice = await Invoice.findOne({ source_module: 'laboratoire', source_id: result._id });
    res.json({ success: true, result, invoice });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // ── Normalisation des champs du formulaire ──────────────────
    const patient = req.body.patient || req.body.patient_id;
    if (!patient) return res.status(400).json({ success: false, message: 'Patient obligatoire.' });

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
    res.status(201).json({ success: true, result });
  } catch (err) { next(err); }
};

exports.prelever = async (req, res, next) => {
  try {
    const { type_echantillon, preleveur, observations_prelevement } = req.body;
    const avant = await LabResult.findById(req.params.id).lean();
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { type_echantillon, preleveur, observations_prelevement, statut: 'preleve', date_prelevement: new Date() },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'PRELEVEMENT', module: 'laboratory', entite_id: result._id, ip: req.ip, message: 'Prélèvement enregistré', avant, apres: result });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.saisirResultats = async (req, res, next) => {
  try {
    const { resultats } = req.body;
    const avant = await LabResult.findById(req.params.id).lean();
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { resultats, statut: 'termine', date_resultat: new Date() },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'RESULTATS', module: 'laboratory', entite_id: result._id, ip: req.ip, message: 'Résultats saisis', avant, apres: result });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.validate = async (req, res, next) => {
  try {
    const { resultats, commentaires, est_critique, valeurs_critiques } = req.body;
    const avant = await LabResult.findById(req.params.id).lean();
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { resultats, commentaires, est_critique, valeurs_critiques, statut: 'valide', validateur: req.user._id, date_validation: new Date() },
      { new: true }
    ).populate('patient', 'nom prenom').populate('medecin_prescripteur', '_id');

    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });

    // Correction 5 (relecture du 5 sept. 2026) — l'onglet "Facturation" de
    // Laboratory.jsx calculait un montant côté client depuis un catalogue
    // d'examens codé en dur (tarifs fixes arbitraires), sans lien réel avec
    // le module Finance — le pattern déjà dénoncé par l'audit pour
    // Consultations/Hospitalisation (FLOW-002, Phase 0). Source de tarif
    // réelle déjà existante et vérifiée avant d'en inventer une :
    // ExamCatalogue.prix (type:'laboratoire'), déjà exposé par
    // GET /laboratory/catalogue et réellement peuplé (utils/seed.js).
    // examens_demandes ne contient un vrai ObjectId ExamCatalogue que si le
    // frontend l'a réellement sélectionné depuis ce catalogue (voir
    // Laboratory.jsx) — une entrée en texte libre / ancien format ne
    // contribue jamais au montant, jamais de tarif inventé pour compenser.
    const idsReels = (result.examens_demandes || []).filter(isObjectId);
    let factureGeneree = null;
    if (idsReels.length > 0) {
      const examensCatalogue = await ExamCatalogue.find({ _id: { $in: idsReels } });
      const lignes = examensCatalogue
        .filter(ex => Number(ex.prix) > 0)
        .map(ex => ({ libelle: ex.nom, categorie: 'laboratoire', prix_unitaire: ex.prix, quantite: 1, montant: ex.prix }));
      const total = lignes.reduce((s, l) => s + l.montant, 0);
      if (total > 0) {
        factureGeneree = await Invoice.create({
          patient: result.patient?._id,
          patient_nom: result.patient ? `${result.patient.prenom || ''} ${result.patient.nom || ''}`.trim() : result.patient_nom,
          service_label: 'Laboratoire',
          source_module: 'laboratoire',
          source_id: result._id,
          created_by: req.user._id,
          lignes,
          montant_ht: total,
          montant_ttc: total,
        });
        await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: factureGeneree._id, ip: req.ip, message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la validation de l'analyse ${result.numero}` });
      }
    }

    if (est_critique && result.medecin_prescripteur) {
      await createNotification({
        destinataire: result.medecin_prescripteur._id,
        type: 'critical',
        titre: `🚨 Résultat critique — ${result.patient?.nom} ${result.patient?.prenom}`,
        message: valeurs_critiques || 'Valeurs critiques détectées.',
        priorite: 'critique',
      });
    }
    await logAction({ utilisateur: req.user._id, action: 'VALIDATE', module: 'laboratory', entite_id: result._id, ip: req.ip, message: `Validation résultat${est_critique ? ' CRITIQUE' : ''}`, avant, apres: result });
    // AUDIT-PHASE4-G3 — seule validate() manquait emitActivity/
    // emitDashboardUpdate dans ce fichier (create() les a déjà) : un
    // résultat critique validé ne se propageait à aucune vue temps réel
    // côté personnel — seule la notification ciblée au médecin prescripteur
    // existait (ci-dessus). Icône/libellé distincts si est_critique, pour
    // que ce cas ressorte visuellement dans le flux d'activité.
    emitActivity({
      module: 'laboratory',
      action: est_critique ? 'Résultat critique validé' : 'Résultat de laboratoire validé',
      detail: `${result.patient?.prenom || ''} ${result.patient?.nom || ''}`.trim() || result.patient_nom || result.numero,
      icon: est_critique ? '🚨' : '✅',
      userId: req.user._id,
      userName: `${req.user.prenom} ${req.user.nom}`,
    });
    emitDashboardUpdate();
    res.json({ success: true, result, invoice: factureGeneree });
  } catch (err) { next(err); }
};

exports.acquit = async (req, res, next) => {
  try {
    const avant = await LabResult.findById(req.params.id).lean();
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { acquitte_par: req.user._id, acquitte_at: new Date() },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'ACQUIT', module: 'laboratory', entite_id: result._id, ip: req.ip, message: `Résultat critique acquitté${result.est_critique ? ' (CRITIQUE)' : ''}`, avant, apres: result });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};
