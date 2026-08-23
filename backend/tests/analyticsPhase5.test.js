// AUDIT-ANALYTICS-P5 — ajout de Bloc opératoire/Ambulances/Messages aux KPIs
// (mêmes 15 modules déjà couverts par getStats, jamais de valeur fabriquée).
// Décisions validées par l'utilisateur avant code :
//  - Bloc opératoire : "interventions à venir" (statut preoperatoire +
//    date_intervention_prev future) ET taux d'occupation salle en
//    instantané (salles occupées maintenant / 3), via de nouveaux
//    horodatages réels salle_entree_at/salle_sortie_at sur
//    DossierChirurgical (conception dédiée validée séparément avant code) +
//    2 nouvelles routes PUT /:id/entree-salle et /:id/sortie-salle
//    (blocoperatoireController.js), qui rendent aussi réelles les 3 cartes
//    BO-1/BO-2/BO-3 de GET /blocoperatoire/salles (avant : heuristique
//    "programmé aujourd'hui", jamais consommée côté frontend).
//  - Ambulances : missions du mois (réel, sous-documents missions[]) + statut
//    de flotte (comptage réel par statut).
//  - Messages : volume réel + temps de réponse moyen (delta entre messages
//    consécutifs d'expéditeurs différents, tous deux dans la période ;
//    computeAvgResponseTimeMin, vérifié isolément ET via getStats()).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 5 — Bloc opératoire / Ambulances / Messages (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Ambulance = require('../models/Ambulance');
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const analyticsC = require('../controllers/analytics.controller');
  const blocC = require('../controllers/blocoperatoireController');
  const { computeAvgResponseTimeMin } = analyticsC;

  const stamp = Date.now();
  const created = { patients: [], dossiers: [], ambulances: [], conversations: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('computeAvgResponseTimeMin — fonction exportée directement, cas déterministes', () => {
      const u1 = new mongoose.Types.ObjectId(), u2 = new mongoose.Types.ObjectId();
      const debut = new Date('2033-01-01T00:00:00Z'), fin = new Date('2033-01-02T00:00:00Z');
      // u1 -> u2 : 10 min. u2 -> u1 : 20 min. Moyenne réelle = 15 min.
      const conv = { messages: [
        { expediteur: u1, date_envoi: new Date('2033-01-01T10:00:00Z') },
        { expediteur: u2, date_envoi: new Date('2033-01-01T10:10:00Z') },
        { expediteur: u1, date_envoi: new Date('2033-01-01T10:30:00Z') },
      ] };
      assert.equal(computeAvgResponseTimeMin([conv], debut, fin), 15);
    });

    await t.test('computeAvgResponseTimeMin — même expéditeur consécutif ne compte pas comme une réponse', () => {
      const u1 = new mongoose.Types.ObjectId();
      const debut = new Date('2033-01-01T00:00:00Z'), fin = new Date('2033-01-02T00:00:00Z');
      const conv = { messages: [
        { expediteur: u1, date_envoi: new Date('2033-01-01T10:00:00Z') },
        { expediteur: u1, date_envoi: new Date('2033-01-01T10:05:00Z') },
      ] };
      assert.equal(computeAvgResponseTimeMin([conv], debut, fin), null, 'aucun changement d\'expéditeur → aucun échantillon → null, jamais 0');
    });

    await t.test('computeAvgResponseTimeMin — null (jamais 0) quand aucune conversation ne qualifie', () => {
      assert.equal(computeAvgResponseTimeMin([], new Date(), new Date()), null);
    });

    await t.test('getStats() — bloc_interventions_a_venir compte réellement un dossier programmé dans le futur', async () => {
      const { body: before } = await call(analyticsC.getStats, { query: {} });
      const patient = await Patient.create({ nom: `T-ANLP5-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const dossier = await DossierChirurgical.create({
        numero: `T-ANLP5-${stamp}`, patient: patient._id, patient_nom: `T-ANLP5-${stamp}`,
        statut: 'preoperatoire', date_intervention_prev: new Date(Date.now() + 30 * 86400000),
      });
      created.dossiers.push(dossier);

      const { body: after } = await call(analyticsC.getStats, { query: {} });
      assert.equal(after.kpi.bloc_interventions_a_venir, before.kpi.bloc_interventions_a_venir + 1, 'une vraie intervention programmée dans le futur doit incrémenter le compte de 1');
      assert.equal(after.kpi.chirurgie_annulees !== undefined, true, 'sanity — la carte Chirurgie existante ne doit pas être cassée par cet ajout');
    });

    await t.test('getStats() — ambulances_missions_periode et statut de flotte réels', async () => {
      const { body: before } = await call(analyticsC.getStats, { query: {} });
      const amb = await Ambulance.create({ numero: `T-ANLP5-${stamp}`, statut: 'disponible' });
      created.ambulances.push(amb);
      amb.missions.push({ destination: 'Test', motif_mission: 'Test', date: new Date() });
      await amb.save();

      const { body: after } = await call(analyticsC.getStats, { query: {} });
      assert.equal(after.kpi.ambulances_missions_periode, before.kpi.ambulances_missions_periode + 1, 'une vraie mission datée dans la période doit incrémenter le compte de 1');
      assert.equal(after.kpi.ambulances_disponibles, before.kpi.ambulances_disponibles + 1, 'une vraie ambulance disponible de plus doit incrémenter le compte de statut de 1');
    });

    await t.test('getStats() — messages_volume_periode et temps de réponse moyen réels (câblage bout-en-bout)', async () => {
      const { body: before } = await call(analyticsC.getStats, { query: {} });
      const u1 = new mongoose.Types.ObjectId(), u2 = new mongoose.Types.ObjectId();
      // Les deux messages doivent être dans le PASSÉ (jamais dans le futur) :
      // getStats() résout fin=new Date() au moment de l'appel "after", donc
      // un message daté dans le futur relatif au moment de la création
      // tomberait hors de la période (>fin) une fois "after" appelé.
      const now = new Date();
      const conv = await Conversation.create({ type: 'direct', membres: [u1, u2] });
      created.conversations.push(conv);
      // AUDIT-ELEVE-5 — messages désormais dans la collection Message dédiée
      // (plus Conversation.messages, migré).
      await Message.create([
        { conversation_id: conv._id, expediteur: u1, contenu: 'T-ANLP5-1', date_envoi: new Date(now.getTime() - 10 * 60000) },
        { conversation_id: conv._id, expediteur: u2, contenu: 'T-ANLP5-2', date_envoi: new Date(now.getTime() - 5 * 60000) },
      ]);

      const { body: after } = await call(analyticsC.getStats, { query: {} });
      assert.equal(after.kpi.messages_volume_periode, before.kpi.messages_volume_periode + 2, 'les 2 vrais messages envoyés maintenant doivent compter dans le volume de la période');
      assert.ok(after.kpi.messages_temps_reponse_moyen_min !== null, 'un vrai changement d\'expéditeur dans la période doit produire un temps de réponse réel, pas null');
      assert.equal(typeof after.kpi.messages_temps_reponse_moyen_min, 'number');
      assert.ok(after.kpi.messages_temps_reponse_moyen_min > 0, 'la moyenne réelle doit être strictement positive (un vrai delta de 5 min existe dans l\'échantillon)');
    });

    await t.test('entreeSalle/sortieSalle — cycle réel via le vrai contrôleur bloc, reflété dans getSalles() et getStats()', async () => {
      const patient = await Patient.create({ nom: `T-ANLP5b-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const dossier = await DossierChirurgical.create({
        numero: `T-ANLP5b-${stamp}`, patient: patient._id, patient_nom: `T-ANLP5b-${stamp}`,
        statut: 'preoperatoire', salle_prevue: 'BO-1',
      });
      created.dossiers.push(dossier);

      const { body: salleAvant } = await call(blocC.getSalles);
      const bo1Avant = salleAvant.salles.find(s => s.id === 'BO-1');
      assert.equal(bo1Avant.statut, 'disponible', 'sanity — BO-1 disponible avant toute entrée réelle (aucun autre dossier de test ne devrait l\'occuper)');
      const { body: statsAvant } = await call(analyticsC.getStats, { query: {} });

      const { status: entreeStatus, body: entreeBody } = await call(blocC.entreeSalle, { params: { id: dossier._id.toString() }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' });
      assert.equal(entreeStatus, 200);
      assert.ok(entreeBody.intervention.salle_entree_at, 'salle_entree_at doit être réellement renseigné par le vrai contrôleur');

      const { body: salleApresEntree } = await call(blocC.getSalles);
      const bo1ApresEntree = salleApresEntree.salles.find(s => s.id === 'BO-1');
      assert.equal(bo1ApresEntree.statut, 'occupee', 'BO-1 doit devenir réellement occupée après une vraie entrée en salle');
      assert.equal(bo1ApresEntree.intervention_en_cours, `T-ANLP5b-${stamp}`);

      const { body: statsApresEntree } = await call(analyticsC.getStats, { query: {} });
      assert.equal(statsApresEntree.kpi.bloc_taux_occupation_salle, statsAvant.kpi.bloc_taux_occupation_salle + Math.round(100 / 3), 'le taux d\'occupation instantané doit progresser exactement de 1 salle réelle sur 3 (arrondi identique à la formule de production)');

      // Une seconde entrée sur le même dossier doit être refusée (déjà en salle).
      const { status: doubleEntreeStatus } = await call(blocC.entreeSalle, { params: { id: dossier._id.toString() }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' });
      assert.equal(doubleEntreeStatus, 400, 'une deuxième entrée sur un dossier déjà en salle doit être refusée, pas silencieusement acceptée');

      const { status: sortieStatus, body: sortieBody } = await call(blocC.sortieSalle, { params: { id: dossier._id.toString() }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' });
      assert.equal(sortieStatus, 200);
      assert.ok(sortieBody.intervention.salle_sortie_at, 'salle_sortie_at doit être réellement renseigné par le vrai contrôleur');

      const { body: salleApresSortie } = await call(blocC.getSalles);
      const bo1ApresSortie = salleApresSortie.salles.find(s => s.id === 'BO-1');
      assert.equal(bo1ApresSortie.statut, 'disponible', 'BO-1 doit redevenir réellement disponible après une vraie sortie de salle');

      const { body: statsApresSortie } = await call(analyticsC.getStats, { query: {} });
      assert.equal(statsApresSortie.kpi.bloc_taux_occupation_salle, statsAvant.kpi.bloc_taux_occupation_salle, 'le taux d\'occupation doit revenir exactement à sa valeur de départ après une vraie sortie');
    });

    await t.test('entreeSalle — refusé si aucune salle n\'est assignée au dossier (jamais une entrée fantôme)', async () => {
      const patient = await Patient.create({ nom: `T-ANLP5c-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const dossier = await DossierChirurgical.create({
        numero: `T-ANLP5c-${stamp}`, patient: patient._id, patient_nom: `T-ANLP5c-${stamp}`, statut: 'preoperatoire',
      });
      created.dossiers.push(dossier);

      const { status } = await call(blocC.entreeSalle, { params: { id: dossier._id.toString() }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' });
      assert.equal(status, 400, 'un dossier sans salle_prevue ne doit jamais pouvoir déclencher une entrée en salle réelle');
    });

    await t.test('sortieSalle — refusé si le dossier n\'est pas encore entré en salle (jamais une sortie fantôme)', async () => {
      const patient = await Patient.create({ nom: `T-ANLP5d-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const dossier = await DossierChirurgical.create({
        numero: `T-ANLP5d-${stamp}`, patient: patient._id, patient_nom: `T-ANLP5d-${stamp}`, statut: 'preoperatoire', salle_prevue: 'BO-2',
      });
      created.dossiers.push(dossier);

      const { status } = await call(blocC.sortieSalle, { params: { id: dossier._id.toString() }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' });
      assert.equal(status, 400, 'un dossier jamais entré en salle ne doit jamais pouvoir déclencher une sortie réelle');
    });
  } finally {
    for (const d of created.dossiers) await DossierChirurgical.findByIdAndDelete(d._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const a of created.ambulances) await Ambulance.findByIdAndDelete(a._id);
    for (const c of created.conversations) await Message.deleteMany({ conversation_id: c._id });
    for (const c of created.conversations) await Conversation.findByIdAndDelete(c._id);
    await mongoose.disconnect();
  }
});
