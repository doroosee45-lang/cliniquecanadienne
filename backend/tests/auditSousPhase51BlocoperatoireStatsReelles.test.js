// Sous-phase 5.1 (relecture du 6 sept. 2026) — Blocoperatoire.jsx cumulait
// plusieurs occurrences factices/décoratives et un bug de statut plus grave
// que les autres modules déjà corrigés de cette sous-phase :
//
// 1) toModelStatut() (blocoperatoireController.js) ne traduisait jamais
//    'preparation' (valeur absente de l'enum réel de DossierChirurgical.statut)
//    : sélectionner "En préparation" dans le formulaire et enregistrer
//    provoquait une erreur de validation Mongoose (findByIdAndUpdate avec
//    runValidators:true), jamais un simple affichage figé. Fixé en le
//    traduisant vers 'preoperatoire' (aucun signal réel ne distingue "en
//    préparation" de "programmée" dans ce schéma).
// 2) 'terminee' (UI) pointait vers 'opere' (modèle) — exactement comme
//    'en_cours' — rendant tout dossier "Terminé" indiscernable d'un dossier
//    "En cours" en base. stats.terminees était donc figé à 0 en dur dans
//    getPlanning(), aucune requête ne pouvant jamais le calculer. Fixé en
//    traduisant 'terminee' vers 'cloture' (valeur de l'enum réel du modèle,
//    jusqu'ici jamais utilisée par ce mapping).
// 3) getPlanning().stats exposait "Interventions/mois"/"Taux d'occupation"/
//    "Taux de succès"/"Taux de complications"/"Durée moyenne"/"Recettes/mois"
//    (onglet Stats de Blocoperatoire.jsx) tous codés en dur côté frontend
//    (kpis.terminees+2, "72%", "92%", "4.2%", "68 min", "1.8M CFA") et un
//    "Volume opératoire — 12 mois" jamais recalculé ([3,5,4,7,...]).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Blocoperatoire) — statuts réels + stats réellement calculées', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const boC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const created = { patients: [], users: [], dossiers: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const chirurgien = await User.create({ email: `_51bloc-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chirurgien', prenom: '51', role: 'medecin', statut: 'actif' });
    created.users.push(chirurgien._id);

    await t.test("toModelStatut('preparation') ne crashe plus (mappé vers 'preoperatoire' réel, plus jamais une valeur hors enum)", async () => {
      const patient = await Patient.create({ nom: `T51-Bloc-Prep-${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });
      created.patients.push(patient._id);

      // Créneau unique (dérivé de stamp, loin dans le futur) pour ne jamais
      // entrer en collision avec le créneau "maintenant+1h" d'un autre
      // fichier de test tournant en parallèle sur la même salle réelle
      // BO-1 (checkBlocConflict est une vraie détection de conflit, pas un
      // bug — seule notre fenêtre de test doit rester isolée).
      const creneauUnique = new Date(stamp + 7 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Test51-Prep', salle: 'BO-1', date_heure_op: creneauUnique.toISOString(), statut: 'programmee' },
        user: chirurgien, ip: '127.0.0.1',
      });
      const dossierId = bCreate.intervention._id;
      created.dossiers.push(dossierId);

      const { status, body } = await call(boC.updateIntervention, {
        params: { id: dossierId }, body: { statut: 'preparation' }, user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(status, 200, `AVANT la correction, ceci provoquait une 500 (enum invalide) : ${JSON.stringify(body)}`);
      const enBase = await DossierChirurgical.findById(dossierId).lean();
      assert.equal(enBase.statut, 'preoperatoire', "'preparation' (UI) doit persister 'preoperatoire' (modèle), jamais une valeur hors enum");
    });

    await t.test("toModelStatut('terminee') persiste réellement 'cloture', distinct de 'en_cours'→'opere'", async () => {
      const patient = await Patient.create({ nom: `T51-Bloc-Term-${stamp}`, prenom: 'P', date_naissance: '1975-05-05', sexe: 'F' });
      created.patients.push(patient._id);

      // Créneau unique (dérivé de stamp), même raison que le sous-test
      // précédent : BO-2 "maintenant" est aussi utilisée par d'autres
      // fichiers de test tournant en parallèle.
      const creneauUnique = new Date(stamp + 8 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Test51-Term', salle: 'BO-2', date_heure_op: creneauUnique.toISOString(), statut: 'en_cours' },
        user: chirurgien, ip: '127.0.0.1',
      });
      assert.ok(bCreate.intervention, `création attendue en succès, obtenu ${JSON.stringify(bCreate)}`);
      const dossierId = bCreate.intervention._id;
      created.dossiers.push(dossierId);
      const avant = await DossierChirurgical.findById(dossierId).lean();
      assert.equal(avant.statut, 'opere', "'en_cours' (UI) doit persister 'opere' (modèle)");

      const { status } = await call(boC.updateIntervention, {
        params: { id: dossierId }, body: { statut: 'terminee' }, user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      const apres = await DossierChirurgical.findById(dossierId).lean();
      assert.equal(apres.statut, 'cloture', "'terminee' (UI) doit désormais persister 'cloture' (modèle), plus jamais 'opere' (AVANT la correction : indiscernable d'un dossier 'en_cours')");
      assert.notEqual(apres.statut, avant.statut, "'terminee' doit produire un état réellement distinct de 'en_cours'");
    });

    await t.test('getPlanning().stats — terminees/durée moyenne/volume 12 mois réellement calculés (jamais figés)', async () => {
      const patientA = await Patient.create({ nom: `T51-Bloc-StatA-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const patientB = await Patient.create({ nom: `T51-Bloc-StatB-${stamp}`, prenom: 'P', date_naissance: '1991-01-01', sexe: 'F' });
      created.patients.push(patientA._id, patientB._id);

      // Dossier A — occupation réelle de salle (90 min), clôturé aujourd'hui, complication + succès réels.
      const dA = await DossierChirurgical.create({
        numero: `BLOC-T51-A-${stamp}`, patient: patientA._id, patient_nom: 'A', statut: 'cloture',
        salle_prevue: 'BO-1', date_intervention_prev: new Date(),
        salle_entree_at: new Date(Date.now() - 90 * 60000), salle_sortie_at: new Date(),
        nb_complications: 1, etat_sortie: 'guerison',
      });
      // Dossier B — occupation réelle de salle (30 min), clôturé aujourd'hui, sans complication, échec réel (décès).
      const dB = await DossierChirurgical.create({
        numero: `BLOC-T51-B-${stamp}`, patient: patientB._id, patient_nom: 'B', statut: 'cloture',
        salle_prevue: 'BO-2', date_intervention_prev: new Date(),
        salle_entree_at: new Date(Date.now() - 30 * 60000), salle_sortie_at: new Date(),
        nb_complications: 0, etat_sortie: 'deces',
      });
      created.dossiers.push(dA._id, dB._id);

      const { status, body } = await call(boC.getPlanning, { query: {} });
      assert.equal(status, 200, JSON.stringify(body));
      const s = body.stats;

      // Agrégats globaux partagés (base Atlas réelle, mutualisée entre
      // sessions) : preuve forte = avant/après (champ absent avant
      // correction) ; ici, plausibilité + effet réel de nos 2 dossiers.
      assert.ok(s.terminees >= 2, `terminees doit désormais compter au moins nos 2 dossiers clôturés aujourd'hui (AVANT la correction : toujours 0), obtenu ${s.terminees}`);
      assert.ok(typeof s.duree_moyenne_min === 'number' && s.duree_moyenne_min > 0, 'duree_moyenne_min doit être un réel calculé à partir de salle_entree_at/salle_sortie_at');
      assert.ok(typeof s.taux_complications === 'number' && s.taux_complications >= 0 && s.taux_complications <= 100);
      assert.ok(typeof s.taux_succes === 'number' && s.taux_succes >= 0 && s.taux_succes <= 100);
      assert.ok(typeof s.interventions_mois_moy === 'number' && s.interventions_mois_moy >= 0);

      assert.ok(Array.isArray(s.volume_12_mois.labels) && s.volume_12_mois.labels.length === 12, 'volume_12_mois doit exposer 12 tranches mensuelles réelles');
      const totalVolume = s.volume_12_mois.data.reduce((sum, n) => sum + n, 0);
      assert.ok(totalVolume >= 2, `le dernier mois du volume 12 mois doit au moins compter nos 2 dossiers réels créés maintenant, total obtenu ${totalVolume}`);
      assert.ok(s.volume_12_mois.data[11] >= 2, `le mois courant (dernier bucket) doit compter au moins nos 2 dossiers, obtenu ${s.volume_12_mois.data[11]}`);
    });
  } finally {
    await DossierChirurgical.deleteMany({ _id: { $in: created.dossiers } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
