// controllers/medicalRecordsController.js
//
// Module « Dossiers Médicaux » — recherche transversale, un seul endpoint en
// lecture seule, sans nouveau modèle : agrège 9 collections déjà existantes
// (Consultation, Hospitalization, DossierChirurgical, LabResult,
// ImagingResult, Echographie, Urgence, PediatricConsultation, Prescription)
// derrière la même matrice de permissions que leurs routes dédiées
// respectives (laboratory.routes.js, radiology.routes.js, etc.) — jamais
// élargie ici. Ne remplace pas PatientDetail.jsx : chaque résultat renvoie
// de quoi y naviguer directement (voir tabTarget/moduleRoute), la vue
// détaillée reste la seule source d'affichage complet d'un dossier.
const Patient               = require('../models/Patient');
const Consultation          = require('../models/Consultation');
const Hospitalization       = require('../models/Hospitalization');
const DossierChirurgical    = require('../models/DossierChirurgical');
const LabResult             = require('../models/LabResult');
const ImagingResult         = require('../models/ImagingResult');
const Echographie           = require('../models/Echographie');
const Urgence                = require('../models/Urgence');
const PediatricConsultation = require('../models/PediatricConsultation');
const Prescription          = require('../models/Prescription');
const { escapeRegex }       = require('../utils/helpers');

// Plafond par collection interrogée — la fusion/tri/pagination se fait en
// mémoire (v1, volontairement simple par choix de conception, voir
// spécification). Sans plafond, une recherche sans filtre chargerait la
// totalité de 9 collections en mémoire à chaque requête. À revoir avec une
// agrégation $unionWith paginée côté base si un test de charge (Phase E)
// montre que ce plafond devient un vrai problème (résultats tronqués avant
// tri complet) plutôt qu'une protection jamais atteinte en pratique.
const PER_SOURCE_CAP = 200;

// ── Un « source » = une collection réellement interrogée. Le filtre UI
// « Imagerie/Écho » couvre volontairement 2 collections (ImagingResult et
// Echographie) qui n'ont PAS la même matrice de rôles réelle (radiology.
// routes.js exclut sage_femme, echographie.routes.js l'inclut) : les rôles
// sont donc vérifiés ici par collection, jamais par filtre UI, pour ne
// jamais élargir l'accès réel d'un rôle à une collection qu'il ne peut pas
// lire via la route dédiée.
const SOURCES = [
  {
    key: 'consultation', uiType: 'consultation', model: Consultation,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
    dateField: 'date_consultation',
    searchFields: ['diagnostic', 'anamnese', 'type_consultation'],
    hasPatientNomField: false,
    praticienField: 'medecin',
    resume: (d) => d.diagnostic || d.anamnese || d.type_consultation || '',
    praticienNom: (d) => d.medecin ? `${d.medecin.prenom || ''} ${d.medecin.nom || ''}`.trim() : '',
    statutActif: ['en_cours', 'suspendue'], statutClos: ['terminee'],
    tabTarget: 'consult', moduleRoute: '/consultations',
  },
  {
    key: 'hospitalisation', uiType: 'hospitalisation', model: Hospitalization,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
    dateField: 'date_entree',
    searchFields: ['motif_entree', 'diagnostic_entree', 'diagnostic_sortie'],
    hasPatientNomField: false,
    praticienField: 'medecin_responsable',
    resume: (d) => d.motif_entree || d.diagnostic_entree || '',
    praticienNom: (d) => d.medecin_responsable ? `${d.medecin_responsable.prenom || ''} ${d.medecin_responsable.nom || ''}`.trim() : (d.medecin_nom || ''),
    statutActif: ['en_cours'], statutClos: ['sorti', 'transfere', 'decede'],
    tabTarget: 'hospi', moduleRoute: '/hospitalization',
  },
  {
    key: 'chirurgie', uiType: 'chirurgie', model: DossierChirurgical,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
    dateField: 'created_at',
    searchFields: ['diagnostic_chirurgical', 'motif_consultation', 'type_intervention'],
    hasPatientNomField: true,
    praticienField: 'chirurgien_id',
    resume: (d) => d.diagnostic_chirurgical || d.motif_consultation || '',
    praticienNom: (d) => d.chirurgien_id ? `${d.chirurgien_id.prenom || ''} ${d.chirurgien_id.nom || ''}`.trim() : (d.chirurgien_nom || ''),
    statutActif: ['consultation', 'preoperatoire', 'opere', 'suivi_postop'], statutClos: ['cloture'],
    tabTarget: 'chirurgie', moduleRoute: '/chirurgie',
  },
  {
    key: 'laboratoire', uiType: 'laboratoire', model: LabResult,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'laborantin'],
    dateField: 'date_prescription',
    searchFields: ['commentaires', 'valeurs_critiques'],
    hasPatientNomField: true,
    praticienField: 'medecin_prescripteur',
    resume: (d) => d.commentaires || d.type_examen || 'Analyse de laboratoire',
    praticienNom: (d) => d.medecin_prescripteur ? `${d.medecin_prescripteur.prenom || ''} ${d.medecin_prescripteur.nom || ''}`.trim() : (d.medecin_prescripteur_nom || ''),
    statutActif: ['prescrit', 'en_attente', 'en_cours', 'preleve'], statutClos: ['termine', 'valide', 'annule'],
    tabTarget: 'labo', moduleRoute: '/laboratory',
  },
  {
    key: 'imagerie', uiType: 'imagerie', model: ImagingResult,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'radiologue'],
    dateField: 'date_prescription',
    searchFields: ['motif', 'type_examen', 'conclusion'],
    hasPatientNomField: true,
    praticienField: 'medecin_prescripteur',
    resume: (d) => d.motif || d.type_examen || '',
    praticienNom: (d) => d.medecin_prescripteur ? `${d.medecin_prescripteur.prenom || ''} ${d.medecin_prescripteur.nom || ''}`.trim() : (d.medecin_prescripteur_nom || ''),
    statutActif: ['programme', 'en_attente', 'realise', 'rapporte'], statutClos: ['valide', 'annule'],
    tabTarget: 'imagerie', moduleRoute: '/radiology',
  },
  {
    key: 'echographie', uiType: 'imagerie', model: Echographie,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'radiologue', 'sage_femme'],
    dateField: 'date_prescription',
    searchFields: ['motif', 'type', 'sous_type', 'conclusion', 'rapport_texte'],
    hasPatientNomField: true,
    // Pas de référence User réelle pour le prescripteur (medecin_presc est un
    // texte libre) — aucun filtre `praticien` (ObjectId) ne s'applique ici.
    praticienField: null,
    resume: (d) => d.motif || d.type || '',
    praticienNom: (d) => d.medecin_presc || d.echographiste || '',
    statutActif: ['en_attente', 'planifiee', 'realisee'], statutClos: ['validee', 'annulee'],
    tabTarget: 'imagerie', moduleRoute: '/echographie',
  },
  {
    key: 'urgence', uiType: 'urgence', model: Urgence,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'],
    dateField: 'date_arrivee',
    searchFields: ['motif', 'diagnostic_provisoire', 'diagnostic_final'],
    hasPatientNomField: true,
    praticienField: 'medecin_responsable',
    resume: (d) => d.motif || d.diagnostic_provisoire || d.diagnostic_final || '',
    praticienNom: (d) => d.medecin_responsable ? `${d.medecin_responsable.prenom || ''} ${d.medecin_responsable.nom || ''}`.trim() : (d.medecin || ''),
    statutActif: ['attente', 'triage', 'consultation', 'observation', 'soins', 'hospitalise'], statutClos: ['sorti', 'transfere', 'decede'],
    tabTarget: 'urgences', moduleRoute: '/urgences',
  },
  {
    key: 'pediatrie', uiType: 'pediatrie', model: PediatricConsultation,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'],
    dateField: 'date',
    searchFields: ['diagnostic', 'motif'],
    hasPatientNomField: true,
    praticienField: null, // medecin est un texte libre, pas une référence User
    resume: (d) => d.diagnostic || d.motif || '',
    praticienNom: (d) => d.medecin || '',
    // Pas de champ statut réel sur ce modèle — jamais inventé, laissé null.
    statutActif: null, statutClos: null,
    // Aucun onglet dédié dans PatientDetail.jsx (PediatricConsultation est
    // rattachée à Child, pas directement à Patient — voir ticket associé) :
    // navigation honnête vers le module Pédiatrie, jamais un lien fictif.
    tabTarget: null, moduleRoute: '/pediatrie',
  },
  {
    key: 'ordonnance', uiType: 'ordonnance', model: Prescription,
    roles: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'pharmacien'],
    dateField: 'date_prescription',
    searchFields: ['lignes.medicament_nom'],
    hasPatientNomField: false,
    praticienField: 'medecin',
    resume: (d) => (d.lignes || []).map(l => l.medicament_nom).filter(Boolean).slice(0, 2).join(', ') || 'Ordonnance',
    praticienNom: (d) => d.medecin ? `${d.medecin.prenom || ''} ${d.medecin.nom || ''}`.trim() : '',
    statutActif: ['brouillon', 'active', 'publiee'], statutClos: ['dispensee', 'expiree', 'annulee'],
    tabTarget: 'ordos', moduleRoute: '/prescriptions',
  },
];

const ALL_UI_TYPES = [...new Set(SOURCES.map(s => s.uiType))];

// Résout les IDs Patient dont le nom/prénom/numéro de dossier correspond au
// texte libre saisi — réutilisé par chaque collection ayant un vrai champ
// `patient` (ObjectId), pour ne pas dupliquer nom/prénom du patient dans
// chaque collection déjà interrogée (objectif explicite du module).
async function matchingPatientIds(qRe) {
  if (!qRe) return null;
  const patients = await Patient.find({
    $or: [{ nom: qRe }, { prenom: qRe }, { numero_dossier: qRe }],
  }).select('_id').lean();
  return patients.map(p => p._id);
}

function buildFilter(source, { qRe, patientIds, dateFrom, dateTo, praticien, statut }) {
  const filter = {};

  if (qRe) {
    const or = [];
    if (source.key !== 'pediatrie' && patientIds?.length) or.push({ patient: { $in: patientIds } });
    for (const field of source.searchFields) or.push({ [field]: qRe });
    if (source.hasPatientNomField) or.push({ patient_nom: qRe });
    // Aucun champ ne peut correspondre (ni patient, ni champs libres) :
    // filtre impossible à satisfaire plutôt que d'ignorer silencieusement q.
    filter.$or = or.length ? or : [{ _id: null }];
  }

  if (dateFrom || dateTo) {
    filter[source.dateField] = {};
    if (dateFrom) filter[source.dateField].$gte = new Date(dateFrom);
    if (dateTo)   filter[source.dateField].$lte = new Date(dateTo);
  }

  if (praticien && source.praticienField) filter[source.praticienField] = praticien;

  if (statut === 'actif' && source.statutActif) filter.statut = { $in: source.statutActif };
  if (statut === 'clos'  && source.statutClos)  filter.statut = { $in: source.statutClos };

  return filter;
}

async function runSource(source, params) {
  const filter = buildFilter(source, params);
  let query = source.model.find(filter).sort(`-${source.dateField}`).limit(PER_SOURCE_CAP).lean();

  if (source.praticienField)   query = query.populate(source.praticienField, 'nom prenom');
  if (source.key !== 'pediatrie') query = query.populate('patient', 'nom prenom');
  if (source.key === 'pediatrie') query = query.populate('child_id', 'patient_id');

  const docs = await query;

  return docs.map((d) => {
    let patientId, patientNom;
    if (source.key === 'pediatrie') {
      patientId  = d.child_id?.patient_id || null;
      patientNom = d.patient_nom || '';
    } else {
      patientId  = d.patient?._id || d.patient || null;
      patientNom = source.hasPatientNomField && d.patient_nom
        ? d.patient_nom
        : (d.patient ? `${d.patient.prenom || ''} ${d.patient.nom || ''}`.trim() : '');
    }
    return {
      patientId,
      patientNom,
      type: source.uiType,
      recordId: d._id,
      date: d[source.dateField] || d.createdAt || null,
      resume: source.resume(d),
      praticien: source.praticienNom(d),
      statut: d.statut ?? null,
      tabTarget: source.tabTarget,
      moduleRoute: source.moduleRoute,
    };
  });
}

// GET /api/medical-records/search
exports.search = async (req, res, next) => {
  try {
    const { q, dateFrom, dateTo, praticien, statut = 'tous', page = 1, limit = 25 } = req.query;
    const requestedTypes = [].concat(req.query.types || []).filter(Boolean);
    const typesFilter = requestedTypes.length ? requestedTypes : ALL_UI_TYPES;

    // Filtrage des sources AUTORISÉES pour ce rôle AVANT toute requête —
    // jamais tout interroger puis filtrer les résultats après coup.
    const allowedSources = SOURCES.filter(
      (s) => typesFilter.includes(s.uiType) && s.roles.includes(req.user.role)
    );

    const qRe = q && q.trim() ? new RegExp(escapeRegex(q.trim()), 'i') : null;
    const patientIds = await matchingPatientIds(qRe);
    const params = { qRe, patientIds, dateFrom, dateTo, praticien, statut };

    const perSourceResults = await Promise.all(allowedSources.map((s) => runSource(s, params)));
    const merged = perSourceResults.flat().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const total = merged.length;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 25);
    const start = (pageNum - 1) * limitNum;
    const results = merged.slice(start, start + limitNum);

    res.json({ success: true, results, total, page: pageNum, limit: limitNum });
  } catch (err) { next(err); }
};
