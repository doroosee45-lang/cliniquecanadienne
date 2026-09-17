const LabResult = require('../models/LabResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const Consultation = require('../models/Consultation');
const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const { fieldsFor } = require('./patients.controller');
const { logAction, createNotification, paginate, escapeRegex } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { nextSequence } = require('../utils/counter');

const isObjectId = v => /^[a-f\d]{24}$/i.test(String(v || ''));

// POST5-009 (audit indépendant post-Phase 5, 14 sept. 2026) — même classe
// qu'ANOM-MAT-01 (maternityController.js) : LabResult.telephone est une
// copie figée du téléphone du Patient, écrite une seule fois à la création
// et jamais resynchronisée. Préfère la donnée live du Patient lié quand
// elle est disponible (patient peuplé), replie sur la copie figée sinon —
// jamais l'inverse, jamais une valeur inventée.
const preferLiveTelephone = (obj) => {
  if (obj.patient && typeof obj.patient === 'object' && obj.patient.telephone) {
    obj.telephone = obj.patient.telephone;
  }
  return obj;
};

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
    const { page = 1, limit = 20, patient, statut, critique, q } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut)  filter.statut  = statut;
    if (critique !== undefined) filter.est_critique = critique === 'true';
    // LAB-RADIO-SEARCH-001 (audit métier du 13 sept. 2026, Phase 4) — le
    // frontend (Laboratory.jsx) envoie déjà ?q=... depuis la barre de
    // recherche, jamais lu ici : la recherche était purement décorative,
    // aucun résultat n'était jamais exclu quel que soit le texte saisi.
    // Même pattern que echographieController.js::getAll (déjà fonctionnel) :
    // regex insensible à la casse sur les champs texte réellement présents
    // au schéma (patient_nom, numero, medecin_prescripteur_nom) —
    // examens_demandes n'est volontairement pas inclus (Schema.Types.Mixed,
    // mélange IDs/texte selon l'appelant, pas un champ texte fiable à
    // interroger par regex).
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ patient_nom: re }, { numero: re }, { medecin_prescripteur_nom: re }];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle (un aller-retour réseau
    // MongoDB économisé) plutôt que l'un après l'autre.
    // .lean() retourne des objets JS purs — pas de documents Mongoose, pas d'objets imbriqués après sérialisation
    const [total, raw] = await Promise.all([
      LabResult.countDocuments(filter),
      LabResult.find(filter)
        .populate('patient',             'nom prenom numero_dossier date_naissance telephone')
        .populate('medecin_prescripteur','nom prenom')
        // LAB-03 — technicien/biologiste réels (jamais les anciens champs
        // texte libre jamais persistés) : mêmes flattening + *_nom que
        // medecin_prescripteur ci-dessous, pour que la liste n'expose jamais
        // un objet peuplé directement (risque de crash React déjà documenté).
        .populate('technicien',         'nom prenom')
        .populate('validateur',         'nom prenom')
        .lean()
        .sort('-date_prescription')
        .skip(skip)
        .limit(parseInt(limit)),
    ]);

    const list = raw.map(a => {
      const patientNom      = a.patient_nom      || (a.patient      ? `${a.patient.prenom      || ''} ${a.patient.nom      || ''}`.trim() : '');
      const patientDossier  = a.patient_dossier  || a.patient?.numero_dossier || '';
      const medecinNom      = a.medecin_prescripteur_nom
                              || (a.medecin_prescripteur ? `${a.medecin_prescripteur.prenom || ''} ${a.medecin_prescripteur.nom || ''}`.trim() : '');
      const technicienNom   = a.technicien ? `${a.technicien.prenom || ''} ${a.technicien.nom || ''}`.trim() : '';
      const validateurNom   = a.validateur ? `${a.validateur.prenom || ''} ${a.validateur.nom || ''}`.trim() : '';
      // POST5-009 — voir preferLiveTelephone ci-dessus, calculé avant que
      // `patient` ne soit ramené à son _id juste en-dessous.
      const telephoneLive   = a.patient?.telephone || a.telephone;
      return {
        ...a,
        patient_nom:              patientNom,
        patient_dossier:          patientDossier,
        medecin_prescripteur_nom: medecinNom,
        technicien_nom:           technicienNom,
        validateur_nom:           validateurNom,
        date_demande:             a.date_demande || a.date_prescription,
        telephone:                telephoneLive,
        // Remplace les objets peuplés par leurs IDs pour éviter tout crash React côté frontend
        patient:              a.patient?._id            ?? a.patient,
        medecin_prescripteur: a.medecin_prescripteur?._id ?? a.medecin_prescripteur,
        examen:               a.examen?._id             ?? a.examen,
        technicien:            a.technicien?._id          ?? a.technicien,
        validateur:            a.validateur?._id          ?? a.validateur,
      };
    });

    res.json({ success: true, total, results: list });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    // Mission harmonisation sélection patient (17 sept. 2026) — `patient`
    // était peuplé ici sans aucune restriction, renvoyant le dossier
    // complet (antecedents_medicaux, notes...) à n'importe quel rôle
    // autorisé à lire un résultat de labo, y compris laborantin (rôle
    // restreint : démographique + groupe_sanguin + allergies uniquement
    // selon RESTRICTED_FIELDS). Alignée sur la même source unique
    // fieldsFor() (déjà réutilisée par prescriptions.controller.js::getOne).
    const patientFields = fieldsFor(req.user.role);
    const result = await LabResult.findById(req.params.id)
      .populate('patient', patientFields || undefined)
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('examen')
      // LAB-03 — technicien/validateur réels (voir saisirResultats/validate
      // ci-dessous), affichés à la place des anciens champs texte libre
      // jamais persistés.
      .populate('technicien', 'nom prenom')
      .populate('validateur', 'nom prenom');
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    // Correction 5 — vraie facture liée (créée par validate() ci-dessous),
    // jamais un calcul recomposé côté frontend à partir d'un catalogue
    // fictif. null si l'analyse n'est pas encore validée ou n'a donné lieu
    // à aucune facture réelle (cf. limite documentée dans validate()).
    const invoice = await Invoice.findOne({ source_module: 'laboratoire', source_id: result._id });
    // POST5-009 — voir preferLiveTelephone ci-dessus ; `patient` reste
    // pleinement peuplé ici (contrat déjà en place pour cette vue détail).
    res.json({ success: true, result: preferLiveTelephone(result.toObject()), invoice });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // ── Normalisation des champs du formulaire ──────────────────
    // POST5-007 (audit indépendant post-Phase 5, 14 sept. 2026) — `patient`
    // n'était vérifié que pour sa présence (truthiness), jamais son format
    // ObjectId ni son existence réelle en base — seul contrôleur clinique
    // dans ce projet à ne pas le faire (voir consultations.controller.js,
    // prescriptions.controller.js, echographieController.js,
    // hospitalization.controller.js, maternityController.js,
    // chirurgieController.js, pediatrieController.js, tous alignés sur ce
    // même garde-fou). Un ObjectId fabriqué/orphelin était accepté tel
    // quel : un LabResult persisté sans qu'aucun vrai Patient ne le
    // référence réellement.
    const patient = req.body.patient || req.body.patient_id;
    if (!patient || !isObjectId(patient)) return res.status(400).json({ success: false, message: 'Patient réel obligatoire (référence invalide).' });
    const patientDoc = await Patient.findById(patient).select('_id').lean();
    if (!patientDoc) return res.status(400).json({ success: false, message: 'Patient introuvable.' });

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

    // CLIN-04 — numéro auto via compteur atomique ($inc + upsert), jamais
    // countDocuments()+1 (condition de course sous créations concurrentes).
    const year = new Date().getFullYear();
    const seq = await nextSequence(`lab-${year}`);
    const numero = `LAB-${year}-${String(seq).padStart(4, '0')}`;

    const payload = {
      patient,
      consultation,
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
    // LAB-03 (correction du 12 sept. 2026, audit indépendant) — le
    // formulaire de validation exigeait un "Technicien de laboratoire"
    // en texte libre, jamais persisté (technicien est un ObjectId ref
    // User côté schéma, jamais alimenté nulle part). Le vrai technicien
    // est la personne authentifiée qui saisit les résultats (route
    // réservée à 'superadmin'/'laborantin' — voir laboratory.routes.js),
    // exactement le même principe que validateur ci-dessous pour la
    // validation : dérivé du compte réel, jamais d'un champ texte
    // fabriquable côté client.
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { resultats, statut: 'termine', date_resultat: new Date(), technicien: req.user._id },
      { new: true }
    ).populate('technicien', 'nom prenom');
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'RESULTATS', module: 'laboratory', entite_id: result._id, ip: req.ip, message: 'Résultats saisis', avant, apres: result });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.validate = async (req, res, next) => {
  try {
    const { resultats, commentaires, est_critique, valeurs_critiques } = req.body;
    const avant = await LabResult.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    // SPEC-07 (correction du 12 sept. 2026, audit indépendant) — validate()
    // ne vérifiait jamais le statut courant : une analyse encore en_attente
    // (jamais prélevée, jamais testée) pouvait être directement validée et
    // facturée, sans qu'aucun résultat réel n'ait été saisi. saisirResultats
    // (ci-dessus) est l'unique chemin réel qui amène le statut à 'termine' —
    // seule précondition honnête pour autoriser la signature.
    if (avant.statut !== 'termine') {
      return res.status(400).json({ success: false, message: `Impossible de valider : les résultats doivent d'abord être saisis (statut actuel : ${avant.statut}).` });
    }
    // POST5-002 (audit indépendant post-Phase 5, 14 sept. 2026) — la lecture
    // `avant` ci-dessus n'est pas atomique avec l'écriture qui suit : deux
    // validations concurrentes du même résultat (double-clic, retry réseau,
    // deux membres du personnel en même temps) passaient toutes deux le
    // contrôle JS avant qu'aucune écriture n'ait abouti, chacune générant
    // ensuite sa propre Invoice — reproduit en direct pendant l'audit (2
    // requêtes concurrentes → 2 factures pour le même LabResult). Filtre de
    // garde `statut:'termine'` sur l'écriture elle-même (même principe déjà
    // appliqué à pharmacy.controller.js::dispenser et
    // hospitalization.controller.js::discharge, AUDIT-M-B5/AUDIT-2.1) :
    // seule la requête qui gagne réellement la course peut matcher, l'autre
    // ne trouve plus aucun document `statut:'termine'` et échoue proprement
    // ci-dessous, sans jamais générer de facture en double.
    const result = await LabResult.findOneAndUpdate(
      { _id: req.params.id, statut: 'termine' },
      { resultats, commentaires, est_critique, valeurs_critiques, statut: 'valide', validateur: req.user._id, date_validation: new Date() },
      { new: true }
    // Découverte annexe (relecture du 6 sept. 2026, pendant la vérification
    // bout-en-bout de la Correction 1) — .populate('medecin_prescripteur',
    // '_id') transformait ce champ, normalement un ObjectId brut partout
    // ailleurs (getAll l'aplatit explicitement), en objet {_id} dans la
    // réponse JSON : Laboratory.jsx (ligne "Prescripteur") le rend
    // directement en JSX, provoquant un vrai crash React ("Objects are not
    // valid as a React child") après toute validation réelle depuis le vrai
    // formulaire. Seul destinataire ci-dessous en avait besoin, et un
    // ObjectId brut (déjà présent sur result.medecin_prescripteur) suffit —
    // aucun besoin de populate ici.
    ).populate('patient', 'nom prenom')
      // LAB-03 — technicien (saisi lors de saisirResultats) et validateur
      // (la personne réelle qui signe ici) : Laboratory.jsx les rend via
      // .nom/.prenom explicitement, jamais l'objet peuplé directement en
      // JSX, donc le risque de crash décrit ci-dessus ne s'applique pas.
      .populate('technicien', 'nom prenom')
      .populate('validateur', 'nom prenom');

    if (!result) {
      // Le filtre `statut:'termine'` n'a rien matché : soit le document a
      // disparu depuis la lecture `avant` (404, cas improbable), soit une
      // autre requête a gagné la course de validation entre-temps (409,
      // le cas réellement visé par ce correctif) — jamais une seconde
      // facture générée dans les deux cas.
      const stillThere = await LabResult.exists({ _id: req.params.id });
      if (!stillThere) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
      return res.status(409).json({ success: false, message: 'Ce résultat a déjà été validé entre-temps par une autre requête.' });
    }

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
        destinataire: result.medecin_prescripteur,
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
