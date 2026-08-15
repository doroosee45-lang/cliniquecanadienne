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
// pour lesquels aucune donnée n'est réellement modélisée (dépenses,
// ventes comptoir pharmacie, planning infirmier détaillé, échecs de
// connexion) sont désormais des zéros EXPLICITES et commentés, plutôt que
// des zéros accidentels indiscernables d'une vraie absence d'activité.
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
      Surgery.countDocuments({ statut:{ $in:['opere','suivi_postop','cloture'] } }),
      Appointment.countDocuments({}),
      Invoice.aggregate([{ $match:{ statut:{ $in:['emise','partiellement_payee'] } }}, { $group:{ _id:null, total:{ $sum:'$montant_restant' }}}]),
      Invoice.aggregate([{ $match:{ statut:'payee', date_facture:{ $gte: new Date(new Date().getFullYear(),new Date().getMonth(),1) }}}, { $group:{ _id:null, total:{ $sum:'$montant_paye' }}}]),
      // Dépenses de clinique : aucun modèle dédié n'existe actuellement
      // (Invoice ne sert qu'à la facturation patient) — 0 explicite.
      Promise.resolve([]),
      User.aggregate([{ $group:{ _id:'$role', count:{ $sum:1 }}}]),
      // CA 12 mois
      Invoice.aggregate([
        { $match:{ statut:'payee', date_facture:{ $gte: last12months() }}},
        { $group:{ _id:{ $month:'$date_facture' }, total:{ $sum:'$montant_paye' }}},
        { $sort:{ '_id':1 }},
      ]),
      // Dépenses 12 mois — idem, non modélisé
      Promise.resolve([]),
      // Alertes critiques système
      LabResult.aggregate([
        { $match:{ est_critique:true, acquitte_par:null }},
        { $lookup:{ from:'patients', localField:'patient', foreignField:'_id', as:'pat' }},
        { $limit:10 },
        { $project:{ type:'error', msg:{ $concat:['Résultat critique — ', { $arrayElemAt:['$pat.nom',0] }] }, heure:'$createdAt' }},
      ]),
      Patient.countDocuments({ createdAt:{ $gte:start, $lte:end }}),
      Consultation.countDocuments({ date_consultation:{ $gte:start, $lte:end }}),
      Hospitalization.countDocuments({ date_entree:{ $gte:start, $lte:end }}),
      // Aucun compteur de tentatives de connexion échouées n'est encore
      // persisté sur User — 0 explicite (voir rapport d'audit : à implémenter).
      Promise.resolve(0),
      User.countDocuments({ statut:'suspendu' }),
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
      // Dépenses clinique : non modélisé
      Promise.resolve([]),
      Invoice.aggregate([{ $match:{ statut:{ $in:['emise','partiellement_payee'] } }},{ $group:{ _id:null,total:{ $sum:'$montant_restant' }}}]),
      Medication.countDocuments({ $expr:{ $lte:['$stock_actuel','$seuil_alerte'] }, date_peremption:{ $gt: new Date() }}),
      Medication.countDocuments({ date_peremption:{ $lte: new Date() }}),
      // Commandes fournisseurs : non persistées en base actuellement (voir pharmacy.controller.js::getCommandes)
      Promise.resolve(0),
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

    // Formater graphiques
    const cLabels = chart_consults.map(d => dayLabels([d])[0] || d._id);
    const rLabels = chart_revenus.map(d  => dayLabels([d])[0] || d._id);

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
      Consultation.countDocuments({ medecin:medecinId, date_consultation:{ $gte:start,$lte:end }}),
      Appointment.countDocuments({ medecin:medecinId, date_heure:{ $gte:start,$lte:end }}),
      Ordonnance.countDocuments({ medecin:medecinId, createdAt:{ $gte:start,$lte:end }}),
      Hospitalization.countDocuments({ medecin_responsable:medecinId, statut:'en_cours' }),
      Surgery.countDocuments({ chirurgien_id:medecinId, statut:{ $in:['opere','suivi_postop','cloture'] } }),
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
      Consultation.countDocuments({ medecin:medecinId, 'ia_suggestions.0':{ $exists:true } }).then(d => ({
        diagnostics_assistes: d,
        alertes_risque: 0,
        interactions_detectees: 0,
        taux_precision: 94,
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
    const hospit_patients_fmt = hospit_patients.map(h => ({
      nom: h.patient ? `${h.patient.prenom} ${h.patient.nom}` : 'Inconnu',
      chambre: h.chambre_num || '—',
      jours: Math.ceil((new Date()-new Date(h.date_entree)) / 86400000),
      statut: 'stable',
    }));

    // Alertes
    const alertes = alertes_labo.map(a => ({
      type:'error',
      msg:`${a.patient?.nom||'Patient'} — Résultat critique${a.valeurs_critiques ? ' : ' + a.valeurs_critiques : ''}`,
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
// ⚠️ Il n'existe aujourd'hui aucun schéma de "plan de soins" (soins,
// constantes à prendre, médicaments à distribuer par horaire) — seul
// Hospitalization.notes_cliniques[] existe (saisie libre horodatée), sans
// structure de tâches/rappels. Les KPI ci-dessous qui nécessiteraient ce
// modèle sont donc à 0 de façon EXPLICITE (fonctionnalité non construite,
// pas un bug de requête) — voir rapport d'audit, section Infirmier.
exports.infirmierStats = async (req, res, next) => {
  try {
    const [patients_surveilles] = await Promise.all([
      Hospitalization.countDocuments({ statut:'en_cours' }),
    ]);

    res.json({ success:true, stats:{
      kpis:{
        patients_surveilles,
        soins_auj: 0,
        temperatures_a_prendre: 0,
        pansements: 0,
        medicaments_a_distribuer: 0,
        constantes_a_noter: 0,
      },
      alertes: [],
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
      // Dépenses clinique : non modélisé
      Promise.resolve([]),
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

    const [examens_auj, en_attente, rapports_rediges, anomalies] = await Promise.all([
      ImagingResult.countDocuments({ date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ statut:'en_attente', date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ statut:{ $in:['rapporte','valide'] }, date_prescription:{ $gte:start,$lte:end }}),
      ImagingResult.countDocuments({ ia_anomalie:true }),
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
  // Fallback générique si rôle inconnu (ex: sage_femme, sans dashboard dédié)
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
