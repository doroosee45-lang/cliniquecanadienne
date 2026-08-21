// T9.13 — anonymisation, alternative à la suppression physique d'un dossier
// patient (patients.controller.js::remove existe déjà pour la suppression
// réelle ; ceci en est une alternative, pas un remplacement).
//
// Principe retenu : anonymiser plutôt que supprimer les enregistrements
// cliniques liés. Une clinique réelle a une obligation de conservation des
// actes médicaux (comptabilité, statistiques, traçabilité légale) même
// quand un patient demande l'effacement de ses données personnelles — c'est
// exactement la tension que le droit à l'effacement (RGPD) résout par
// l'anonymisation plutôt que la suppression : le contenu clinique/financier
// est conservé, mais tout ce qui permet de le relier à une personne
// identifiable est retiré. Concrètement :
//   - Patient et le compte User lié (role:'patient') : champs identifiants
//     réellement effacés (nom, prénom, email, téléphone, adresse, contact
//     d'urgence, photo, notes libres). Champs cliniques/statistiques
//     conservés (date de naissance, sexe, groupe sanguin, allergies,
//     antécédents) — nécessaires pour toute analyse agrégée future et sans
//     valeur ré-identifiante isolée.
//   - 8 modèles référençant Patient et dupliquant des champs d'identité pour
//     l'affichage (patient_nom/patient_prenom/patient_dossier/telephone/
//     adresse) : ces copies sont scrubées. Le contenu clinique/financier de
//     ces documents (diagnostic, montants, dates, actes) N'EST PAS purgé —
//     conservation légale/statistique — et la référence ObjectId vers le
//     Patient n'est PAS retirée : une fois le Patient lui-même anonymisé,
//     cette référence seule n'est plus personnellement identifiable.
//   - Les autres modèles référençant Patient (AIPrediction, Appointment,
//     Child, Consultation, Echographie, Hospitalization, Newborn,
//     Prescription, Room) ne dupliquent aucun champ d'identité — vérifié
//     par grep sur chaque schéma avant d'écrire ce module — donc rien à
//     scruber dessus ; la référence ObjectId seule n'exige aucune action.
const Patient = require('../models/Patient');
const User = require('../models/User');
const { logAction } = require('./helpers');

const ANONYMOUS_LABEL = 'Patient anonymisé';

// modèle → { refField, piiFields } pour les 8 modèles qui dupliquent des
// champs d'identité patient pour affichage (constaté par lecture directe de
// chaque schéma, pas supposé).
// Listes de champs vérifiées par relecture complète de chaque schéma (pas
// seulement un grep ciblé sur "patient_nom"/"telephone" — un premier passage
// avait manqué date_naissance/patient_dob/contact_urgence/tel_urgence sur
// plusieurs modèles, retrouvés en relisant chaque schéma en entier avant
// d'écrire le test). patient_sexe (Urgence) et sexe/date_naissance (Patient
// lui-même) restent volontairement conservés : donnée démographique/clinique,
// pas identifiante à elle seule — même principe que groupe_sanguin/allergies.
const CASCADE_TARGETS = [
  { model: require('../models/ArchiveEntry'),        refField: 'patient',    piiFields: ['patient_nom'] },
  { model: require('../models/Delivery'),             refField: 'patient_id', piiFields: ['patient_nom'] },
  { model: require('../models/DossierChirurgical'),   refField: 'patient',    piiFields: ['patient_nom', 'telephone', 'date_naissance'] },
  { model: require('../models/ImagingResult'),        refField: 'patient',    piiFields: ['patient_nom', 'patient_dossier', 'patient_dob', 'telephone', 'adresse'] },
  { model: require('../models/Invoice'),               refField: 'patient',    piiFields: ['patient_nom'] },
  { model: require('../models/LabResult'),             refField: 'patient',    piiFields: ['patient_nom', 'patient_dossier', 'telephone', 'date_naissance'] },
  { model: require('../models/Pregnancy'),             refField: 'patient_id', piiFields: ['patient_nom', 'patient_prenom', 'telephone', 'date_naissance'] },
  { model: require('../models/Urgence'),               refField: 'patient',    piiFields: ['patient_nom', 'patient_dob', 'patient_tel', 'contact_urgence', 'tel_urgence'] },
];

async function anonymizePatient(patientId, { utilisateur, ip } = {}) {
  const patient = await Patient.findById(patientId);
  if (!patient) {
    const err = new Error('Patient introuvable.');
    err.statusCode = 404;
    throw err;
  }
  if (patient.anonymise) {
    const err = new Error('Ce dossier est déjà anonymisé.');
    err.statusCode = 400;
    throw err;
  }

  const avant = patient.toObject();

  // ── 1. Patient ────────────────────────────────────────────────────────
  patient.nom = ANONYMOUS_LABEL;
  patient.prenom = patient.numero_dossier || 'N/A';
  patient.email = undefined;
  patient.telephone = undefined;
  patient.photo = undefined;
  patient.adresse = { rue: undefined, ville: undefined, pays: undefined, code_postal: undefined };
  patient.contact_urgence = { nom: undefined, relation: undefined, telephone: undefined };
  patient.notes = undefined;
  patient.token_activation = undefined;
  patient.token_activation_expire = undefined;
  patient.actif = false;
  patient.statut = 'inactif';
  patient.anonymise = true;
  patient.anonymise_at = new Date();
  patient.anonymise_par = utilisateur;
  await patient.save();

  // ── 2. Compte User lié (role:'patient') ──────────────────────────────
  let userAnonymise = false;
  const linkedUser = await User.findOne({ patient_id: patient._id, role: 'patient' });
  if (linkedUser) {
    linkedUser.nom = ANONYMOUS_LABEL;
    linkedUser.prenom = patient.numero_dossier || 'N/A';
    linkedUser.email = `anonymise-${patient._id}@invalide.local`;
    linkedUser.telephone = undefined;
    linkedUser.avatar = undefined;
    linkedUser.googleId = undefined;
    linkedUser.statut = 'inactif';
    await linkedUser.save();
    userAnonymise = true;
  }

  // ── 3. Cascade — scrub des copies d'identité, contenu clinique conservé ──
  const cascade = {};
  for (const { model, refField, piiFields } of CASCADE_TARGETS) {
    const unset = Object.fromEntries(piiFields.map(f => [f, 1]));
    const result = await model.updateMany({ [refField]: patient._id }, { $unset: unset });
    cascade[model.modelName] = result.modifiedCount;
  }

  await logAction({
    utilisateur, action: 'ANONYMIZE', module: 'patients', entite_id: patient._id, ip,
    avant: { nom: avant.nom, prenom: avant.prenom, email: avant.email, telephone: avant.telephone },
    apres: { anonymise: true },
    message: `Dossier patient ${patient.numero_dossier} anonymisé — ${Object.values(cascade).reduce((s, n) => s + n, 0)} document(s) lié(s) scrubés dans ${Object.keys(cascade).length} collection(s)${userAnonymise ? ', compte portail lié anonymisé' : ''}`,
  });

  return { patientId: patient._id, numero_dossier: patient.numero_dossier, userAnonymise, cascade };
}

module.exports = { anonymizePatient, CASCADE_TARGETS };
