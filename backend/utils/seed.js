require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User          = require('../models/User');
const Patient       = require('../models/Patient');
const Service       = require('../models/Service');
const Room          = require('../models/Room');
const ExamCatalogue = require('../models/ExamCatalogue');
const Medication    = require('../models/Medication');
const Insurance     = require('../models/Insurance');
const Setting       = require('../models/Setting');
const Staff         = require('../models/Staff');
const Appointment   = require('../models/Appointment');
const Consultation  = require('../models/Consultation');
const Notification  = require('../models/Notification');
const AuditLog      = require('../models/AuditLog');
const Invoice       = require('../models/Invoice');
const LabResult     = require('../models/LabResult');

const seed = async () => {
  const uri = process.env.MONGO_URI;
  console.log(`\n🔌 Connexion à : ${uri}`);
  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`✅ MongoDB connecté — base : "${dbName}"\n`);

  // Clear all collections
  await Promise.all([
    User.deleteMany(), Patient.deleteMany(), Service.deleteMany(),
    Room.deleteMany(), ExamCatalogue.deleteMany(), Medication.deleteMany(),
    Insurance.deleteMany(), Setting.deleteMany(), Staff.deleteMany(),
    Appointment.deleteMany(), Consultation.deleteMany(), Notification.deleteMany(),
    AuditLog.deleteMany(), Invoice.deleteMany(), LabResult.deleteMany(),
  ]);
  console.log('🗑️  Collections vidées.');

  // ── Services ──────────────────────────────────────────────────────────────
  const services = await Service.insertMany([
    { nom: 'Médecine Générale',  code: 'MG',  etage: 1, couleur: '#3b82f6' },
    { nom: 'Chirurgie',          code: 'CHI', etage: 2, couleur: '#ef4444' },
    { nom: 'Maternité',          code: 'MAT', etage: 1, couleur: '#ec4899' },
    { nom: 'Pédiatrie',          code: 'PED', etage: 2, couleur: '#8b5cf6' },
    { nom: 'Urgences',           code: 'URG', etage: 0, couleur: '#f59e0b' },
  ]);
  console.log('✅ Services créés.');

  // ── Users — mot de passe en clair, le hook pre('save') du modèle hache ──────
  // Ne PAS utiliser insertMany ici : il contourne les hooks Mongoose.
  // User.create() déclenche bien pre('save') → bcrypt hash automatique.
  const MOT_DE_PASSE = 'medisync123';
  const users = await Promise.all([
    User.create({ email:'superadmin@medisync.clinic',    password:MOT_DE_PASSE, nom:'Martin',  prenom:'Sophie',     role:'superadmin' }),
    User.create({ email:'admin@medisync.clinic',         password:MOT_DE_PASSE, nom:'Nguema',  prenom:'Paul',       role:'adminclinique' }),
    User.create({ email:'medecin@medisync.clinic',       password:MOT_DE_PASSE, nom:'Obiang',  prenom:'Jean-Marie', role:'medecin',     specialite:'Médecine Générale' }),
    User.create({ email:'infirmier@medisync.clinic',     password:MOT_DE_PASSE, nom:'Mbemba',  prenom:'Marie',      role:'infirmier' }),
    User.create({ email:'laborantin@medisync.clinic',    password:MOT_DE_PASSE, nom:'Bongo',   prenom:'Pierre',     role:'laborantin' }),
    User.create({ email:'radiologue@medisync.clinic',    password:MOT_DE_PASSE, nom:'Nzé',     prenom:'Claire',     role:'radiologue' }),
    User.create({ email:'pharmacien@medisync.clinic',    password:MOT_DE_PASSE, nom:'Mba',     prenom:'André',      role:'pharmacien' }),
    User.create({ email:'comptable@medisync.clinic',     password:MOT_DE_PASSE, nom:'Eyeghe',  prenom:'Rose',       role:'comptable' }),
    User.create({ email:'receptionniste@medisync.clinic',password:MOT_DE_PASSE, nom:'Bekale',  prenom:'Hélène',     role:'receptionniste' }),
    User.create({ email:'patient@medisync.clinic',       password:MOT_DE_PASSE, nom:'Ondo',    prenom:'Georges',    role:'patient' }),
  ]);
  console.log(`✅ Utilisateurs créés (${users.length}) — mots de passe hachés par bcrypt.`);

  const superadmin = users[0];
  const medecin    = users[2];
  const laborantin = users[4];

  // ── Staff (linked to users, except superadmin & patient) ─────────────────
  const staffUsers = users.filter(u => !['superadmin','patient'].includes(u.role));
  const staffData = staffUsers.map((u, i) => ({
    utilisateur: u._id,
    poste: {
      adminclinique: 'Directeur médical',
      medecin:       'Médecin généraliste',
      infirmier:     'Infirmier principal',
      laborantin:    'Technicien de laboratoire',
      radiologue:    'Radiologue',
      pharmacien:    'Pharmacien chef',
      comptable:     'Chef comptable',
      receptionniste:'Réceptionniste',
    }[u.role] || u.role,
    service: services[0]._id,
    type_contrat: i < 4 ? 'cdi' : 'cdd',
    date_embauche: new Date('2020-01-15'),
    salaire_base: { adminclinique:800000, medecin:700000, infirmier:350000, laborantin:300000, radiologue:600000, pharmacien:450000, comptable:400000, receptionniste:250000 }[u.role] || 300000,
    conges_restants: 20,
    statut: 'actif',
  }));
  const staffRecords = await Staff.insertMany(staffData);
  console.log(`✅ Personnel créé (${staffRecords.length}).`);

  // ── Patients ──────────────────────────────────────────────────────────────
  const patientsData = [
    { nom:'Ondo',     prenom:'Georges',   date_naissance:new Date('1985-03-15'), sexe:'M', telephone:'077123456', email:'g.ondo@email.com',     numero_dossier:'CLIN-2024-00001', groupe_sanguin:'O+', allergies:['Pénicilline'],                  medecin_referent:medecin._id },
    { nom:'Nguema',   prenom:'Cécile',    date_naissance:new Date('1992-07-22'), sexe:'F', telephone:'066234567',                              numero_dossier:'CLIN-2024-00002', groupe_sanguin:'A+',                                               medecin_referent:medecin._id },
    { nom:'Mboumba',  prenom:'Thierry',   date_naissance:new Date('1978-11-05'), sexe:'M', telephone:'074345678',                              numero_dossier:'CLIN-2024-00003', groupe_sanguin:'B+', antecedents_medicaux:['Diabète type 2','HTA'] },
    { nom:'Nkoghe',   prenom:'Pauline',   date_naissance:new Date('2005-02-14'), sexe:'F', telephone:'077456789',                              numero_dossier:'CLIN-2024-00004', groupe_sanguin:'AB+' },
    { nom:'Obame',    prenom:'Léon',      date_naissance:new Date('1965-09-30'), sexe:'M', telephone:'066567890',                              numero_dossier:'CLIN-2024-00005', groupe_sanguin:'O-', antecedents_medicaux:['Insuffisance cardiaque'] },
    { nom:'Zue',      prenom:'Martine',   date_naissance:new Date('1999-04-18'), sexe:'F', telephone:'074678901',                              numero_dossier:'CLIN-2024-00006', groupe_sanguin:'A-' },
    { nom:'Bekale',   prenom:'Samuel',    date_naissance:new Date('1955-12-01'), sexe:'M', telephone:'077789012',                              numero_dossier:'CLIN-2024-00007', groupe_sanguin:'B-', antecedents_medicaux:['Asthme'] },
    { nom:'Engonga',  prenom:'Françoise', date_naissance:new Date('1988-06-25'), sexe:'F', telephone:'066890123',                              numero_dossier:'CLIN-2024-00008', groupe_sanguin:'O+' },
    { nom:'Minko',    prenom:'Patrick',   date_naissance:new Date('2015-01-10'), sexe:'M', telephone:'074901234',                              numero_dossier:'CLIN-2024-00009', groupe_sanguin:'A+' },
    { nom:'Ndong',    prenom:'Sylvie',    date_naissance:new Date('1970-08-07'), sexe:'F', telephone:'077012345',                              numero_dossier:'CLIN-2024-00010', groupe_sanguin:'AB-' },
  ];
  const patients = await Patient.insertMany(patientsData);
  console.log('✅ Patients créés (10).');

  // ── Rooms & Beds ──────────────────────────────────────────────────────────
  await Room.insertMany([
    { numero:'101', service:services[0]._id, type:'commune', etage:1, capacite:4, lits:[
      { numero:'101-A', type:'standard', statut:'libre',       prix_par_jour:5000 },
      { numero:'101-B', type:'standard', statut:'libre',       prix_par_jour:5000 },
      { numero:'101-C', type:'standard', statut:'libre',       prix_par_jour:5000 },
      { numero:'101-D', type:'standard', statut:'maintenance', prix_par_jour:5000 },
    ]},
    { numero:'201', service:services[1]._id, type:'privee', etage:2, capacite:2, lits:[
      { numero:'201-A', type:'vip', statut:'libre', prix_par_jour:15000 },
      { numero:'201-B', type:'vip', statut:'libre', prix_par_jour:15000 },
    ]},
    { numero:'REA-1', service:services[0]._id, type:'reanimation', etage:1, capacite:3, lits:[
      { numero:'REA-1A', type:'reanimation', statut:'libre', prix_par_jour:25000 },
      { numero:'REA-1B', type:'reanimation', statut:'libre', prix_par_jour:25000 },
      { numero:'REA-1C', type:'reanimation', statut:'libre', prix_par_jour:25000 },
    ]},
    { numero:'MAT-1', service:services[2]._id, type:'maternite', etage:1, capacite:3, lits:[
      { numero:'MAT-1A', type:'maternite', statut:'libre', prix_par_jour:8000 },
      { numero:'MAT-1B', type:'maternite', statut:'libre', prix_par_jour:8000 },
      { numero:'MAT-1C', type:'maternite', statut:'libre', prix_par_jour:8000 },
    ]},
  ]);
  console.log('✅ Chambres & lits créés.');

  // ── Exam Catalogue ────────────────────────────────────────────────────────
  const examens = await ExamCatalogue.insertMany([
    { nom:'NFS (Numération Formule Sanguine)', code:'NFS',        type:'laboratoire', prix:5000,   delai_rendu_h:4  },
    { nom:'Glycémie à jeun',                  code:'GLY',        type:'laboratoire', prix:2500,   delai_rendu_h:2  },
    { nom:'Créatinine sérique',               code:'CREAT',      type:'laboratoire', prix:3000,   delai_rendu_h:4  },
    { nom:'Ionogramme sanguin',               code:'IONO',       type:'laboratoire', prix:8000,   delai_rendu_h:6  },
    { nom:'CRP (Protéine C-réactive)',        code:'CRP',        type:'laboratoire', prix:4000,   delai_rendu_h:3  },
    { nom:'Troponine I',                      code:'TROP',       type:'laboratoire', prix:15000,  delai_rendu_h:2  },
    { nom:'Bilan hépatique (ASAT/ALAT)',      code:'BILAN-HEP',  type:'laboratoire', prix:7500,   delai_rendu_h:6  },
    { nom:'Test paludisme (TDR)',             code:'PALUD',      type:'laboratoire', prix:2000,   delai_rendu_h:1  },
    { nom:'Radiographie thorax (face)',       code:'RX-THORAX',  type:'imagerie',    prix:10000,  delai_rendu_h:24 },
    { nom:'Échographie abdominale',           code:'ECHO-ABD',   type:'imagerie',    prix:20000,  delai_rendu_h:48 },
    { nom:'Scanner cérébral',                code:'SCAN-CERV',  type:'imagerie',    prix:80000,  delai_rendu_h:72 },
    { nom:'IRM lombaire',                    code:'IRM-LOMB',   type:'imagerie',    prix:120000, delai_rendu_h:96 },
    { nom:'Échographie obstétricale',        code:'ECHO-OBS',   type:'imagerie',    prix:15000,  delai_rendu_h:24 },
  ]);
  console.log('✅ Catalogue examens créé (13).');

  // ── Medications ───────────────────────────────────────────────────────────
  await Medication.insertMany([
    { nom_commercial:'Amoxicilline 500mg',       dci:'Amoxicilline',             forme:'gelule',    dosage:'500mg',   categorie:'Antibiotique',     stock_actuel:350, seuil_alerte:50,  prix_achat:500,   prix_vente:800,   date_peremption:new Date('2025-12-31') },
    { nom_commercial:'Paracétamol 500mg',        dci:'Paracétamol',              forme:'comprime',  dosage:'500mg',   categorie:'Analgésique',      stock_actuel:500, seuil_alerte:100, prix_achat:100,   prix_vente:200,   date_peremption:new Date('2026-06-30') },
    { nom_commercial:'Metformine 850mg',         dci:'Metformine',               forme:'comprime',  dosage:'850mg',   categorie:'Antidiabétique',   stock_actuel:120, seuil_alerte:30,  prix_achat:800,   prix_vente:1200,  date_peremption:new Date('2025-09-30') },
    { nom_commercial:'Amlodipine 5mg',           dci:'Amlodipine',               forme:'comprime',  dosage:'5mg',     categorie:'Antihypertenseur', stock_actuel:15,  seuil_alerte:20,  prix_achat:600,   prix_vente:900,   date_peremption:new Date('2025-08-31') },
    { nom_commercial:'Artémether+Luméfantrine',  dci:'Artémether+Luméfantrine', forme:'comprime',  dosage:'20/120mg',categorie:'Antipaludéen',     stock_actuel:80,  seuil_alerte:25,  prix_achat:1500,  prix_vente:2500,  date_peremption:new Date('2025-11-30') },
    { nom_commercial:'Sérum physiologique 500ml',dci:'NaCl 0.9%',               forme:'injectable',dosage:'0.9%',    categorie:'Soluté',           stock_actuel:200, seuil_alerte:50,  prix_achat:2000,  prix_vente:3000,  date_peremption:new Date('2026-03-31') },
    { nom_commercial:'Ibuprofène 400mg',         dci:'Ibuprofène',               forme:'comprime',  dosage:'400mg',   categorie:'AINS',             stock_actuel:8,   seuil_alerte:30,  prix_achat:300,   prix_vente:500,   date_peremption:new Date('2025-10-31') },
    { nom_commercial:'Oméprazole 20mg',          dci:'Oméprazole',               forme:'gelule',    dosage:'20mg',    categorie:'IPP',              stock_actuel:90,  seuil_alerte:20,  prix_achat:400,   prix_vente:700,   date_peremption:new Date('2025-07-31') },
    { nom_commercial:'Ciprofloxacine 500mg',     dci:'Ciprofloxacine',           forme:'comprime',  dosage:'500mg',   categorie:'Antibiotique',     stock_actuel:60,  seuil_alerte:15,  prix_achat:900,   prix_vente:1500,  date_peremption:new Date('2026-01-31') },
    { nom_commercial:'Enalapril 5mg',            dci:'Énalapril',                forme:'comprime',  dosage:'5mg',     categorie:'IEC',              stock_actuel:45,  seuil_alerte:10,  prix_achat:500,   prix_vente:800,   date_peremption:new Date('2026-04-30') },
    { nom_commercial:'Furosémide 40mg',          dci:'Furosémide',               forme:'comprime',  dosage:'40mg',    categorie:'Diurétique',       stock_actuel:30,  seuil_alerte:10,  prix_achat:300,   prix_vente:500,   date_peremption:new Date('2025-12-31') },
    { nom_commercial:'Metronidazole 250mg',      dci:'Métronidazole',            forme:'comprime',  dosage:'250mg',   categorie:'Antiparasitaire',  stock_actuel:150, seuil_alerte:30,  prix_achat:200,   prix_vente:400,   date_peremption:new Date('2026-02-28') },
    { nom_commercial:'Prednisolone 5mg',         dci:'Prednisolone',             forme:'comprime',  dosage:'5mg',     categorie:'Corticoïde',       stock_actuel:70,  seuil_alerte:20,  prix_achat:400,   prix_vente:700,   date_peremption:new Date('2025-11-30') },
    { nom_commercial:'Vitamine C 500mg',         dci:'Acide ascorbique',         forme:'comprime',  dosage:'500mg',   categorie:'Vitamines',        stock_actuel:200, seuil_alerte:50,  prix_achat:100,   prix_vente:200,   date_peremption:new Date('2026-06-30') },
    { nom_commercial:'Insuline Rapide',          dci:'Insuline lispro',          forme:'injectable',dosage:'100UI/ml',categorie:'Antidiabétique',   stock_actuel:25,  seuil_alerte:5,   prix_achat:8000,  prix_vente:12000, date_peremption:new Date('2025-08-31') },
  ]);
  console.log('✅ Médicaments créés (15).');

  // ── Insurance ─────────────────────────────────────────────────────────────
  await Insurance.insertMany([
    { nom:'CNAMGS',                  code:'CNAMGS', type:'publique',  taux_prise_en_charge:80, plafond_mensuel:500000 },
    { nom:'AXA Gabon',               code:'AXA',    type:'privee',    taux_prise_en_charge:70, plafond_mensuel:300000 },
    { nom:'NSIA Santé',              code:'NSIA',   type:'privee',    taux_prise_en_charge:75, plafond_mensuel:400000 },
    { nom:'Mutuelle Fonctionnaires', code:'MFG',    type:'mutuelle',  taux_prise_en_charge:60, plafond_mensuel:250000 },
  ]);
  console.log('✅ Assurances créées (4).');

  // ── Settings ──────────────────────────────────────────────────────────────
  await Setting.insertMany([
    { cle:'nom_clinique',            valeur:'Clinique Canadienne de Souanké',      type:'string',  groupe:'clinique',      description:'Nom officiel de l\'établissement' },
    { cle:'devise',                  valeur:'FCFA',                                type:'string',  groupe:'clinique' },
    { cle:'telephone_clinique',      valeur:'+241 07 000 0000',                    type:'string',  groupe:'clinique' },
    { cle:'email_clinique',          valeur:'contact@clinique-souanke.cg',         type:'string',  groupe:'clinique' },
    { cle:'adresse_clinique',        valeur:'Souanké, Sangha, République du Congo',type:'string',  groupe:'clinique' },
    { cle:'numero_agrement',         valeur:'AGR-2024-001',                        type:'string',  groupe:'clinique' },
    { cle:'couleur_theme',           valeur:'#2563eb',                             type:'color',   groupe:'clinique' },
    { cle:'rappel_rdv_7j',           valeur:true,                                  type:'boolean', groupe:'rappels',       description:'Envoyer un rappel 7 jours avant le RDV' },
    { cle:'rappel_rdv_3j',           valeur:true,                                  type:'boolean', groupe:'rappels',       description:'Envoyer un rappel 3 jours avant le RDV' },
    { cle:'rappel_rdv_1j',           valeur:true,                                  type:'boolean', groupe:'rappels',       description:'Envoyer un rappel la veille du RDV' },
    { cle:'rappel_rdv_h2',           valeur:true,                                  type:'boolean', groupe:'rappels',       description:'Envoyer un rappel 2h avant le RDV' },
    { cle:'ia_diagnostic',           valeur:true,                                  type:'boolean', groupe:'ia',            description:'Activer l\'aide au diagnostic IA' },
    { cle:'ia_interactions',         valeur:true,                                  type:'boolean', groupe:'ia',            description:'Activer la détection d\'interactions médicamenteuses' },
    { cle:'ia_anomalies_labo',       valeur:true,                                  type:'boolean', groupe:'ia',            description:'Activer la détection d\'anomalies biologiques' },
    { cle:'ia_risque_finance',       valeur:true,                                  type:'boolean', groupe:'ia',            description:'Activer le scoring de risque financier' },
    { cle:'seuil_archive_chaud_j',   valeur:90,                                    type:'number',  groupe:'archivage',     description:'Délai (jours) pour passer en archive chaude' },
    { cle:'seuil_archive_froid_j',   valeur:365,                                   type:'number',  groupe:'archivage',     description:'Délai (jours) pour passer en archive froide' },
    { cle:'tva_defaut',              valeur:18,                                    type:'number',  groupe:'tarification',  description:'Taux de TVA par défaut (%)' },
    { cle:'email_notifications',     valeur:false,                                 type:'boolean', groupe:'email',         description:'Envoyer les notifications par email' },
    { cle:'sms_notifications',       valeur:false,                                 type:'boolean', groupe:'sms',           description:'Envoyer les notifications par SMS' },
    { cle:'duree_rdv_defaut',        valeur:30,                                    type:'number',  groupe:'general',       description:'Durée par défaut d\'un RDV (minutes)' },
  ]);
  console.log('✅ Paramètres créés (21).');

  // ── Appointments ──────────────────────────────────────────────────────────
  const now = new Date();
  const appts = await Appointment.insertMany([
    { patient:patients[0]._id, medecin:medecin._id, date_heure:new Date(now.getTime() + 2 * 3600000),   type:'consultation', motif:'Bilan de santé annuel',        statut:'confirme',  duree_minutes:30, created_by:superadmin._id },
    { patient:patients[1]._id, medecin:medecin._id, date_heure:new Date(now.getTime() + 5 * 3600000),   type:'consultation', motif:'Contrôle diabète',              statut:'planifie',  duree_minutes:45, created_by:superadmin._id },
    { patient:patients[2]._id, medecin:medecin._id, date_heure:new Date(now.getTime() - 2 * 3600000),   type:'urgence',      motif:'Douleurs thoraciques',          statut:'termine',   duree_minutes:60, created_by:superadmin._id },
    { patient:patients[3]._id, medecin:medecin._id, date_heure:new Date(now.getTime() + 1 * 86400000),  type:'suivi',        motif:'Suivi post-opératoire',         statut:'planifie',  duree_minutes:20, created_by:superadmin._id },
    { patient:patients[4]._id, medecin:medecin._id, date_heure:new Date(now.getTime() + 2 * 86400000),  type:'bilan',        motif:'Bilan cardiaque',               statut:'planifie',  duree_minutes:60, created_by:superadmin._id },
    { patient:patients[5]._id, medecin:medecin._id, date_heure:new Date(now.getTime() + 3 * 86400000),  type:'consultation', motif:'Douleurs abdominales',          statut:'planifie',  duree_minutes:30, created_by:superadmin._id },
    { patient:patients[6]._id, medecin:medecin._id, date_heure:new Date(now.getTime() - 1 * 86400000),  type:'consultation', motif:'Toux persistante',              statut:'absent',    duree_minutes:30, created_by:superadmin._id },
    { patient:patients[7]._id, medecin:medecin._id, date_heure:new Date(now.getTime() - 3 * 86400000),  type:'examen',       motif:'Examen de routine',             statut:'termine',   duree_minutes:30, created_by:superadmin._id },
  ]);
  console.log('✅ Rendez-vous créés (8).');

  // ── Consultations ─────────────────────────────────────────────────────────
  const consults = await Consultation.insertMany([
    {
      patient: patients[0]._id, medecin: medecin._id, appointment: appts[2]._id,
      date_consultation: new Date(now.getTime() - 2 * 3600000),
      signes_vitaux: { tension_systolique:120, tension_diastolique:80, pouls:72, temperature:36.8, spo2:98, poids:70, taille:172 },
      anamnese: 'Patient se plaint de douleurs thoraciques depuis ce matin.',
      examen_clinique: 'Auscultation pulmonaire normale. Abdomen souple.',
      diagnostic: 'Suspicion d\'indigestion. Angoisse.',
      recommandations: 'Repos. Oméprazole 20mg. Contrôle si persistance.',
      statut: 'terminee',
      ia_suggestions: [{ diagnostic:'Reflux gastro-oesophagien', confidence: 72 }],
    },
    {
      patient: patients[2]._id, medecin: medecin._id,
      date_consultation: new Date(now.getTime() - 7 * 86400000),
      signes_vitaux: { tension_systolique:155, tension_diastolique:95, pouls:88, temperature:37.2, spo2:96, glycemie:9.2, poids:92, taille:175 },
      anamnese: 'Suivi HTA et diabète type 2.',
      examen_clinique: 'TA élevée. Pas d\'oedème.',
      diagnostic: 'HTA mal contrôlée. Diabète déséquilibré.',
      recommandations: 'Adapter traitement antihypertenseur. Régime pauvre en sucre.',
      statut: 'terminee',
      ia_suggestions: [
        { diagnostic: 'HTA stade 2 — risque cardiovasculaire élevé', confidence: 89 },
        { diagnostic: 'Hyperglycémie — évaluer HbA1c', confidence: 82 },
      ],
    },
    {
      patient: patients[7]._id, medecin: medecin._id,
      date_consultation: new Date(now.getTime() - 3 * 86400000),
      signes_vitaux: { tension_systolique:118, tension_diastolique:76, pouls:68, temperature:38.9, spo2:97 },
      anamnese: 'Fièvre depuis 2 jours. Courbatures.',
      examen_clinique: 'Gorge inflammée. Ganglions cervicaux palpables.',
      diagnostic: 'Syndrome grippal probable.',
      recommandations: 'Paracétamol 500mg x3/jour. Repos. Hydratation.',
      statut: 'terminee',
      ia_suggestions: [{ diagnostic: 'Syndrome fébrile — éliminer paludisme', confidence: 85 }],
    },
  ]);
  console.log('✅ Consultations créées (3).');

  // ── Lab Results ───────────────────────────────────────────────────────────
  await LabResult.insertMany([
    {
      patient: patients[2]._id,
      medecin_prescripteur: medecin._id,
      examen: examens[3]._id, // Ionogramme
      priorite: 'urgente',
      date_prescription: new Date(now.getTime() - 7 * 86400000),
      date_realisation: new Date(now.getTime() - 6 * 86400000),
      date_validation: new Date(now.getTime() - 6 * 86400000),
      technicien: laborantin._id, validateur: laborantin._id,
      resultats: { 'Kaliémie': '6.8 mmol/L', 'Natrémie': '138 mmol/L', 'Chlorémie': '100 mmol/L' },
      est_critique: true,
      valeurs_critiques: 'Kaliémie 6.8 mmol/L (N: 3.5-5.0) — Hyperkaliémie critique',
      statut: 'valide',
      ia_anomalie: true,
      ia_details: 'Hyperkaliémie sévère détectée. Risque d\'arythmie cardiaque.',
    },
    {
      patient: patients[0]._id,
      medecin_prescripteur: medecin._id,
      examen: examens[7]._id, // TDR paludisme
      priorite: 'stat',
      date_prescription: new Date(now.getTime() - 2 * 86400000),
      date_realisation: new Date(now.getTime() - 2 * 86400000),
      date_validation: new Date(now.getTime() - 2 * 86400000),
      technicien: laborantin._id, validateur: laborantin._id,
      resultats: { 'Résultat': 'Négatif', 'Antigène HRP2': 'Absent' },
      est_critique: false,
      statut: 'valide',
    },
    {
      patient: patients[7]._id,
      medecin_prescripteur: medecin._id,
      examen: examens[0]._id, // NFS
      priorite: 'normale',
      date_prescription: new Date(now.getTime() - 3 * 86400000),
      statut: 'prescrit',
    },
  ]);
  console.log('✅ Résultats de labo créés (3).');

  // ── Invoices ──────────────────────────────────────────────────────────────
  const inv1 = await Invoice.create({
    numero_facture: 'INV-2024-00001',
    patient: patients[0]._id,
    created_by: superadmin._id,
    date_facture: new Date(now.getTime() - 5 * 86400000),
    lignes: [
      { libelle:'Consultation médecine générale', categorie:'consultation', prix_unitaire:5000,  quantite:1, montant:5000 },
      { libelle:'TDR Paludisme',                  categorie:'laboratoire',  prix_unitaire:2000,  quantite:1, montant:2000 },
    ],
    montant_ht: 7000, tva: 0, montant_ttc: 7000,
    paiements: [{ montant:7000, mode:'especes', date: new Date(now.getTime() - 4 * 86400000) }],
    statut: 'payee',
  });

  const inv2 = await Invoice.create({
    numero_facture: 'INV-2024-00002',
    patient: patients[2]._id,
    created_by: superadmin._id,
    date_facture: new Date(now.getTime() - 7 * 86400000),
    lignes: [
      { libelle:'Consultation suivi diabète',     categorie:'consultation', prix_unitaire:5000,  quantite:1, montant:5000 },
      { libelle:'Ionogramme sanguin',             categorie:'laboratoire',  prix_unitaire:8000,  quantite:1, montant:8000 },
      { libelle:'Metformine 850mg x30',           categorie:'pharmacie',    prix_unitaire:1200,  quantite:1, montant:1200 },
    ],
    montant_ht: 14200, tva: 0, montant_ttc: 14200,
    paiements: [{ montant:5000, mode:'mobile_money', date: new Date(now.getTime() - 6 * 86400000) }],
    statut: 'partiellement_payee',
  });

  await Invoice.create({
    numero_facture: 'INV-2024-00003',
    patient: patients[4]._id,
    created_by: superadmin._id,
    date_facture: new Date(now.getTime() - 10 * 86400000),
    lignes: [
      { libelle:'Bilan cardiologique',            categorie:'consultation', prix_unitaire:25000, quantite:1, montant:25000 },
      { libelle:'Troponine I',                    categorie:'laboratoire',  prix_unitaire:15000, quantite:1, montant:15000 },
    ],
    montant_ht: 40000, tva: 0, montant_ttc: 40000,
    montant_restant: 40000,
    statut: 'emise',
    score_risque: 65,
  });
  console.log('✅ Factures créées (3).');

  // ── Notifications ─────────────────────────────────────────────────────────
  await Notification.insertMany([
    { destinataire:medecin._id,    type:'critical',  titre:'🚨 Résultat critique — Mboumba Thierry',   message:'Kaliémie 6.8 mmol/L — Hyperkaliémie critique. Prise en charge immédiate nécessaire.',    priorite:'critique' },
    { destinataire:superadmin._id, type:'warning',   titre:'⚠️ Alertes stock pharmacie',               message:'Amlodipine 5mg (15 unités) et Ibuprofène 400mg (8 unités) sous le seuil d\'alerte.',    priorite:'haute' },
    { destinataire:medecin._id,    type:'ai_alert',  titre:'🤖 IA : Anomalie détectée',                message:'L\'IA a détecté une hyperkaliémie sévère sur l\'ionogramme du patient Mboumba Thierry.', priorite:'critique' },
    { destinataire:superadmin._id, type:'info',      titre:'ℹ️ 3 RDV planifiés aujourd\'hui',          message:'Vous avez 3 rendez-vous confirmés pour aujourd\'hui.',                                    priorite:'normale' },
    { destinataire:medecin._id,    type:'rappel',    titre:'🔔 RDV dans 2 heures',                     message:'Rendez-vous avec Georges Ondo (Bilan de santé) dans 2 heures.',                           priorite:'normale' },
    { destinataire:superadmin._id, type:'success',   titre:'✅ Facture payée',                         message:'Facture INV-2024-00001 entièrement réglée par Georges Ondo.',                             priorite:'basse',  lu:true },
  ]);
  console.log('✅ Notifications créées (6).');

  // ── Audit Logs ────────────────────────────────────────────────────────────
  await AuditLog.insertMany([
    { utilisateur:superadmin._id, action:'LOGIN',    module:'auth',     ip_address:'192.168.1.1', message:'Connexion superadmin@medisync.clinic' },
    { utilisateur:medecin._id,    action:'CREATE',   module:'consultations', ip_address:'192.168.1.5', message:'Nouvelle consultation — Ondo Georges' },
    { utilisateur:laborantin._id, action:'VALIDATE', module:'laboratory',    ip_address:'192.168.1.8', message:'Validation résultat CRITIQUE — Mboumba Thierry (Ionogramme)' },
    { utilisateur:superadmin._id, action:'CREATE',   module:'patients',      ip_address:'192.168.1.1', message:'Nouveau patient: Ndong Sylvie' },
    { utilisateur:medecin._id,    action:'LOGIN',    module:'auth',          ip_address:'192.168.1.5', message:'Connexion medecin@medisync.clinic' },
    { utilisateur:superadmin._id, action:'PAYMENT',  module:'finance',       ip_address:'192.168.1.1', message:'Paiement 7000 FCFA (espèces) — INV-2024-00001' },
  ]);
  console.log('✅ Audit logs créés (6).');

  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║         ✅ SEED TERMINÉ AVEC SUCCÈS              ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Démarrer le backend  : cd server && npm run dev  ║');
  console.log('║  Démarrer le frontend : cd client && npm run dev  ║');
  console.log('║  URL : http://localhost:5173                       ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Identifiants universels : medisync123            ║');
  console.log('║  superadmin@medisync.clinic  →  Super Admin       ║');
  console.log('║  medecin@medisync.clinic     →  Médecin           ║');
  console.log('║  pharmacien@medisync.clinic  →  Pharmacien        ║');
  console.log('║  patient@medisync.clinic     →  Patient           ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  process.exit(0);
};

seed().catch(err => { console.error('❌ Seed échoué:', err.message); process.exit(1); });
