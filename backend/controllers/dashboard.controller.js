// controllers/dashboardController.js
//
// ⚠️ Ce fichier interrogeait massivement des champs/valeurs d'énumération
// qui n'existent PAS dans les modèles Mongoose réels (ex: Invoice.type,
// Invoice.statut='impayee', Consultation.date, Hospitalization.date_admission,
// Surgery.statut='realisee', User.statut_service, Ordonnance.medicaments...).
// Ces requêtes ne levaient aucune erreur (Mongo traite un champ absent comme
// "n'existe pas"), elles renvoyaient juste 0/vide en permanence — chaque
// rôle voyait donc un tableau de bord silencieusement faux. Toutes les
// requêtes ci-dessous ont été réalignées sur les schémas réels ; les KPI
// pour lesquels aucune donnée n'est réellement modélisée (ventes comptoir
// pharmacie, planning infirmier détaillé) sont désormais des zéros
// EXPLICITES et commentés, plutôt que des zéros accidentels indiscernables
// d'une vraie absence d'activité. Dépenses et échecs de connexion étaient
// dans ce même cas jusqu'à AUDIT-04 — Depense et le journal LOGIN_ECHEC
// existent désormais et sont réellement agrégés ci-dessous.
const mongoose       = require('mongoose');
const Patient        = require('../models/Patient');
const Appointment    = require('../models/Appointment');
const Consultation   = require('../models/Consultation');
const Invoice        = require('../models/Invoice');
const LabResult      = require('../models/LabResult');
const ImagingResult  = require('../models/ImagingResult');
const Hospitalization= require('../models/Hospitalization');
const Medication     = require('../models/Medication');
const Surgery        = require('../models/DossierChirurgical');
const Ordonnance     = require('../models/Prescription');
const User           = require('../models/User');
const Staff          = require('../models/Staff');
const Room           = require('../models/Room');
const Conversation   = require('../models/Conversation');
// AUDIT-04 — Depense/Commande/AuditLog n'existaient pas (ou n'étaient pas
// encore alimentés) quand les stubs ci-dessous ont été écrits ; ils le sont
// désormais (finance.controller.js::createDepense, pharmacy.controller.js::
// createCommande, logAction sur chaque échec de connexion dans
// auth.controller.js).
const Depense        = require('../models/Depense');
const Commande       = require('../models/Commande');
const AuditLog       = require('../models/AuditLog');
const Urgence        = require('../models/Urgence');
const Pregnancy      = require('../models/Pregnancy');
const Delivery       = require('../models/Delivery');
const { escapeRegex } = require('../utils/helpers');

// ─── Helpers ──────────────────────────────────────────────────
const todayRange = () => {
  const start = new Date(); start.setHours(0,0,0,0);
  const end   = new Date(); end.setHours(23,59,59,999);
  return { start, end };
};
const last7days  = () => new Date(Date.now() - 7  * 86400000);
const last12months = () => new Date(Date.now() - 365 * 86400000);
const dayLabels = (arr) => arr.map(d => {
  const dt = new Date(d._id);
  return dt.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric' });
});
const monthLabels = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

// Occupation réelle des lits (mêmes règles que hospitalization.controller.js::getStats)
const litsOccupationPct = async () => {
  const rooms = await Room.find();
  const totalLits   = rooms.reduce((s, r) => s + (r.lits?.length || 0), 0);
  const litsOccupes = rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'occupe').length || 0), 0);
  return totalLits > 0 ? Math.round((litsOccupes / totalLits) * 100) : 0;
};

// ─── 1. SUPER ADMIN ────────────────────────────────────────────
// AUDIT-DASHBOARD-SUPERADMIN — vue globale professionnelle : réutilise au
// maximum les mêmes requêtes déjà éprouvées ailleurs dans ce fichier
// (adminCliniqueStats, laborantinStats, radiologueStats) plutôt que d'en
// réinventer, puisqu'il n'existe qu'une seule clinique dans ce projet (aucun
// champ clinique_id sur Patient/Appointment/etc.) — le périmètre de données
// réelles est donc rigoureusement le même, seule la présentation diffère.
exports.superAdminStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      patients_total,
      users_total,
      users_connectes,
      consultations_total,
      hospitalisations,
      interventions,
      rdv_total,
      factures_impayees_agg,
      ca_global_agg,
      depenses_agg,
      users_par_role,
      chart_ca,
      chart_dep,
      alertes_labo,
      patients_auj,
      consultations_auj,
      admissions_auj,
      connexions_echouees,
      comptes_bloques,
      // Revenus du jour (même agrégat que comptableStats/adminCliniqueStats)
      revenus_auj_agg,
      // RDV du jour
      rdv_auj_total, rdv_confirmes, rdv_en_attente, rdv_termines, rdv_annules,
      rdv_liste_raw,
      // Consultations du jour (détail)
      consults_liste_raw,
      // Urgences
      urgences_nouvelles, urgences_en_cours, urgences_terminees,
      // Hospitalisation
      sorties_auj,
      // Laboratoire (même agrégats que laborantinStats)
      labo_demandes_auj, labo_en_cours, labo_critiques,
      // Imagerie (mêmes agrégats que radiologueStats)
      img_examens_auj, img_en_attente, img_rapports_dispo,
      // Pharmacie (pour la zone alertes)
      pharma_stock_faible, pharma_ruptures, alertes_pharma_raw,
      // Factures pour alerte
      factures_imp_liste,
      // Activité médicale — 7 jours (4 séries)
      chart_patients_raw, chart_consults_raw, chart_rdv_raw, chart_hospit_raw,
    ] = await Promise.all([
      Patient.countDocuments({ statut:'actif' }),
      User.countDocuments({ statut:'actif' }),
      User.countDocuments({ statut:'actif', derniere_connexion:{ $gte: new Date(Date.now()-15*60000) } }),
      Consultation.countDocuments({}),
      Hospitalization.countDocuments({ statut:'en_cours' }),
      Surgery.countDocuments({ statut:{ $in:['opere','suivi_postop','cloture'] } }),
      Appointment.countDocuments({}),
      Invoice.aggregate([{ $match:{ statut:{ $in:['emise','partiellement_payee'] } }}, { $group:{ _id:null, total:{ $sum:'$montant_restant' }}}]),
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte: new Date(new Date().getFullYear(),new Date().getMonth(),1) }}}, { $group:{ _id:null, total:{ $sum:'$montant_paye' }}}]),
      // AUDIT-04 — Depense.date/montant, même fenêtre "ce mois-ci" que le CA ci-dessus.
      Depense.aggregate([{ $match:{ date:{ $gte: new Date(new Date().getFullYear(),new Date().getMonth(),1) }}}, { $group:{ _id:null, total:{ $sum:'$montant' }}}]),
      User.aggregate([{ $group:{ _id:'$role', count:{ $sum:1 }}}]),
      // CA 12 mois
      Invoice.aggregate([
        { $match:{ statut:'payee', date_facture:{ $gte: last12months() }}},
        { $group:{ _id:{ $month:'$date_facture' }, total:{ $sum:'$montant_paye' }}},
        { $sort:{ '_id':1 }},
      ]),
      // AUDIT-04 — Dépenses 12 mois, même forme que le CA 12 mois ci-dessus.
      Depense.aggregate([
        { $match:{ date:{ $gte: last12months() }}},
        { $group:{ _id:{ $month:'$date' }, total:{ $sum:'$montant' }}},
        { $sort:{ '_id':1 }},
      ]),
      // Alertes labo critiques (système entier, pas de populate lourd — nom via lookup)
      LabResult.aggregate([
        { $match:{ est_critique:true, acquitte_par:null }},
        { $lookup:{ from:'patients', localField:'patient', foreignField:'_id', as:'pat' }},
        { $limit:10 },
        { $project:{ msg:{ $concat:['Résultat critique — ', { $arrayElemAt:['$pat.nom',0] }] }, heure:'$createdAt' }},
      ]),
      Patient.countDocuments({ createdAt:{ $gte:start, $lte:end }}),
      Consultation.countDocuments({ date_consultation:{ $gte:start, $lte:end }}),
      Hospitalization.countDocuments({ date_entree:{ $gte:start, $lte:end }}),
      // AUDIT-04 — journal LOGIN_ECHEC (auth.controller.js), même fenêtre
      // "aujourd'hui" que patients_auj/consultations_auj/admissions_auj
      // ci-dessus, plutôt que la somme de User.tentatives_echouees (un
      // compteur courant remis à zéro à la connexion, pas un journal daté).
      AuditLog.countDocuments({ action:'LOGIN_ECHEC', createdAt:{ $gte:start, $lte:end }}),
      User.countDocuments({ statut:'suspendu' }),
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_paye' }}}]),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'confirme' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'en_attente' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'termine' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'annule' }),
      Appointment.find({ date_heure:{ $gte:start,$lte:end } })
        .populate('patient','nom prenom').populate('medecin','nom prenom specialite').populate('service','nom')
        .sort({ date_heure:1 }).limit(8),
      Consultation.find({ date_consultation:{ $gte:start,$lte:end } })
        .populate('patient','nom prenom').populate('medecin','nom prenom specialite')
        .sort({ date_consultation:1 }).limit(8),
      Urgence.countDocuments({ date_arrivee:{ $gte:start,$lte:end } }),
      Urgence.countDocuments({ statut:{ $nin:['sorti','transfere','decede'] } }),
      Urgence.countDocuments({ date_sortie:{ $gte:start,$lte:end }, statut:{ $in:['sorti','transfere','decede'] } }),
      Hospitalization.countDocuments({ date_sortie:{ $gte:start,$lte:end } }),
      LabResult.countDocuments({ createdAt:{ $gte:start,$lte:end } }),
      LabResult.countDocuments({ statut:'en_cours' }),
      LabResult.countDocuments({ est_critique:true, acquitte_par:null }),
      ImagingResult.countDocuments({ date_prescription:{ $gte:start,$lte:end } }),
      ImagingResult.countDocuments({ statut:'en_attente', date_prescription:{ $gte:start,$lte:end } }),
      ImagingResult.countDocuments({ statut:{ $in:['rapporte','valide'] }, date_prescription:{ $gte:start,$lte:end } }),
      Medication.countDocuments({ $expr:{ $and:[{ $gt:['$stock_actuel',0] },{ $lte:['$stock_actuel','$seuil_alerte'] }]}}),
      Medication.countDocuments({ stock_actuel:{ $lte:0 }}),
      Medication.find({ $or:[{ stock_actuel:{ $lte:0 }},{ $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }}]}).limit(3),
      Invoice.find({ statut:{ $in:['emise','partiellement_payee'] } }).sort({ montant_restant:-1 }).limit(1),
      Patient.aggregate([
        { $match:{ createdAt:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' }}, count:{ $sum:1 }}},
      ]),
      Consultation.aggregate([
        { $match:{ date_consultation:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date_consultation' }}, count:{ $sum:1 }}},
      ]),
      Appointment.aggregate([
        { $match:{ date_heure:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date_heure' }}, count:{ $sum:1 }}},
      ]),
      Hospitalization.aggregate([
        { $match:{ date_entree:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date_entree' }}, count:{ $sum:1 }}},
      ]),
    ]);

    // Formater users_par_role en objet — tout rôle réel de l'enum User.role
    // apparaît explicitement à 0 s'il n'a aucun utilisateur (pas une absence
    // de clé indiscernable d'une donnée non chargée).
    const ROLES_CONNUS = ['medecin','infirmier','laborantin','radiologue','pharmacien','comptable','receptionniste','patient','superadmin','adminclinique'];
    const uRoles = {};
    ROLES_CONNUS.forEach(r => { uRoles[r] = 0; });
    users_par_role.forEach(r => { uRoles[r._id] = r.count; });

    // Formater graphiques 12 mois (financier)
    const caMap  = {}; chart_ca.forEach(d  => { caMap[d._id]  = d.total; });
    const depMap = {}; chart_dep.forEach(d => { depMap[d._id] = d.total; });
    const caArr  = Array.from({length:12}, (_,i) => caMap[i+1]  || 0);
    const depArr = Array.from({length:12}, (_,i) => depMap[i+1] || 0);

    const ca_global     = ca_global_agg[0]?.total || 0;
    const depenses      = depenses_agg[0]?.total   || 0;
    const factures_imp  = factures_impayees_agg[0]?.total || 0;

    // Activité médicale 7 jours — même réconciliation que adminCliniqueStats
    // (ADM-02) : liste fixe des 7 derniers jours, zéro explicite si aucune
    // donnée ce jour-là, jamais une série tronquée qui se ferait passer pour
    // les 7 jours en l'absence de certains jours.
    const joursSemaine = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      joursSemaine.push(d.toISOString().substring(0, 10));
    }
    const toMap = (arr) => Object.fromEntries(arr.map(d => [d._id, d.count]));
    const patientsMap = toMap(chart_patients_raw);
    const consultsMap = toMap(chart_consults_raw);
    const rdvMap      = toMap(chart_rdv_raw);
    const hospitMap   = toMap(chart_hospit_raw);
    const activiteLabels = joursSemaine.map(j => dayLabels([{ _id: j }])[0]);

    const rdv_auj = rdv_liste_raw.map(r => ({
      heure: new Date(r.date_heure).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      patient: r.patient ? `${r.patient.prenom} ${r.patient.nom}` : 'Inconnu',
      medecin: r.medecin ? `Dr. ${r.medecin.nom}` : '—',
      service: r.service?.nom || r.medecin?.specialite || '—',
      statut: r.statut || 'en_attente',
    }));

    const consultations_auj_liste = consults_liste_raw.map(c => ({
      heure: new Date(c.date_consultation).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      patient: c.patient ? `${c.patient.prenom} ${c.patient.nom}` : 'Inconnu',
      medecin: c.medecin ? `Dr. ${c.medecin.nom}` : '—',
      service: c.service || c.medecin?.specialite || '—',
      statut: c.statut || 'en_cours',
    }));

    // Alertes & Attention — combine labo critique, pharmacie, factures et
    // comptes suspendus, mêmes règles de gravité que adminCliniqueStats.
    const alertes = [
      ...alertes_labo.map(a => ({ type:'error', icon:'🔬', msg:a.msg, heure:new Date(a.heure).toLocaleString('fr-FR') })),
      ...alertes_pharma_raw.map(m => ({
        type: m.stock_actuel<=0 ? 'error' : 'warn', icon:'💊',
        msg: m.stock_actuel<=0 ? `${m.nom_commercial} — Rupture de stock` : `${m.nom_commercial} — Stock bas (${m.stock_actuel} unités)`,
        heure:'Aujourd\'hui',
      })),
      factures_imp > 0 ? { type:'warn', icon:'💰', msg:`${factures_imp.toLocaleString('fr-FR')} CFA de factures impayées${factures_imp_liste[0] ? ' — ex. #'+(factures_imp_liste[0].numero_facture||'?') : ''}`, heure:'Aujourd\'hui' } : null,
      comptes_bloques > 0 ? { type:'warn', icon:'🔒', msg:`${comptes_bloques} compte(s) suspendu(s)`, heure:'À vérifier' } : null,
      connexions_echouees > 0 ? { type:'info', icon:'🔐', msg:`${connexions_echouees} connexion(s) échouée(s) aujourd'hui`, heure:'Aujourd\'hui' } : null,
    ].filter(Boolean);

    res.json({ success:true, stats:{
      kpis:{
        patients_total, users_total, users_connectes, consultations_total,
        hospitalisations, interventions, rdv_total,
        ca_global, depenses, benefice: ca_global - depenses,
        factures_impayees: factures_imp,
        patients_auj, consultations_auj, admissions_auj,
        rdv_auj: rdv_auj_total,
        urgences_en_cours,
        revenus_auj: revenus_auj_agg[0]?.total || 0,
      },
      users_par_role: uRoles,
      // AUDIT-DASHBOARD — db/backup/disk/cpu/ram/services_actifs étaient tous
      // codés en dur ('ok'/0/14) : un superadmin voyait "Base de données OK"
      // même connexion Mongo coupée. db reflète maintenant l'état réel de la
      // connexion Mongoose (seul signal vérifiable sans dépendance nouvelle).
      // backup/disk/cpu/ram/services_actifs restent non instrumentés (aucune
      // supervision OS/sauvegarde n'existe dans ce projet) — non affichés
      // tant que ce n'est pas construit, voir rapport d'audit dashboards.
      sys_status:{
        db: mongoose.connection.readyState === 1 ? 'ok' : 'error',
      },
      connexions_echouees,
      comptes_bloques,
      chart_mois:{ labels:monthLabels, ca:caArr, dep:depArr },
      chart_activite:{
        labels: activiteLabels,
        patients:       joursSemaine.map(j => patientsMap[j] || 0),
        consultations:  joursSemaine.map(j => consultsMap[j] || 0),
        rdv:            joursSemaine.map(j => rdvMap[j] || 0),
        hospitalisations: joursSemaine.map(j => hospitMap[j] || 0),
      },
      alertes_crit: alertes,
      rdv_auj_liste: rdv_auj,
      rdv_stats: { total:rdv_auj_total, confirmes:rdv_confirmes, en_attente:rdv_en_attente, termines:rdv_termines, annules:rdv_annules },
      consultations_auj_liste,
      urgences: { nouvelles:urgences_nouvelles, en_cours:urgences_en_cours, terminees:urgences_terminees },
      hospitalisation: { admissions_auj, patients_actuels:hospitalisations, sorties_auj },
      laboratoire: { demandes_auj:labo_demandes_auj, en_cours:labo_en_cours, critiques:labo_critiques },
      imagerie: { examens_auj:img_examens_auj, en_attente:img_en_attente, rapports_dispo:img_rapports_dispo },
      pharmacie: { stock_faible:pharma_stock_faible, ruptures:pharma_ruptures },
    }});
  } catch (err) { next(err); }
};

// ─── 2. ADMIN CLINIQUE ─────────────────────────────────────────
exports.adminCliniqueStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      patients_auj,
      rdv_auj_total, rdv_confirmes, rdv_en_attente, rdv_annules, rdv_absents,
      consults_en_cours, consults_suspendues, consults_terminees,
      hospit_en_cours, occupation_lits, sorties_prev, admissions_auj,
      labo_auj, imagerie_auj,
      chirurgie_prog, chirurgie_real,
      ordonnances_auj,
      revenus_auj_agg, depenses_auj_agg, factures_imp_agg,
      stock_faible, expires, commandes_attente,
      medecins_p, infirmiers_p, laborantins_p, admin_p, absents, conges,
      alertes_labo, alertes_pharma,
      rdv_liste,
      chart_consults, chart_revenus,
    ] = await Promise.all([
      Patient.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'confirme' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'en_attente' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'annule' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'absent' }),
      Consultation.countDocuments({ date_consultation:{ $gte:start,$lte:end }, statut:'en_cours' }),
      Consultation.countDocuments({ date_consultation:{ $gte:start,$lte:end }, statut:'suspendue' }),
      Consultation.countDocuments({ date_consultation:{ $gte:start,$lte:end }, statut:'terminee' }),
      Hospitalization.countDocuments({ statut:'en_cours' }),
      litsOccupationPct(),
      Hospitalization.countDocuments({ statut:'en_cours', date_sortie_prevue:{ $gte:start,$lte:end }}),
      Hospitalization.countDocuments({ date_entree:{ $gte:start,$lte:end }}),
      LabResult.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ date_prescription:{ $gte:start,$lte:end }}),
      Surgery.countDocuments({ date_intervention_prev:{ $gte:start,$lte:end }, statut:'preoperatoire' }),
      Surgery.countDocuments({ date_intervention_prev:{ $gte:start,$lte:end }, statut:{ $in:['opere','suivi_postop','cloture'] } }),
      Ordonnance.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_paye' }}}]),
      // AUDIT-04 — Depense.date/montant, même fenêtre "aujourd'hui" que le revenu ci-dessus.
      Depense.aggregate([{ $match:{ date:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant' }}}]),
      Invoice.aggregate([{ $match:{ statut:{ $in:['emise','partiellement_payee'] } }},{ $group:{ _id:null,total:{ $sum:'$montant_restant' }}}]),
      Medication.countDocuments({ $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }, date_peremption:{ $gt: new Date() }}),
      Medication.countDocuments({ date_peremption:{ $lte: new Date() }}),
      // AUDIT-04 — Commande.statut hors "recu"/"annule" = encore en attente d'une action.
      Commande.countDocuments({ statut:{ $nin:['recu','annule'] }}),
      User.countDocuments({ role:'medecin', statut:'actif' }),
      User.countDocuments({ role:'infirmier', statut:'actif' }),
      User.countDocuments({ role:'laborantin', statut:'actif' }),
      User.countDocuments({ role:{ $in:['adminclinique','receptionniste','comptable'] }, statut:'actif' }),
      Staff.countDocuments({ statut:'absent' }),
      Staff.countDocuments({ statut:'conge' }),
      LabResult.find({ est_critique:true, acquitte_par:null }).populate('patient','nom prenom').limit(5),
      Medication.find({ $or:[{ $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }},{ date_peremption:{ $lte: new Date() }}]}).limit(3),
      // RDV du jour avec détails
      Appointment.find({ date_heure:{ $gte:start,$lte:end }})
        .populate('patient','nom prenom')
        .populate('medecin','nom prenom')
        .sort({ date_heure:1 }).limit(10),
      // Consultations 7 jours
      Consultation.aggregate([
        { $match:{ date_consultation:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date_consultation' }}, count:{ $sum:1 }}},
        { $sort:{ _id:1 }},
      ]),
      // Revenus 7 jours
      Invoice.aggregate([
        { $match:{ statut:'payee', date_facture:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date_facture' }}, total:{ $sum:'$montant_paye' }}},
        { $sort:{ _id:1 }},
      ]),
    ]);

    // Formater RDV liste
    const rdv_auj = rdv_liste.map(r => ({
      heure: new Date(r.date_heure).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      patient: r.patient ? `${r.patient.prenom} ${r.patient.nom}` : 'Inconnu',
      type: r.type || 'Consultation',
      medecin: r.medecin ? `Dr. ${r.medecin.nom}` : '—',
      statut: r.statut || 'en_attente',
    }));

    // AUDIT-3.5 (ADM-02) — chart_consults et chart_revenus sont deux
    // agrégations indépendantes, groupées sur des champs de date différents
    // (date_consultation / date_facture) : un jour avec des consultations
    // mais sans facture payée (ou l'inverse) n'a pas le même ensemble de
    // dates dans les deux séries. Les labels dérivés uniquement de
    // chart_consults pouvaient donc afficher un revenu sous la mauvaise
    // date. Reconciliation sur une liste fixe des 7 derniers jours
    // (aujourd'hui inclus), jours sans donnée comptés à zéro dans les deux
    // séries.
    const joursSemaine = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      joursSemaine.push(d.toISOString().substring(0, 10)); // YYYY-MM-DD, même format que $dateToString ci-dessus
    }
    const consultsParJour = Object.fromEntries(chart_consults.map(d => [d._id, d.count]));
    const revenusParJour  = Object.fromEntries(chart_revenus.map(d => [d._id, d.total]));
    const cLabels = joursSemaine.map(j => dayLabels([{ _id: j }])[0]);

    // Alertes combinées
    const alertes = [
      ...alertes_labo.map(a => ({ type:'error', icon:'🔬', msg:`Résultat critique : ${a.patient?.nom||'Patient'}`, heure: new Date(a.createdAt).toLocaleString('fr-FR') })),
      ...alertes_pharma.map(m => ({ type: m.date_peremption<=new Date()?'error':'warn', icon:'💊', msg:`${m.nom_commercial} — ${m.date_peremption<=new Date()?'Expiré':'Stock bas ('+m.stock_actuel+' unités)'}`, heure:'Aujourd\'hui' })),
      factures_imp_agg[0]?.total > 0 ? { type:'warn', icon:'💰', msg:`${(factures_imp_agg[0].total).toLocaleString('fr-FR')} CFA de factures impayées`, heure:'Aujourd\'hui' } : null,
    ].filter(Boolean);

    res.json({ success:true, stats:{
      kpis:{
        patients_auj, rdv_auj: rdv_auj_total,
        consultations_auj: consults_en_cours + consults_suspendues + consults_terminees,
        hospit_en_cours, labo_auj, imagerie_auj, ordonnances_auj,
        revenus_auj: revenus_auj_agg[0]?.total || 0,
        depenses_auj: depenses_auj_agg[0]?.total || 0,
        factures_imp: factures_imp_agg[0]?.total || 0,
      },
      // Le modèle Consultation n'a pas d'état "en attente" (enum réel :
      // en_cours/terminee/suspendue) — le 3ᵉ compteur reflète "suspendue".
      consults:{ en_attente:consults_suspendues, en_cours:consults_en_cours, terminees:consults_terminees },
      hospit:{ admissions_auj, occupation_lits, sorties_prev },
      // "reportee" n'existe pas dans l'enum DossierChirurgical.statut — non modélisé.
      chirurgie:{ programmees:chirurgie_prog, realisees:chirurgie_real, reportees:0 },
      rdv:{ total:rdv_auj_total, confirmes:rdv_confirmes, en_attente:rdv_en_attente, annules:rdv_annules, absents:rdv_absents },
      pharmacie:{ stock_faible, expires, commandes_attente },
      personnel:{ medecins_presents:medecins_p, infirmiers_presents:infirmiers_p, laborantins_presents:laborantins_p, admin_presents:admin_p, absents, conges },
      alertes,
      rdv_auj,
      chart_semaine:{
        labels: cLabels,
        consults: joursSemaine.map(j => consultsParJour[j] || 0),
        revenus:  joursSemaine.map(j => revenusParJour[j] || 0),
      },
    }});
  } catch (err) { next(err); }
};

// ─── 3. MÉDECIN ────────────────────────────────────────────────
exports.medecinStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();
    const medecinId = req.user._id;

    const [
      mes_patients,
      mes_consults_auj,
      mes_rdv_auj,
      mes_ordonnances_auj,
      mes_hospit,
      mes_chirurgies,
      mes_urgences,
      consults_du_jour,
      hospit_patients,
      alertes_labo,
      ia_stats,
    ] = await Promise.all([
      Patient.countDocuments({ medecin_referent:medecinId, statut:'actif' }),
      Consultation.countDocuments({ medecin:medecinId, date_consultation:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ medecin:medecinId, date_heure:{ $gte:start,$lte:end }}),
      Ordonnance.countDocuments({ medecin:medecinId, createdAt:{ $gte:start,$lte:end }}),
      Hospitalization.countDocuments({ medecin_responsable:medecinId, statut:'en_cours' }),
      Surgery.countDocuments({ chirurgien_id:medecinId, statut:{ $in:['opere','suivi_postop','cloture'] } }),
      // AUDIT-DASHBOARD — Urgence.medecin_responsable existe réellement (même
      // pattern que Hospitalization.medecin_responsable/Surgery.chirurgien_id
      // ci-dessus) mais n'était jamais agrégé ici : un médecin ne voyait
      // aucun passage aux urgences sous sa responsabilité sur son dashboard.
      Urgence.countDocuments({ medecin_responsable:medecinId, statut:{ $nin:['sorti','transfere','decede'] } }),
      // Consultations du jour avec détails
      Consultation.find({ medecin:medecinId, date_consultation:{ $gte:start,$lte:end }})
        .populate('patient','nom prenom')
        .sort({ date_consultation:1 }).limit(10),
      // Patients hospitalisés
      Hospitalization.find({ medecin_responsable:medecinId, statut:'en_cours' })
        .populate('patient','nom prenom')
        .limit(5),
      // Alertes labo critiques pour mes patients
      LabResult.find({ est_critique:true, acquitte_par:null, medecin_prescripteur:medecinId })
        .populate('patient','nom prenom').limit(5),
      // Stats IA (suggestions générées automatiquement à la consultation)
      // AUDIT-DASHBOARD — taux_precision était fixé en dur à 94 quel que soit
      // le contenu réel : ia_suggestions ne stocke qu'un diagnostic +
      // confidence par suggestion, jamais confronté a posteriori à un
      // diagnostic confirmé — aucun taux de précision n'est réellement
      // calculable avec les données actuelles. 0 explicite, même convention
      // que le reste de ce fichier (cf. en-tête), plutôt qu'un chiffre inventé.
      Consultation.countDocuments({ medecin:medecinId, 'ia_suggestions.0':{ $exists:true } }).then(d => ({
        diagnostics_assistes: d,
        alertes_risque: 0,
        interactions_detectees: 0,
        taux_precision: 0,
      })).catch(() => ({ diagnostics_assistes:0, alertes_risque:0, interactions_detectees:0, taux_precision:0 })),
    ]);

    // Formater consultations du jour
    const consults_auj = consults_du_jour.map(c => ({
      heure: new Date(c.date_consultation).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      patient: c.patient ? `${c.patient.prenom} ${c.patient.nom}` : 'Inconnu',
      motif: c.diagnostic || c.anamnese || '—',
      statut: c.statut || 'en_cours',
    }));

    // Formater hospitalisations
    // AUDIT-DASHBOARD — statut était fixé en dur à 'stable' pour chaque
    // patient : le badge frontend "⚠ Surveillance / ✅ Stable" ne reflétait
    // donc jamais un état réel (aucun champ de gravité/surveillance n'existe
    // sur Hospitalization pour un séjour en_cours — etat_patient est réservé
    // à la sortie). Champ retiré plutôt que de continuer à afficher une
    // évaluation clinique fictive ; voir Dashboard.jsx pour le badge neutre.
    const hospit_patients_fmt = hospit_patients.map(h => ({
      nom: h.patient ? `${h.patient.prenom} ${h.patient.nom}` : 'Inconnu',
      chambre: h.chambre_num || '—',
      jours: Math.ceil((new Date()-new Date(h.date_entree)) / 86400000),
    }));

    // Alertes
    const alertes = alertes_labo.map(a => ({
      type:'error',
      msg:`${a.patient?.nom||'Patient'} — Résultat critique${a.valeurs_critiques ? ' : ' + a.valeurs_critiques : ''}`,
      heure: new Date(a.createdAt).toLocaleString('fr-FR'),
    }));

    res.json({ success:true, stats:{
      kpis:{ mes_patients, mes_consults_auj, mes_rdv_auj, mes_ordonnances_auj, mes_hospit, mes_chirurgies, mes_urgences },
      consults_auj,
      hospit_patients: hospit_patients_fmt,
      alertes,
      ia_stats,
    }});
  } catch (err) { next(err); }
};

// ─── 3bis. SAGE-FEMME ──────────────────────────────────────────
// AUDIT-ADMIN-P1 — sage_femme n'avait aucun dashboard dédié (retombait sur
// le fallback générique de exports.getStats ci-dessous, déjà annoté "ex:
// sage_femme, sans dashboard dédié"). Même structure que medecinStats
// ci-dessus, mais Pregnancy.sage_femme/Delivery.sage_femme sont des String
// libres (jamais un ObjectId ref vers User, contrairement à
// Consultation.medecin) — scope "mes patientes" fait donc par
// correspondance approximative sur le nom réel de l'utilisatrice connectée,
// même principe déjà validé en Analytics Phase 7 pour les champs médecin
// en texte libre (jamais un nom inventé, juste une limite de fiabilité
// disclosed).
exports.sageFemmeStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();
    const now = new Date();
    const dans7j = new Date(now.getTime() + 7 * 86400000);
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const nomRegex = new RegExp(`${escapeRegex(req.user.prenom || '')}.*${escapeRegex(req.user.nom || '')}|${escapeRegex(req.user.nom || '')}`, 'i');
    const filtreSF = { sage_femme: nomRegex };

    const [
      mes_grossesses_suivies,
      mes_accouchements_mois,
      patientes_risque_eleve,
      accouchements_prevus_7j,
      suivis_postnatal_actifs,
      cpn_auj_result,
      grossesses_risque,
    ] = await Promise.all([
      Pregnancy.countDocuments({ ...filtreSF, statut: { $in: ['active', 'a_risque'] } }),
      Delivery.countDocuments({ sage_femme: nomRegex, date_heure: { $gte: debutMois } }),
      Pregnancy.countDocuments({ ...filtreSF, statut: { $ne: 'cloturee' }, niveau_risque: 'eleve' }),
      Pregnancy.countDocuments({ ...filtreSF, statut: 'active', dpa: { $gte: now, $lte: dans7j } }),
      Pregnancy.countDocuments({ ...filtreSF, statut: 'suivi_postnatal' }),
      Pregnancy.aggregate([
        { $match: filtreSF },
        { $unwind: '$cpns' },
        { $match: { 'cpns.date': { $gte: start, $lte: end } } },
        { $project: { patient_nom: 1, patient_prenom: 1, 'cpns.date': 1, 'cpns.terme': 1 } },
      ]).catch(() => []),
      Pregnancy.find({ ...filtreSF, statut: { $ne: 'cloturee' }, niveau_risque: 'eleve' })
        .select('patient_nom patient_prenom terme dpa niveau_risque').limit(5).lean(),
    ]);

    const cpn_auj = cpn_auj_result.map(p => ({
      heure: new Date(p.cpns.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      patiente: `${p.patient_prenom || ''} ${p.patient_nom || ''}`.trim() || 'Inconnue',
      terme: p.cpns.terme ? `${p.cpns.terme} SA` : '—',
    }));

    const grossesses_a_risque = grossesses_risque.map(g => ({
      patiente: `${g.patient_prenom || ''} ${g.patient_nom || ''}`.trim() || 'Inconnue',
      dpa: g.dpa ? new Date(g.dpa).toLocaleDateString('fr-FR') : '—',
      niveau_risque: g.niveau_risque,
    }));

    const alertes = grossesses_a_risque.map(g => ({
      type: 'error',
      msg: `${g.patiente} — Grossesse à risque élevé (DPA ${g.dpa})`,
      heure: '',
    }));

    res.json({ success: true, stats: {
      kpis: { mes_grossesses_suivies, mes_accouchements_mois, patientes_risque_eleve, accouchements_prevus_7j, suivis_postnatal_actifs, cpn_aujourdhui: cpn_auj.length },
      cpn_auj,
      grossesses_a_risque,
      alertes,
    }});
  } catch (err) { next(err); }
};

// ─── 4. INFIRMIER ──────────────────────────────────────────────
// ⚠️ Il n'existe aujourd'hui aucun schéma de "plan de soins" (soins,
// constantes à prendre, médicaments à distribuer par horaire) — seul
// Hospitalization.notes_cliniques[] existe (saisie libre horodatée), sans
// structure de tâches/rappels. Les KPI ci-dessous qui nécessiteraient ce
// modèle sont donc à 0 de façon EXPLICITE (fonctionnalité non construite,
// pas un bug de requête) — voir rapport d'audit, section Infirmier.
exports.infirmierStats = async (req, res, next) => {
  try {
    const hospitalises = await Hospitalization.find({ statut:'en_cours' }).select('patient').lean();
    const patientIds = hospitalises.map(h => h.patient).filter(Boolean);

    // AUDIT-A-6 — alertes était un tableau vide codé en dur alors que
    // laborantinStats (juste en dessous) calcule déjà les mêmes résultats
    // labo critiques non acquittés pour son propre tableau de bord : les
    // données existaient, seule la requête manquait ici. Restreint aux
    // patients actuellement hospitalisés (statut:'en_cours') — une
    // infirmière ne surveille que ses patients du moment, pas tous les
    // résultats critiques du système (portée volontairement plus étroite
    // que laborantinStats, qui les voit tous).
    const alertes_raw = patientIds.length
      ? await LabResult.find({ patient:{ $in: patientIds }, est_critique:true, acquitte_par:null })
          .populate('patient','nom prenom').populate('examen','nom').limit(10)
      : [];

    const alertes = alertes_raw.map(a => ({
      type: 'error',
      msg: `${a.patient?.nom||'Patient'} — ${a.examen?.nom || 'Résultat'} : CRITIQUE`,
      heure: 'Urgent',
    }));

    res.json({ success:true, stats:{
      kpis:{
        patients_surveilles: hospitalises.length,
        soins_auj: 0,
        temperatures_a_prendre: 0,
        pansements: 0,
        medicaments_a_distribuer: 0,
        constantes_a_noter: 0,
      },
      alertes,
      planning: [],
    }});
  } catch (err) { next(err); }
};

// ─── 5. LABORANTIN ─────────────────────────────────────────────
exports.laborantinStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      analyses_auj,
      en_cours,
      terminees,
      critiques,
      en_attente_validation,
      analyses_urgentes_raw,
      alertes_raw,
    ] = await Promise.all([
      LabResult.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      LabResult.countDocuments({ statut:'en_cours' }),
      LabResult.countDocuments({ statut:'valide', createdAt:{ $gte:start,$lte:end }}),
      LabResult.countDocuments({ est_critique:true, acquitte_par:null }),
      // "en_attente_validation" n'existe pas dans l'enum réel — l'état
      // équivalent est 'termine' (résultat saisi, en attente de validation).
      LabResult.countDocuments({ statut:'termine' }),
      LabResult.find({ est_critique:true })
        .populate('patient','nom prenom').populate('examen','nom')
        .sort({ createdAt:-1 }).limit(10),
      LabResult.find({ est_critique:true, acquitte_par:null })
        .populate('patient','nom prenom').populate('examen','nom').limit(5),
    ]);

    const analyses_urgentes = analyses_urgentes_raw.map(a => ({
      patient: a.patient ? `${a.patient.prenom} ${a.patient.nom}` : 'Inconnu',
      examen: a.examen?.nom || a.patient_dossier || '—',
      valeur: a.valeurs_critiques || '—',
      statut: a.est_critique ? 'critique' : (a.statut || 'anormal'),
    }));

    const alertes = alertes_raw.map(a => ({
      type: 'error',
      msg: `${a.patient?.nom||'Patient'} — ${a.examen?.nom || 'Résultat'} : CRITIQUE`,
      heure: 'Urgent',
    }));

    if (en_attente_validation > 0) alertes.push({
      type:'warn', msg:`${en_attente_validation} analyse(s) en attente de validation`, heure:'À traiter',
    });

    res.json({ success:true, stats:{
      kpis:{ analyses_auj, en_cours, terminees, critiques, en_attente_validation },
      analyses_urgentes,
      alertes,
    }});
  } catch (err) { next(err); }
};

// ─── 6. PHARMACIEN ────────────────────────────────────────────
exports.pharmacienStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      medicaments_total,
      ruptures,
      stocks_faibles,
      expires,
      dispensations_auj,
      ventes_auj_agg,
      alertes_raw,
      top_meds_raw,
    ] = await Promise.all([
      Medication.countDocuments({}),
      Medication.countDocuments({ stock_actuel:{ $lte:0 }}),
      Medication.countDocuments({ $expr:{ $and:[{ $gt:['$stock_actuel',0] },{ $lte:['$stock_actuel','$seuil_alerte'] }]}}),
      Medication.countDocuments({ date_peremption:{ $lte:new Date() }}),
      Ordonnance.countDocuments({ statut:'dispensee', date_dispensation:{ $gte:start,$lte:end }}),
      // Les ventes comptoir (pharmacy.controller.js::createVente) ne sont
      // pas encore persistées en base — 0 explicite.
      Promise.resolve([]),
      Medication.find({ $or:[
        { stock_actuel:{ $lte:0 }},
        { date_peremption:{ $lte:new Date() }},
        { $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }},
      ]}).limit(6),
      // Top médicaments dispensés (7 jours)
      Ordonnance.aggregate([
        { $match:{ statut:'dispensee', date_dispensation:{ $gte:last7days() }}},
        { $unwind:'$lignes' },
        { $group:{ _id:'$lignes.medicament_nom', total:{ $sum:'$lignes.quantite' }}},
        { $sort:{ total:-1 }},
        { $limit:5 },
      ]),
    ]);

    const alertes = alertes_raw.map(m => ({
      type: m.stock_actuel <= 0 || m.date_peremption <= new Date() ? 'error' : 'warn',
      msg: m.stock_actuel <= 0
        ? `${m.nom_commercial} — Rupture de stock`
        : m.date_peremption <= new Date()
          ? `${m.nom_commercial} — Lot périmé (${new Date(m.date_peremption).toLocaleDateString('fr-FR')})`
          : `${m.nom_commercial} — Stock bas (${m.stock_actuel} unités)`,
      heure: m.stock_actuel <= 0 || m.date_peremption <= new Date() ? 'Urgent' : 'Commander',
    }));

    const top_meds = top_meds_raw.map(m => [m._id || 'Inconnu', m.total || 0]);

    res.json({ success:true, stats:{
      kpis:{ medicaments_total, ruptures, stocks_faibles, expires, dispensations_auj, ventes_auj: ventes_auj_agg[0]?.total||0 },
      alertes,
      top_meds,
    }});
  } catch (err) { next(err); }
};

// ─── 7. RÉCEPTIONNISTE ────────────────────────────────────────
exports.receptionnisteStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      patients_auj,
      rdv_confirmes,
      en_attente,
      absents,
      nouveaux_dossiers,
      messages_non_lus,
      rdv_prochains_raw,
    ] = await Promise.all([
      Patient.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'confirme' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'en_attente' }),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'absent' }),
      Patient.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      // Conversations où l'utilisateur est membre et a au moins un message
      // non lu qu'il n'a pas lui-même envoyé (Conversation n'a pas de champ
      // destinataire/lu au niveau racine — ce sont des sous-documents).
      Conversation.countDocuments({
        membres: req.user._id,
        messages: { $elemMatch: { lu_par: { $ne: req.user._id }, expediteur: { $ne: req.user._id } } },
      }),
      Appointment.find({ date_heure:{ $gte:new Date() }})
        .populate('patient','nom prenom')
        .populate('medecin','nom prenom')
        .sort({ date_heure:1 }).limit(8),
    ]);

    const rdv_prochains = rdv_prochains_raw.map(r => ({
      heure: new Date(r.date_heure).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      patient: r.patient ? `${r.patient.prenom} ${r.patient.nom}` : 'Inconnu',
      medecin: r.medecin ? `Dr. ${r.medecin.nom}` : '—',
      type: r.type || 'Consultation',
      statut: r.statut || 'en_attente',
    }));

    res.json({ success:true, stats:{
      kpis:{ patients_auj, rdv_confirmes, en_attente, absents, nouveaux_dossiers, messages: messages_non_lus },
      rdv_prochains,
    }});
  } catch (err) { next(err); }
};

// ─── 8. COMPTABLE ─────────────────────────────────────────────
exports.comptableStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      revenus_auj_agg,
      depenses_auj_agg,
      factures_imp_agg,
      creances_assur_agg,
      paiements_auj,
      alertes_raw,
      chart_revenus,
    ] = await Promise.all([
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_paye' }}}]),
      // AUDIT-04 — Depense.date/montant, même fenêtre "aujourd'hui" que le revenu ci-dessus.
      Depense.aggregate([{ $match:{ date:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant' }}}]),
      Invoice.aggregate([{ $match:{ statut:{ $in:['emise','partiellement_payee'] } }},{ $group:{ _id:null,total:{ $sum:'$montant_restant' }}}]),
      Invoice.aggregate([{ $match:{ statut:{ $in:['emise','partiellement_payee'] } }},{ $group:{ _id:null,total:{ $sum:'$montant_assurance' }}}]),
      // Factures ayant reçu au moins un paiement aujourd'hui (les paiements
      // sont des sous-documents avec leur propre date, pas un champ racine).
      Invoice.countDocuments({ paiements: { $elemMatch: { date: { $gte:start, $lte:end } } } }),
      Invoice.find({ statut:{ $in:['emise','partiellement_payee'] }, montant_restant:{ $gt:100000 }}).sort({ montant_restant:-1 }).limit(5),
      Invoice.aggregate([
        { $match:{ statut:'payee', date_facture:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date_facture' }}, total:{ $sum:'$montant_paye' }}},
        { $sort:{ _id:1 }},
      ]),
    ]);

    const rev   = revenus_auj_agg[0]?.total   || 0;
    const dep   = depenses_auj_agg[0]?.total  || 0;
    const fimp  = factures_imp_agg[0]?.total  || 0;
    const crass = creances_assur_agg[0]?.total || 0;

    const alertes = [
      fimp > 0 ? { type:'error', msg:`${fimp.toLocaleString('fr-FR')} CFA de factures impayées (${alertes_raw.length} factures)`, heure:'Critique' } : null,
      ...alertes_raw.slice(0,2).map(f => ({ type:'warn', msg:`Facture #${f.numero_facture||'?'} — ${(f.montant_restant||0).toLocaleString('fr-FR')} CFA impayée`, heure:`Depuis ${new Date(f.createdAt).toLocaleDateString('fr-FR')}` })),
    ].filter(Boolean);

    res.json({ success:true, stats:{
      kpis:{ revenus_auj:rev, depenses_auj:dep, benefice_auj:rev-dep, factures_imp:fimp, creances_assur:crass, paiements_auj },
      alertes,
      chart:{
        labels: chart_revenus.map(d => { const dt=new Date(d._id); return dt.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}); }),
        revenus: chart_revenus.map(d => d.total),
      },
    }});
  } catch (err) { next(err); }
};

// ─── 9. RADIOLOGUE ────────────────────────────────────────────
// L'imagerie médicale est portée par le modèle ImagingResult, pas
// Consultation (qui n'a ni champ `type`, ni `ia_result`).
exports.radiologueStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    // AUDIT-DASHBOARD — precision_ia était fixé en dur à 94 (aucun calcul
    // réel n'existe : ia_confidence est stocké par examen mais jamais
    // confronté a posteriori à un diagnostic confirmé). Retiré plutôt que
    // d'afficher un taux inventé. en_cours (statut 'realise' = examen
    // effectué, en attente de compte-rendu) remplace ce qui manquait ici
    // alors que le frontend l'attendait déjà — sans backing réel jusqu'ici,
    // le KPI affichait systématiquement sa valeur de repli codée en dur.
    const [examens_auj, en_attente, en_cours, rapports_rediges, anomalies, examens_liste_raw] = await Promise.all([
      ImagingResult.countDocuments({ date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ statut:'en_attente', date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ statut:'realise', date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ statut:{ $in:['rapporte','valide'] }, date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ ia_anomalie:true }),
      // AUDIT-DASHBOARD — le frontend attendait déjà une liste `examens`
      // (table "Examens du jour") mais elle n'était jamais renvoyée : les KPI
      // ci-dessus montraient un nombre réel non nul pendant que la table
      // affichait systématiquement "Aucun examen aujourd'hui". patient_nom/
      // type_examen/heure_rdv sont des champs texte libre déjà stockés sur
      // ImagingResult (voir modèle) — pas de populate nécessaire.
      ImagingResult.find({ date_prescription:{ $gte:start,$lte:end }, statut:{ $ne:'annule' } })
        .sort({ date_prescription:1 }).limit(20),
    ]);

    const examens = examens_liste_raw.map(e => ({
      patient: e.patient_nom || 'Patient',
      type: e.type_examen || e.type_categorie || 'Examen',
      heure: e.heure_rdv || new Date(e.date_prescription).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
      statut: e.ia_anomalie ? 'anomalie' : (e.statut === 'realise' ? 'en_cours' : (['rapporte','valide'].includes(e.statut) ? 'valide' : 'en_attente')),
    }));

    res.json({ success:true, stats:{
      kpis:{ examens_auj, en_attente, en_cours, rapports_rediges, anomalies },
      examens,
      alertes: anomalies > 0 ? [{ type:'error', msg:`${anomalies} anomalie(s) IA détectée(s) — Vérification requise`, heure:'Urgent' }] : [],
    }});
  } catch (err) { next(err); }
};

// ─── ROUTE UNIQUE (fallback générique) ───────────────────────
exports.getStats = async (req, res, next) => {
  const role = req.user?.role;
  const handlers = {
    superadmin:     exports.superAdminStats,
    adminclinique:  exports.adminCliniqueStats,
    medecin:        exports.medecinStats,
    sage_femme:     exports.sageFemmeStats,
    infirmier:      exports.infirmierStats,
    laborantin:     exports.laborantinStats,
    pharmacien:     exports.pharmacienStats,
    receptionniste: exports.receptionnisteStats,
    comptable:      exports.comptableStats,
    radiologue:     exports.radiologueStats,
  };
  const handler = handlers[role];
  if (handler) return handler(req, res, next);
  // Fallback générique si rôle inconnu — tous les rôles STAFF réels ont
  // désormais un dashboard dédié (sage_femme ajouté ci-dessus, AUDIT-ADMIN-P1).
  const { start, end } = todayRange();
  try {
    const [patients, rdv, consultations] = await Promise.all([
      Patient.countDocuments({}),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }}),
      Consultation.countDocuments({ date_consultation:{ $gte:start,$lte:end }}),
    ]);
    res.json({ success:true, stats:{ kpis:{ patients, rdv, consultations }, alertes:[], chart:{} }});
  } catch (err) { next(err); }
};

// T9.9 — cache court (30s, node-cache) sur les 9 agrégats de tableau de
// bord. Réassigné ici, après toutes les définitions, plutôt que décoré au
// niveau des routes : exports.getStats ci-dessus lit exports.<role>Stats
// au moment de l'appel (pas à l'import), donc cette réassignation couvre
// aussi bien un appel direct à /dashboard/medecin qu'un appel via le
// dispatcher générique /dashboard — sans dupliquer la logique de cache
// aux deux endroits. medecinStats/receptionnisteStats sont personnalisés
// (filtrent par req.user._id) : clé de cache par utilisateur, pas globale.
const { cacheStats } = require('../utils/dashboardCache');
exports.superAdminStats     = cacheStats('superAdminStats',     false, exports.superAdminStats);
exports.adminCliniqueStats  = cacheStats('adminCliniqueStats',  false, exports.adminCliniqueStats);
exports.medecinStats        = cacheStats('medecinStats',        true,  exports.medecinStats);
exports.sageFemmeStats      = cacheStats('sageFemmeStats',      true,  exports.sageFemmeStats);
exports.infirmierStats      = cacheStats('infirmierStats',      false, exports.infirmierStats);
exports.laborantinStats     = cacheStats('laborantinStats',     false, exports.laborantinStats);
exports.pharmacienStats     = cacheStats('pharmacienStats',     false, exports.pharmacienStats);
exports.receptionnisteStats = cacheStats('receptionnisteStats', true,  exports.receptionnisteStats);
exports.comptableStats      = cacheStats('comptableStats',      false, exports.comptableStats);
exports.radiologueStats     = cacheStats('radiologueStats',     false, exports.radiologueStats);
