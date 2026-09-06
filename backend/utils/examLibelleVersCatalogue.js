// Correction 4 (Consultations::examens_complementaires ↔ Laboratoire/
// Radiology) — même principe que la correspondance déjà construite en
// Sous-phase 5.7 pour la facturation (Consultations.jsx::LIBELLE_VERS_CATALOGUE,
// prixExamenCatalogue) : correspondance EXACTE et curatée sur les libellés
// de saisie rapide réels, jamais une correspondance floue/substring (qui
// risquerait de rattacher un examen à un mauvais tarif/catalogue). Cette
// table doit rester synchronisée manuellement avec la constante identique
// côté frontend (frontend/src/pages/Consultations.jsx) — les deux sont la
// même connaissance métier, dupliquée par nécessité (frontend/backend
// séparés), pas deux sources concurrentes : en cas de divergence future,
// c'est cette liste-ci qui gouverne la création réelle de LabResult/
// ImagingResult, et celle du frontend qui gouverne l'affichage du tarif.
const LIBELLE_VERS_CATALOGUE = {
  'nfs complète':          'numération formule sanguine',
  'glycémie à jeun':       'glycémie à jeun',
  'créatinémie':           'créatinine',
  'bilan lipidique':       'bilan lipidique',
  'ge/tdr paludisme':      'goutte épaisse / test rapide',
  'ecbu':                  'ecbu (examen cyto-bacteriologique urinaire)',
  'crp':                   'crp (protéine c réactive)',
  'radiographie thorax':   'radiographie thoracique',
  'échographie abdominale':'échographie abdominale',
};

// Retourne le document ExamCatalogue réellement correspondant, ou null si
// le libellé saisi (texte libre) n'a pas de correspondance exacte curatée —
// jamais une approximation qui inventerait un rattachement.
function matchExamCatalogue(libelle, catalogue) {
  const cibleNom = LIBELLE_VERS_CATALOGUE[(libelle || '').trim().toLowerCase()];
  if (!cibleNom) return null;
  return (catalogue || []).find(c => (c.nom || '').trim().toLowerCase() === cibleNom) || null;
}

module.exports = { LIBELLE_VERS_CATALOGUE, matchExamCatalogue };
