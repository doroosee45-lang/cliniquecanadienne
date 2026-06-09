const mongoose = require('mongoose');

const CPNSchema = new mongoose.Schema({
  date:               { type: Date, default: Date.now },
  terme:              Number,  // semaines d'aménorrhée
  poids:              Number,
  taille:             Number,
  tension_sys:        Number,
  tension_dia:        Number,
  temperature:        Number,
  imc:                Number,
  hauteur_uterine:    Number,
  presentation:       String,
  bcf:                Number,
  mouvements_foetaux: { type: Boolean, default: true },
  contractions:       { type: Boolean, default: false },
  hemoglobine:        Number,
  glycemie:           Number,
  vih:                { type: String, default: 'non_fait' },
  hepatite_b:         { type: String, default: 'non_fait' },
  syphilis:           { type: String, default: 'non_fait' },
  proteinurie:        { type: String, default: 'negative' },
  vitamines:          String,
  conseils:           String,
  examens_compl:      String,
  medecin:            String,
  observations:       String,
}, { timestamps: true, _id: true });

const EchoSchema = new mongoose.Schema({
  date:           { type: Date, default: Date.now },
  type:           { type: String, default: 'morphologique' },
  trimestre:      Number,
  terme:          Number,
  sexe:           { type: String, enum: ['masculin', 'feminin', 'inconnu'], default: 'inconnu' },
  poids_estime:   Number,
  observations:   String,
  images:         [String],
  technicien:     String,
  validee:        { type: Boolean, default: false },
}, { timestamps: true, _id: true });

const PostnatalSchema = new mongoose.Schema({
  date:          { type: Date, default: Date.now },
  etat_mere:     String,
  cicatrisation: String,
  allaitement:   { type: Boolean, default: true },
  contraception: String,
  observations:  String,
}, { timestamps: true, _id: true });

const PregnancySchema = new mongoose.Schema({
  numero:                  String,
  patient_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  patient_nom:             String,
  patient_prenom:          String,
  telephone:               String,
  date_naissance:          Date,
  groupe_sanguin:          String,
  antecedents_medicaux:    String,
  antecedents_chirurgicaux:String,

  ddr:                     Date,  // date dernières règles
  dpa:                     Date,  // date prévue accouchement
  date_debut:              Date,

  nb_grossesses:           { type: Number, default: 0 },
  nb_accouchements:        { type: Number, default: 0 },
  nb_fausses_couches:      { type: Number, default: 0 },
  nb_morts_nes:            { type: Number, default: 0 },
  nb_cesariennes:          { type: Number, default: 0 },

  statut: {
    type: String,
    enum: ['active', 'accouchee', 'suivi_postnatal', 'cloturee', 'a_risque'],
    default: 'active',
  },
  niveau_risque: {
    type: String,
    enum: ['faible', 'modere', 'eleve'],
    default: 'faible',
  },
  facteurs_risque: [String],

  medecin_responsable: String,
  sage_femme:          String,

  cpns:         [CPNSchema],
  echographies: [EchoSchema],

  salle_travail: {
    date_admission:         Date,
    motif_admission:        String,
    etat_patient:           String,
    dilatation:             Number,
    frequence_contractions: Number,
    rcf:                    Number,
    rupture_membranes:      { type: Boolean, default: false },
    heure_rupture:          Date,
    en_travail:             { type: Boolean, default: false },
  },

  consultations_postnatales: [PostnatalSchema],
  notes: String,

  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

PregnancySchema.pre('save', async function (next) {
  if (!this.numero) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Pregnancy').countDocuments({ numero: new RegExp(`^MAT-${year}-`) });
    this.numero = `MAT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  if (this.ddr && !this.dpa) {
    const dpa = new Date(this.ddr);
    dpa.setDate(dpa.getDate() + 280);
    this.dpa = dpa;
  }
  next();
});

module.exports = mongoose.model('Pregnancy', PregnancySchema);
