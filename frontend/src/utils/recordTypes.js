// utils/recordTypes.js — taxonomie partagée des types de dossier médical.
// Réutilise exactement les libellés/icônes déjà utilisés par les onglets de
// PatientDetail.jsx (Consultations 🩺, Hospitalisations 🛏️, Ordonnances 📋,
// Laboratoire 🔬, Imagerie 🩻, Urgences 🚨, Chirurgie 🔪) — ne pas réinventer
// une deuxième taxonomie qui divergerait de celle déjà en place.
//
// « imagerie » couvre volontairement 2 collections backend (ImagingResult et
// Echographie, voir medicalRecordsController.js) sous un seul filtre UI —
// c'est pourquoi PatientDetail.jsx récupère désormais aussi les échographies
// du patient dans son onglet "Imagerie" (voir PatientDetail.jsx).
//
// « pediatrie » n'a PAS d'équivalent dans PatientDetail.jsx (PediatricConsultation
// est rattachée à Child, pas directement à Patient — aucun onglet réel
// n'existe pour l'ouvrir depuis la fiche patient) : icône ajoutée ici
// spécifiquement pour ce module de recherche, pas reprise d'un onglet
// existant puisqu'aucun n'existe.
export const RECORD_TYPES = [
  { id: 'consultation',    label: 'Consultation',    icon: '🩺', tabTarget: 'consult' },
  { id: 'hospitalisation', label: 'Hospitalisation', icon: '🛏️', tabTarget: 'hospi' },
  { id: 'chirurgie',       label: 'Chirurgie',       icon: '🔪', tabTarget: 'chirurgie' },
  { id: 'laboratoire',     label: 'Laboratoire',     icon: '🔬', tabTarget: 'labo' },
  { id: 'imagerie',        label: 'Imagerie/Écho',   icon: '🩻', tabTarget: 'imagerie' },
  { id: 'urgence',         label: 'Urgence',         icon: '🚨', tabTarget: 'urgences' },
  { id: 'pediatrie',       label: 'Pédiatrie',       icon: '👶', tabTarget: null },
  { id: 'ordonnance',      label: 'Ordonnance',      icon: '📋', tabTarget: 'ordos' },
];

export const RECORD_TYPE_MAP = Object.fromEntries(RECORD_TYPES.map((t) => [t.id, t]));
