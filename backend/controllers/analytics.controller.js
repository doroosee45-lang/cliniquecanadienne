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
const Depense        = require('../models/Depense');
const Ambulance      = require('../models/Ambulance');
const Message        = require('../models/Message');
const Service        = require('../models/Service');
const mail           = require('../utils/mail');
const { logAction, escapeRegex } = require('../utils/helpers');
const { logger }     = require('../utils/logger');

const COLORS = ['#DC2626','#D97706','#0EA5A0','#1B4F9E','#7C3AED','#059669','#EC4899','#06B6D4','#84CC16','#F59E0B'];
const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
// AUDIT-ANALYTICS-P5 — 3 salles de bloc réelles (même config que
// blocoperatoireController.js::SALLES_BLOC), utilisées comme dénominateur
// fixe et réel du taux d'occupation salle, jamais un chiffre inventé.
const NB_SALLES_BLOC = 3;

function startOf(periodeKey) {
  const now = new Date();
  if (periodeKey === 'aujourd_hui') { const d = new Date(); d.setHours(0,0,0,0); return d; }
  if (periodeKey === 'semaine')  { const d = new Date(); d.setDate(d.getDate()-7); return d; }
  if (periodeKey === 'annee')    return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1); // mois par défaut
}

// AUDIT-ANALYTICS-P1 — période "Personnalisée" (date_debut/date_fin) n'avait
// aucun traitement réel : startOf('custom') retombait silencieusement sur le
// cas "mois" par défaut, quels que soient les champs de date remplis côté
// UI. getStats() est la SEULE des 4 fonctions de ce contrôleur à lire
// req.query.periode — getReport/getFinancial/getPatientStats restent figées
// sur l'année civile en cours quel que soit le sélecteur (limitation
// préexistante, hors périmètre de ce point : les graphiques ne suivent donc
// la période choisie que partiellement, seuls les KPI ci-dessous en tiennent
// compte). `fin` est ajouté explicitement (pas seulement `depuis`) pour que
// la borne de fin d'une période personnalisée soit réellement respectée —
// sans elle, un date_fin dans le passé n'aurait aucun effet (toute requête
// en simple `{ $gte: depuis }`, sans borne haute, inclut implicitement
// "jusqu'à maintenant").
function resolvePeriodRange(query) {
  const { periode, date_debut, date_fin } = query;
  if (periode === 'custom' && date_debut) {
    const debut = new Date(date_debut);
    debut.setHours(0, 0, 0, 0);
    const fin = date_fin ? new Date(date_fin) : new Date();
    fin.setHours(23, 59, 59, 999);
    return { debut, fin };
  }
  return { debut: startOf(periode || 'mois'), fin: new Date() };
}

// AUDIT-ANALYTICS-P7 — filtres Service/Médecin, best-effort partout où une
// notion équivalente existe réellement (décision validée : jamais un champ
// inventé). Deux formes selon la collection cible :
//  - referenceId : le champ réel est un ObjectId (ref User/Service) —
//    correspondance exacte, la plus fiable.
//  - regex : le champ réel est une String libre (pas de lien fiable vers un
//    User/Service) — correspondance approximative sur le nom réel résolu
//    une seule fois ici, jamais un texte fabriqué. Disclosed comme
//    "best-effort" dans le rapport, jamais présenté comme une correspondance
//    garantie.
// Résolu une seule fois par requête getStats(), jamais par sous-requête.
async function resolveServiceMedecinFilters(query) {
  const { service, medecin } = query;
  const out = { serviceId: null, serviceNomRegex: null, medecinId: null, medecinRegex: null };

  if (service) {
    out.serviceId = service;
    const svc = await Service.findById(service).select('nom').lean().catch(() => null);
    if (svc?.nom) out.serviceNomRegex = new RegExp(escapeRegex(svc.nom), 'i');
  }
  if (medecin) {
    out.medecinId = medecin;
    const med = await User.findById(medecin).select('nom prenom').lean().catch(() => null);
    if (med?.nom) out.medecinRegex = new RegExp(`${escapeRegex(med.prenom || '')}.*${escapeRegex(med.nom)}|${escapeRegex(med.nom)}`, 'i');
  }
  return out;
}

// safe count helper — returns 0 if model query fails
async function safeCount(model, filter = {}) {
  try { return await model.countDocuments(filter); } catch { return 0; }
}
async function safeAggregate(model, pipeline) {
  try { return await model.aggregate(pipeline); } catch { return []; }
}

// ─── Dashboard Global & Analytics (SuperAdmin) — helpers de période ─────────
// AUDIT-DASHBOARD-GLOBAL — periode ici est une fenêtre GLISSANTE (7 derniers
// jours, 30 derniers jours, 12 derniers mois), volontairement différente du
// startOf() calendaire ci-dessus (début du mois civil) : plus intuitif pour
// un filtre de type "7 jours / 30 jours / 12 mois" affiché à l'utilisateur,
// et ça permet un calcul honnête de la période PRÉCÉDENTE de même durée pour
// la tendance (jamais une comparaison inventée).
function resolveGlobalPeriod(key) {
  const now = new Date();
  const days = key === 'jour' ? 1 : key === '30j' ? 30 : key === '12m' ? 365 : 7; // défaut '7j'
  const granularity = key === '12m' ? 'month' : 'day';
  const start = new Date(now.getTime() - days * 86400000);
  if (key === 'jour') start.setHours(0, 0, 0, 0);
  const prevEnd   = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - days * 86400000);
  return { start, end: now, prevStart, prevEnd, granularity, days };
}

// Tendance réelle uniquement : jamais affichée si la période précédente est
// à 0 (division impossible à interpréter honnêtement — ni +100%, ni 0%
// n'auraient de sens réel dans ce cas).
function realTrend(current, previous) {
  if (!previous || previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return { pct, sens: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

// AUDIT-ANALYTICS-P5 — "Temps de réponse moyen" (Messages) : jamais une
// valeur inventée. Pour chaque conversation, ne considère que les messages
// réellement envoyés DANS la période demandée, triés chronologiquement ;
// à chaque changement réel d'expéditeur entre deux messages consécutifs
// (tous deux dans la période), le delta de temps est un échantillon réel
// de "temps de réponse". Limite assumée et documentée (validée) : une
// réponse à un message juste avant la borne de période n'est pas comptée
// (les deux messages doivent être dans la période) — même logique de
// disclosure que le reste du chantier plutôt qu'un contournement bricolé.
// Retourne null (jamais 0) si aucun échantillon réel n'existe sur la
// période, jamais une moyenne sur un tableau vide.
function computeAvgResponseTimeMin(conversations, depuis, fin) {
  const samples = [];
  for (const conv of conversations) {
    const msgs = (conv.messages || [])
      .filter(m => m.date_envoi && new Date(m.date_envoi) >= depuis && new Date(m.date_envoi) <= fin)
      .sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi));
    for (let i = 1; i < msgs.length; i++) {
      const prev = msgs[i - 1], cur = msgs[i];
      if (String(prev.expediteur) !== String(cur.expediteur)) {
        samples.push((new Date(cur.date_envoi) - new Date(prev.date_envoi)) / 60000);
      }
    }
  }
  if (samples.length === 0) return null;
  return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;
}

// AUDIT-ELEVE-5 — regroupe des documents Message (collection dédiée depuis
// la migration, chacun une ligne indépendante) par conversation_id, pour
// reconstituer la forme {messages:[...]} que computeAvgResponseTimeMin
// attend déjà ci-dessus — sa signature reste inchangée (voir
// tests/analyticsPhase5.test.js, qui l'appelle directement avec cette
// forme) : seule la source des messages a changé, jamais la fonction de
// calcul elle-même.
function groupMessagesByConversation(messages) {
  const byConv = new Map();
  for (const m of messages) {
    const key = m.conversation_id.toString();
    if (!byConv.has(key)) byConv.set(key, []);
    byConv.get(key).push(m);
  }
  return Array.from(byConv.values()).map(msgs => ({ messages: msgs }));
}

// AUDIT-ANALYTICS-P3 — remplace la section "Recommandations IA" de
// Analytics.jsx (6 cartes statiques codées en dur, aucun appel IA nulle
// part dans ce projet — même constat que le chantier Planning : pas de
// module de génération de texte). Règles seuil simples sur les KPI déjà
// réellement agrégés par getStats() ci-dessous. chirurgie_annulees est
// réel depuis ANL-03 (12 sept. 2026, date_annulation) mais volontairement
// non intégré ici : décision produit (seuil pertinent, formulation) hors
// périmètre technique de ce correctif. Le nombre de recommandations
// varie réellement selon les données (aucune n'est déclenchée = tableau
// vide, pas une liste fixe de 6 toujours affichée), et chaque libellé
// interpole la vraie valeur observée — jamais le même texte statique
// republié sous une étiquette différente.
function computeRecommandations(kpi) {
  const recs = [];

  if (kpi.taux_occupation > 85) {
    recs.push({ niveau: 'danger', icone: '🔴', titre: 'Occupation critique', description: `Taux d'occupation des lits à ${kpi.taux_occupation}% — risque de saturation, prioriser les sorties et libérer des lits.` });
  } else if (kpi.taux_occupation > 0 && kpi.taux_occupation < 30) {
    recs.push({ niveau: 'info', icone: '🔵', titre: 'Capacité disponible', description: `Taux d'occupation des lits à ${kpi.taux_occupation}% — capacité d'accueil disponible pour de nouvelles admissions.` });
  }

  if (kpi.pharma_ruptures > 0) {
    recs.push({ niveau: kpi.pharma_ruptures >= 5 ? 'danger' : 'warn', icone: '🟠', titre: 'Ruptures de stock pharmacie', description: `${kpi.pharma_ruptures} médicament(s) en rupture de stock — réapprovisionnement à prioriser.` });
  }

  if (kpi.consultations_total >= 5) {
    const tauxAnnulation = Math.round((kpi.consultations_annulees / kpi.consultations_total) * 100);
    if (tauxAnnulation > 15) {
      recs.push({ niveau: 'warn', icone: '🟠', titre: 'Annulations de rendez-vous élevées', description: `${tauxAnnulation}% des consultations de la période ont été annulées — envisager un rappel automatique avant rendez-vous.` });
    }
  }

  if (kpi.factures_impayees > 0) {
    recs.push({ niveau: kpi.factures_impayees > 500000 ? 'danger' : 'warn', icone: '💰', titre: 'Factures impayées', description: `${kpi.factures_impayees.toLocaleString('fr-FR')} CFA de factures en attente de règlement — relance du recouvrement recommandée.` });
  }

  if (kpi.urgences_periode >= 5) {
    const tauxCritique = Math.round((kpi.urgences_critiques / kpi.urgences_periode) * 100);
    if (tauxCritique > 20) {
      recs.push({ niveau: 'danger', icone: '🔴', titre: 'Part élevée d\'urgences critiques', description: `${tauxCritique}% des urgences de la période sont classées critiques — vérifier les ressources disponibles.` });
    }
  }

  if (kpi.chirurgie_programmees >= 3) {
    const tauxRealisation = Math.round((kpi.chirurgie_realisees / kpi.chirurgie_programmees) * 100);
    if (tauxRealisation < 70) {
      recs.push({ niveau: 'warn', icone: '🟠', titre: 'Taux de réalisation chirurgicale bas', description: `${tauxRealisation}% des interventions programmées ont été réalisées — analyser les causes de report.` });
    }
  }

  if (recs.length === 0) {
    recs.push({ niveau: 'success', icone: '🟢', titre: 'Indicateurs dans les normes', description: 'Aucun seuil d\'alerte déclenché sur la période — occupation, stock pharmacie, annulations, factures et urgences dans les normes.' });
  }

  return recs;
}

const DAY_LABEL = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

// Reconciliation jour-par-jour sur les N derniers jours — même principe que
// dashboard.controller.js (ADM-02/AUDIT-DASHBOARD) : liste fixe de jours,
// zéro explicite pour un jour sans donnée, jamais une série tronquée.
function dailyBuckets(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(d.toISOString().substring(0, 10));
  }
  return out;
}
function mapDailyAgg(raw) {
  return Object.fromEntries(raw.map((d) => [d._id, d.count ?? d.total ?? 0]));
}
// Agrégation "count par jour" sur les `days` derniers jours pour un modèle/champ donné.
async function countPerDay(model, dateField, days, extraMatch = {}) {
  const since = new Date(); since.setDate(since.getDate() - (days - 1)); since.setHours(0, 0, 0, 0);
  const raw = await safeAggregate(model, [
    { $match: { [dateField]: { $gte: since }, ...extraMatch } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } }, count: { $sum: 1 } } },
  ]);
  const map = mapDailyAgg(raw);
  const buckets = dailyBuckets(days);
  return { labels: buckets.map(DAY_LABEL), data: buckets.map((b) => map[b] || 0), map, buckets };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/stats  — KPIs temps réel (tous modules)
// ═══════════════════════════════════════════════════════════════
exports.getStats = async (req, res, next) => {
  try {
    const { debut: depuis, fin } = resolvePeriodRange(req.query);
    const { serviceId, serviceNomRegex, medecinId, medecinRegex } = await resolveServiceMedecinFilters(req.query);

    // AUDIT-ANALYTICS-P7 — un fragment de filtre par collection réellement
    // porteuse d'un champ médecin/service (voir audit reporté à
    // l'utilisateur) ; {} pour les collections sans notion équivalente,
    // jamais un filtre inventé pour elles. ObjectId direct (fiable) quand
    // le champ réel est une référence User/Service ; regex approximative
    // (best-effort, disclosed) quand c'est une String libre.
    const fConsult   = { ...(medecinId ? { medecin: medecinId } : {}), ...(serviceNomRegex ? { service: serviceNomRegex } : {}) };
    const fAppt      = { ...(medecinId ? { medecin: medecinId } : {}), ...(serviceId ? { service: serviceId } : {}) };
    const fLabo      = { ...(medecinId ? { medecin_prescripteur: medecinId } : {}), ...(serviceNomRegex ? { service_demandeur: serviceNomRegex } : {}) };
    const fImagerie  = { ...(medecinId ? { medecin_prescripteur: medecinId } : {}), ...(serviceNomRegex ? { service_demandeur: serviceNomRegex } : {}) };
    const fHospit    = { ...(medecinId ? { medecin_responsable: medecinId } : {}), ...(serviceId ? { service: serviceId } : {}) };
    const fChir      = { ...(medecinId ? { chirurgien_id: medecinId } : {}), ...(serviceNomRegex ? { service_demandeur: serviceNomRegex } : {}) };
    const fPresc     = { ...(medecinId ? { medecin: medecinId } : {}) };
    const fUrg       = { ...(medecinId ? { medecin_responsable: medecinId } : {}), ...(serviceNomRegex ? { service: serviceNomRegex } : {}) };
    const fPregnancy = { ...(medecinRegex ? { medecin_responsable: medecinRegex } : {}) };
    const fPediatrie = { ...(medecinRegex ? { medecin: medecinRegex } : {}) };
    const fEcho      = { ...(medecinRegex ? { medecin_presc: medecinRegex } : {}) };
    const fInvoice   = { ...(serviceNomRegex ? { service_label: serviceNomRegex } : {}) };

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
      chir_total, chir_realisees, chir_annulees_reel,
      // Bloc opératoire (AUDIT-ANALYTICS-P5 — interventions à venir, angle
      // prospectif distinct de la carte "Chirurgie" déjà existante ; taux
      // d'occupation salle en instantané, réel, via salle_entree_at/
      // salle_sortie_at — conception validée)
      chir_a_venir, salles_occupees_now,
      // Ambulances (AUDIT-ANALYTICS-P5)
      ambu_missions_result, ambu_statuts,
      // Messages (AUDIT-ANALYTICS-P5)
      msg_volume_result, msg_conversations_periode,
      // Finance
      ca_result, factures_impayees_result, depenses_result,
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
      safeCount(Patient, { createdAt: { $gte: depuis, $lte: fin } }),
      safeCount(Hospitalization, { statut: 'en_cours' }),
      // AUDIT-ANALYTICS-P7 — patients_actifs dérive d'Appointment (même
      // collection que consultations_annulees), donc hérite naturellement
      // des mêmes filtres réels ; patients_nouveaux/patients_total restent
      // globaux (Patient n'a pas de notion service/médecin propre à cette
      // activité — medecin_referent est une notion différente, le médecin
      // référent à l'enregistrement, pas l'activité de la période).
      Appointment.distinct('patient', { date_heure: { $gte: depuis, $lte: fin }, ...fAppt }).catch(()=>[]),
      // ── Consultations
      safeCount(Consultation, { createdAt: { $gte: depuis, $lte: fin }, ...fConsult }),
      safeCount(Consultation, { statut: 'terminee', createdAt: { $gte: depuis, $lte: fin }, ...fConsult }),
      safeCount(Appointment, { statut: 'annule', date_heure: { $gte: depuis, $lte: fin }, ...fAppt }),
      // ── Labo
      safeCount(LabResult, { createdAt: { $gte: depuis, $lte: fin }, ...fLabo }),
      safeCount(LabResult, { statut: { $in: ['termine','valide'] }, createdAt: { $gte: depuis, $lte: fin }, ...fLabo }),
      safeCount(LabResult, { statut: { $in: ['prescrit','en_attente','en_cours'] }, ...fLabo }),
      // ── Imagerie
      safeCount(ImagingResult, { createdAt: { $gte: depuis, $lte: fin }, ...fImagerie }),
      safeCount(ImagingResult, { statut: { $in: ['realise','rapporte','valide'] }, createdAt: { $gte: depuis, $lte: fin }, ...fImagerie }),
      safeCount(ImagingResult, { statut: { $in: ['programme','en_attente'] }, ...fImagerie }),
      // ── Hospitalisations
      safeCount(Hospitalization, { createdAt: { $gte: depuis, $lte: fin }, ...fHospit }),
      safeCount(Hospitalization, { statut: 'sorti', updatedAt: { $gte: depuis, $lte: fin }, ...fHospit }),
      // AUDIT-ANALYTICS-P7 — taux_occupation reste un instantané global,
      // jamais filtré (même choix que bloc_taux_occupation_salle) : un ratio
      // "lits occupés par Dr X / total des lits" mélangerait une notion
      // filtrée à un dénominateur qui ne l'est pas, résultat trompeur.
      safeCount(Hospitalization, { statut: 'en_cours' }),
      safeCount(Room, { statut: { $ne: 'ferme' } }),
      // ── Chirurgie
      safeCount(DossierChirurgical, { createdAt: { $gte: depuis, $lte: fin }, ...fChir }),
      safeCount(DossierChirurgical, { statut: 'opere', date_intervention_reelle: { $gte: depuis, $lte: fin }, ...fChir }),
      // ANL-03 — voir DossierChirurgical.js/blocoperatoireController.js pour
      // le détail : date_annulation est le seul signal réel distinguant une
      // annulation effective d'un dossier simplement jamais programmé (les
      // deux partagent le statut modèle 'consultation'). Ne compte que les
      // annulations survenues après l'introduction de ce champ — jamais un
      // pourcentage inventé pour combler l'historique antérieur.
      safeCount(DossierChirurgical, { date_annulation: { $gte: depuis, $lte: fin }, ...fChir }),
      // ── Bloc opératoire
      safeCount(DossierChirurgical, { statut: 'preoperatoire', date_intervention_prev: { $gte: new Date() }, ...fChir }),
      safeCount(DossierChirurgical, { salle_entree_at: { $ne: null }, salle_sortie_at: null }),
      // ── Ambulances
      safeAggregate(Ambulance, [
        { $unwind: '$missions' },
        { $match: { 'missions.date': { $gte: depuis, $lte: fin } } },
        { $count: 'count' },
      ]),
      safeAggregate(Ambulance, [
        { $group: { _id: '$statut', count: { $sum: 1 } } },
      ]),
      // ── Messages — AUDIT-ELEVE-5 : Conversation.messages (tableau
      // embarqué) migré vers une collection Message dédiée. safeCount
      // remplace l'aggregate $unwind (plus simple et plus efficace, un
      // vrai countDocuments indexé au lieu de dérouler tout le tableau) ;
      // le find() ci-dessous alimente toujours computeAvgResponseTimeMin,
      // via groupMessagesByConversation pour reconstituer la forme
      // {messages:[...]} attendue par cette fonction inchangée.
      safeCount(Message, { date_envoi: { $gte: depuis, $lte: fin } }),
      Message.find({ date_envoi: { $gte: depuis, $lte: fin } })
        .select('conversation_id expediteur date_envoi').lean().catch(() => []),
      // ── Finance (AUDIT-ANALYTICS-P7 — service_label, best-effort ; pas de
      // champ médecin sur Invoice/Depense — jamais filtré par médecin,
      // disclosed. Depense n'a aucun des deux champs — reste global.)
      Invoice.aggregate([
        { $match: { statut: { $nin: ['annulee','brouillon'] }, createdAt: { $gte: depuis, $lte: fin }, ...fInvoice } },
        { $group: { _id: null, total: { $sum: '$montant_ttc' }, paye: { $sum: '$montant_paye' } } },
      ]).catch(()=>[]),
      Invoice.aggregate([
        { $match: { statut: { $in: ['emise','partiellement_payee','contentieux'] }, ...fInvoice } },
        { $group: { _id: null, total: { $sum: '$montant_restant' } } },
      ]).catch(()=>[]),
      Depense.aggregate([
        { $match: { date: { $gte: depuis, $lte: fin } } },
        { $group: { _id: null, total: { $sum: '$montant' } } },
      ]).catch(()=>[]),
      // ── Pharmacie (aucun champ médecin/service réel — reste global, disclosed)
      safeCount(Medication),
      safeCount(Medication, { statut: 'rupture' }),
      safeCount(Medication, { stock_actuel: { $gt: 0 }, $expr: { $lte: ['$stock_actuel', { $multiply: ['$stock_minimum', 0.3] }] } }),
      // AUDIT-18-6 — même correctif que pharmacy.controller.js::getStats :
      // coût d'acquisition (prix_achat), jamais le chiffre d'affaires
      // potentiel (prix_vente), pour "valeur du stock" — cohérent avec
      // finance.controller.js, déjà correct.
      Medication.aggregate([
        { $group: { _id: null, val: { $sum: { $multiply: ['$stock_actuel', '$prix_achat'] } } } },
      ]).catch(()=>[]),
      // ── Prescriptions (médecin réel ; pas de champ service sur ce modèle)
      safeCount(Prescription),
      safeCount(Prescription, { createdAt: { $gte: depuis, $lte: fin }, ...fPresc }),
      // ── Urgences
      safeCount(Urgence),
      safeCount(Urgence, { createdAt: { $gte: depuis, $lte: fin }, ...fUrg }),
      // Urgence.niveau_urgence n'existe pas — le champ réel est niveau_triage
      // (enum rouge/orange/jaune/vert/bleu) ; 'rouge' = niveau critique.
      safeCount(Urgence, { niveau_triage: 'rouge', ...fUrg }),
      // ── Maternité (medecin_responsable réel sur Pregnancy, best-effort
      // texte libre ; Delivery n'a qu'un champ sage_femme, pas de médecin —
      // accouchements_periode reste non filtré par médecin, disclosed)
      // Enum réel Pregnancy.statut : active/accouchee/suivi_postnatal/cloturee/a_risque
      safeCount(Pregnancy, { statut: { $in: ['active','a_risque'] }, ...fPregnancy }),
      safeCount(Delivery, { createdAt: { $gte: depuis, $lte: fin } }),
      // ── Pédiatrie (medecin réel, best-effort texte libre ; pas de champ service)
      safeCount(PediatricConsultation),
      safeCount(PediatricConsultation, { createdAt: { $gte: depuis, $lte: fin }, ...fPediatrie }),
      // ── Échographie (medecin_presc réel, best-effort texte libre ; pas de champ service)
      safeCount(Echographie),
      safeCount(Echographie, { createdAt: { $gte: depuis, $lte: fin }, ...fEcho }),
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
    // AUDIT-ANALYTICS-P2 — depenses était Math.round(ca_total*0.28), une
    // estimation, jamais une vraie somme de Depense (repéré en implémentant
    // les trends : un trend calculé sur une base déjà fake serait fake par
    // construction — un trend de dépenses n'a de sens que si les dépenses
    // elles-mêmes sont réelles). Corrigé pour agréger le vrai modèle
    // Depense, même source que getGlobalStats (qui le faisait déjà
    // correctement) — dashboard.controller.js utilise la même agrégation.
    const depenses          = depenses_result[0]?.total || 0;
    const benefice          = ca_total - depenses;
    const taux_occupation   = total_rooms > 0 ? Math.round((hospit_en_cours / total_rooms) * 100) : 0;
    const valeur_stock_pharma = med_stock_val[0]?.val || 0;

    const bloc_taux_occupation_salle = Math.round((salles_occupees_now / NB_SALLES_BLOC) * 100);

    const ambu_missions_periode = ambu_missions_result[0]?.count || 0;
    const ambuStatutMap = {}; ambu_statuts.forEach(({ _id, count }) => { if (_id) ambuStatutMap[_id] = count; });

    // AUDIT-ELEVE-5 — msg_volume_result est désormais un nombre direct
    // (safeCount), plus le tableau [{count}] renvoyé par l'ancien aggregate.
    const msg_volume_periode = msg_volume_result;
    const msg_temps_reponse_moyen_min = computeAvgResponseTimeMin(groupMessagesByConversation(msg_conversations_periode), depuis, fin);

    // AUDIT-ANALYTICS-P2 — trends réels "vs période précédente" : jamais une
    // évolution inventée (même principe que realTrend/resolveGlobalPeriod,
    // déjà établis pour /analytics/global, réutilisés ici tels quels).
    // Uniquement sur des métriques réellement scopées à une période — les
    // valeurs cumulatives/instantanées (patients_total, factures_impayees,
    // taux_occupation, stocks...) n'ont pas d'équivalent "période
    // précédente" qui aurait un sens honnête, donc pas de trend pour elles.
    const dureeMs = fin.getTime() - depuis.getTime();
    const prevFin = new Date(depuis.getTime() - 1);
    const prevDebut = new Date(prevFin.getTime() - dureeMs);
    const [
      patients_nouveaux_prev, consult_total_prev, consult_terminees_prev, consult_annulees_prev,
      ca_prev_result, depenses_prev_result,
    ] = await Promise.all([
      safeCount(Patient, { createdAt: { $gte: prevDebut, $lte: prevFin } }),
      safeCount(Consultation, { createdAt: { $gte: prevDebut, $lte: prevFin }, ...fConsult }),
      safeCount(Consultation, { statut: 'terminee', createdAt: { $gte: prevDebut, $lte: prevFin }, ...fConsult }),
      safeCount(Appointment, { statut: 'annule', date_heure: { $gte: prevDebut, $lte: prevFin }, ...fAppt }),
      Invoice.aggregate([
        { $match: { statut: { $nin: ['annulee', 'brouillon'] }, createdAt: { $gte: prevDebut, $lte: prevFin }, ...fInvoice } },
        { $group: { _id: null, total: { $sum: '$montant_ttc' } } },
      ]).catch(() => []),
      Depense.aggregate([
        { $match: { date: { $gte: prevDebut, $lte: prevFin } } },
        { $group: { _id: null, total: { $sum: '$montant' } } },
      ]).catch(() => []),
    ]);
    const ca_prev = ca_prev_result[0]?.total || 0;
    const depenses_prev = depenses_prev_result[0]?.total || 0;
    const benefice_prev = ca_prev - depenses_prev;

    const trends = {
      patients_nouveaux:      realTrend(patients_nouveaux, patients_nouveaux_prev),
      consultations_total:    realTrend(consult_total, consult_total_prev),
      consultations_terminees:realTrend(consult_terminees, consult_terminees_prev),
      consultations_annulees: realTrend(consult_annulees, consult_annulees_prev),
      ca_total:  realTrend(ca_total, ca_prev),
      depenses:  realTrend(depenses, depenses_prev),
      benefice:  realTrend(benefice, benefice_prev),
    };

    const kpi = {
      // Patients
      patients_total, patients_nouveaux,
      patients_actifs: patients_actifs_arr.length,
      patients_hospitalises,
      // Consultations
      consultations_total:     consult_total,
      consultations_terminees: consult_terminees,
      consultations_annulees:  consult_annulees,
      // ANL-02 (correction du 12 sept. 2026, audit indépendant) — valeur
      // codée en dur (22), jamais calculée. Consultation ne modélise aucune
      // durée réelle de l'acte (aucun champ start/end, aucune date de fin —
      // vérifié dans models/Consultation.js ; le seul champ `duree` existant
      // est celui d'une ligne de prescription, sans rapport). Donnée
      // honnêtement absente plutôt qu'une estimation inventée — null,
      // jamais un nombre fabriqué.
      temps_moyen_consult:     null,
      // Labo
      labo_demandes: labo_total, labo_realises, labo_attente,
      // Imagerie
      imagerie_demandes: img_total, imagerie_realises: img_realises, imagerie_attente: img_attente,
      // Hospitalisations
      hospit_admissions, hospit_sorties, taux_occupation,
      // Chirurgie
      chirurgie_programmees: chir_total,
      chirurgie_realisees:   chir_realisees,
      // ANL-03 — voir la requête ci-dessus : donnée réelle (date_annulation),
      // jamais un pourcentage arbitraire du volume total.
      chirurgie_annulees:    chir_annulees_reel,
      // Bloc opératoire
      bloc_interventions_a_venir: chir_a_venir,
      bloc_taux_occupation_salle: bloc_taux_occupation_salle,
      // Ambulances
      ambulances_missions_periode: ambu_missions_periode,
      ambulances_disponibles: ambuStatutMap.disponible || 0,
      ambulances_en_route:    ambuStatutMap.en_route    || 0,
      ambulances_occupees:    ambuStatutMap.occupe      || 0,
      ambulances_maintenance: ambuStatutMap.maintenance || 0,
      // Messages
      messages_volume_periode: msg_volume_periode,
      messages_temps_reponse_moyen_min: msg_temps_reponse_moyen_min,
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
    };

    res.json({
      success: true,
      trends,
      recommandations: computeRecommandations(kpi),
      kpi,
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
    // AUDIT-ANALYTICS-P2 — "vs Mois préc." (tableau financier détaillé,
    // Analytics.jsx) était [12,8,-2,15,6,22][i] codé en dur. getReport() ne
    // lit pas periode (limitation trouvée en Phase 1, hors périmètre ici) ;
    // ce tableau a de toute façon sa propre étiquette "Mois" indépendante du
    // sélecteur de période du haut de page — calcul réel mois civil actuel
    // vs mois civil précédent, littéralement ce que l'étiquette promet déjà.
    const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1);
    const moisPrecDebut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const moisPrecFin = new Date(moisDebut.getTime() - 1);

    // ── Helper: par mois (année en cours)
    const parMois = (arr) => {
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
      revenusMoisActuelRaw,
      revenusMoisPrecRaw,
      nb_hommes, nb_femmes,
      diagRaw,
      medRaw,
      total_consult_all, consult_terminees_all,
      hospit_en_cours, total_rooms,
      labo_critiques,
      factures_impayees_count,
      pharmaStats,
      med_ruptures,
      labo_resolues_mois,
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
      // AUDIT-ANALYTICS-P2 — revenus par service, mois civil actuel vs
      // précédent, pour un vrai trend "vs Mois préc." (voir commentaire
      // plus haut).
      safeAggregate(Invoice, [
        { $match: { statut: { $nin: ['annulee','brouillon'] }, date_facture: { $gte: moisDebut } } },
        { $unwind: { path: '$lignes', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$lignes.categorie', total: { $sum: '$lignes.montant' } } },
      ]),
      safeAggregate(Invoice, [
        { $match: { statut: { $nin: ['annulee','brouillon'] }, date_facture: { $gte: moisPrecDebut, $lte: moisPrecFin } } },
        { $unwind: { path: '$lignes', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$lignes.categorie', total: { $sum: '$lignes.montant' } } },
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
      // AUDIT-ANALYTICS-P4 — "Résolues ce mois" (Alertes) : compte réel des
      // résultats labo acquittés sur le mois civil en cours, remplaçant le
      // 12 codé en dur. Seul le mécanisme d'acquittement labo est réel
      // aujourd'hui (acquitte_par/acquitte_at) ; les alertes agrégées
      // (rupture stock, occupation, factures impayées) n'ont pas d'action de
      // résolution individuelle, donc pas de contrepartie ici.
      safeCount(LabResult, { acquitte_par: { $ne: null }, acquitte_at: { $gte: moisDebut } }),
    ]);

    // ── Revenus par service
    const CAT_LABELS = { consultation:'Consultation', hospitalisation:'Hospitalisation', laboratoire:'Laboratoire', imagerie:'Imagerie', pharmacie:'Pharmacie', autre:'Autre' };
    const CAT_COLORS = { consultation:'#1B4F9E', hospitalisation:'#D97706', laboratoire:'#0EA5A0', imagerie:'#7C3AED', pharmacie:'#059669', autre:'#9CA3AF' };
    const moisActuelMap = {}; revenusMoisActuelRaw.forEach(({ _id, total }) => { if (_id) moisActuelMap[_id] = total; });
    const moisPrecMap = {}; revenusMoisPrecRaw.forEach(({ _id, total }) => { if (_id) moisPrecMap[_id] = total; });
    const revLabels = [], revData = [], revColors = [], revTrends = [];
    revenusRaw.forEach(({ _id, total }) => {
      if (!_id) return;
      revLabels.push(CAT_LABELS[_id] || _id);
      revData.push(total);
      revColors.push(CAT_COLORS[_id] || '#6B7A99');
      revTrends.push(realTrend(moisActuelMap[_id] || 0, moisPrecMap[_id] || 0));
    });
    if (revLabels.length === 0) {
      revLabels.push(...['Consultation','Hospitalisation','Laboratoire','Imagerie','Pharmacie']);
      revData.push(0,0,0,0,0);
      revColors.push('#1B4F9E','#D97706','#0EA5A0','#7C3AED','#059669');
      revTrends.push(null,null,null,null,null);
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
    // AUDIT-ANALYTICS-P4 — entite_id/entite_type ajoutés pour que le
    // frontend puisse distinguer une alerte réellement acquittable
    // individuellement (labresult, via le mécanisme d'acquittement déjà
    // réel de laboratory.controller.js::acquit) d'une alerte agrégée sans
    // entité unique (pharmacy_rupture, finance_impayees,
    // hospitalisation_occupation) — celles-ci ne peuvent que router vers
    // le module concerné, jamais être "traitées" en un clic.
    const alertes_medicales = labo_critiques.map(l => ({
      type: 'danger', icon: '🔬',
      titre:  `Résultat critique — ${l.patient_nom || (l.patient ? `${l.patient.prenom} ${l.patient.nom}` : 'Patient')}`,
      detail: 'Résultat biologique anormal nécessitant une attention immédiate.',
      heure:  new Date(l.createdAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
      entite_type: 'labresult', entite_id: l._id.toString(),
    }));
    if (med_ruptures > 0) {
      alertes_medicales.push({ type:'warn', icon:'💊', titre:`${med_ruptures} médicament(s) en rupture de stock`, detail:'Stock pharmacie insuffisant — réapprovisionnement requis.', heure:'Maintenant', entite_type: 'pharmacy_rupture' });
    }

    // ── Alertes admin
    const alertes_admin = [];
    if (factures_impayees_count > 0) {
      alertes_admin.push({ type:'warn', icon:'💰', titre:`${factures_impayees_count} factures impayées`, detail:'Factures en attente de règlement.', heure:"Aujourd'hui", entite_type: 'finance_impayees' });
    }
    if (taux_occupation > 80) {
      alertes_admin.push({ type:'danger', icon:'🛏️', titre:`Taux d'occupation élevé (${taux_occupation}%)`, detail:"Capacité d'accueil presque atteinte.", heure:'Maintenant', entite_type: 'hospitalisation_occupation' });
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
        revenus_par_service:  { labels: revLabels, data: revData, colors: revColors, trends: revTrends },
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
        alertes_resolues_mois: labo_resolues_mois,
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
    const [raw, depRaw] = await Promise.all([
      Invoice.aggregate([
        { $match: { statut: { $nin: ['annulee','brouillon'] }, date_facture: { $gte: new Date(year, 0, 1) } } },
        { $group: { _id: { $month: '$date_facture' }, ca: { $sum: '$montant_ttc' }, paye: { $sum: '$montant_paye' } } },
        { $sort: { _id: 1 } },
      ]).catch(()=>[]),
      // ANL-01 (correction du 12 sept. 2026, audit indépendant) —
      // depenses_par_mois était Math.round(ca*0.28), une estimation
      // arbitraire jamais liée aux vraies dépenses. Même correctif déjà
      // appliqué à getStats/getGlobalStats (voir commentaires AUDIT-
      // ANALYTICS-P2/AUDIT-DASHBOARD-GLOBAL plus haut/bas dans ce fichier),
      // ici étendu à getFinancial qui en était resté à l'ancienne formule.
      Depense.aggregate([
        { $match: { date: { $gte: new Date(year, 0, 1) } } },
        { $group: { _id: { $month: '$date' }, total: { $sum: '$montant' } } },
        { $sort: { _id: 1 } },
      ]).catch(()=>[]),
    ]);
    const ca_par_mois   = Array(12).fill(0);
    const paye_par_mois = Array(12).fill(0);
    raw.forEach(({ _id, ca, paye }) => { ca_par_mois[_id-1]=ca; paye_par_mois[_id-1]=paye; });
    const depenses_par_mois = Array(12).fill(0);
    depRaw.forEach(({ _id, total }) => { depenses_par_mois[_id-1] = total; });
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

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/global — Dashboard Global & Analytics (SuperAdmin)
// ═══════════════════════════════════════════════════════════════
// AUDIT-DASHBOARD-GLOBAL — n'importe AUCUNE des heuristiques présentes plus
// haut dans ce fichier (dépenses = 28% du CA, temps_moyen_consult = 22 en
// dur) : les dépenses viennent réellement du modèle Depense (même source
// que dashboard.controller.js::superAdminStats/comptableStats), aucune
// valeur n'est estimée. Une tendance n'est renvoyée QUE si la période
// précédente de même durée est réellement non nulle (realTrend ci-dessus) —
// jamais une évolution inventée pour remplir une carte KPI.
exports.getGlobalStats = async (req, res, next) => {
  try {
    const periode = ['jour', '7j', '30j', '12m'].includes(req.query.periode) ? req.query.periode : '7j';
    const { start, end, prevStart, prevEnd, granularity, days } = resolveGlobalPeriod(periode);

    // ── KPI + tendance réelle (période courante vs période précédente de même durée) ──
    const [
      revenus_cur_agg, revenus_prev_agg,
      patients_actifs_cur, patients_actifs_prev,
      consultations_cur, consultations_prev,
      rdv_cur, rdv_prev,
    ] = await Promise.all([
      safeAggregate(Invoice, [{ $match: { statut: 'payee', date_facture: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$montant_paye' } } }]),
      safeAggregate(Invoice, [{ $match: { statut: 'payee', date_facture: { $gte: prevStart, $lte: prevEnd } } }, { $group: { _id: null, total: { $sum: '$montant_paye' } } }]),
      Appointment.distinct('patient', { date_heure: { $gte: start, $lte: end } }).catch(() => []),
      Appointment.distinct('patient', { date_heure: { $gte: prevStart, $lte: prevEnd } }).catch(() => []),
      safeCount(Consultation, { date_consultation: { $gte: start, $lte: end } }),
      safeCount(Consultation, { date_consultation: { $gte: prevStart, $lte: prevEnd } }),
      safeCount(Appointment, { statut: 'termine', date_heure: { $gte: start, $lte: end } }),
      safeCount(Appointment, { statut: 'termine', date_heure: { $gte: prevStart, $lte: prevEnd } }),
    ]);
    const revenus_cur  = revenus_cur_agg[0]?.total  || 0;
    const revenus_prev = revenus_prev_agg[0]?.total || 0;

    // Sparklines des cartes KPI — toujours les 7 derniers jours réels,
    // indépendamment du filtre de période sélectionné (comme demandé).
    const [sparkRevenus, sparkPatients, sparkConsultations, sparkRdv] = await Promise.all([
      (async () => {
        const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
        const raw = await safeAggregate(Invoice, [
          { $match: { statut: 'payee', date_facture: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_facture' } }, total: { $sum: '$montant_paye' } } },
        ]);
        const map = mapDailyAgg(raw);
        return dailyBuckets(7).map((b) => map[b] || 0);
      })(),
      countPerDay(Patient, 'createdAt', 7).then((r) => r.data),
      countPerDay(Consultation, 'date_consultation', 7).then((r) => r.data),
      countPerDay(Appointment, 'date_heure', 7).then((r) => r.data),
    ]);

    // ── Finance globale ──
    const [
      depenses_agg, factures_imp_agg, paiements_recus_count, revenusServiceRaw,
    ] = await Promise.all([
      safeAggregate(Depense, [{ $match: { date: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
      safeAggregate(Invoice, [{ $match: { statut: { $in: ['emise', 'partiellement_payee'] } } }, { $group: { _id: null, total: { $sum: '$montant_restant' }, count: { $sum: 1 } } }]),
      safeCount(Invoice, { paiements: { $elemMatch: { date: { $gte: start, $lte: end } } } }),
      safeAggregate(Invoice, [
        { $match: { statut: { $nin: ['annulee', 'brouillon'] }, date_facture: { $gte: start, $lte: end } } },
        { $unwind: { path: '$lignes', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$lignes.categorie', total: { $sum: '$lignes.montant' } } },
        { $sort: { total: -1 } },
      ]),
    ]);
    const depenses = depenses_agg[0]?.total || 0;

    let finEvolution;
    if (granularity === 'month') {
      const [caRaw, depRaw] = await Promise.all([
        safeAggregate(Invoice, [{ $match: { statut: 'payee', date_facture: { $gte: start } } }, { $group: { _id: { $month: '$date_facture' }, total: { $sum: '$montant_paye' } } }]),
        safeAggregate(Depense, [{ $match: { date: { $gte: start } } }, { $group: { _id: { $month: '$date' }, total: { $sum: '$montant' } } }]),
      ]);
      const caMap = mapDailyAgg(caRaw), depMap = mapDailyAgg(depRaw);
      finEvolution = { labels: MOIS_LABELS, revenus: MOIS_LABELS.map((_, i) => caMap[i + 1] || 0), depenses: MOIS_LABELS.map((_, i) => depMap[i + 1] || 0) };
    } else {
      const [ca, dep] = await Promise.all([
        countPerDay(Invoice, 'date_facture', days, { statut: 'payee' }),
        countPerDay(Depense, 'date', days),
      ]);
      // countPerDay compte des documents, pas des montants — refaire les
      // sommes réelles par jour pour la finance (les compteurs seuls
      // n'ont pas de sens monétaire).
      const [caSumRaw, depSumRaw] = await Promise.all([
        safeAggregate(Invoice, [{ $match: { statut: 'payee', date_facture: { $gte: new Date(Date.now() - (days - 1) * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_facture' } }, total: { $sum: '$montant_paye' } } }]),
        safeAggregate(Depense, [{ $match: { date: { $gte: new Date(Date.now() - (days - 1) * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } }]),
      ]);
      const caMap = mapDailyAgg(caSumRaw), depMap = mapDailyAgg(depSumRaw);
      finEvolution = { labels: ca.buckets.map(DAY_LABEL), revenus: ca.buckets.map((b) => caMap[b] || 0), depenses: dep.buckets.map((b) => depMap[b] || 0) };
    }

    const CAT_LABELS = { consultation: 'Consultation', hospitalisation: 'Hospitalisation', laboratoire: 'Laboratoire', imagerie: 'Imagerie', pharmacie: 'Pharmacie', autre: 'Autre' };
    const CAT_COLORS = { consultation: '#1B4F9E', hospitalisation: '#D97706', laboratoire: '#0EA5A0', imagerie: '#7C3AED', pharmacie: '#059669', autre: '#9CA3AF' };
    const revLabels = [], revData = [], revColors = [];
    revenusServiceRaw.forEach(({ _id, total }) => { if (!_id) return; revLabels.push(CAT_LABELS[_id] || _id); revData.push(total); revColors.push(CAT_COLORS[_id] || '#6B7A99'); });

    // ── Analytics clinique ──
    const [
      patients_nouveaux, hospitalisations_cur, urgences_cur, labo_cur, imagerie_cur,
      trendPatients, trendConsultations, trendRdv, trendHospit,
    ] = await Promise.all([
      safeCount(Patient, { createdAt: { $gte: start, $lte: end } }),
      safeCount(Hospitalization, { date_entree: { $gte: start, $lte: end } }),
      safeCount(Urgence, { date_arrivee: { $gte: start, $lte: end } }),
      safeCount(LabResult, { createdAt: { $gte: start, $lte: end } }),
      safeCount(ImagingResult, { date_prescription: { $gte: start, $lte: end } }),
      granularity === 'month'
        ? safeAggregate(Patient, [{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } }])
        : countPerDay(Patient, 'createdAt', days),
      granularity === 'month'
        ? safeAggregate(Consultation, [{ $match: { date_consultation: { $gte: start } } }, { $group: { _id: { $month: '$date_consultation' }, count: { $sum: 1 } } }])
        : countPerDay(Consultation, 'date_consultation', days),
      granularity === 'month'
        ? safeAggregate(Appointment, [{ $match: { date_heure: { $gte: start } } }, { $group: { _id: { $month: '$date_heure' }, count: { $sum: 1 } } }])
        : countPerDay(Appointment, 'date_heure', days),
      granularity === 'month'
        ? safeAggregate(Hospitalization, [{ $match: { date_entree: { $gte: start } } }, { $group: { _id: { $month: '$date_entree' }, count: { $sum: 1 } } }])
        : countPerDay(Hospitalization, 'date_entree', days),
    ]);

    let clinEvolution;
    if (granularity === 'month') {
      const pMap = mapDailyAgg(trendPatients), cMap = mapDailyAgg(trendConsultations), rMap = mapDailyAgg(trendRdv), hMap = mapDailyAgg(trendHospit);
      clinEvolution = {
        labels: MOIS_LABELS,
        patients: MOIS_LABELS.map((_, i) => pMap[i + 1] || 0),
        consultations: MOIS_LABELS.map((_, i) => cMap[i + 1] || 0),
        rdv: MOIS_LABELS.map((_, i) => rMap[i + 1] || 0),
        hospitalisations: MOIS_LABELS.map((_, i) => hMap[i + 1] || 0),
      };
    } else {
      clinEvolution = {
        labels: trendPatients.labels,
        patients: trendPatients.data, consultations: trendConsultations.data,
        rdv: trendRdv.data, hospitalisations: trendHospit.data,
      };
    }

    // ── Maternité (données réelles uniquement — Pregnancy/Delivery) ──
    const [
      grossesses_en_cours, femmes_suivies_arr, accouchements_raw,
      cpnRaw, deliveryEvolutionRaw,
    ] = await Promise.all([
      safeCount(Pregnancy, { statut: { $in: ['active', 'a_risque'] } }),
      Pregnancy.distinct('patient_id', { statut: { $in: ['active', 'a_risque'] } }).catch(() => []),
      safeAggregate(Delivery, [
        { $match: { date_heure: { $gte: start, $lte: end } } },
        { $group: { _id: '$type_accouchement', count: { $sum: 1 } } },
      ]),
      safeAggregate(Pregnancy, [
        { $unwind: '$cpns' },
        { $match: { 'cpns.date': { $gte: start, $lte: end } } },
        { $count: 'total' },
      ]),
      granularity === 'month'
        ? safeAggregate(Delivery, [{ $match: { date_heure: { $gte: start } } }, { $group: { _id: { $month: '$date_heure' }, count: { $sum: 1 } } }])
        : countPerDay(Delivery, 'date_heure', days),
    ]);
    const accouchementsMap = Object.fromEntries(accouchements_raw.map((d) => [d._id, d.count]));
    const voie_basse   = accouchementsMap.voie_basse || 0;
    const cesariennes  = accouchementsMap.cesarienne  || 0;
    const forceps_ventouse = (accouchementsMap.forceps || 0) + (accouchementsMap.ventouse || 0);
    const accouchements_total = voie_basse + cesariennes + forceps_ventouse;
    let matEvolution;
    if (granularity === 'month') {
      const dMap = mapDailyAgg(deliveryEvolutionRaw);
      matEvolution = { labels: MOIS_LABELS, accouchements: MOIS_LABELS.map((_, i) => dMap[i + 1] || 0) };
    } else {
      matEvolution = { labels: deliveryEvolutionRaw.labels, accouchements: deliveryEvolutionRaw.data };
    }

    // ── Ordonnances (Prescription — données réelles) ──
    const [
      presc_total, presc_actives, presc_terminees, presc_periode,
      prescEvolutionRaw, topMedsRaw,
    ] = await Promise.all([
      safeCount(Prescription, {}),
      safeCount(Prescription, { statut: { $in: ['active', 'publiee'] } }),
      safeCount(Prescription, { statut: { $in: ['dispensee', 'expiree'] } }),
      safeCount(Prescription, { date_prescription: { $gte: start, $lte: end } }),
      granularity === 'month'
        ? safeAggregate(Prescription, [{ $match: { date_prescription: { $gte: start } } }, { $group: { _id: { $month: '$date_prescription' }, count: { $sum: 1 } } }])
        : countPerDay(Prescription, 'date_prescription', days),
      safeAggregate(Prescription, [
        { $match: { date_prescription: { $gte: start, $lte: end } } },
        { $unwind: '$lignes' },
        { $group: { _id: '$lignes.medicament_nom', total: { $sum: { $ifNull: ['$lignes.quantite', 1] } } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
    ]);
    let presEvolution;
    if (granularity === 'month') {
      const map = mapDailyAgg(prescEvolutionRaw);
      presEvolution = { labels: MOIS_LABELS, data: MOIS_LABELS.map((_, i) => map[i + 1] || 0) };
    } else {
      presEvolution = { labels: prescEvolutionRaw.labels, data: prescEvolutionRaw.data };
    }
    const top_medicaments = topMedsRaw.map((m) => [m._id || 'Inconnu', m.total || 0]);

    // ── Alertes (mêmes règles réelles que getReport ci-dessus) ──
    const [labCritiques, medRuptures, urgCritiques] = await Promise.all([
      LabResult.find({ est_critique: true, acquitte_par: null }).populate('patient', 'nom prenom').select('patient patient_nom createdAt').sort('-createdAt').limit(5).lean().catch(() => []),
      safeCount(Medication, { statut: 'rupture' }),
      safeCount(Urgence, { niveau_triage: 'rouge', statut: { $nin: ['sorti', 'transfere', 'decede'] } }),
    ]);
    const alertes = [
      ...labCritiques.map((l) => ({ type: 'error', icon: '🔬', msg: `Résultat critique — ${l.patient_nom || (l.patient ? `${l.patient.prenom} ${l.patient.nom}` : 'Patient')}`, heure: new Date(l.createdAt).toLocaleString('fr-FR') })),
      medRuptures > 0 ? { type: 'error', icon: '💊', msg: `${medRuptures} médicament(s) en rupture de stock`, heure: 'Maintenant' } : null,
      urgCritiques > 0 ? { type: 'error', icon: '🚨', msg: `${urgCritiques} urgence(s) niveau critique en cours`, heure: 'Maintenant' } : null,
      (factures_imp_agg[0]?.total || 0) > 0 ? { type: 'warn', icon: '💰', msg: `${(factures_imp_agg[0].total).toLocaleString('fr-FR')} CFA de factures impayées (${factures_imp_agg[0].count} facture(s))`, heure: "Aujourd'hui" } : null,
    ].filter(Boolean);

    res.json({
      success: true,
      periode,
      kpis: {
        revenus:       { valeur: revenus_cur,          unite: 'CFA', trend: realTrend(revenus_cur, revenus_prev),                   sparkline: sparkRevenus },
        patients_actifs: { valeur: patients_actifs_cur.length, unite: '',   trend: realTrend(patients_actifs_cur.length, patients_actifs_prev.length), sparkline: sparkPatients },
        consultations: { valeur: consultations_cur,    unite: '',    trend: realTrend(consultations_cur, consultations_prev),        sparkline: sparkConsultations },
        rdv_realises:  { valeur: rdv_cur,               unite: '',    trend: realTrend(rdv_cur, rdv_prev),                            sparkline: sparkRdv },
      },
      finance: {
        revenus: revenus_cur, depenses, benefice: revenus_cur - depenses,
        paiements_recus: paiements_recus_count,
        factures_impayees_count: factures_imp_agg[0]?.count || 0,
        factures_impayees_montant: factures_imp_agg[0]?.total || 0,
        evolution: finEvolution,
        revenus_par_service: revLabels.length ? { labels: revLabels, data: revData, colors: revColors } : null,
      },
      analytics: {
        patients_nouveaux, patients_actifs: patients_actifs_cur.length,
        consultations: consultations_cur, rdv: rdv_cur,
        hospitalisations: hospitalisations_cur, urgences: urgences_cur,
        labo: labo_cur, imagerie: imagerie_cur,
        evolution: clinEvolution,
      },
      maternite: {
        femmes_suivies: femmes_suivies_arr.length,
        grossesses_en_cours,
        consultations_prenatales: cpnRaw[0]?.total ?? 0,
        accouchements: accouchements_total,
        naissances: accouchements_total, // 1 accouchement = 1 naissance enregistrée (pas de champ nb_bebes distinct)
        voie_basse, cesariennes,
        hospitalisations_maternite: null, // aucun champ ne rattache Hospitalization à la maternité de façon fiable
        evolution: matEvolution,
        repartition_accouchement: (voie_basse + cesariennes) > 0 ? { labels: ['Voie basse', 'Césarienne'], data: [voie_basse, cesariennes], colors: ['#0EA5A0', '#DC2626'] } : null,
      },
      ordonnances: {
        total: presc_total, actives: presc_actives, terminees: presc_terminees, periode_count: presc_periode,
        evolution: presEvolution,
        top_medicaments: top_medicaments.length ? top_medicaments : null,
      },
      alertes,
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/analytics/report/email
// ═══════════════════════════════════════════════════════════════
// AUDIT-ANALYTICS-P1 — "Envoyer par e-mail" n'envoyait rien (toast seul).
// Aucun destinataire unique naturel pour un rapport Analytics (pas un
// patient, pas un membre du personnel déjà identifié comme en Finance/
// Planning) : décision explicite — sélection d'un rôle, envoi à tout le
// personnel actif de ce rôle avec un email connu, un message séparé par
// destinataire (jamais de consolidation, cohérent avec Finance/Planning).
const ROLES_RAPPORT_VALIDES = ['superadmin','adminclinique','medecin','infirmier','sage_femme','laborantin','radiologue','pharmacien','comptable','receptionniste'];
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

exports.sendReportEmail = async (req, res, next) => {
  try {
    const { role, attachment } = req.body;
    if (!ROLES_RAPPORT_VALIDES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle destinataire invalide.' });
    }
    if (!attachment?.contentBase64) {
      return res.status(400).json({ success: false, message: 'Pièce jointe requise.' });
    }
    const buf = Buffer.from(attachment.contentBase64, 'base64');
    if (buf.length > MAX_ATTACHMENT_BYTES) {
      return res.status(400).json({ success: false, message: 'Pièce jointe trop volumineuse (max 8 Mo).' });
    }

    const destinataires = await User.find({ role, statut: 'actif', email: { $exists: true, $ne: '' } }).select('email prenom nom');
    if (destinataires.length === 0) {
      return res.json({ success: true, envoyes: 0, echecs: 0, message: `Aucun utilisateur actif du rôle "${role}" avec un email connu.` });
    }

    let envoyes = 0, echecs = 0;
    for (const u of destinataires) {
      try {
        await mail.sendAnalyticsReportEmail({
          email: u.email, prenom: u.prenom || '', nom: u.nom || '',
          attachment: { filename: attachment.filename || 'rapport-analytics.pdf', content: buf },
        });
        envoyes++;
      } catch (err) {
        echecs++;
        logger.error('[analytics] Échec envoi rapport', { userId: u._id.toString(), error: err.message });
      }
    }

    await logAction({
      utilisateur: req.user._id, action: 'ANALYTICS_REPORT_EMAIL', module: 'analytics', ip: req.ip,
      message: `Rapport Analytics envoyé au rôle "${role}" — ${envoyes} envoyé(s), ${echecs} échec(s)`,
    });

    res.json({ success: true, envoyes, echecs });
  } catch (err) { next(err); }
};

// AUDIT-B4 — le cache dashboard (T9.9, TTL 30s) n'était pas étendu aux
// endpoints Analytics, de coût comparable (mêmes agrégations lourdes sur
// les mêmes collections, même audience superadmin/adminclinique). Réassigné
// ici, après toutes les définitions, même schéma que
// dashboard.controller.js : exports.<fn> lit exports.<fn> au moment de
// l'appel (pas à l'import), donc cette réassignation couvre bien tout
// appel entrant via les routes. getStats est seul concerné par une clé
// dépendant de la requête (req.query.periode) — les 3 autres n'ont aucun
// paramètre qui changerait le résultat, clé globale comme
// medecinStats/superAdminStats côté dashboard.
const { cacheStats } = require('../utils/dashboardCache');
// AUDIT-ANALYTICS-P1 — la clé de cache ne portait que sur `periode` : pour
// periode='custom', deux plages date_debut/date_fin différentes auraient
// partagé le même résultat en cache (collision réelle, pas hypothétique,
// puisque 'custom' est maintenant un cas géré). Les deux dates rejoignent la
// clé pour ce cas.
// AUDIT-ANALYTICS-P1 — le qualificatif date_debut/date_fin n'est ajouté que
// pour periode='custom' : garde la clé identique à avant ("mois", "annee"...)
// dans tous les autres cas, pour ne pas casser auditB4CacheAnalytics.test.js
// qui vérifie la clé exacte 'analyticsStats:mois'.
exports.getStats        = cacheStats('analyticsStats', (req) => {
  const p = req.query.periode || 'mois';
  return p === 'custom' ? `${p}:${req.query.date_debut||''}:${req.query.date_fin||''}` : p;
}, exports.getStats);
exports.getReport       = cacheStats('analyticsReport', false, exports.getReport);
exports.getFinancial    = cacheStats('analyticsFinancial', false, exports.getFinancial);
exports.getPatientStats = cacheStats('analyticsPatientStats', false, exports.getPatientStats);
exports.getGlobalStats  = cacheStats('analyticsGlobalStats', (req) => req.query.periode || '7j', exports.getGlobalStats);

// Exporté pour test direct des règles (analyticsPhase3.test.js) — la même
// fonction que celle réellement appelée par getStats() ci-dessus, jamais
// une réimplémentation séparée pour les tests.
exports.computeRecommandations = computeRecommandations;
exports.computeAvgResponseTimeMin = computeAvgResponseTimeMin;
exports.groupMessagesByConversation = groupMessagesByConversation;
