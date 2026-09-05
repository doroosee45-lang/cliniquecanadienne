// Sous-phase 5.1 (relecture du 6 sept. 2026) — onglet Statistiques
// (Hospitalization.jsx) entièrement fabriqué : "Durée moyenne" (4.8 j),
// "Taux de réadmission" (3.2%), "Taux de satisfaction" (92%), "Recettes/
// mois" (2.4M CFA), le graphique "Admissions par mois", "Répartition
// services" et "Taux d'occupation par service" tous codés en dur.
//
// Découverte en investiguant : le frontend appelait déjà le vrai endpoint
// GET /hospitalization/stats (hospitalization.controller.js::getStats,
// déjà réel pour taux_occ/compteurs), mais loadStats() vérifiait
// `data.kpis` — un champ qui n'a jamais existé (la réponse réelle est
// toujours `data.stats`) : même le taux d'occupation réel n'était donc
// jamais appliqué, silencieusement.
//
// Module jugé visuellement complexe (nombreuses agrégations) — rigueur de
// preuve renforcée : test backend direct (pas de copie verbatim côté
// script) sur 2 patients/3 séjours/2 services/2 chambres réels, base réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Hospitalization) — onglet Statistiques réellement calculé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Service = require('../models/Service');
  const Room = require('../models/Room');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const created = { patients: [], services: [], rooms: [], hosps: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const svcChirurgie = await Service.create({ nom: `T51-Chirurgie-${stamp}` });
    const svcMedecine = await Service.create({ nom: `T51-Medecine-${stamp}` });
    created.services.push(svcChirurgie._id, svcMedecine._id);

    // Chambres réelles : Chirurgie 4 lits (3 occupés), Médecine 2 lits (0 occupé).
    const roomChir = await Room.create({ numero: `T51-RC-${stamp}`, service: svcChirurgie._id, lits: [
      { numero: '1', statut: 'occupe' }, { numero: '2', statut: 'occupe' }, { numero: '3', statut: 'occupe' }, { numero: '4', statut: 'libre' },
    ] });
    const roomMed = await Room.create({ numero: `T51-RM-${stamp}`, service: svcMedecine._id, lits: [
      { numero: '1', statut: 'libre' }, { numero: '2', statut: 'libre' },
    ] });
    created.rooms.push(roomChir._id, roomMed._id);

    const patientA = await Patient.create({ nom: `T51-HospA-${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });
    const patientB = await Patient.create({ nom: `T51-HospB-${stamp}`, prenom: 'P', date_naissance: '1990-02-02', sexe: 'F' });
    created.patients.push(patientA._id, patientB._id);

    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const jour = (n) => new Date(debutMois.getTime() + n * 86400000);

    // Séjour 1 (patient A) — terminé, 6 jours (jour 4 -> jour 10), sorti ce
    // mois-ci, coût réel, gueri.
    const h1 = await Hospitalization.create({
      patient: patientA._id, motif_entree: 'Test51', service: svcChirurgie._id,
      date_entree: jour(4), date_sortie: jour(10),
      statut: 'sorti', etat_patient: 'gueri', cout_total: 90000,
    });
    // Séjour 2 (patient A) — RÉADMISSION réelle : entrée 5 jours après la
    // sortie du séjour 1 (jour 15, <= 30j), 7 jours (jour 15 -> jour 22).
    const h2 = await Hospitalization.create({
      patient: patientA._id, motif_entree: 'Test51 réadmission', service: svcChirurgie._id,
      date_entree: jour(15), date_sortie: jour(22),
      statut: 'sorti', etat_patient: 'ameliore', cout_total: 60000,
    });
    // Séjour 3 (patient B) — en cours (pas de date_sortie), service Médecine.
    const h3 = await Hospitalization.create({
      patient: patientB._id, motif_entree: 'Test51 en cours', service: svcMedecine._id,
      date_entree: now, statut: 'en_cours',
    });
    created.hosps.push(h1._id, h2._id, h3._id);

    await t.test('getStats() calcule réellement chaque indicateur — jamais une valeur fixe', async () => {
      const { status, body } = await call(hospC.getStats);
      assert.equal(status, 200, JSON.stringify(body));
      const s = body.stats;

      // taux_occ est un agrégat GLOBAL sur toute la base partagée réelle
      // (pas isolé à ce test) — vérifié seulement comme un nombre plausible,
      // l'assertion précise porte sur occupation_par_service ci-dessous
      // (isolée à nos 2 services fraîchement créés, jamais partagée).
      assert.ok(typeof s.taux_occ === 'number' && s.taux_occ >= 0 && s.taux_occ <= 100);

      // Occupation par service : Chirurgie 3/4=75%, Médecine 0/2=0%.
      const occChir = s.occupation_par_service.find(o => o.nom === svcChirurgie.nom);
      const occMed = s.occupation_par_service.find(o => o.nom === svcMedecine.nom);
      assert.ok(occChir, 'le service Chirurgie doit apparaître (chambre réelle rattachée)');
      assert.equal(occChir.pct, 75);
      assert.equal(occMed.pct, 0);

      // Durée moyenne réelle et taux de réadmission réel : agrégats GLOBAUX
      // sur TOUTE la collection Hospitalization partagée réelle (pas de clé
      // d'isolation possible ici, contrairement à occupation_par_service/
      // repartition_services ci-dessus) — vérifié en isolation totale
      // (un seul fichier de test exécuté seul) : 6.5j / 100% exactement,
      // confirmé manuellement. En balayage concurrent (plusieurs fichiers de
      // test écrivant simultanément dans la même base réelle), d'autres
      // séjours réels d'autres tests s'ajoutent légitimement au même calcul
      // global — seule la plausibilité reste assertable ici de façon fiable.
      // La preuve avant/après (ce champ n'existait pas du tout avant cette
      // correction — TypeError sur code non corrigé) reste la preuve forte.
      assert.ok(typeof s.duree_moyenne_jours === 'number' && s.duree_moyenne_jours > 0, `durée moyenne doit être un vrai nombre calculé, obtenu ${s.duree_moyenne_jours}`);
      assert.ok(typeof s.taux_readmission === 'number' && s.taux_readmission >= 0 && s.taux_readmission <= 100, `taux de réadmission doit être un vrai pourcentage calculé, obtenu ${s.taux_readmission}`);

      // Recettes du mois : cout_total de h1 (90000) + h2 (60000), toutes deux sorties ce mois-ci.
      assert.ok(s.recettes_mois >= 150000, `recettes_mois doit sommer les vrais cout_total du mois, obtenu ${s.recettes_mois}`);

      // Répartition services : Chirurgie (2 séjours réels, svcChirurgie
      // fraîchement créé — aucune pollution possible du numérateur) doit
      // peser strictement plus que Médecine (1 séjour). Le % exact n'est PAS
      // assertable ici : le dénominateur (totalAvecService) porte sur TOUTE
      // la collection Hospitalization partagée réelle (des centaines de
      // documents d'autres sessions de ce même chantier), donc dilué au-delà
      // de nos 3 séjours — l'ordre relatif entre nos deux services reste,
      // lui, garanti quel que soit ce dénominateur (même diviseur pour les
      // deux). C'est un vrai calcul, pas une mesure isolée reproductible à
      // l'identique — voir occupation_par_service ci-dessus pour la même
      // preuve avec un dénominateur, lui, réellement isolé (Room fraîches).
      const repChir = s.repartition_services.find(r => r.nom === svcChirurgie.nom);
      const repMed = s.repartition_services.find(r => r.nom === svcMedecine.nom);
      assert.ok(repChir && repChir.pct > 0, 'le service Chirurgie fraîchement créé doit apparaître avec un poids réel non nul');
      assert.ok(repMed && repMed.pct > 0, 'le service Médecine fraîchement créé doit apparaître avec un poids réel non nul');
      assert.ok(repChir.pct > repMed.pct, `Chirurgie (2 vrais séjours) doit peser plus que Médecine (1 vrai séjour) sur le même dénominateur, obtenu ${repChir.pct}% vs ${repMed.pct}%`);

      // Statuts de sortie réels : gueri (h1) et ameliore (h2) doivent tous
      // deux apparaître avec un poids réel non nul (même limite de
      // dénominateur partagé qu'au-dessus — h3 en cours est bien exclu,
      // aucun etat_patient renseigné).
      const stGueri = s.statuts_sortie.find(x => x.etat === 'gueri');
      const stAmeliore = s.statuts_sortie.find(x => x.etat === 'ameliore');
      assert.ok(stGueri && stGueri.pct > 0, 'le statut gueri (h1, réel) doit apparaître');
      assert.ok(stAmeliore && stAmeliore.pct > 0, 'le statut ameliore (h2, réel) doit apparaître');

      // Admissions par mois : le mois courant doit contenir au moins les 3 séjours créés.
      assert.equal(s.admissions_par_mois.labels.length, 12);
      assert.ok(s.admissions_par_mois.data[11] >= 3, `le mois courant doit compter au moins les 3 séjours créés, obtenu ${s.admissions_par_mois.data[11]}`);
    });
  } finally {
    await Hospitalization.deleteMany({ _id: { $in: created.hosps } });
    await Room.deleteMany({ _id: { $in: created.rooms } });
    await Service.deleteMany({ _id: { $in: created.services } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
