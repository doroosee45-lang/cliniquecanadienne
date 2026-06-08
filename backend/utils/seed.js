/**
 * SEED COMPLET — Clinique Canadienne de Souanké
 * Données réelles pour toutes les fonctionnalités
 * Usage : node backend/utils/seed.js
 */
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
const Hospitalization = require('../models/Hospitalization');
const Prescription  = require('../models/Prescription');

const seed = async () => {
  const uri = process.env.MONGO_URI;
  console.log(`\n🔌 Connexion à : ${uri?.substring(0, 40)}...`);
  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`✅ MongoDB connecté — base : "${dbName}"\n`);

  // ── Vider toutes les collections ─────────────────────────────────────────
  await Promise.all([
    User.deleteMany(), Patient.deleteMany(), Service.deleteMany(),
    Room.deleteMany(), ExamCatalogue.deleteMany(), Medication.deleteMany(),
    Insurance.deleteMany(), Setting.deleteMany(), Staff.deleteMany(),
    Appointment.deleteMany(), Consultation.deleteMany(), Notification.deleteMany(),
    AuditLog.deleteMany(), Invoice.deleteMany(), LabResult.deleteMany(),
    Hospitalization.deleteMany(), Prescription.deleteMany(),
  ]);
  console.log('🗑️  Collections vidées.\n');

  // ════════════════════════════════════════════════════════════════════════
  // 1. SERVICES MÉDICAUX
  // ════════════════════════════════════════════════════════════════════════
  const services = await Service.insertMany([
    { nom: 'Médecine Générale',  code: 'MG',  etage: 1, couleur: '#3b82f6', description: 'Consultations et soins primaires' },
    { nom: 'Chirurgie',          code: 'CHI', etage: 2, couleur: '#ef4444', description: 'Interventions chirurgicales planifiées et urgentes' },
    { nom: 'Maternité',          code: 'MAT', etage: 1, couleur: '#ec4899', description: 'Suivi de grossesse, accouchements et soins néonataux' },
    { nom: 'Pédiatrie',          code: 'PED', etage: 2, couleur: '#8b5cf6', description: 'Soins aux enfants de 0 à 15 ans' },
    { nom: 'Urgences',           code: 'URG', etage: 0, couleur: '#f59e0b', description: 'Prise en charge des urgences médicales et traumatiques' },
    { nom: 'Laboratoire',        code: 'LAB', etage: 0, couleur: '#10b981', description: 'Analyses biologiques et biochimiques' },
    { nom: 'Radiologie',         code: 'RAD', etage: 0, couleur: '#6366f1', description: 'Imagerie médicale : radio, écho, scanner' },
    { nom: 'Pharmacie',          code: 'PHA', etage: 0, couleur: '#14b8a6', description: 'Dispensation des médicaments et conseils pharmaceutiques' },
  ]);
  const [svcMG, svcCHI, svcMAT, svcPED, svcURG, svcLAB, svcRAD, svcPHA] = services;
  console.log(`✅ Services créés (${services.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 2. UTILISATEURS
  // ════════════════════════════════════════════════════════════════════════
  const PWD = 'medisync123';
  const users = await Promise.all([
    // Super Admin
    User.create({ email:'oseedoro@gmail.com',              password:PWD, nom:'Doroosee',   prenom:'Osee',        role:'superadmin',     telephone:'+242 06 000 0001', statut:'actif' }),
    // Admins clinique
    User.create({ email:'admin@clinique-souanke.cg',       password:PWD, nom:'Mboula',     prenom:'Jean-Pierre', role:'adminclinique',  telephone:'+242 06 100 0001', statut:'actif' }),
    // Médecins
    User.create({ email:'dr.nguema@clinique-souanke.cg',   password:PWD, nom:'Nguema',     prenom:'Albert',      role:'medecin',        telephone:'+242 06 200 0001', statut:'actif', specialite:'Médecine Générale' }),
    User.create({ email:'dr.obiang@clinique-souanke.cg',   password:PWD, nom:'Obiang',     prenom:'Marie-Claire',role:'medecin',        telephone:'+242 06 200 0002', statut:'actif', specialite:'Chirurgie Générale' }),
    User.create({ email:'dr.moussavou@clinique-souanke.cg',password:PWD, nom:'Moussavou',  prenom:'Théodore',    role:'medecin',        telephone:'+242 06 200 0003', statut:'actif', specialite:'Pédiatrie' }),
    User.create({ email:'dr.nze@clinique-souanke.cg',      password:PWD, nom:'Nzé',        prenom:'Cécile',      role:'radiologue',     telephone:'+242 06 200 0004', statut:'actif', specialite:'Radiologie' }),
    // Infirmiers
    User.create({ email:'inf.bekale@clinique-souanke.cg',  password:PWD, nom:'Bekale',     prenom:'Hélène',      role:'infirmier',      telephone:'+242 06 300 0001', statut:'actif' }),
    User.create({ email:'inf.mba@clinique-souanke.cg',     password:PWD, nom:'Mba',        prenom:'André',       role:'infirmier',      telephone:'+242 06 300 0002', statut:'actif' }),
    User.create({ email:'inf.eyeghe@clinique-souanke.cg',  password:PWD, nom:'Eyeghe',     prenom:'Rose',        role:'infirmier',      telephone:'+242 06 300 0003', statut:'actif' }),
    // Laborantins
    User.create({ email:'lab.bongo@clinique-souanke.cg',   password:PWD, nom:'Bongo',      prenom:'Pierre',      role:'laborantin',     telephone:'+242 06 400 0001', statut:'actif' }),
    User.create({ email:'lab.mbemba@clinique-souanke.cg',  password:PWD, nom:'Mbemba',     prenom:'Sylvie',      role:'laborantin',     telephone:'+242 06 400 0002', statut:'actif' }),
    // Pharmaciens
    User.create({ email:'ph.ndong@clinique-souanke.cg',    password:PWD, nom:'Ndong',      prenom:'Isabelle',    role:'pharmacien',     telephone:'+242 06 500 0001', statut:'actif' }),
    // Comptable
    User.create({ email:'cpt.ella@clinique-souanke.cg',    password:PWD, nom:'Ella',       prenom:'Patrick',     role:'comptable',      telephone:'+242 06 600 0001', statut:'actif' }),
    // Réceptionnistes
    User.create({ email:'rec.mouanda@clinique-souanke.cg', password:PWD, nom:'Mouanda',    prenom:'Amina',       role:'receptionniste', telephone:'+242 06 700 0001', statut:'actif' }),
    // Patients portail
    User.create({ email:'patient@clinique-souanke.cg',     password:PWD, nom:'Ondo',       prenom:'Georges',     role:'patient',        telephone:'+242 06 800 0001', statut:'actif' }),
  ]);

  const [superadmin, admin, drNguema, drObiang, drMoussavou, drNze,
         infBekale, infMba, infEyeghe, labBongo, labMbemba,
         phNdong, cptElla, recMouanda, patientUser] = users;
  console.log(`✅ Utilisateurs créés (${users.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 3. PERSONNEL (Staff)
  // ════════════════════════════════════════════════════════════════════════
  // Création séquentielle pour éviter les conflits de matricule auto-généré
  const staffToCreate = [
    { matricule:'STAF-0001', utilisateur: admin._id,       poste: 'Directeur médical',          service: svcMG._id,  date_embauche: new Date('2018-03-01'), type_contrat: 'cdi', salaire_base: 850000,  conges_restants: 15, statut: 'actif', competences: ['Gestion administrative', 'Coordination médicale'] },
    { matricule:'STAF-0002', utilisateur: drNguema._id,    poste: 'Médecin généraliste',         service: svcMG._id,  date_embauche: new Date('2019-07-15'), type_contrat: 'cdi', salaire_base: 750000,  conges_restants: 12, statut: 'actif', competences: ['Médecine interne', 'Urgences'] },
    { matricule:'STAF-0003', utilisateur: drObiang._id,    poste: 'Chirurgien principal',        service: svcCHI._id, date_embauche: new Date('2017-01-10'), type_contrat: 'cdi', salaire_base: 950000,  conges_restants: 8,  statut: 'actif', competences: ['Chirurgie abdominale', 'Laparoscopie'] },
    { matricule:'STAF-0004', utilisateur: drMoussavou._id, poste: 'Pédiatre',                   service: svcPED._id, date_embauche: new Date('2020-09-01'), type_contrat: 'cdi', salaire_base: 720000,  conges_restants: 18, statut: 'actif', competences: ['Pédiatrie générale', 'Néonatologie'] },
    { matricule:'STAF-0005', utilisateur: drNze._id,       poste: 'Radiologue',                  service: svcRAD._id, date_embauche: new Date('2021-04-20'), type_contrat: 'cdi', salaire_base: 780000,  conges_restants: 20, statut: 'actif', competences: ['Échographie', 'Radiographie', 'Scanner'] },
    { matricule:'STAF-0006', utilisateur: infBekale._id,   poste: 'Infirmière principale',       service: svcURG._id, date_embauche: new Date('2016-06-01'), type_contrat: 'cdi', salaire_base: 380000,  conges_restants: 10, statut: 'actif', competences: ['Soins intensifs', 'Prise en charge urgences'] },
    { matricule:'STAF-0007', utilisateur: infMba._id,      poste: 'Infirmier soins généraux',    service: svcMG._id,  date_embauche: new Date('2020-02-15'), type_contrat: 'cdi', salaire_base: 350000,  conges_restants: 22, statut: 'actif', competences: ['Soins de base', 'Pansements'] },
    { matricule:'STAF-0008', utilisateur: infEyeghe._id,   poste: 'Infirmière maternité',        service: svcMAT._id, date_embauche: new Date('2018-11-01'), type_contrat: 'cdi', salaire_base: 365000,  conges_restants: 14, statut: 'actif', competences: ['Soins obstétriques', 'Soins néonataux'] },
    { matricule:'STAF-0009', utilisateur: labBongo._id,    poste: 'Technicien de laboratoire',   service: svcLAB._id, date_embauche: new Date('2019-03-10'), type_contrat: 'cdi', salaire_base: 410000,  conges_restants: 17, statut: 'actif', competences: ['Hématologie', 'Biochimie', 'Microbiologie'] },
    { matricule:'STAF-0010', utilisateur: labMbemba._id,   poste: 'Technicienne de laboratoire', service: svcLAB._id, date_embauche: new Date('2022-01-05'), type_contrat: 'cdd', salaire_base: 380000,  conges_restants: 20, statut: 'actif', competences: ['Sérologie', 'Parasitologie'] },
    { matricule:'STAF-0011', utilisateur: phNdong._id,     poste: 'Pharmacienne chef',           service: svcPHA._id, date_embauche: new Date('2017-08-15'), type_contrat: 'cdi', salaire_base: 560000,  conges_restants: 11, statut: 'actif', competences: ['Dispensation', 'Gestion stock', 'Pharmacovigilance'] },
    { matricule:'STAF-0012', utilisateur: cptElla._id,     poste: 'Chef comptable',              service: svcMG._id,  date_embauche: new Date('2015-05-20'), type_contrat: 'cdi', salaire_base: 490000,  conges_restants: 9,  statut: 'actif', competences: ['Comptabilité générale', 'Facturation', 'Paie'] },
    { matricule:'STAF-0013', utilisateur: recMouanda._id,  poste: 'Réceptionniste',              service: svcMG._id,  date_embauche: new Date('2021-10-01'), type_contrat: 'cdi', salaire_base: 280000,  conges_restants: 20, statut: 'actif', competences: ['Accueil patients', 'Prise de RDV', 'Facturation'] },
  ];
  const staffList = await Staff.insertMany(staffToCreate);
  console.log(`✅ Personnel créé (${staffList.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 4. ASSURANCES
  // ════════════════════════════════════════════════════════════════════════
  const assurances = await Insurance.insertMany([
    { nom: 'CNSS Congo',           code: 'CNSS',  taux_prise_en_charge: 80, statut: 'actif', contact: '+242 22 281 5000', email: 'infos@cnss.cg' },
    { nom: 'CNAMGS',               code: 'CNAM',  taux_prise_en_charge: 75, statut: 'actif', contact: '+241 01 761 5050', email: 'contact@cnamgs.ga' },
    { nom: 'Axa Assurances Congo', code: 'AXA',   taux_prise_en_charge: 70, statut: 'actif', contact: '+242 22 281 6000', email: 'sante@axa.cg' },
    { nom: 'Sanlam Assurances',    code: 'SAN',   taux_prise_en_charge: 65, statut: 'actif', contact: '+242 22 281 7000', email: 'sante@sanlam.cg' },
  ]);
  console.log(`✅ Assurances créées (${assurances.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 5. PATIENTS
  // ════════════════════════════════════════════════════════════════════════
  const yr = new Date().getFullYear();
  const patientsData = [
    { numero_dossier:`CLIN-${yr}-00001`, nom:'Mboumba',    prenom:'Jean-Baptiste', date_naissance:new Date('1978-03-15'), sexe:'M', groupe_sanguin:'A+', telephone:'+242 06 111 2233', email:'jb.mboumba@gmail.com',    adresse:{rue:'Quartier Centre',    ville:'Souanké', pays:'Congo'}, allergies:['Pénicilline'],        antecedents_medicaux:['Hypertension artérielle','Diabète type 2'],     contact_urgence:{nom:'Marie Mboumba',    relation:'Épouse', telephone:'+242 06 111 2234'}, assurances:[{compagnie:'CNSS Congo',taux:80}] },
    { numero_dossier:`CLIN-${yr}-00002`, nom:'Ngoma',      prenom:'Fatou',         date_naissance:new Date('1990-07-22'), sexe:'F', groupe_sanguin:'O+', telephone:'+242 06 222 3344', email:'fatou.ngoma@yahoo.fr',      adresse:{rue:'Quartier Marché',    ville:'Souanké', pays:'Congo'}, allergies:[],                     antecedents_medicaux:['Anémie ferriprive'],                            contact_urgence:{nom:'Brice Ngoma',      relation:'Époux',  telephone:'+242 06 222 3345'}, assurances:[] },
    { numero_dossier:`CLIN-${yr}-00003`, nom:'Ondoa',      prenom:'Lucie',         date_naissance:new Date('2010-12-05'), sexe:'F', groupe_sanguin:'B+', telephone:'+242 06 333 4455', email:'',                          adresse:{rue:'Rue de la Liberté',  ville:'Souanké', pays:'Congo'}, allergies:['Aspirine'],           antecedents_medicaux:['Paludisme récurrent'],                          contact_urgence:{nom:'Paul Ondoa',       relation:'Père',   telephone:'+242 06 333 4456'}, assurances:[{compagnie:'CNAMGS',taux:75}] },
    { numero_dossier:`CLIN-${yr}-00004`, nom:'Essono',     prenom:'Marc',          date_naissance:new Date('1965-09-30'), sexe:'M', groupe_sanguin:'AB-',telephone:'+242 06 444 5566', email:'marc.essono@gmail.com',     adresse:{rue:'Quartier Plateau',   ville:'Souanké', pays:'Congo'}, allergies:['Sulfamides','Latex'],  antecedents_medicaux:['Cardiopathie ischémique','HTAP'],               contact_urgence:{nom:'Claire Essono',    relation:'Fille',  telephone:'+242 06 444 5567'}, assurances:[{compagnie:'Axa Assurances Congo',taux:70}] },
    { numero_dossier:`CLIN-${yr}-00005`, nom:'Akana',      prenom:'Sophie',        date_naissance:new Date('1985-04-18'), sexe:'F', groupe_sanguin:'A-', telephone:'+242 06 555 6677', email:'sophie.akana@hotmail.com',  adresse:{rue:'Rue du Commerce',    ville:'Souanké', pays:'Congo'}, allergies:[],                     antecedents_medicaux:['Asthme bronchique'],                            contact_urgence:{nom:'Eric Akana',       relation:'Frère',  telephone:'+242 06 555 6678'}, assurances:[{compagnie:'CNSS Congo',taux:80}] },
    { numero_dossier:`CLIN-${yr}-00006`, nom:'Moutombi',   prenom:'David',         date_naissance:new Date('1972-11-08'), sexe:'M', groupe_sanguin:'O-', telephone:'+242 06 666 7788', email:'d.moutombi@gmail.com',      adresse:{rue:'Quartier Nord',      ville:'Souanké', pays:'Congo'}, allergies:['Iode'],               antecedents_medicaux:['Ulcère gastrique','Hépatite B chronique'],       contact_urgence:{nom:'Irène Moutombi',   relation:'Épouse', telephone:'+242 06 666 7789'}, assurances:[] },
    { numero_dossier:`CLIN-${yr}-00007`, nom:'Nzinga',     prenom:'Carine',        date_naissance:new Date('1998-02-14'), sexe:'F', groupe_sanguin:'B-', telephone:'+242 06 777 8899', email:'carine.nzinga@gmail.com',   adresse:{rue:"Rue de l'École",     ville:'Souanké', pays:'Congo'}, allergies:[],                     antecedents_medicaux:[],                                               contact_urgence:{nom:'Alice Nzinga',     relation:'Mère',   telephone:'+242 06 777 8900'}, assurances:[{compagnie:'Sanlam Assurances',taux:65}] },
    { numero_dossier:`CLIN-${yr}-00008`, nom:'Biyoghe',    prenom:'Emmanuel',      date_naissance:new Date('1955-06-25'), sexe:'M', groupe_sanguin:'A+', telephone:'+242 06 888 9900', email:'',                          adresse:{rue:'Quartier Est',       ville:'Souanké', pays:'Congo'}, allergies:['AINS'],               antecedents_medicaux:['Arthrose','Prostatite chronique','Diabète type 2'],contact_urgence:{nom:'Jean Biyoghe',     relation:'Fils',   telephone:'+242 06 888 9901'}, assurances:[{compagnie:'CNSS Congo',taux:80}] },
    { numero_dossier:`CLIN-${yr}-00009`, nom:'Mounguengui',prenom:'Grâce',         date_naissance:new Date('2005-08-10'), sexe:'F', groupe_sanguin:'O+', telephone:'+242 06 111 0011', email:'',                          adresse:{rue:'Rue Centrale',       ville:'Souanké', pays:'Congo'}, allergies:[],                     antecedents_medicaux:['Paludisme simple'],                             contact_urgence:{nom:'Robert Mounguengui',relation:'Père', telephone:'+242 06 111 0012'}, assurances:[] },
    { numero_dossier:`CLIN-${yr}-00010`, nom:'Oyono',      prenom:'Patrice',       date_naissance:new Date('1980-01-20'), sexe:'M', groupe_sanguin:'AB+',telephone:'+242 06 222 0022', email:'p.oyono@gmail.com',         adresse:{rue:'Avenue de la Gare',  ville:'Souanké', pays:'Congo'}, allergies:[],                     antecedents_medicaux:['Hypertension artérielle'],                      contact_urgence:{nom:'Jeanne Oyono',     relation:'Épouse', telephone:'+242 06 222 0023'}, assurances:[{compagnie:'CNAMGS',taux:75}] },
    { numero_dossier:`CLIN-${yr}-00011`, nom:'Meye',       prenom:'Brigitte',      date_naissance:new Date('1992-05-30'), sexe:'F', groupe_sanguin:'A+', telephone:'+242 06 333 0033', email:'brigitte.meye@gmail.com',   adresse:{rue:'Quartier Sud',       ville:'Souanké', pays:'Congo'}, allergies:['Erythromycine'],      antecedents_medicaux:['Appendicectomie 2015'],                         contact_urgence:{nom:'Paul Meye',        relation:'Époux',  telephone:'+242 06 333 0034'}, assurances:[{compagnie:'Axa Assurances Congo',taux:70}] },
    { numero_dossier:`CLIN-${yr}-00012`, nom:'Nkoghe',     prenom:'Antoine',       date_naissance:new Date('2018-09-12'), sexe:'M', groupe_sanguin:'B+', telephone:'+242 06 444 0044', email:'',                          adresse:{rue:'Rue des Manguiers',  ville:'Souanké', pays:'Congo'}, allergies:[],                     antecedents_medicaux:['Prématurité à 34 SA'],                          contact_urgence:{nom:'Marie Nkoghe',     relation:'Mère',   telephone:'+242 06 444 0045'}, assurances:[{compagnie:'CNSS Congo',taux:80}] },
  ];
  const patients = await Patient.insertMany(patientsData.map(p => ({ ...p, cree_par: superadmin._id, actif: true })));
  const [ptMboumba, ptNgoma, ptOndoa, ptEssono, ptAkana, ptMoutombi, ptNzinga, ptBiyoghe, ptMounguengui, ptOyono, ptMeye, ptNkoghe] = patients;
  console.log(`✅ Patients créés (${patients.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 6. CHAMBRES & LITS
  // ════════════════════════════════════════════════════════════════════════
  const rooms = await Room.insertMany([
    { numero:'CH-101', service:svcMG._id,  type:'privee',      etage:1, capacite:1, statut:'actif', lits:[{ numero:'L-101-A', type:'standard', statut:'libre',  prix_par_jour:15000 }] },
    { numero:'CH-102', service:svcMG._id,  type:'commune',     etage:1, capacite:2, statut:'actif', lits:[{ numero:'L-102-A', type:'standard', statut:'occupe', prix_par_jour:8000 },{ numero:'L-102-B', type:'standard', statut:'libre', prix_par_jour:8000 }] },
    { numero:'CH-201', service:svcCHI._id, type:'privee',      etage:2, capacite:1, statut:'actif', lits:[{ numero:'L-201-A', type:'standard', statut:'occupe', prix_par_jour:20000 }] },
    { numero:'CH-202', service:svcCHI._id, type:'vip',         etage:2, capacite:1, statut:'actif', lits:[{ numero:'L-202-A', type:'vip',      statut:'libre',  prix_par_jour:35000 }] },
    { numero:'CH-MAT', service:svcMAT._id, type:'maternite',   etage:1, capacite:3, statut:'actif', lits:[{ numero:'L-MAT-A', type:'maternite',statut:'occupe', prix_par_jour:18000 },{ numero:'L-MAT-B', type:'maternite', statut:'libre', prix_par_jour:18000 },{ numero:'L-MAT-C', type:'maternite', statut:'libre', prix_par_jour:18000 }] },
    { numero:'CH-PED', service:svcPED._id, type:'pediatrie',   etage:2, capacite:2, statut:'actif', lits:[{ numero:'L-PED-A', type:'pediatrique',statut:'occupe',prix_par_jour:10000 },{ numero:'L-PED-B', type:'pediatrique', statut:'libre', prix_par_jour:10000 }] },
    { numero:'CH-REA', service:svcURG._id, type:'reanimation', etage:0, capacite:2, statut:'actif', lits:[{ numero:'L-REA-A', type:'reanimation',statut:'libre', prix_par_jour:45000 },{ numero:'L-REA-B', type:'reanimation', statut:'maintenance', prix_par_jour:45000 }] },
    { numero:'BLOC-1', service:svcCHI._id, type:'commune',     etage:2, capacite:1, statut:'actif', lits:[{ numero:'BL-01',   type:'standard', statut:'libre',  prix_par_jour:0 }] },
    { numero:'BLOC-2', service:svcCHI._id, type:'commune',     etage:2, capacite:1, statut:'actif', lits:[{ numero:'BL-02',   type:'standard', statut:'libre',  prix_par_jour:0 }] },
  ]);
  console.log(`✅ Chambres & lits créés (${rooms.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 7. CATALOGUE D'EXAMENS
  // ════════════════════════════════════════════════════════════════════════
  const examens = await ExamCatalogue.insertMany([
    // Biologie
    { code:'NFS',    nom:'Numération Formule Sanguine',      type:'laboratoire',   categorie:'Hématologie',  prix:5500,  duree_min:60,  description:'Analyse des cellules sanguines' },
    { code:'GLUC',   nom:'Glycémie à jeun',                  type:'laboratoire',   categorie:'Biochimie',    prix:3500,  duree_min:30,  description:'Dosage glucose sanguin' },
    { code:'CREAT',  nom:'Créatinine',                       type:'laboratoire',   categorie:'Biochimie',    prix:4000,  duree_min:45,  description:'Fonction rénale' },
    { code:'BILI',   nom:'Bilan hépatique complet',          type:'laboratoire',   categorie:'Biochimie',    prix:12000, duree_min:90,  description:'ASAT, ALAT, GGT, PAL, bilirubine' },
    { code:'LIPID',  nom:'Bilan lipidique',                  type:'laboratoire',   categorie:'Biochimie',    prix:9000,  duree_min:60,  description:'Cholestérol total, HDL, LDL, triglycérides' },
    { code:'VS',     nom:'Vitesse de Sédimentation',         type:'laboratoire',   categorie:'Hématologie',  prix:2500,  duree_min:120, description:'Marqueur inflammatoire' },
    { code:'CRP',    nom:'CRP (Protéine C Réactive)',        type:'laboratoire',   categorie:'Immunologie',  prix:6000,  duree_min:60,  description:'Marqueur d\'inflammation aiguë' },
    { code:'PALU',   nom:'Goutte épaisse / Test rapide',    type:'laboratoire',   categorie:'Parasitologie',prix:3000,  duree_min:30,  description:'Diagnostic paludisme' },
    { code:'ECBU',   nom:'ECBU (Examen Cyto-Bacteriologique Urinaire)', type:'laboratoire', categorie:'Microbiologie', prix:8000, duree_min:48, description:'Culture urinaire et antibiogramme' },
    { code:'VIH',    nom:'Sérologie VIH',                    type:'laboratoire',   categorie:'Sérologie',    prix:5000,  duree_min:60,  description:'Test de dépistage VIH' },
    { code:'HEPA',   nom:'Ag HBs et Anti-HCV',              type:'laboratoire',   categorie:'Sérologie',    prix:8500,  duree_min:60,  description:'Hépatites B et C' },
    // Imagerie
    { code:'RX-THO', nom:'Radiographie thoracique',          type:'imagerie',   categorie:'Radiologie',   prix:15000, duree_min:20,  description:'Face et profil' },
    { code:'ECH-ABD',nom:'Échographie abdominale',           type:'imagerie',   categorie:'Échographie',  prix:25000, duree_min:30,  description:'Organes abdominaux' },
    { code:'ECH-OB', nom:'Échographie obstétricale',         type:'imagerie',   categorie:'Échographie',  prix:20000, duree_min:25,  description:'Suivi de grossesse' },
    { code:'ECH-CAR',nom:'Échographie cardiaque',            type:'imagerie',   categorie:'Échographie',  prix:35000, duree_min:40,  description:'Échocardiographie transthoracique' },
  ]);
  console.log(`✅ Catalogue examens créé (${examens.length})`);

  const [exNFS, exGLUC, exCREAT, exBILI, exLIPID, exVS, exCRP, exPALU, exECBU, exVIH, exHEPA, exRXTHO, exECHABD, exECHOB] = examens;

  // ════════════════════════════════════════════════════════════════════════
  // 8. MÉDICAMENTS
  // ════════════════════════════════════════════════════════════════════════
  const today = new Date();
  const meds = await Medication.insertMany([
    { nom_commercial:'Amoxicilline 500mg', dci:'Amoxicilline',          forme:'comprime', dosage:'500mg', categorie:'Antibiotique',      fabricant:'Sanofi',      numero_lot:'AMX2024-001', stock_actuel:450, stock_minimum:50,  seuil_alerte:100, prix_achat:85,    prix_vente:150,   date_peremption:new Date('2026-06-30'), statut:'disponible', ordonnance_requise:true,  interactions:['Anticoagulants'] },
    { nom_commercial:'Paracétamol 1g',     dci:'Paracétamol',           forme:'comprime', dosage:'1000mg',categorie:'Antalgique',         fabricant:'Pfizer',      numero_lot:'PCT2024-001', stock_actuel:800, stock_minimum:100, seuil_alerte:200, prix_achat:30,    prix_vente:60,    date_peremption:new Date('2026-12-31'), statut:'disponible', ordonnance_requise:false, interactions:[] },
    { nom_commercial:'Métronidazole 500mg',dci:'Métronidazole',         forme:'comprime', dosage:'500mg', categorie:'Antiparasitaire',    fabricant:'Bayer',       numero_lot:'MET2024-001', stock_actuel:300, stock_minimum:40,  seuil_alerte:80,  prix_achat:95,    prix_vente:180,   date_peremption:new Date('2026-09-30'), statut:'disponible', ordonnance_requise:true,  interactions:['Alcool','Anticoagulants'] },
    { nom_commercial:'Artéméther/Luméfantrine 20/120mg', dci:'Artéméther+Luméfantrine', forme:'comprime', dosage:'20/120mg', categorie:'Antipaludéen', fabricant:'Novartis', numero_lot:'ALU2024-001', stock_actuel:200, stock_minimum:30, seuil_alerte:60, prix_achat:1200, prix_vente:2500, date_peremption:new Date('2026-08-31'), statut:'disponible', ordonnance_requise:true, interactions:['Antiépileptiques'] },
    { nom_commercial:'Amlodipine 5mg',     dci:'Amlodipine',            forme:'comprime', dosage:'5mg',   categorie:'Antihypertenseur',   fabricant:'Servier',     numero_lot:'AML2024-001', stock_actuel:350, stock_minimum:50,  seuil_alerte:100, prix_achat:120,   prix_vente:220,   date_peremption:new Date('2026-11-30'), statut:'disponible', ordonnance_requise:true,  interactions:['Antiépileptiques','Jus de pamplemousse'] },
    { nom_commercial:'Metformine 850mg',   dci:'Metformine',            forme:'comprime', dosage:'850mg', categorie:'Antidiabétique',     fabricant:'Merck',       numero_lot:'MET2024-002', stock_actuel:280, stock_minimum:40,  seuil_alerte:80,  prix_achat:95,    prix_vente:175,   date_peremption:new Date('2026-10-31'), statut:'disponible', ordonnance_requise:true,  interactions:['Alcool','Produits de contraste iodés'] },
    { nom_commercial:'Oméprazole 20mg',    dci:'Oméprazole',            forme:'gelule',   dosage:'20mg',  categorie:'Antiulcéreux',       fabricant:'AstraZeneca', numero_lot:'OME2024-001', stock_actuel:400, stock_minimum:60,  seuil_alerte:120, prix_achat:80,    prix_vente:150,   date_peremption:new Date('2026-07-31'), statut:'disponible', ordonnance_requise:false, interactions:['Clopidogrel','Kétoconazole'] },
    { nom_commercial:'Salbutamol 100µg',   dci:'Salbutamol',            forme:'autre',    dosage:'100µg', categorie:'Bronchodilatateur',  fabricant:'GSK',         numero_lot:'SAL2024-001', stock_actuel:80,  stock_minimum:20,  seuil_alerte:40,  prix_achat:3500,  prix_vente:6000,  date_peremption:new Date('2026-04-30'), statut:'disponible', ordonnance_requise:true,  interactions:[] },
    { nom_commercial:'Ibuprofène 400mg',   dci:'Ibuprofène',            forme:'comprime', dosage:'400mg', categorie:'Anti-inflammatoire', fabricant:'Reckitt',     numero_lot:'IBU2024-001', stock_actuel:500, stock_minimum:60,  seuil_alerte:120, prix_achat:55,    prix_vente:110,   date_peremption:new Date('2026-06-30'), statut:'disponible', ordonnance_requise:false, interactions:['Anticoagulants','AINS','Lithium'] },
    { nom_commercial:'Ciprofloxacine 500mg',dci:'Ciprofloxacine',       forme:'comprime', dosage:'500mg', categorie:'Antibiotique',       fabricant:'Bayer',       numero_lot:'CIP2024-001', stock_actuel:220, stock_minimum:30,  seuil_alerte:60,  prix_achat:180,   prix_vente:320,   date_peremption:new Date('2026-05-31'), statut:'disponible', ordonnance_requise:true,  interactions:['Antiacides','Théophylline','Anticoagulants'] },
    { nom_commercial:'Furosémide 40mg',    dci:'Furosémide',            forme:'comprime', dosage:'40mg',  categorie:'Diurétique',         fabricant:'Sanofi',      numero_lot:'FUR2024-001', stock_actuel:150, stock_minimum:20,  seuil_alerte:50,  prix_achat:60,    prix_vente:110,   date_peremption:new Date('2026-03-31'), statut:'disponible', ordonnance_requise:true,  interactions:['AINS','Aminoglycosides'] },
    { nom_commercial:'Érythromycine 250mg',dci:'Érythromycine',         forme:'comprime', dosage:'250mg', categorie:'Antibiotique',       fabricant:'Abbott',      numero_lot:'ERY2024-001', stock_actuel:180, stock_minimum:25,  seuil_alerte:50,  prix_achat:130,   prix_vente:240,   date_peremption:new Date('2026-08-31'), statut:'disponible', ordonnance_requise:true,  interactions:['Antihistaminiques','Statines'] },
    { nom_commercial:'Sérum physiologique 500ml', dci:'NaCl 0,9%',     forme:'injectable',dosage:'0,9%', categorie:'Perfusion',          fabricant:'Fresenius',   numero_lot:'SER2024-001', stock_actuel:120, stock_minimum:20,  seuil_alerte:40,  prix_achat:1200,  prix_vente:2000,  date_peremption:new Date('2027-01-31'), statut:'disponible', ordonnance_requise:true,  interactions:[] },
    { nom_commercial:'Dextrose 5% 500ml',  dci:'Glucose 5%',            forme:'injectable',dosage:'5%',   categorie:'Perfusion',          fabricant:'Fresenius',   numero_lot:'DEX2024-001', stock_actuel:90,  stock_minimum:15,  seuil_alerte:30,  prix_achat:1300,  prix_vente:2200,  date_peremption:new Date('2027-01-31'), statut:'disponible', ordonnance_requise:true,  interactions:[] },
    { nom_commercial:'Sulfate de magnésium 15%', dci:'Sulfate de Mg',   forme:'injectable',dosage:'15%',  categorie:'Tocolytique',        fabricant:'Sanofi',      numero_lot:'MAG2024-001', stock_actuel:40,  stock_minimum:10,  seuil_alerte:20,  prix_achat:3500,  prix_vente:6000,  date_peremption:new Date('2026-09-30'), statut:'disponible', ordonnance_requise:true,  interactions:['Nifédipine'] },
    { nom_commercial:'Gel hydroalcoolique 500ml', dci:'Alcool 70°',     forme:'autre',    dosage:'70°',   categorie:'Désinfectant',       fabricant:'Dettol',      numero_lot:'GEL2024-001', stock_actuel:60,  stock_minimum:10,  seuil_alerte:20,  prix_achat:2500,  prix_vente:4000,  date_peremption:new Date('2026-12-31'), statut:'disponible', ordonnance_requise:false, interactions:[] },
    { nom_commercial:'Bétadine solution 10%', dci:'Povidone iodée',     forme:'autre',    dosage:'10%',   categorie:'Antiseptique',       fabricant:'Meda',        numero_lot:'BET2024-001', stock_actuel:35,  stock_minimum:8,   seuil_alerte:15,  prix_achat:1800,  prix_vente:3000,  date_peremption:new Date('2026-06-30'), statut:'disponible', ordonnance_requise:false, interactions:['Mercure'] },
    { nom_commercial:'Morfine 10mg/ml',    dci:'Morphine',              forme:'injectable',dosage:'10mg/ml',categorie:'Antalgique opioïde',fabricant:'Renaudin',   numero_lot:'MOR2024-001', stock_actuel:15,  stock_minimum:5,   seuil_alerte:10,  prix_achat:4500,  prix_vente:8000,  date_peremption:new Date('2026-02-28'), statut:'disponible', ordonnance_requise:true,  interactions:['Benzodiazépines','Alcool','IMAO'] },
    { nom_commercial:'Fer + Acide folique', dci:'Sulfate ferreux+Folate',forme:'comprime',dosage:'200mg', categorie:'Hématinique',        fabricant:'Sanofi',      numero_lot:'FER2024-001', stock_actuel:600, stock_minimum:80,  seuil_alerte:150, prix_achat:45,    prix_vente:85,    date_peremption:new Date('2026-11-30'), statut:'disponible', ordonnance_requise:false, interactions:['Antiacides','Tétracyclines'] },
    { nom_commercial:'Vitamines B complexe', dci:'B1+B6+B12',           forme:'comprime', dosage:'complexe',categorie:'Vitamine',         fabricant:'Bayer',       numero_lot:'VIT2024-001', stock_actuel:350, stock_minimum:50,  seuil_alerte:100, prix_achat:65,    prix_vente:120,   date_peremption:new Date('2026-10-31'), statut:'disponible', ordonnance_requise:false, interactions:[] },
    // ── 5 médicaments supplémentaires (total = 25) ──────────────────────────
    { nom_commercial:'Doxycycline 100mg',    dci:'Doxycycline',           forme:'gelule',   dosage:'100mg', categorie:'Antibiotique',       fabricant:'Pfizer',      numero_lot:'DOX2024-001', stock_actuel:240, stock_minimum:30,  seuil_alerte:60,  prix_achat:110,   prix_vente:200,   date_peremption:new Date('2026-09-30'), statut:'disponible', ordonnance_requise:true,  interactions:['Antiacides','Lait','Anticoagulants'] },
    { nom_commercial:'Clotrimazole crème 1%',dci:'Clotrimazole',          forme:'pommade',  dosage:'1%',    categorie:'Antifongique',       fabricant:'Bayer',       numero_lot:'CLO2024-001', stock_actuel:90,  stock_minimum:15,  seuil_alerte:30,  prix_achat:850,   prix_vente:1500,  date_peremption:new Date('2027-03-31'), statut:'disponible', ordonnance_requise:false, interactions:[] },
    { nom_commercial:'Prednisolone 5mg',     dci:'Prednisolone',          forme:'comprime', dosage:'5mg',   categorie:'Corticoïde',         fabricant:'Sanofi',      numero_lot:'PRE2024-001', stock_actuel:180, stock_minimum:25,  seuil_alerte:50,  prix_achat:90,    prix_vente:160,   date_peremption:new Date('2026-07-31'), statut:'disponible', ordonnance_requise:true,  interactions:['AINS','Vaccins vivants','Antidiabétiques'] },
    { nom_commercial:'Quinine 300mg',        dci:'Quinine sulfate',        forme:'comprime', dosage:'300mg', categorie:'Antipaludéen',       fabricant:'Qualipharma', numero_lot:'QUI2024-001', stock_actuel:310, stock_minimum:40,  seuil_alerte:80,  prix_achat:140,   prix_vente:260,   date_peremption:new Date('2026-08-31'), statut:'disponible', ordonnance_requise:true,  interactions:['Digoxine','Anticoagulants'] },
    { nom_commercial:'Aspirine 500mg',       dci:'Acide acétylsalicylique',forme:'comprime', dosage:'500mg', categorie:'Antiagrégant',       fabricant:'Bayer',       numero_lot:'ASP2024-001', stock_actuel:420, stock_minimum:60,  seuil_alerte:120, prix_achat:40,    prix_vente:75,    date_peremption:new Date('2026-12-31'), statut:'disponible', ordonnance_requise:false, interactions:['Anticoagulants','AINS','Methotrexate'] },
  ]);
  const [medAmox, medParac, medMetro, medArte, medAmlo, medMetf, medOme, medSalb, medIbu, medCipro, medFuro, medEry, medSerum, medDex] = meds;
  console.log(`✅ Médicaments créés (${meds.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 9. PARAMÈTRES CLINIQUE
  // ════════════════════════════════════════════════════════════════════════
  await Setting.insertMany([
    { cle:'clinique_nom',       valeur:'Clinique Canadienne de Souanké', type:'string', groupe:'clinique',       description:'Nom officiel de la clinique' },
    { cle:'clinique_adresse',   valeur:'Avenue de la Liberté, Souanké, République du Congo', type:'string', groupe:'clinique', description:'Adresse postale' },
    { cle:'clinique_telephone', valeur:'+242 22 295 0000',  type:'string', groupe:'clinique',       description:'Numéro principal' },
    { cle:'clinique_email',     valeur:'contact@clinique-souanke.cg', type:'string', groupe:'email', description:'Email officiel' },
    { cle:'clinique_devise',    valeur:'CFA',               type:'string', groupe:'tarification',   description:'Devise monétaire' },
    { cle:'clinique_tva',       valeur:'0',                 type:'number', groupe:'tarification',   description:'Taux TVA (%)' },
    { cle:'horaire_debut',      valeur:'07:00',             type:'string', groupe:'clinique',       description:"Heure d'ouverture" },
    { cle:'horaire_fin',        valeur:'20:00',             type:'string', groupe:'clinique',       description:'Heure de fermeture' },
    { cle:'rdv_duree_defaut',   valeur:'30',                type:'number', groupe:'clinique',       description:'Durée RDV par défaut (minutes)' },
    { cle:'backup_auto',        valeur:'true',              type:'boolean',groupe:'archivage',      description:'Sauvegarde automatique activée' },
    { cle:'notif_sms',          valeur:'false',             type:'boolean',groupe:'sms',            description:'Envoi SMS activé' },
    { cle:'notif_email',        valeur:'true',              type:'boolean',groupe:'email',          description:'Envoi email activé' },
    { cle:'rappel_rdv_h',       valeur:'24',                type:'number', groupe:'rappels',        description:'Délai rappel RDV (heures avant)' },
    { cle:'labo_delai_normal',  valeur:'24',                type:'number', groupe:'ia',             description:'Délai résultats normaux (heures)' },
    { cle:'labo_delai_urgent',  valeur:'2',                 type:'number', groupe:'ia',             description:'Délai résultats urgents (heures)' },
    { cle:'ia_diagnostic',      valeur:'true',              type:'boolean',groupe:'ia',             description:'Assistance IA au diagnostic activée' },
    { cle:'ia_risque',          valeur:'true',              type:'boolean',groupe:'ia',             description:'Score de risque IA activé' },
    { cle:'pwd_min_length',     valeur:'8',                 type:'number', groupe:'general',        description:'Longueur minimale mot de passe' },
  ]);
  console.log(`✅ Paramètres créés (18)`);

  // ════════════════════════════════════════════════════════════════════════
  // 10. RENDEZ-VOUS
  // ════════════════════════════════════════════════════════════════════════
  const rdvs = await Appointment.insertMany([
    { patient:ptMboumba._id, medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-02T08:00:00'), duree_minutes:30, type:'suivi',        motif:'Contrôle tension artérielle et glycémie', statut:'termine',  created_by:recMouanda._id },
    { patient:ptNgoma._id,   medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-02T09:00:00'), duree_minutes:30, type:'consultation', motif:'Fatigue persistante, pâleur', statut:'termine',  created_by:recMouanda._id },
    { patient:ptOndoa._id,   medecin:drMoussavou._id,service:svcPED._id, date_heure:new Date('2025-06-02T10:00:00'), duree_minutes:30, type:'consultation', motif:'Fièvre, frissons depuis 2 jours', statut:'termine',  created_by:recMouanda._id },
    { patient:ptEssono._id,  medecin:drObiang._id,   service:svcCHI._id, date_heure:new Date('2025-06-03T08:30:00'), duree_minutes:45, type:'suivi',        motif:'Contrôle post-opératoire hernie inguinale', statut:'confirme', created_by:recMouanda._id },
    { patient:ptAkana._id,   medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-03T09:30:00'), duree_minutes:30, type:'consultation', motif:'Crise d\'asthme, dyspnée à l\'effort', statut:'confirme', created_by:recMouanda._id },
    { patient:ptMoutombi._id,medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-03T11:00:00'), duree_minutes:30, type:'suivi',        motif:'Douleurs épigastriques récidivantes', statut:'planifie', created_by:recMouanda._id },
    { patient:ptNzinga._id,  medecin:drMoussavou._id,service:svcPED._id, date_heure:new Date('2025-06-04T08:00:00'), duree_minutes:30, type:'bilan',        motif:'Bilan gynécologique de routine', statut:'planifie', created_by:recMouanda._id },
    { patient:ptBiyoghe._id, medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-04T10:00:00'), duree_minutes:45, type:'suivi',        motif:'Douleurs articulaires genou gauche, prostate', statut:'planifie', created_by:recMouanda._id },
    { patient:ptOyono._id,   medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-05T08:30:00'), duree_minutes:30, type:'suivi',        motif:'Renouvellement traitement hypertension', statut:'planifie', created_by:recMouanda._id },
    { patient:ptMeye._id,    medecin:drObiang._id,   service:svcCHI._id, date_heure:new Date('2025-06-05T09:30:00'), duree_minutes:30, type:'consultation', motif:'Douleurs abdominales basse droite', statut:'planifie', created_by:recMouanda._id },
    { patient:ptNkoghe._id,  medecin:drMoussavou._id,service:svcPED._id, date_heure:new Date('2025-06-06T08:00:00'), duree_minutes:20, type:'bilan',        motif:'Vaccins routine 6 ans', statut:'planifie', created_by:recMouanda._id },
    { patient:ptMboumba._id, medecin:drNguema._id,   service:svcMG._id,  date_heure:new Date('2025-06-10T08:00:00'), duree_minutes:30, type:'suivi',        motif:'Résultats bilan biologique', statut:'planifie', created_by:recMouanda._id },
  ]);
  console.log(`✅ Rendez-vous créés (${rdvs.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 11. CONSULTATIONS
  // ════════════════════════════════════════════════════════════════════════
  const consults = await Consultation.insertMany([
    {
      patient:ptMboumba._id, medecin:drNguema._id, appointment:rdvs[0]._id,
      date_consultation: new Date('2025-06-02T08:10:00'),
      signes_vitaux:{ tension_systolique:148, tension_diastolique:92, pouls:78, temperature:36.8, spo2:98, glycemie:7.4, poids:82, taille:175 },
      anamnese:'Patient hypertendu et diabétique type 2 sous traitement. Signale des céphalées matinales et une fatigue modérée. Observance thérapeutique bonne selon le patient.',
      examen_clinique:'Conscience normale. TA 148/92 mmHg au repos. FC 78 bpm régulier. Pas de signe d\'insuffisance cardiaque. Pas d\'œdème des membres inférieurs. Fond d\'œil non fait ce jour.',
      diagnostic:'Hypertension artérielle mal équilibrée. Diabète type 2 avec contrôle glycémique insuffisant.',
      diagnostic_code:'I10 / E11',
      recommandations:'Majoration Amlodipine 5mg → 10mg/j. Maintien Metformine 850mg x2/j. Régime hyposodé et hypocalorique strict. Activité physique 30min/j. HbA1c dans 3 mois.',
      statut:'terminee',
    },
    {
      patient:ptNgoma._id, medecin:drNguema._id, appointment:rdvs[1]._id,
      date_consultation: new Date('2025-06-02T09:10:00'),
      signes_vitaux:{ tension_systolique:100, tension_diastolique:65, pouls:96, temperature:37.2, spo2:97, poids:55, taille:162 },
      anamnese:'Patiente de 35 ans, fatigue intense depuis 3 semaines, pâleur, essoufflement à l\'effort, palpitations. Règles abondantes depuis 2 mois. Alimentation pauvre en fer.',
      examen_clinique:'Pâleur conjonctivale nette. Tachycardie à 96 bpm. PA normale. Abdomen souple, pas d\'hépatosplénomégalie. Ongles cassants.',
      diagnostic:'Anémie ferriprive probable sur ménorragies.',
      diagnostic_code:'D50.0',
      recommandations:'NFS + ferritine + bilan martial en urgence. Fer + Acide folique 200mg x3/j pendant 3 mois. Consultation gynécologique pour ménorragies.',
      statut:'terminee',
    },
    {
      patient:ptOndoa._id, medecin:drMoussavou._id, appointment:rdvs[2]._id,
      date_consultation: new Date('2025-06-02T10:10:00'),
      signes_vitaux:{ tension_systolique:95, tension_diastolique:60, pouls:110, temperature:38.9, spo2:97, poids:32, taille:140 },
      anamnese:'Enfant de 14 ans. Fièvre à 38.9°C depuis 48h, frissons, céphalées, myalgies. Vomissements x2. Pas de voyage récent. Zone endémique paludisme.',
      examen_clinique:'Fièvre. Tachycardie. Légère splénomégalie. Pas de raideur méningée. Pas de purpura.',
      diagnostic:'Paludisme simple à Plasmodium falciparum probable.',
      diagnostic_code:'B50.9',
      recommandations:'TDR paludisme réalisé positif. Artéméther/Luméfantrine selon poids. Paracétamol pour fièvre. Hydratation orale abondante. Contrôle J3.',
      statut:'terminee',
    },
    {
      patient:ptAkana._id, medecin:drNguema._id, appointment:rdvs[4]._id,
      date_consultation: new Date('2025-06-03T09:40:00'),
      signes_vitaux:{ tension_systolique:118, tension_diastolique:74, pouls:88, temperature:37.0, spo2:95, poids:63, taille:165 },
      anamnese:'Patiente asthmatique depuis l\'enfance. Aggravation depuis 2 semaines. Crises nocturnes x3 cette semaine. Sifflement à l\'effort. Pas d\'exposition allergène particulière.',
      examen_clinique:'Légère dyspnée au repos. Sibilances diffuses à l\'auscultation. Spo2 95%. Pas de cyanose. Thorax normoconformé.',
      diagnostic:'Asthme bronchique en exacerbation modérée.',
      diagnostic_code:'J45.1',
      recommandations:'Salbutamol inhalé 2 bouffées x4/j pendant 5 jours. Corticoïdes inhalés renforcés. Éviction des allergènes. Plan d\'action écrit remis. Consultation pneumo si pas d\'amélioration J7.',
      statut:'terminee',
    },
  ]);
  console.log(`✅ Consultations créées (${consults.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 12. RÉSULTATS DE LABORATOIRE
  // ════════════════════════════════════════════════════════════════════════
  const labResults = await LabResult.insertMany([
    {
      patient:ptNgoma._id, medecin_prescripteur:drNguema._id, technicien:labBongo._id,
      examen:exNFS._id, priorite:'urgente',
      date_prescription:new Date('2025-06-02T09:30:00'),
      date_realisation: new Date('2025-06-02T11:00:00'),
      date_validation:  new Date('2025-06-02T12:00:00'),
      resultats:{ hemoglobine:'7.2 g/dL', hematocrite:'21%', globules_rouges:'2.8 T/L', globules_blancs:'6.5 G/L', plaquettes:'320 G/L', VGM:'68 fL', CCMH:'25 g/dL' },
      est_critique:true, valeurs_critiques:'Hb 7.2 g/dL (N: 12-16 g/dL) — Anémie sévère',
      commentaires:'Anémie microcytaire hypochrome sévère. À corréler avec bilan martial. Évoquer une carence en fer.',
      statut:'valide', ia_anomalie:true, ia_details:'Anémie microcytaire hypochrome. Pattern évocateur de carence martiale.'
    },
    {
      patient:ptMboumba._id, medecin_prescripteur:drNguema._id, technicien:labMbemba._id,
      examen:exGLUC._id, priorite:'normale',
      date_prescription:new Date('2025-06-02T08:30:00'),
      date_realisation: new Date('2025-06-02T10:00:00'),
      date_validation:  new Date('2025-06-02T10:30:00'),
      resultats:{ glycemie_a_jeun:'8.2 mmol/L (1.48 g/L)', reference:'3.9 - 6.1 mmol/L' },
      est_critique:false,
      commentaires:'Glycémie à jeun élevée. Diabète type 2 mal équilibré.',
      statut:'valide', ia_anomalie:true, ia_details:'Hyperglycémie à jeun. Contrôle du diabète insuffisant.'
    },
    {
      patient:ptOndoa._id, medecin_prescripteur:drMoussavou._id, technicien:labBongo._id,
      examen:exPALU._id, priorite:'urgente',
      date_prescription:new Date('2025-06-02T10:20:00'),
      date_realisation: new Date('2025-06-02T10:50:00'),
      date_validation:  new Date('2025-06-02T11:00:00'),
      resultats:{ tdr_paludisme:'POSITIF', espece:'Plasmodium falciparum probable', parasitemie:'++' },
      est_critique:false,
      commentaires:'TDR paludisme positif. Parasitémie modérée. Traitement antipaludéen instauré.',
      statut:'valide', ia_anomalie:false
    },
    {
      patient:ptMboumba._id, medecin_prescripteur:drNguema._id, technicien:labMbemba._id,
      examen:exLIPID._id, priorite:'normale',
      date_prescription:new Date('2025-06-02T08:30:00'),
      date_realisation: new Date('2025-06-03T09:00:00'),
      date_validation:  new Date('2025-06-03T10:00:00'),
      resultats:{ cholesterol_total:'6.8 mmol/L', HDL:'0.9 mmol/L', LDL:'4.7 mmol/L', triglycerides:'2.4 mmol/L' },
      est_critique:false,
      commentaires:'Dyslipidémie avec LDL élevé et HDL bas. Risque cardiovasculaire augmenté chez ce patient hypertendu diabétique.',
      statut:'valide', ia_anomalie:true, ia_details:'Dyslipidémie mixte. Risque cardiovasculaire élevé.'
    },
    {
      patient:ptBiyoghe._id, medecin_prescripteur:drNguema._id, technicien:labBongo._id,
      examen:exHEPA._id, priorite:'normale',
      date_prescription:new Date('2025-05-28T10:00:00'),
      date_realisation: new Date('2025-05-28T14:00:00'),
      date_validation:  new Date('2025-05-29T09:00:00'),
      resultats:{ AgHBs:'POSITIF', AntiHCV:'NÉGATIF', ASAT:'68 UI/L', ALAT:'82 UI/L', GGT:'95 UI/L' },
      est_critique:false,
      commentaires:'Hépatite B chronique confirmée (Ag HBs positif). Cytolyse hépatique modérée. Suivi hépatologique nécessaire.',
      statut:'valide', ia_anomalie:true, ia_details:'Hépatite B chronique avec cytolyse modérée.'
    },
  ]);
  console.log(`✅ Résultats de laboratoire créés (${labResults.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 13. HOSPITALISATIONS
  // ════════════════════════════════════════════════════════════════════════
  const hosps = await Hospitalization.insertMany([
    {
      patient:ptEssono._id, chambre:rooms[2]._id, lit_numero:'L-201-A',
      service:svcCHI._id, medecin_responsable:drObiang._id,
      date_entree:new Date('2025-05-25T10:00:00'), date_sortie_prevue:new Date('2025-06-02T10:00:00'),
      motif_entree:'Cure de hernie inguinale droite programmée',
      diagnostic_entree:'Hernie inguinale droite non compliquée',
      statut:'en_cours', cout_total:145000,
      notes_cliniques:[
        { date:new Date('2025-05-25T14:00:00'), auteur:infBekale._id, tension:'130/82', pouls:74, temperature:36.6, spo2:98, contenu:'Post-opératoire immédiat. Patient conscient, stable. Douleur EVA 4/10 contrôlée par antalgiques. Pansement propre sec.' },
        { date:new Date('2025-05-26T08:00:00'), auteur:infMba._id, tension:'128/80', pouls:72, temperature:37.1, spo2:99, contenu:'J1 post-op. Patient debout, marche avec aide. Alimentation reprise. Transit présent. Douleur EVA 2/10.' },
        { date:new Date('2025-05-28T08:00:00'), auteur:infBekale._id, tension:'125/78', pouls:70, temperature:36.8, spo2:99, contenu:'J3 post-op. Bonne évolution. Pansement refait. Pas de signe infectieux.' },
      ]
    },
    {
      patient:ptNgoma._id, chambre:rooms[1]._id, lit_numero:'L-102-A',
      service:svcMG._id, medecin_responsable:drNguema._id,
      date_entree:new Date('2025-06-02T12:00:00'), date_sortie_prevue:new Date('2025-06-05T12:00:00'),
      motif_entree:'Anémie sévère nécessitant transfusion',
      diagnostic_entree:'Anémie ferriprive sévère (Hb 7.2 g/dL)',
      statut:'en_cours', cout_total:85000,
      notes_cliniques:[
        { date:new Date('2025-06-02T14:00:00'), auteur:infMba._id, tension:'100/65', pouls:96, temperature:37.1, spo2:97, contenu:'Patiente admise pour anémie sévère. Transfusion de 2 culots globulaires débutée. Surveillance tolérance transfusionnelle.' },
        { date:new Date('2025-06-03T08:00:00'), auteur:infEyeghe._id, tension:'108/70', pouls:82, temperature:36.9, spo2:98, contenu:'Post-transfusion. Bonne tolérance. Amélioration clinique. Moins de pâleur. Spo2 améliorée.' },
      ]
    },
    {
      patient:ptMounguengui._id, chambre:rooms[5]._id, lit_numero:'L-PED-A',
      service:svcPED._id, medecin_responsable:drMoussavou._id,
      date_entree:new Date('2025-06-01T16:00:00'), date_sortie_prevue:new Date('2025-06-04T10:00:00'),
      motif_entree:'Paludisme grave avec convulsions fébriles',
      diagnostic_entree:'Paludisme grave',
      statut:'en_cours', cout_total:62000,
      notes_cliniques:[
        { date:new Date('2025-06-01T17:00:00'), auteur:infEyeghe._id, tension:'90/55', pouls:120, temperature:39.5, spo2:95, contenu:'Enfant admise en urgence. Convulsion fébrile. Artéméther IV débuté. Anticonvulsivant administré. Surveillance rapprochée.' },
        { date:new Date('2025-06-02T08:00:00'), auteur:infMba._id, tension:'95/62', pouls:105, temperature:38.2, spo2:97, contenu:'Amélioration. Plus de convulsions. Fièvre en baisse. Alimentation reprise partiellement.' },
      ]
    },
  ]);
  console.log(`✅ Hospitalisations créées (${hosps.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 14. PRESCRIPTIONS
  // ════════════════════════════════════════════════════════════════════════
  // Création séquentielle — le hook pre('save') génère numero_rx séquentiellement
  const rx1 = await Prescription.create({ patient:ptMboumba._id, medecin:drNguema._id, consultation:consults[0]._id, date_prescription:new Date('2025-06-02T08:45:00'), lignes:[{ medicament:medAmlo._id, medicament_nom:'Amlodipine 10mg', posologie:'1 comprimé le matin', duree:'30 jours', quantite:30, notes:'À prendre à jeun' },{ medicament:medMetf._id, medicament_nom:'Metformine 850mg', posologie:'1 comprimé matin et soir au repas', duree:'30 jours', quantite:60, notes:'Ne pas écraser' }], statut:'active' });
  const rx2 = await Prescription.create({ patient:ptNgoma._id, medecin:drNguema._id, consultation:consults[1]._id, date_prescription:new Date('2025-06-02T09:45:00'), lignes:[{ medicament:meds[18]._id, medicament_nom:'Fer + Acide folique 200mg', posologie:'1 comprimé 3 fois par jour entre les repas', duree:'3 mois', quantite:270, notes:'Éviter avec thé/café' },{ medicament:medParac._id, medicament_nom:'Paracétamol 1g', posologie:'1 comprimé si besoin, max 3/j', duree:'7 jours', quantite:21, notes:'En cas de douleur' }], statut:'active' });
  const rx3 = await Prescription.create({ patient:ptOndoa._id, medecin:drMoussavou._id, consultation:consults[2]._id, date_prescription:new Date('2025-06-02T10:45:00'), lignes:[{ medicament:medArte._id, medicament_nom:'Artéméther/Luméfantrine 20/120mg', posologie:'4 comprimés 2×/j pendant 3 jours', duree:'3 jours', quantite:24, notes:'Prendre avec aliment gras' },{ medicament:medParac._id, medicament_nom:'Paracétamol 1g', posologie:'1 comprimé x3/j si fièvre', duree:'3 jours', quantite:9, notes:'Hydratation abondante' }], statut:'dispensee', dispensee_par:phNdong._id, date_dispensation:new Date('2025-06-02T14:00:00') });
  const rx4 = await Prescription.create({ patient:ptAkana._id, medecin:drNguema._id, consultation:consults[3]._id, date_prescription:new Date('2025-06-03T10:00:00'), lignes:[{ medicament:medSalb._id, medicament_nom:'Salbutamol 100µg inhalateur', posologie:'2 bouffées 4 fois par jour', duree:'10 jours', quantite:1, notes:"Technique d'inhalation à vérifier" },{ medicament:medIbu._id, medicament_nom:'Ibuprofène 400mg', posologie:'1 comprimé x3/j au repas si besoin', duree:'5 jours', quantite:15, notes:'Ne pas dépasser 5 jours' }], statut:'active' });
  const prescriptions = [rx1, rx2, rx3, rx4];
  console.log(`✅ Prescriptions créées (${prescriptions.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 15. FACTURES
  // ════════════════════════════════════════════════════════════════════════
  // Création séquentielle — le hook pre('save') génère numero_facture séquentiellement
  const inv1 = await Invoice.create({ patient:ptMboumba._id, created_by:cptElla._id, date_facture:new Date('2025-06-02T13:00:00'), lignes:[{ libelle:'Consultation médecine générale', categorie:'consultation', prix_unitaire:10000, quantite:1, montant:10000 },{ libelle:'Glycémie à jeun', categorie:'laboratoire', prix_unitaire:3500, quantite:1, montant:3500 },{ libelle:'Bilan lipidique', categorie:'laboratoire', prix_unitaire:9000, quantite:1, montant:9000 },{ libelle:'Amlodipine 10mg x30', categorie:'pharmacie', prix_unitaire:220, quantite:30, montant:6600 },{ libelle:'Metformine 850mg x60', categorie:'pharmacie', prix_unitaire:175, quantite:60, montant:10500 }], montant_ht:39600, tva:0, montant_ttc:39600, montant_paye:39600, montant_restant:0, assurance_taux:80, montant_assurance:31680, statut:'payee', paiements:[{ date:new Date('2025-06-02T13:30:00'), montant:7920, mode:'especes', reference:'PAY-20250602-001', enregistre_par:cptElla._id }] });
  const inv2 = await Invoice.create({ patient:ptNgoma._id, created_by:cptElla._id, date_facture:new Date('2025-06-02T15:00:00'), lignes:[{ libelle:'Consultation médecine générale', categorie:'consultation', prix_unitaire:10000, quantite:1, montant:10000 },{ libelle:'NFS urgente', categorie:'laboratoire', prix_unitaire:5500, quantite:1, montant:5500 },{ libelle:'Hospitalisation chambre commune (3 nuits)', categorie:'hospitalisation', prix_unitaire:8000, quantite:3, montant:24000 },{ libelle:'Fer + Acide folique x270', categorie:'pharmacie', prix_unitaire:85, quantite:270, montant:22950 }], montant_ht:62450, tva:0, montant_ttc:62450, montant_paye:20000, montant_restant:42450, statut:'partiellement_payee', paiements:[{ date:new Date('2025-06-02T15:30:00'), montant:20000, mode:'mobile_money', reference:'PAY-20250602-002', enregistre_par:cptElla._id }] });
  const inv3 = await Invoice.create({ patient:ptOndoa._id, created_by:cptElla._id, date_facture:new Date('2025-06-02T14:00:00'), lignes:[{ libelle:'Consultation pédiatrie', categorie:'consultation', prix_unitaire:10000, quantite:1, montant:10000 },{ libelle:'Test rapide paludisme', categorie:'laboratoire', prix_unitaire:3000, quantite:1, montant:3000 },{ libelle:'Artéméther/Luméfantrine', categorie:'pharmacie', prix_unitaire:2500, quantite:1, montant:2500 },{ libelle:'Paracétamol 1g x9', categorie:'pharmacie', prix_unitaire:60, quantite:9, montant:540 }], montant_ht:16040, tva:0, montant_ttc:16040, montant_paye:16040, montant_restant:0, assurance_taux:75, montant_assurance:12030, statut:'payee', paiements:[{ date:new Date('2025-06-02T14:30:00'), montant:4010, mode:'especes', reference:'PAY-20250602-003', enregistre_par:cptElla._id }] });
  const inv4 = await Invoice.create({ patient:ptEssono._id, created_by:cptElla._id, date_facture:new Date('2025-05-25T11:00:00'), lignes:[{ libelle:'Consultation chirurgie', categorie:'consultation', prix_unitaire:15000, quantite:1, montant:15000 },{ libelle:'Intervention hernie inguinale', categorie:'consultation', prix_unitaire:120000, quantite:1, montant:120000 },{ libelle:'Hospitalisation chambre privée (7 nuits)', categorie:'hospitalisation', prix_unitaire:20000, quantite:7, montant:140000 },{ libelle:'Médicaments post-opératoires', categorie:'pharmacie', prix_unitaire:15000, quantite:1, montant:15000 }], montant_ht:290000, tva:0, montant_ttc:290000, montant_paye:203000, montant_restant:87000, assurance_taux:70, montant_assurance:203000, statut:'partiellement_payee', paiements:[{ date:new Date('2025-05-25T12:00:00'), montant:203000, mode:'virement', reference:'PAY-20250525-001', enregistre_par:cptElla._id }] });
  const inv5 = await Invoice.create({ patient:ptMoutombi._id, created_by:cptElla._id, date_facture:new Date('2025-05-20T10:00:00'), lignes:[{ libelle:'Consultation médecine générale', categorie:'consultation', prix_unitaire:10000, quantite:1, montant:10000 },{ libelle:'Bilan hépatique complet', categorie:'laboratoire', prix_unitaire:12000, quantite:1, montant:12000 },{ libelle:'Échographie abdominale', categorie:'imagerie', prix_unitaire:25000, quantite:1, montant:25000 },{ libelle:'Oméprazole 20mg x30', categorie:'pharmacie', prix_unitaire:150, quantite:30, montant:4500 }], montant_ht:51500, tva:0, montant_ttc:51500, montant_paye:0, montant_restant:51500, statut:'emise' });
  const invoices = [inv1, inv2, inv3, inv4, inv5];
  console.log(`✅ Factures créées (${invoices.length})`);

  // ════════════════════════════════════════════════════════════════════════
  // 16. NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════════════
  await Notification.insertMany([
    { destinataire:drNguema._id,    type:'critical', priorite:'haute',   titre:'Résultat critique — Fatou Ngoma',     message:'NFS: Hémoglobine 7.2 g/dL. Anémie sévère. Hospitalisation en cours.', lien:'/laboratory' },
    { destinataire:phNdong._id,     type:'warning',  priorite:'haute',   titre:'Stock faible — Morphine 10mg/ml',     message:'Stock actuel: 15 unités (seuil alerte: 10). Commander rapidement.', lien:'/pharmacy' },
    { destinataire:superadmin._id,  type:'info',     priorite:'normale', titre:'Rapport mensuel disponible',          message:'Le rapport financier de mai 2025 est disponible pour téléchargement.', lien:'/finance' },
    { destinataire:drObiang._id,    type:'rappel',   priorite:'normale', titre:'Consultation post-op — Marc Essono', message:'RDV demain 08h30 pour contrôle post-opératoire hernie inguinale.', lien:'/appointments' },
    { destinataire:labBongo._id,    type:'info',     priorite:'normale', titre:'Nouvel examen prescrit urgent',       message:'Bilan biologique urgent prescrit pour patient Mboumba Jean-Baptiste.', lien:'/laboratory' },
    { destinataire:recMouanda._id,  type:'rappel',   priorite:'basse',   titre:'5 RDV prévus demain',                message:'5 rendez-vous planifiés pour le 04 juin 2025. Préparer les dossiers.', lien:'/appointments' },
  ]);
  console.log(`✅ Notifications créées (6)`);

  // ════════════════════════════════════════════════════════════════════════
  // 17. AUDIT LOGS
  // ════════════════════════════════════════════════════════════════════════
  await AuditLog.insertMany([
    { utilisateur:superadmin._id, action:'LOGIN',          module:'auth',      ip:'192.168.1.10', message:'Connexion Super Admin', statut:'succes' },
    { utilisateur:recMouanda._id, action:'CREATE',         module:'patients',  ip:'192.168.1.12', message:'Nouveau dossier patient: Mboumba Jean-Baptiste', statut:'succes' },
    { utilisateur:drNguema._id,   action:'CREATE',         module:'consultations', ip:'192.168.1.15', message:'Consultation créée: patient Mboumba Jean-Baptiste', statut:'succes' },
    { utilisateur:labBongo._id,   action:'UPDATE',         module:'laboratory',ip:'192.168.1.20', message:'Résultat NFS validé: Ngoma Fatou — Anémie sévère', statut:'succes' },
    { utilisateur:cptElla._id,    action:'CREATE',         module:'finance',   ip:'192.168.1.25', message:'Facture INV-2025-00001 créée: 39 600 CFA', statut:'succes' },
    { utilisateur:drObiang._id,   action:'UPDATE',         module:'hospitalization', ip:'192.168.1.16', message:'Note clinique ajoutée: patient Essono Marc J3 post-op', statut:'succes' },
    { utilisateur:phNdong._id,    action:'UPDATE',         module:'pharmacy',  ip:'192.168.1.30', message:'Prescription dispensée: Artéméther pour patient Ondoa Lucie', statut:'succes' },
    { utilisateur:superadmin._id, action:'UPDATE',         module:'settings',  ip:'192.168.1.10', message:'Paramètres clinique mis à jour', statut:'succes' },
  ]);
  console.log(`✅ Audit logs créés (8)`);

  // ════════════════════════════════════════════════════════════════════════
  // RÉSUMÉ FINAL
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           ✅ SEED COMPLET TERMINÉ AVEC SUCCÈS           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  DONNÉES RÉELLES — Clinique Canadienne de Souanké       ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Services       : ${services.length.toString().padEnd(3)} | Utilisateurs  : ${users.length.toString().padEnd(3)}         ║`);
  console.log(`║  Patients       : ${patients.length.toString().padEnd(3)} | Personnel     : ${staffList.length.toString().padEnd(3)}         ║`);
  console.log(`║  Médicaments    : ${meds.length.toString().padEnd(3)} | Chambres      : ${rooms.length.toString().padEnd(3)}         ║`);
  console.log(`║  Rendez-vous    : ${rdvs.length.toString().padEnd(3)} | Consultations : ${consults.length.toString().padEnd(3)}         ║`);
  console.log(`║  Hospit.        : ${hosps.length.toString().padEnd(3)} | Prescriptions : ${prescriptions.length.toString().padEnd(3)}         ║`);
  console.log(`║  Factures       : ${invoices.length.toString().padEnd(3)} | Labo          : ${labResults.length.toString().padEnd(3)}         ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  CONNEXION : oseedoro@gmail.com / medisync123           ║');
  console.log('║  Autres    : dr.nguema@clinique-souanke.cg / medisync123║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
};

seed().catch(err => {
  console.error('\n❌ Erreur seed :', err.message);
  console.error(err.stack);
  process.exit(1);
});
