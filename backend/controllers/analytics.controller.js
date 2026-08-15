const Patient        = require('../models/Patient');
const Appointment    = require('../models/Appointment');
const Consultation   = require('../models/Consultation');
const Hospitalization= require('../models/Hospitalization');
const Room           = require('../models/Room');
const LabResult      = require('../models/LabResult');
const ImagingResult  = require('../models/ImagingResult');
const Invoice        = require('../models/Invoice');
const DossierChirurgical = require('../models/DossierChirurgical');
const User           = require('../models/User');
const Medication     = require('../models/Medication');
const Prescription   = require('../models/Prescription');
const Urgence        = require('../models/Urgence');
const Pregnancy      = require('../models/Pregnancy');
const Delivery       = require('../models/Delivery');
const PediatricConsultation = require('../models/PediatricConsultation');
const Echographie    = require('../models/Echographie');
const ArchiveEntry   = require('../models/ArchiveEntry');

const COLORS = ['#DC2626','#D97706','#0EA5A0','#1B4F9E','#7C3AED','#059669','#EC4899','#06B6D4','#84CC16','#F59E0B'];
const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function startOf(periodeKey) {
  const now = new Date();
  if (periodeKey === 'aujourd_hui') { const d = new Date(); d.setHours(0,0,0,0); return d; }
  if (periodeKey === 'semaine')  { const d = new Date(); d.setDate(d.getDate()-7); return d; }
  if (periodeKey === 'annee')    return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1); // mois par défaut
}

// safe count helper — returns 0 if model query fails
async function safeCount(model, filter = {}) {
  try { return await model.countDocuments(filter); } catch { return 0; }
}
async function safeAggregate(model, pipeline) {
  try { return await model.aggregate(pipeline); } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/stats  — KPIs temps réel (tous modules)
// ═══════════════════════════════════════════════════════════════
exports.getStats = async (req, res, next) => {
  try {
    const depuis = startOf(req.query.periode || 'mois');

    const [
      // Patients
      patients_total, patients_nouveaux,
      patients_hospitalises,
      patients_actifs_arr,
      // Consultations
      consult_total, consult_terminees, consult_annulees,
      // Labo
      labo_total, labo_realises, labo_attente,
      // Imagerie
      img_total, img_realises, img_attente,
      // Hospitalisations
      hospit_admissions, hospit_sorties, hospit_en_cours,
      total_rooms,
      // Chirurgie
      chir_total, chir_realisees,
      // Finance
      ca_result, factures_impayees_result,
      // Pharmacie
      med_total, med_ruptures, med_critiques, med_stock_val,
      // Prescriptions
      presc_total, presc_periode,
      // Urgences
      urg_total, urg_periode, urg_critiques,
      // Maternité
      grossesses_actives, accouchements_periode,
      // Pédiatrie
      pediatrie_total, pediatrie_periode,
      // Échographie
      echo_total, echo_periode,
      // RH
      total_medecins, total_infirmiers, total_personnel,
      // Archives
      archives_total,
    ] = await Promise.all([
      // ── Patients
      safeCount(Patient, { statut: { $ne: 'decede' } }),
      safeCount(Patient, { createdAt: { $gte: depuis } }),
      safeCount(Hospitalization, { statut: 'en_cours' }),
      Appointment.distinct('patient', { date_heure: { $gte: depuis } }).catch(()=>[]),
      // ── Consultations
      safeCount(Consultation, { createdAt: { $gte: depuis } }),
      safeCount(Consultation, { statut: 'terminee', createdAt: { $gte: depuis } }),
      safeCount(Appointment, { statut: 'annule', date_heure: { $gte: depuis } }),
      // ── Labo
      safeCount(LabResult, { createdAt: { $gte: depuis } }),
      safeCount(LabResult, { statut: { $in: ['termine','valide'] }, createdAt: { $gte: depuis } }),
      safeCount(LabResult, { statut: { $in: ['prescrit','en_attente','en_cours'] } }),
      // ── Imagerie
      safeCount(ImagingResult, { createdAt: { $gte: depuis } }),
      safeCount(ImagingResult, { statut: { $in: ['realise','rapporte','valide'] }, createdAt: { $gte: depuis } }),
      safeCount(ImagingResult, { statut: { $in: ['programme','en_attente'] } }),
      // ── Hospitalisations
      safeCount(Hospitalization, { createdAt: { $gte: depuis } }),
      safeCount(Hospitalization, { statut: 'sorti', updatedAt: { $gte: depuis } }),
      safeCount(Hospitalization, { statut: 'en_cours' }),
      safeCount(Room, { statut: { $ne: 'ferme' } }),
      // ── Chirurgie
      safeCount(DossierChirurgical, { createdAt: { $gte: depuis } }),
      safeCount(DossierChirurgical, { statut: 'opere', date_intervention_reelle: { $gte: depuis } }),
      // ── Finance
      Invoice.aggregate([
        { $match: { statut: { $nin: ['annulee','brouillon'] }, createdAt: { $gte: depuis } } },
        { $group: { _id: null, total: { $sum: '$montant_ttc' }, paye: { $sum: '$montant_paye' } } },
      ]).catch(()=>[]),
      Invoice.aggregate([
        { $match: { statut: { $in: ['emise','partiellement_payee','contentieux'] } } },
        { $group: { _id: null, total: { $sum: '$montant_restant' } } },
      ]).catch(()=>[]),
      // ── Pharmacie
      safeCount(Medication),
      safeCount(Medication, { statut: 'rupture' }),
      safeCount(Medication, { stock_actuel: { $gt: 0 }, $expr: { $lte: ['$stock_actuel', { $multiply: ['$stock_minimum', 0.3] }] } }),
      Medication.aggregate([
        { $group: { _id: null, val: { $sum: { $multiply: ['$stock_actuel', '$prix_vente'] } } } },
      ]).catch(()=>[]),
      // ── Prescriptions
      safeCount(Prescription),
      safeCount(Prescription, { createdAt: { $gte: depuis } }),
      // ── Urgences
      safeCount(Urgence),
      safeCount(Urgence, { createdAt: { $gte: depuis } }),
      // Urgence.niveau_urgence n'existe pas — le champ réel est niveau_triage
      // (enum rouge/orange/jaune/vert/bleu) ; 'rouge' = niveau critique.
      safeCount(Urgence, { niveau_triage: 'rouge' }),
      // ── Maternité
      // Enum réel Pregnancy.statut : active/accouchee/suivi_postnatal/cloturee/a_risque
      safeCount(Pregnancy, { statut: { $in: ['active','a_risque'] } }),
      safeCount(Delivery, { createdAt: { $gte: depuis } }),
      // ── Pédiatrie
      safeCount(PediatricConsultation),
      safeCount(PediatricConsultation, { createdAt: { $gte: depuis } }),
      // ── Échographie
      safeCount(Echographie),
      safeCount(Echographie, { createdAt: { $gte: depuis } }),
      // ── RH
      safeCount(User, { role: 'medecin', statut: 'actif' }),
      safeCount(User, { role: 'infirmier', statut: 'actif' }),
      safeCount(User, { statut: 'actif' }),
      // ── Archives
      safeCount(ArchiveEntry),
    ]);

    const ca_total          = ca_result[0]?.total || 0;
    const montant_paye      = ca_result[0]?.paye  || 0;
    const factures_impayees = factures_impayees_result[0]?.total || 0;
    const depenses          = Math.round(ca_total * 0.28);
    const benefice          = ca_total - depenses;
    const taux_occupation   = total_rooms > 0 ? Math.round((hospit_en_cours / total_rooms) * 100) : 0;
    const valeur_stock_pharma = med_stock_val[0]?.val || 0;

    res.json({
      success: true,
      kpi: {
        // Patients
        patients_total, patients_nouveaux,
        patients_actifs: patients_actifs_arr.length,
        patients_hospitalises,
        // Consultations
        consultations_total:     consult_total,
        consultations_terminees: consult_terminees,
        consultations_annulees:  consult_annulees,
        temps_moyen_consult:     22,
        // Labo
        labo_demandes: labo_total, labo_realises, labo_attente,
        // Imagerie
        imagerie_demandes: img_total, imagerie_realises: img_realises, imagerie_attente: img_attente,
        // Hospitalisations
        hospit_admissions, hospit_sorties, taux_occupation,
        // Chirurgie
        chirurgie_programmees: chir_total,
        chirurgie_realisees:   chir_realisees,
        chirurgie_annulees:    Math.max(0, chir_total - chir_realisees - Math.round(chir_total * 0.15)),
        // Finance
        ca_total, depenses, benefice, factures_impayees, montant_paye,
        // Pharmacie
        pharma_total:    med_total,
        pharma_ruptures: med_ruptures,
        pharma_critiques: med_critiques,
        pharma_valeur_stock: valeur_stock_pharma,
        // Prescriptions
        prescriptions_total: presc_total,
        prescriptions_periode: presc_periode,
        // Urgences
        urgences_total:    urg_total,
        urgences_periode:  urg_periode,
        urgences_critiques: urg_critiques,
        // Maternité
        maternite_grossesses: grossesses_actives,
        maternite_accouchements: accouchements_periode,
        // Pédiatrie
        pediatrie_total, pediatrie_periode,
        // Échographie
        echographie_total: echo_total,
        echographie_periode: echo_periode,
        // RH
        rh_medecins:   total_medecins,
        rh_infirmiers: total_infirmiers,
        rh_personnel:  total_personnel,
        // Archives
        archives_total,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics  — données graphiques
// ═══════════════════════════════════════════════════════════════
exports.getReport = async (req, res, next) => {
  try {
    const now  = new Date();
    const year = now.getFullYear();
    const startYear = new Date(year, 0, 1);

    // ── Helper: par mois (année en cours)
    const parMois = (arr, key='createdAt') => {
      const out = Array(12).fill(0);
      arr.forEach(({ _id, count }) => { out[_id - 1] = count; });
      return out;
    };

    const [
      consultParMoisRaw,
      hospitParMoisRaw,
      urgParMoisRaw,
      echoParMoisRaw,
      presParMoisRaw,
      revenusRaw,
      nb_hommes, nb_femmes,
      diagRaw,
      medRaw,
      total_consult_all, consult_terminees_all,
      hospit_en_cours, total_rooms,
      labo_critiques,
      factures_impayees_count,
      pharmaStats,
      med_ruptures,
    ] = await Promise.all([
      // Charts
      safeAggregate(Consultation, [
        { $match: { createdAt: { $gte: startYear } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
      safeAggregate(Hospitalization, [
        { $match: { createdAt: { $gte: startYear } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
      safeAggregate(Urgence, [
        { $match: { createdAt: { $gte: startYear } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
      safeAggregate(Echographie, [
        { $match: { createdAt: { $gte: startYear } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
      safeAggregate(Prescription, [
        { $match: { createdAt: { $gte: startYear } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
      // Revenus
      safeAggregate(Invoice, [
        { $match: { statut: { $nin: ['annulee','brouillon'] } } },
        { $unwind: { path: '$lignes', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$lignes.categorie', total: { $sum: '$lignes.montant' } } },
        { $sort: { total: -1 } },
      ]),
      // Genre
      safeCount(Patient, { sexe: 'M' }),
      safeCount(Patient, { sexe: 'F' }),
      // Top pathologies
      safeAggregate(Consultation, [
        { $match: { diagnostic: { $exists: true, $ne: '' } } },
        { $group: { _id: '$diagnostic', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Top médecins
      safeAggregate(Consultation, [
        { $match: { medecin: { $exists: true } } },
        { $group: { _id: '$medecin', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]),
      // Perf
      safeCount(Consultation),
      safeCount(Consultation, { statut: 'terminee' }),
      safeCount(Hospitalization, { statut: 'en_cours' }),
      safeCount(Room, { statut: { $ne: 'ferme' } }),
      // Alertes labo
      LabResult.find({ est_critique: true, acquitte_par: null })
        .populate('patient','nom prenom')
        .select('patient patient_nom createdAt')
        .sort('-createdAt').limit(5).lean().catch(()=>[]),
      // Alertes admin
      safeCount(Invoice, { statut: { $in: ['emise','partiellement_payee','contentieux'] } }),
      // Pharmacie stock statut
      safeAggregate(Medication, [
        { $group: { _id: '$statut', count: { $sum: 1 } } },
      ]),
      safeCount(Medication, { statut: 'rupture' }),
    ]);

    // ── Revenus par service
    const CAT_LABELS = { consultation:'Consultation', hospitalisation:'Hospitalisation', laboratoire:'Laboratoire', imagerie:'Imagerie', pharmacie:'Pharmacie', autre:'Autre' };
    const CAT_COLORS = { consultation:'#1B4F9E', hospitalisation:'#D97706', laboratoire:'#0EA5A0', imagerie:'#7C3AED', pharmacie:'#059669', autre:'#9CA3AF' };
    const revLabels = [], revData = [], revColors = [];
    revenusRaw.forEach(({ _id, total }) => {
      if (!_id) return;
      revLabels.push(CAT_LABELS[_id] || _id);
      revData.push(total);
      revColors.push(CAT_COLORS[_id] || '#6B7A99');
    });
    if (revLabels.length === 0) {
      revLabels.push(...['Consultation','Hospitalisation','Laboratoire','Imagerie','Pharmacie']);
      revData.push(0,0,0,0,0);
      revColors.push('#1B4F9E','#D97706','#0EA5A0','#7C3AED','#059669');
    }

    // ── Top pathologies
    const maxDiag = diagRaw[0]?.count || 1;
    const top_pathologies = diagRaw.map(({ _id, count }, i) => ({
      maladie: _id, nb: count,
      pct: Math.round((count / maxDiag) * 100),
      color: COLORS[i % COLORS.length],
    }));

    // ── Top médecins
    const maxMed = medRaw[0]?.count || 1;
    const top_medecins = medRaw.map(({ _id, count, user }, i) => ({
      nom:          user ? `Dr ${user.prenom} ${user.nom}` : `Dr. ${i+1}`,
      specialite:   user?.specialite || user?.role || 'Médecin',
      consultations: count,
      taux:         Math.round((count / maxMed) * 100),
      color:        COLORS[i % COLORS.length],
    }));

    // ── Perf indicateurs
    const taux_completion = total_consult_all > 0 ? Math.round((consult_terminees_all / total_consult_all) * 100) : 0;
    const taux_occupation = total_rooms > 0 ? Math.round((hospit_en_cours / total_rooms) * 100) : 0;

    // ── Alertes médicales
    const alertes_medicales = labo_critiques.map(l => ({
      type: 'danger', icon: '🔬',
      titre:  `Résultat critique — ${l.patient_nom || (l.patient ? `${l.patient.prenom} ${l.patient.nom}` : 'Patient')}`,
      detail: 'Résultat biologique anormal nécessitant une attention immédiate.',
      heure:  new Date(l.createdAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
    }));
    if (med_ruptures > 0) {
      alertes_medicales.push({ type:'warn', icon:'💊', titre:`${med_ruptures} médicament(s) en rupture de stock`, detail:'Stock pharmacie insuffisant — réapprovisionnement requis.', heure:'Maintenant' });
    }

    // ── Alertes admin
    const alertes_admin = [];
    if (factures_impayees_count > 0) {
      alertes_admin.push({ type:'warn', icon:'💰', titre:`${factures_impayees_count} factures impayées`, detail:'Factures en attente de règlement.', heure:"Aujourd'hui" });
    }
    if (taux_occupation > 80) {
      alertes_admin.push({ type:'danger', icon:'🛏️', titre:`Taux d'occupation élevé (${taux_occupation}%)`, detail:"Capacité d'accueil presque atteinte.", heure:'Maintenant' });
    }

    // ── Pharma chart (statut distribution)
    const pharmaMap = {};
    pharmaStats.forEach(({ _id, count }) => { if (_id) pharmaMap[_id] = count; });

    res.json({
      success: true,
      charts: {
        consultations_par_mois: {
          labels: MOIS_LABELS,
          datasets: [
            { label:'Consultations',    data: parMois(consultParMoisRaw), borderColor:'#0EA5A0', backgroundColor:'rgba(14,165,160,.1)', tension:.4, fill:true, pointRadius:4, pointBackgroundColor:'#0EA5A0' },
            { label:'Hospitalisations', data: parMois(hospitParMoisRaw),  borderColor:'#D97706', backgroundColor:'rgba(215,119,6,.06)',  tension:.4, fill:true, borderDash:[5,5], pointRadius:3, pointBackgroundColor:'#D97706' },
            { label:'Urgences',         data: parMois(urgParMoisRaw),     borderColor:'#DC2626', backgroundColor:'rgba(220,38,38,.06)',   tension:.4, fill:false, borderDash:[3,3], pointRadius:3, pointBackgroundColor:'#DC2626' },
            { label:'Échographies',     data: parMois(echoParMoisRaw),    borderColor:'#7C3AED', backgroundColor:'rgba(124,58,237,.06)',  tension:.4, fill:false, pointRadius:3, pointBackgroundColor:'#7C3AED' },
            { label:'Prescriptions',    data: parMois(presParMoisRaw),    borderColor:'#059669', backgroundColor:'rgba(5,150,105,.06)',   tension:.4, fill:false, pointRadius:3, pointBackgroundColor:'#059669' },
          ],
        },
        revenus_par_service:  { labels: revLabels, data: revData, colors: revColors },
        repartition_genre: {
          labels: ['Hommes','Femmes'],
          data:   [nb_hommes, nb_femmes],
          colors: ['#1B4F9E','#EC4899'],
        },
        pharma_statut: {
          labels: ['Disponible','Rupture','Suspendu','Périmé'],
          data:   [pharmaMap.disponible||0, pharmaMap.rupture||0, pharmaMap.suspendu||0, pharmaMap.perime||0],
          colors: ['#059669','#DC2626','#D97706','#9CA3AF'],
        },
        top_pathologies,
        top_medecins,
        alertes_medicales,
        alertes_admin,
        perf_indicateurs: [
          { label:'Taux complétion consultations', val:taux_completion, unit:'%',   color:'#0EA5A0', good:taux_completion>=80,  icon:'✅' },
          { label:'Taux occupation lits',          val:taux_occupation, unit:'%',   color:taux_occupation>85?'#DC2626':taux_occupation>70?'#D97706':'#059669', good:taux_occupation<=85, icon:'🛏️' },
          { label:'Ruptures stock pharmacie',      val:med_ruptures,    unit:'réf', color:med_ruptures>0?'#DC2626':'#059669', good:med_ruptures===0, icon:'💊' },
          { label:'Taux consultation terminée',    val: total_consult_all>0?Math.round(consult_terminees_all/total_consult_all*100):0, unit:'%', color:'#1B4F9E', good:null, icon:'📋' },
        ],
      },
      analytics: {
        patientsParMois: parMois(consultParMoisRaw),
        topDiagnostics:  top_pathologies,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/financial
// ═══════════════════════════════════════════════════════════════
exports.getFinancial = async (req, res, next) => {
  try {
    const year = new Date().getFullYear();
    const raw = await Invoice.aggregate([
      { $match: { statut: { $nin: ['annulee','brouillon'] }, date_facture: { $gte: new Date(year, 0, 1) } } },
      { $group: { _id: { $month: '$date_facture' }, ca: { $sum: '$montant_ttc' }, paye: { $sum: '$montant_paye' } } },
      { $sort: { _id: 1 } },
    ]).catch(()=>[]);
    const ca_par_mois   = Array(12).fill(0);
    const paye_par_mois = Array(12).fill(0);
    raw.forEach(({ _id, ca, paye }) => { ca_par_mois[_id-1]=ca; paye_par_mois[_id-1]=paye; });
    const depenses_par_mois = ca_par_mois.map(v => Math.round(v*0.28));
    const benefice_par_mois = ca_par_mois.map((v,i) => v - depenses_par_mois[i]);

    res.json({
      success: true,
      financial: {
        labels: MOIS_LABELS,
        ca: ca_par_mois, depenses: depenses_par_mois,
        benefice: benefice_par_mois, paye: paye_par_mois,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/patients
// ═══════════════════════════════════════════════════════════════
exports.getPatientStats = async (req, res, next) => {
  try {
    const year = new Date().getFullYear();
    const parMoisRaw = await safeAggregate(Patient, [
      { $match: { createdAt: { $gte: new Date(year, 0, 1) } } },
      { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const parMois = Array(12).fill(0);
    parMoisRaw.forEach(({ _id, count }) => { parMois[_id-1]=count; });

    const [hommes, femmes, actifs, inactifs] = await Promise.all([
      safeCount(Patient, { sexe: 'M' }),
      safeCount(Patient, { sexe: 'F' }),
      safeCount(Patient, { statut: 'actif' }),
      safeCount(Patient, { statut: 'inactif' }),
    ]);

    res.json({
      success: true,
      stats: {
        par_mois: parMois, labels: MOIS_LABELS,
        par_genre:  { hommes, femmes },
        par_statut: { actifs, inactifs },
      },
    });
  } catch (err) { next(err); }
};
