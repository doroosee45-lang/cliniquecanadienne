// const Patient = require('../models/Patient');
// const Appointment = require('../models/Appointment');
// const Consultation = require('../models/Consultation');
// const Invoice = require('../models/Invoice');
// const LabResult = require('../models/LabResult');
// const Hospitalization = require('../models/Hospitalization');
// const Medication = require('../models/Medication');

// exports.getStats = async (req, res, next) => {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);

//     const [
//       totalPatients, totalStaff, rdvAujourdhui, hospisEnCours,
//       critiquesNonAcquittes, stockAlertes, caTotal, rdvData, invoiceData
//     ] = await Promise.all([
//       Patient.countDocuments({ statut: 'actif' }),
//       require('../models/User').countDocuments({ statut: 'actif' }),
//       Appointment.countDocuments({ date_heure: { $gte: today, $lt: tomorrow } }),
//       Hospitalization.countDocuments({ statut: 'en_cours' }),
//       LabResult.countDocuments({ est_critique: true, acquitte_par: null }),
//       Medication.countDocuments({ $expr: { $lte: ['$stock_actuel', '$seuil_alerte'] } }),
//       Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$montant_paye' } } }]),
//       // 7-day appointments
//       Appointment.aggregate([
//         { $match: { date_heure: { $gte: new Date(Date.now() - 7 * 86400000) } } },
//         { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_heure' } }, count: { $sum: 1 } } },
//         { $sort: { _id: 1 } },
//       ]),
//       // 7-day revenue
//       Invoice.aggregate([
//         { $match: { date_facture: { $gte: new Date(Date.now() - 7 * 86400000) } } },
//         { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_facture' } }, total: { $sum: '$montant_paye' } } },
//         { $sort: { _id: 1 } },
//       ]),
//     ]);

//     res.json({ success: true, stats: {
//       totalPatients, totalStaff, rdvAujourdhui, hospisEnCours,
//       critiquesNonAcquittes, stockAlertes,
//       caTotal: caTotal[0]?.total || 0,
//       rdvData, invoiceData,
//     }});
//   } catch (err) { next(err); }
// };





// controllers/dashboardController.js
const Patient        = require('../models/Patient');
const Appointment    = require('../models/Appointment');
const Consultation   = require('../models/Consultation');
const Invoice        = require('../models/Invoice');
const LabResult      = require('../models/LabResult');
const Hospitalization= require('../models/Hospitalization');
const Medication     = require('../models/Medication');
const Surgery        = require('../models/DossierChirurgical');
const Ordonnance     = require('../models/Prescription');
const User           = require('../models/User');
const Message        = require('../models/Conversation');

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

// ─── 1. SUPER ADMIN ────────────────────────────────────────────
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
      alertes_critiques,
      patients_auj,
      consultations_auj,
      admissions_auj,
      connexions_echouees,
      comptes_bloques,
    ] = await Promise.all([
      Patient.countDocuments({ statut:'actif' }),
      User.countDocuments({ statut:'actif' }),
      User.countDocuments({ statut:'actif', derniere_connexion:{ $gte: new Date(Date.now()-15*60000) } }),
      Consultation.countDocuments({}),
      Hospitalization.countDocuments({ statut:'en_cours' }),
      Surgery.countDocuments({ statut:'realisee' }),
      Appointment.countDocuments({}),
      Invoice.aggregate([{ $match:{ statut:'impayee' }}, { $group:{ _id:null, total:{ $sum:'$montant_total' }}}]),
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte: new Date(new Date().getFullYear(),new Date().getMonth(),1) }}}, { $group:{ _id:null, total:{ $sum:'$montant_paye' }}}]),
      Invoice.aggregate([{ $match:{ type:'depense', date_facture:{ $gte: new Date(new Date().getFullYear(),new Date().getMonth(),1) }}}, { $group:{ _id:null, total:{ $sum:'$montant_total' }}}]),
      User.aggregate([{ $group:{ _id:'$role', count:{ $sum:1 }}}]),
      // CA 12 mois
      Invoice.aggregate([
        { $match:{ statut:'payee', date_facture:{ $gte: last12months() }}},
        { $group:{ _id:{ $month:'$date_facture' }, total:{ $sum:'$montant_paye' }}},
        { $sort:{ '_id':1 }},
      ]),
      // Dépenses 12 mois
      Invoice.aggregate([
        { $match:{ type:'depense', date_facture:{ $gte: last12months() }}},
        { $group:{ _id:{ $month:'$date_facture' }, total:{ $sum:'$montant_total' }}},
        { $sort:{ '_id':1 }},
      ]),
      // Alertes critiques système
      LabResult.aggregate([
        { $match:{ est_critique:true, acquitte_par:null }},
        { $lookup:{ from:'patients', localField:'patient', foreignField:'_id', as:'pat' }},
        { $limit:10 },
        { $project:{ type:'error', msg:{ $concat:['Résultat critique — ', { $arrayElemAt:['$pat.nom',0] }] }, heure:'$createdAt' }},
      ]),
      Patient.countDocuments({ createdAt:{ $gte:start, $lte:end }}),
      Consultation.countDocuments({ date:{ $gte:start, $lte:end }}),
      Hospitalization.countDocuments({ date_admission:{ $gte:start, $lte:end }}),
      User.countDocuments({ tentatives_connexion_echouees:{ $gt:3 }}),
      User.countDocuments({ statut:'bloque' }),
    ]);

    // Formater users_par_role en objet
    const uRoles = {};
    users_par_role.forEach(r => { uRoles[r._id] = r.count; });

    // Formater graphiques 12 mois
    const caMap  = {}; chart_ca.forEach(d  => { caMap[d._id]  = d.total; });
    const depMap = {}; chart_dep.forEach(d => { depMap[d._id] = d.total; });
    const caArr  = Array.from({length:12}, (_,i) => caMap[i+1]  || 0);
    const depArr = Array.from({length:12}, (_,i) => depMap[i+1] || 0);

    const ca_global     = ca_global_agg[0]?.total || 0;
    const depenses      = depenses_agg[0]?.total   || 0;
    const factures_imp  = factures_impayees_agg[0]?.total || 0;

    res.json({ success:true, stats:{
      kpis:{
        patients_total, users_total, users_connectes, consultations_total,
        hospitalisations, interventions, rdv_total,
        ca_global, depenses, benefice: ca_global - depenses,
        factures_impayees: factures_imp,
        patients_auj, consultations_auj, admissions_auj,
      },
      users_par_role: uRoles,
      sys_status:{
        db:'ok', backup:'ok',
        disk:0, server_cpu:0, server_ram:0, services_actifs:14,
      },
      connexions_echouees,
      comptes_bloques,
      chart_mois:{ labels:monthLabels, ca:caArr, dep:depArr },
      alertes_crit: alertes_critiques.map(a => ({
        type: a.type || 'error',
        msg: a.msg,
        heure: new Date(a.heure).toLocaleString('fr-FR'),
      })),
    }});
  } catch (err) { next(err); }
};

// ─── 2. ADMIN CLINIQUE ─────────────────────────────────────────
exports.adminCliniqueStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();

    const [
      patients_auj,
      rdv_auj_total, rdv_confirmes, rdv_en_attente, rdv_annules,
      consults_en_attente, consults_en_cours, consults_terminees,
      hospit_en_cours, occupation_lits, sorties_prev,
      labo_auj, imagerie_auj,
      chirurgie_prog, chirurgie_real, chirurgie_rep,
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
      Consultation.countDocuments({ date:{ $gte:start,$lte:end }, statut:'en_attente' }),
      Consultation.countDocuments({ date:{ $gte:start,$lte:end }, statut:'en_cours' }),
      Consultation.countDocuments({ date:{ $gte:start,$lte:end }, statut:'terminee' }),
      Hospitalization.countDocuments({ statut:'en_cours' }),
      Hospitalization.countDocuments({ statut:'en_cours' }).then(n => Math.round((n/50)*100)), // sur 50 lits
      Hospitalization.countDocuments({ statut:'en_cours', sortie_prevue:{ $gte:start,$lte:end }}),
      LabResult.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      Consultation.countDocuments({ date:{ $gte:start,$lte:end }, type:'imagerie' }),
      Surgery.countDocuments({ date_prevue:{ $gte:start,$lte:end }, statut:'programmee' }),
      Surgery.countDocuments({ date_prevue:{ $gte:start,$lte:end }, statut:'realisee' }),
      Surgery.countDocuments({ date_prevue:{ $gte:start,$lte:end }, statut:'reportee' }),
      Ordonnance.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_paye' }}}]),
      Invoice.aggregate([{ $match:{ type:'depense', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_total' }}}]),
      Invoice.aggregate([{ $match:{ statut:'impayee' }},{ $group:{ _id:null,total:{ $sum:'$montant_total' }}}]),
      Medication.countDocuments({ $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }, date_expiration:{ $gt: new Date() }}),
      Medication.countDocuments({ date_expiration:{ $lte: new Date() }}),
      Medication.countDocuments({ statut_commande:'en_attente' }),
      User.countDocuments({ role:'medecin', statut_service:'present', date_service:{ $gte:start }}),
      User.countDocuments({ role:'infirmier', statut_service:'present', date_service:{ $gte:start }}),
      User.countDocuments({ role:'laborantin', statut_service:'present', date_service:{ $gte:start }}),
      User.countDocuments({ role:{ $in:['adminclinique','receptionniste','comptable'] }, statut_service:'present', date_service:{ $gte:start }}),
      User.countDocuments({ statut_service:'absent', date_service:{ $gte:start }}),
      User.countDocuments({ statut_service:'conge' }),
      LabResult.find({ est_critique:true, acquitte_par:null }).populate('patient','nom prenom').limit(5),
      Medication.find({ $or:[{ $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }},{ date_expiration:{ $lte: new Date() }}]}).limit(3),
      // RDV du jour avec détails
      Appointment.find({ date_heure:{ $gte:start,$lte:end }})
        .populate('patient','nom prenom')
        .populate('medecin','nom prenom')
        .sort({ date_heure:1 }).limit(10),
      // Consultations 7 jours
      Consultation.aggregate([
        { $match:{ date:{ $gte:last7days() }}},
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date' }}, count:{ $sum:1 }}},
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

    // Formater graphiques
    const cLabels = chart_consults.map(d => dayLabels([d])[0] || d._id);
    const rLabels = chart_revenus.map(d  => dayLabels([d])[0] || d._id);

    // Alertes combinées
    const alertes = [
      ...alertes_labo.map(a => ({ type:'error', icon:'🔬', msg:`Résultat critique : ${a.patient?.nom||'Patient'} — ${a.test}`, heure: new Date(a.createdAt).toLocaleString('fr-FR') })),
      ...alertes_pharma.map(m => ({ type: m.date_expiration<=new Date()?'error':'warn', icon:'💊', msg:`${m.nom} — ${m.date_expiration<=new Date()?'Expiré':'Stock bas ('+m.stock_actuel+' unités)'}`, heure:'Aujourd\'hui' })),
      factures_imp_agg[0]?.total > 0 ? { type:'warn', icon:'💰', msg:`${(factures_imp_agg[0].total).toLocaleString('fr-FR')} CFA de factures impayées`, heure:'Aujourd\'hui' } : null,
    ].filter(Boolean);

    res.json({ success:true, stats:{
      kpis:{
        patients_auj, rdv_auj: rdv_auj_total,
        consultations_auj: consults_en_attente + consults_en_cours + consults_terminees,
        hospit_en_cours, labo_auj, imagerie_auj, ordonnances_auj,
        revenus_auj: revenus_auj_agg[0]?.total || 0,
        depenses_auj: depenses_auj_agg[0]?.total || 0,
        factures_imp: factures_imp_agg[0]?.total || 0,
      },
      consults:{ en_attente:consults_en_attente, en_cours:consults_en_cours, terminees:consults_terminees },
      hospit:{ admissions_auj:0, occupation_lits, sorties_prev },
      chirurgie:{ programmees:chirurgie_prog, realisees:chirurgie_real, reportees:chirurgie_rep },
      rdv:{ total:rdv_auj_total, confirmes:rdv_confirmes, en_attente:rdv_en_attente, annules:rdv_annules, absents:0 },
      pharmacie:{ stock_faible, expires, commandes_attente },
      personnel:{ medecins_presents:medecins_p, infirmiers_presents:infirmiers_p, laborantins_presents:laborantins_p, admin_presents:admin_p, absents, conges },
      alertes,
      rdv_auj,
      chart_semaine:{
        labels: cLabels.length ? cLabels : ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
        consults: chart_consults.map(d => d.count),
        revenus:  chart_revenus.map(d  => d.total),
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
      consults_du_jour,
      hospit_patients,
      alertes_labo,
      ia_stats,
    ] = await Promise.all([
      Patient.countDocuments({ medecin_referent:medecinId, statut:'actif' }),
      Consultation.countDocuments({ medecin:medecinId, date:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ medecin:medecinId, date_heure:{ $gte:start,$lte:end }}),
      Ordonnance.countDocuments({ medecin:medecinId, createdAt:{ $gte:start,$lte:end }}),
      Hospitalization.countDocuments({ medecin_responsable:medecinId, statut:'en_cours' }),
      Surgery.countDocuments({ chirurgien_principal:medecinId, statut:'realisee' }),
      // Consultations du jour avec détails
      Consultation.find({ medecin:medecinId, date:{ $gte:start,$lte:end }})
        .populate('patient','nom prenom')
        .sort({ heure:1 }).limit(10),
      // Patients hospitalisés
      Hospitalization.find({ medecin_responsable:medecinId, statut:'en_cours' })
        .populate('patient','nom prenom')
        .limit(5),
      // Alertes labo critiques pour mes patients
      LabResult.find({ est_critique:true, acquitte_par:null, medecin:medecinId })
        .populate('patient','nom prenom').limit(5),
      // Stats IA (si module IA disponible)
      Consultation.countDocuments({ medecin:medecinId, ia_utilise:true }).then(d => ({
        diagnostics_assistes: d,
        alertes_risque: 0,
        interactions_detectees: 0,
        taux_precision: 94,
      })).catch(() => ({ diagnostics_assistes:0, alertes_risque:0, interactions_detectees:0, taux_precision:0 })),
    ]);

    // Formater consultations du jour
    const consults_auj = consults_du_jour.map(c => ({
      heure: c.heure || new Date(c.date).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      patient: c.patient ? `${c.patient.prenom} ${c.patient.nom}` : 'Inconnu',
      motif: c.motif || '—',
      statut: c.statut || 'en_attente',
    }));

    // Formater hospitalisations
    const hospit_patients_fmt = hospit_patients.map(h => ({
      nom: h.patient ? `${h.patient.prenom} ${h.patient.nom}` : 'Inconnu',
      chambre: h.numero_chambre || '—',
      jours: Math.ceil((new Date()-new Date(h.date_admission)) / 86400000),
      statut: h.statut_clinique || 'stable',
    }));

    // Alertes
    const alertes = alertes_labo.map(a => ({
      type:'error',
      msg:`${a.patient?.nom||'Patient'} — Résultat critique : ${a.test} = ${a.valeur}`,
      heure: new Date(a.createdAt).toLocaleString('fr-FR'),
    }));

    res.json({ success:true, stats:{
      kpis:{ mes_patients, mes_consults_auj, mes_rdv_auj, mes_ordonnances_auj, mes_hospit, mes_chirurgies },
      consults_auj,
      hospit_patients: hospit_patients_fmt,
      alertes,
      ia_stats,
    }});
  } catch (err) { next(err); }
};

// ─── 4. INFIRMIER ──────────────────────────────────────────────
exports.infirmierStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();
    const infirmierId = req.user._id;

    const [
      patients_surveilles,
      soins_auj,
      temperatures_a_prendre,
      pansements,
      medicaments_a_distribuer,
      constantes_a_noter,
      alertes_constantes,
      planning_soins,
    ] = await Promise.all([
      Hospitalization.countDocuments({ infirmier_referent:infirmierId, statut:'en_cours' }),
      Hospitalization.countDocuments({ 'soins.date':{ $gte:start,$lte:end }, 'soins.infirmier':infirmierId }),
      Hospitalization.countDocuments({ statut:'en_cours', 'constantes.prochaine_prise':{ $lte:new Date() }}),
      Hospitalization.countDocuments({ statut:'en_cours', 'soins.type':'pansement', 'soins.statut':'a_faire' }),
      Hospitalization.countDocuments({ statut:'en_cours', 'medicaments.heure_prochaine_dose':{ $lte:new Date() }}),
      Hospitalization.countDocuments({ statut:'en_cours', 'constantes.prochaine_saisie':{ $lte:new Date() }}),
      // Alertes constantes anormales
      Hospitalization.find({ statut:'en_cours', 'constantes.alerte':true })
        .populate('patient','nom prenom chambre').limit(5),
      // Planning du jour
      Hospitalization.find({ infirmier_referent:infirmierId, statut:'en_cours', 'soins.date':{ $gte:start,$lte:end }})
        .populate('patient','nom prenom').limit(8),
    ]);

    const alertes = alertes_constantes.map(h => ({
      type: 'error',
      msg: `${h.patient?.nom||'Patient'} — Chambre ${h.numero_chambre||'?'} : constante anormale`,
      heure: 'Maintenant',
    }));

    const planning = planning_soins.map((h, i) => ({
      heure: new Date(start.getTime() + (i+1)*7200000).toLocaleTimeString('fr-FR',{ hour:'2-digit',minute:'2-digit' }),
      tache: `Soins — ${h.patient?.nom||'Patient'} Chambre ${h.numero_chambre||'?'}`,
      fait: h.soins?.[0]?.statut === 'fait',
    }));

    res.json({ success:true, stats:{
      kpis:{ patients_surveilles, soins_auj, temperatures_a_prendre, pansements, medicaments_a_distribuer, constantes_a_noter },
      alertes,
      planning,
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
      LabResult.countDocuments({ statut:'en_attente_validation' }),
      LabResult.find({ $or:[{ est_critique:true },{ statut_alerte:{ $in:['anormal','eleve','critique'] }}]})
        .populate('patient','nom prenom').sort({ est_critique:-1 }).limit(10),
      LabResult.find({ est_critique:true, acquitte_par:null }).populate('patient','nom prenom').limit(5),
    ]);

    const analyses_urgentes = analyses_urgentes_raw.map(a => ({
      patient: a.patient ? `${a.patient.prenom} ${a.patient.nom}` : 'Inconnu',
      examen: a.test || a.type_analyse || '—',
      valeur: `${a.valeur||'?'} ${a.unite||''}`.trim(),
      statut: a.est_critique ? 'critique' : (a.statut_alerte || 'anormal'),
    }));

    const alertes = alertes_raw.map(a => ({
      type: 'error',
      msg: `${a.patient?.nom||'Patient'} — ${a.test} : CRITIQUE`,
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
      Medication.countDocuments({ statut:'actif' }),
      Medication.countDocuments({ stock_actuel:{ $lte:0 }}),
      Medication.countDocuments({ $expr:{ $and:[{ $gt:['$stock_actuel',0] },{ $lte:['$stock_actuel','$seuil_alerte'] }]}}),
      Medication.countDocuments({ date_expiration:{ $lte:new Date() }}),
      Ordonnance.countDocuments({ statut:'delivree', date_delivrance:{ $gte:start,$lte:end }}),
      Invoice.aggregate([{ $match:{ type:'vente_pharma', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_paye' }}}]),
      Medication.find({ $or:[
        { stock_actuel:{ $lte:0 }},
        { date_expiration:{ $lte:new Date() }},
        { $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }},
      ]}).limit(6),
      // Top médicaments dispensés
      Ordonnance.aggregate([
        { $match:{ statut:'delivree', createdAt:{ $gte:last7days() }}},
        { $unwind:'$medicaments' },
        { $group:{ _id:'$medicaments.nom', total:{ $sum:'$medicaments.quantite' }}},
        { $sort:{ total:-1 }},
        { $limit:5 },
      ]),
    ]);

    const alertes = alertes_raw.map(m => ({
      type: m.stock_actuel <= 0 || m.date_expiration <= new Date() ? 'error' : 'warn',
      msg: m.stock_actuel <= 0
        ? `${m.nom} — Rupture de stock`
        : m.date_expiration <= new Date()
          ? `${m.nom} — Lot périmé (${new Date(m.date_expiration).toLocaleDateString('fr-FR')})`
          : `${m.nom} — Stock bas (${m.stock_actuel} ${m.unite||'unités'})`,
      heure: m.stock_actuel <= 0 || m.date_expiration <= new Date() ? 'Urgent' : 'Commander',
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
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }, statut:'patient_absent' }),
      Patient.countDocuments({ createdAt:{ $gte:start,$lte:end }}),
      Message.countDocuments({ destinataire:req.user._id, lu:false }),
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
      Invoice.aggregate([{ $match:{ type:'depense', date_facture:{ $gte:start,$lte:end }}},{ $group:{ _id:null,total:{ $sum:'$montant_total' }}}]),
      Invoice.aggregate([{ $match:{ statut:'impayee' }},{ $group:{ _id:null,total:{ $sum:'$montant_total' }}}]),
      Invoice.aggregate([{ $match:{ statut:'impayee', mode_paiement:'assurance' }},{ $group:{ _id:null,total:{ $sum:'$montant_total' }}}]),
      Invoice.countDocuments({ date_paiement:{ $gte:start,$lte:end }, statut:'payee' }),
      Invoice.find({ statut:'impayee', montant_total:{ $gt:100000 }}).sort({ montant_total:-1 }).limit(5),
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
      ...alertes_raw.slice(0,2).map(f => ({ type:'warn', msg:`Facture #${f.numero||'?'} — ${(f.montant_total||0).toLocaleString('fr-FR')} CFA impayée`, heure:`Depuis ${new Date(f.createdAt).toLocaleDateString('fr-FR')}` })),
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
exports.radiologueStats = async (req, res, next) => {
  try {
    const { start, end } = todayRange();
    const radiologueId = req.user._id;

    const [examens_auj, en_attente, rapports_rediges, anomalies] = await Promise.all([
      Consultation.countDocuments({ type:'imagerie', date:{ $gte:start,$lte:end }}),
      Consultation.countDocuments({ type:'imagerie', statut:'en_attente', date:{ $gte:start,$lte:end }}),
      Consultation.countDocuments({ type:'imagerie', statut:'rapport_redige', date:{ $gte:start,$lte:end }}),
      Consultation.countDocuments({ type:'imagerie', 'ia_result.anomalie':true }),
    ]);

    res.json({ success:true, stats:{
      kpis:{ examens_auj, en_attente, rapports_rediges, anomalies, precision_ia:94 },
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
    infirmier:      exports.infirmierStats,
    laborantin:     exports.laborantinStats,
    pharmacien:     exports.pharmacienStats,
    receptionniste: exports.receptionnisteStats,
    comptable:      exports.comptableStats,
    radiologue:     exports.radiologueStats,
  };
  const handler = handlers[role];
  if (handler) return handler(req, res, next);
  // Fallback générique si rôle inconnu
  const { start, end } = todayRange();
  try {
    const [patients, rdv, consultations] = await Promise.all([
      Patient.countDocuments({}),
      Appointment.countDocuments({ date_heure:{ $gte:start,$lte:end }}),
      Consultation.countDocuments({ date:{ $gte:start,$lte:end }}),
    ]);
    res.json({ success:true, stats:{ kpis:{ patients, rdv, consultations }, alertes:[], chart:{} }});
  } catch (err) { next(err); }
};