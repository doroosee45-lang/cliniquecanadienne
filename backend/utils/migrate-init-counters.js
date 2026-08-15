/**
 * Migration à exécuter UNE SEULE FOIS avant/au déploiement du compteur
 * atomique (utils/counter.js) sur une base déjà peuplée.
 *
 * Les numéros séquentiels (numero_dossier, numero_facture, numero_rx,
 * matricule, numero d'urgence, numero de dossier chirurgical/bloc) étaient
 * jusqu'ici dérivés de countDocuments()/findOne().sort() au moment de la
 * création. Cette approche est sujette à une condition de course, corrigée
 * en la remplaçant par un compteur atomique (collection Counter). Mais un
 * compteur qui démarrerait à 0 sur une base contenant déjà N documents
 * réutiliserait des numéros déjà pris et échouerait sur l'index unique dès
 * la première création — ce script initialise chaque compteur au maximum
 * réellement utilisé, pour repartir exactement là où l'ancienne logique
 * s'était arrêtée.
 *
 * Usage : node utils/migrate-init-counters.js
 * Sans danger à ré-exécuter : ne fait que relever un compteur existant,
 * jamais le redescendre.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const Patient = require('../models/Patient');
const Invoice = require('../models/Invoice');
const Prescription = require('../models/Prescription');
const Staff = require('../models/Staff');
const Urgence = require('../models/Urgence');
const DossierChirurgical = require('../models/DossierChirurgical');
const Pregnancy = require('../models/Pregnancy');
const Delivery = require('../models/Delivery');
const Newborn = require('../models/Newborn');
const Child = require('../models/Child');
const PediatricConsultation = require('../models/PediatricConsultation');
const Echographie = require('../models/Echographie');

// Relève counterKey au max(seq déjà atteint, valeur actuelle du compteur).
const bump = async (counterKey, currentMax) => {
  if (currentMax <= 0) return;
  const existing = await Counter.findById(counterKey);
  const target = Math.max(currentMax, existing?.seq || 0);
  await Counter.findByIdAndUpdate(counterKey, { seq: target }, { upsert: true });
  console.log(`  ${counterKey} → ${target}`);
};

// Extrait le plus grand suffixe numérique parmi des identifiants du type PREFIX-YYYY-NNNNN.
const maxSeqFor = (docs, field, prefix, year) => {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  return docs.reduce((max, doc) => {
    const m = re.exec(doc[field] || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté — initialisation des compteurs\n');

  const year = new Date().getFullYear();

  const patients = await Patient.find({}, 'numero_dossier');
  await bump(`patient-${year}`, maxSeqFor(patients, 'numero_dossier', 'CLIN', year));

  const invoices = await Invoice.find({}, 'numero_facture');
  await bump(`invoice-${year}`, maxSeqFor(invoices, 'numero_facture', 'INV', year));

  const prescriptions = await Prescription.find({}, 'numero_rx');
  await bump(`prescription-${year}`, maxSeqFor(prescriptions, 'numero_rx', 'RX', year));

  const urgences = await Urgence.find({}, 'numero');
  await bump(`urgence-${year}`, maxSeqFor(urgences, 'numero', 'URG', year));

  const dossiers = await DossierChirurgical.find({}, 'numero');
  await bump(`chirurgie-${year}`, maxSeqFor(dossiers, 'numero', 'CHIR', year));
  await bump(`bloc-${year}`,      maxSeqFor(dossiers, 'numero', 'BLOC', year));

  const pregnancies = await Pregnancy.find({}, 'numero');
  await bump(`pregnancy-${year}`, maxSeqFor(pregnancies, 'numero', 'MAT', year));

  const deliveries = await Delivery.find({}, 'numero');
  await bump(`delivery-${year}`, maxSeqFor(deliveries, 'numero', 'ACC', year));

  const newborns = await Newborn.find({}, 'numero');
  await bump(`newborn-${year}`, maxSeqFor(newborns, 'numero', 'NB', year));

  const children = await Child.find({}, 'numero');
  await bump(`child-${year}`, maxSeqFor(children, 'numero', 'PED', year));

  const pedConsults = await PediatricConsultation.find({}, 'numero');
  await bump(`pediatric-consultation-${year}`, maxSeqFor(pedConsults, 'numero', 'CPED', year));

  const echos = await Echographie.find({}, 'numero');
  await bump(`echographie-${year}`, maxSeqFor(echos, 'numero', 'ECH', year));

  const staff = await Staff.find({}, 'matricule');
  const staffMax = staff.reduce((max, s) => {
    const m = /^STAF-(\d+)$/.exec(s.matricule || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  await bump('staff', staffMax);

  console.log('\n✅ Compteurs initialisés.');
  await mongoose.disconnect();
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
