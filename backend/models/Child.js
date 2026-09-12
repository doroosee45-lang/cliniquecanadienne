const mongoose = require('mongoose');

const VaccinationSchema = new mongoose.Schema({
  vaccin:         { type: String, required: true },
  date:           { type: Date, default: Date.now },
  lot:            String,
  dose:           String,
  administre_par: String,
  rappel_prevu:   Date,
}, { _id: true, timestamps: true });

const MesureCroissanceSchema = new mongoose.Schema({
  date:              { type: Date, default: Date.now },
  poids:             Number,  // kg
  taille:            Number,  // cm
  perimetre_cranien: Number,  // cm
  imc:               Number,
  z_score_poids:     Number,
  z_score_taille:    Number,
  statut_nutritionnel: {
    type: String,
    enum: ['normal', 'mam', 'mas', 'surpoids', 'obesite'],
    default: 'normal',
  },
  notes: String,
}, { _id: true, timestamps: true });

const MaladieChronSchema = new mongoose.Schema({
  maladie:               { type: String, required: true },
  date_diagnostic:       Date,
  traitement:            String,
  controle:              { type: String, enum: ['bien', 'acceptable', 'modere', 'mauvais'], default: 'bien' },
  derniere_consultation: Date,
  prochaine_consultation:Date,
  notes:                 String,
}, { _id: true, timestamps: true });

const ChildSchema = new mongoose.Schema({
  numero:          { type: String, unique: true, sparse: true },
  // SPEC-10 (correction du 12 sept. 2026, audit indépendant) — patient_id
  // n'était jamais validé (client pouvait fournir un ObjectId fabriqué/
  // orphelin). pediatrieController.js::create l'exige et le vérifie
  // désormais réellement, comme Pediatrie.jsx::ModalDossier l'exige déjà
  // côté interface (même raisonnement que SPEC-03 pour Pregnancy) — non
  // required ici au niveau du schéma, car maternityController.js::
  // createChildDossier (Newborn→Child) crée légitimement un dossier enfant
  // avant qu'un Patient dédié n'existe pour ce nouveau-né (aucune création
  // automatique de Patient à la naissance dans ce système).
  patient_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  // SPEC-10 — lien de retour direct et fiable vers le Newborn d'origine
  // (createChildDossier, maternityController.js). Newborn.child_id pointait
  // déjà Newborn→Child ; l'absence de champ symétrique Child→Newborn
  // obligeait une requête de recherche inverse (Newborn.findOne({child_id}))
  // au lieu d'une référence directe stockée.
  newborn_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Newborn' },

  nom:             { type: String, required: true },
  prenom:          String,
  date_naissance:  { type: Date, required: true },
  sexe:            { type: String, enum: ['M', 'F'], required: true },

  parent_nom:      String,
  parent_tel:      String,
  parent_relation: { type: String, default: 'parent' },

  groupe_sanguin:  String,
  allergies:       [String],
  antecedents_medicaux:    String,
  antecedents_familiaux:   String,

  statut: {
    type: String,
    enum: ['normal', 'surveillance', 'a_risque', 'chronique'],
    default: 'normal',
  },

  // Mesures actuelles (dupliquées pour affichage rapide)
  poids_actuel:  Number,
  taille_actuelle: Number,

  vaccinations:       [VaccinationSchema],
  mesures_croissance: [MesureCroissanceSchema],
  maladies_chroniques:[MaladieChronSchema],

  notes:       String,
  created_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ChildSchema.pre('save', async function (next) {
  if (!this.numero) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`child-${year}`);
    this.numero = `PED-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

// Calcul de l'âge en texte
ChildSchema.virtual('age_texte').get(function () {
  if (!this.date_naissance) return '—';
  const diff = Math.floor((Date.now() - new Date(this.date_naissance)) / (365.25 * 86400000));
  if (diff < 1) {
    const mois = Math.floor((Date.now() - new Date(this.date_naissance)) / (30.5 * 86400000));
    return `${mois} mois`;
  }
  return `${diff} an${diff > 1 ? 's' : ''}`;
});

ChildSchema.set('toJSON', { virtuals: true });
ChildSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Child', ChildSchema);
