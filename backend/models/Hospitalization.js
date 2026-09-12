const mongoose = require('mongoose');
const { Schema } = mongoose;

const NoteSchema = new Schema({
  date: { type: Date, default: Date.now },
  auteur: { type: Schema.Types.ObjectId, ref: 'User' },
  tension: String,
  pouls: Number,
  temperature: Number,
  spo2: Number,
  contenu: String,
}, { _id: false });

// P7-2 — sous-documents du dossier de séjour, même principe que NoteSchema
// ci-dessus. _id conservé (contrairement à NoteSchema) : chaque entrée doit
// être identifiable individuellement en réponse de POST/GET (clé React côté
// front, retour de l'élément créé côté API).
const ConstanteSchema = new Schema({
  date:        { type: Date, default: Date.now },
  auteur:      { type: Schema.Types.ObjectId, ref: 'User' },
  temperature: Number,
  tension_sys: Number,
  tension_dia: Number,
  fc:          Number,
  spo2:        Number,
  poids:       Number,
  note_med:    String,
  note_inf:    String,
});

const TraitementSchema = new Schema({
  date:       { type: Date, default: Date.now },
  medicament: String,
  dose:       String,
  heure:      String,
  voie:       String,
  personnel:  String,
  statut:     String,
});

const ExamenSchema = new Schema({
  date:        { type: Date, default: Date.now },
  type:        String,
  designation: String,
  statut:      String,
  resultat:    String,
});

const VisiteSchema = new Schema({
  date:          { type: Date, default: Date.now },
  visiteur:      String,
  heure_entree:  String,
  heure_sortie:  String,
  note:          String,
});

// Nommée "PrescriptionSejour" (et non "Prescription") pour ne pas entrer en
// collision avec le vrai modèle Prescription (document séparé, ailleurs dans
// l'app) : ceci ne représente qu'une entrée légère de prescription saisie
// directement dans le dossier de séjour, pas une ordonnance formelle.
const PrescriptionSejourSchema = new Schema({
  date:        { type: Date, default: Date.now },
  type:        String,
  designation: String,
  posologie:   String,
  // HOSP-03 (correction du 12 sept. 2026, audit indépendant) — medecin
  // restait un texte libre fabriquable par le client, sans aucune référence
  // vérifiable vers un vrai compte utilisateur — contrairement à
  // ConstanteSchema.auteur (même sous-ressource de séjour) qui capture déjà
  // l'identité réelle de l'auteur. Même convention reprise ici : medecin
  // reste le libellé affiché (ex: un médecin non connecté qui prescrit par
  // téléphone), auteur capture réellement qui a saisi cette prescription.
  medecin:     String,
  auteur:      { type: Schema.Types.ObjectId, ref: 'User' },
});

const HospitalizationSchema = new Schema({
  patient:              { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  // Ticket 0018 (option 2 retenue) — référence optionnelle vers le passage
  // aux urgences à l'origine de cette admission, quand il y en a un. Purement
  // déclaratif : aucune automatisation ne crée ce lien, le personnel le
  // renseigne manuellement au moment de la saisie s'il le souhaite. Ne change
  // rien pour les hospitalisations sans passage aux urgences (champ absent).
  urgence_id:           { type: Schema.Types.ObjectId, ref: 'Urgence' },
  chambre:              { type: Schema.Types.ObjectId, ref: 'Room' },
  chambre_num:          { type: String },          // texte libre quand pas de Room en BD
  lit_numero:           { type: String },
  service:              { type: Schema.Types.ObjectId, ref: 'Service' },
  service_nom:          { type: String },          // texte libre quand pas de Service en BD
  medecin_responsable:  { type: Schema.Types.ObjectId, ref: 'User' },
  medecin_nom:          { type: String },          // texte libre quand pas d'User en BD
  date_entree:          { type: Date, default: Date.now },
  date_sortie_prevue:   Date,
  date_sortie:          Date,
  motif_entree:         { type: String, required: true },
  diagnostic_entree:    String,
  diagnostic_sortie:    String,
  notes_cliniques:      [NoteSchema],
  statut:               { type: String, enum: ['en_cours','sorti','transfere','decede'], default: 'en_cours' },
  cout_total:           { type: Number, default: 0 },
  // Correction A (relecture du 5 sept. 2026) — traçabilité du calcul réel de
  // cout_total à la sortie (hospitalization.controller.js::discharge) :
  // détail lisible (durée × tarif réel du lit) quand calculé automatiquement,
  // absent si cout_total a été saisi manuellement.
  cout_detail:          String,
  // champs supplémentaires du formulaire
  provenance:           String,
  type_chambre:         String,
  batiment:             String,
  contact_urgence:      String,
  tel_urgence:          String,
  // P7-1 — champs saisis par le formulaire de sortie (frontend EMPTY_SORTIE)
  // mais absents du schéma : silencieusement perdus par findByIdAndUpdate
  // jusqu'ici. heure_sortie/recommandations/rdv_controle en texte libre ;
  // etat_patient contraint à l'enum affiché par le <select> du formulaire.
  heure_sortie:         String,
  etat_patient:         { type: String, enum: ['gueri','ameliore','stable','transfere','deces'] },
  recommandations:      String,
  rdv_controle:         String,
  // P7-2 — dossier de séjour : sous-ressources exposées via GET/POST dédiés
  constantes:           [ConstanteSchema],
  traitements:          [TraitementSchema],
  examens:              [ExamenSchema],
  visites:              [VisiteSchema],
  prescriptions_sejour: [PrescriptionSejourSchema],
}, { timestamps: true });

// T9.8 — aucun index avant ce correctif (constaté en T2.4) : toute requête
// filtrait sur COLLSCAN. statut/date_entree couvrent le dashboard (compteurs
// par statut, occupation du jour) et la liste triée par défaut ; patient et
// medecin_responsable+statut couvrent respectivement l'historique patient et
// la vue "mon service".
HospitalizationSchema.index({ statut: 1, date_entree: -1 });
HospitalizationSchema.index({ date_entree: -1 });
HospitalizationSchema.index({ patient: 1, date_entree: -1 });
HospitalizationSchema.index({ medecin_responsable: 1, statut: 1 });

module.exports = mongoose.model('Hospitalization', HospitalizationSchema);
