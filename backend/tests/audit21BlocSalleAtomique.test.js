// AUDIT-2.1 — blocoperatoireController.js n'avait aucune détection de
// conflit de salle/créneau : deux interventions pouvaient être programmées
// dans la même salle au même moment. checkBlocConflict() vérifie désormais
// l'absence de conflit avant l'écriture (sur le modèle de
// utils/helpers.js::checkAppointmentConflict), mais cette vérification n'est
// pas atomique avec l'écriture qui suit — un index unique partiel
// (salle_prevue+date_intervention_prev, modèle DossierChirurgical) ferme la
// course pour le cas exact (même salle, même créneau). Ce test prouve, sur
// une vraie course (Promise.all, pas séquentiel) : exactement une
// intervention réussit sur N tentatives concurrentes pour la salle et le
// créneau identiques, toutes les autres échouent explicitement (400 via la
// pré-vérification ou 409 via l'index selon l'ordre d'arrivée réel), et un
// seul dossier occupe réellement ce créneau en base au final.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 10;

test('AUDIT-2.1 — programmation de salle de bloc atomique sur créneau identique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const blocC = require('../controllers/blocoperatoireController');
  // AUDIT-0 (gap "base de test indépendante") — mongoose construit l'index
  // unique partiel (salle_prevue+date_intervention_prev) en arrière-plan,
  // sans bloquer : sur une base fraîchement créée (mongod local isolé,
  // toujours vide au premier accès), le lancer immédiatement des 10 requêtes
  // concurrentes ci-dessous pouvait s'exécuter AVANT que l'unicité ne soit
  // réellement appliquée, laissant passer plusieurs réussites au lieu d'une
  // seule. Invisible contre l'ancien cluster Atlas partagé (index déjà
  // construit depuis longtemps). Model.init() attend la fin de la
  // construction avant de continuer — même garde-fou ajouté à
  // server.js::bootstrap() pour la production.
  await DossierChirurgical.init();

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T21', nom: 'Bloc' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test(`${N} programmations concurrentes sur la salle et le créneau identiques → exactement 1 réussit`, async () => {
      const patients = await Promise.all(Array.from({ length: N }, (_, i) =>
        Patient.create({ nom: `T21-Bloc-${stamp}`, prenom: `Concurrent${i}`, date_naissance: '1990-01-01', sexe: i % 2 ? 'F' : 'M' })
      ));
      cleanup.push(() => Patient.deleteMany({ _id: { $in: patients.map(p => p._id) } }));

      const salle = `T21-Salle-${stamp}`;
      const dateHeureOp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      const results = await Promise.all(patients.map(p => call(blocC.createIntervention, {
        body: { patient_id: p._id, salle, date_heure_op: dateHeureOp, type_intervention: 'Test concurrence' },
        user,
      })));
      cleanup.push(() => DossierChirurgical.deleteMany({ patient_id: { $in: patients.map(p => p._id) } }));

      const successes = results.filter(r => r.status === 201);
      const echecs    = results.filter(r => r.status === 400 || r.status === 409);
      assert.equal(successes.length, 1, `exactement 1 programmation doit réussir sur ${N} concurrentes pour la salle/créneau identiques, obtenu ${successes.length}`);
      assert.equal(echecs.length, N - 1, `les ${N - 1} autres doivent échouer explicitement (400 ou 409), obtenu ${echecs.length}`);

      const enBase = await DossierChirurgical.countDocuments({
        salle_prevue: salle,
        date_intervention_prev: new Date(dateHeureOp),
        statut: { $in: ['preoperatoire', 'opere'] },
      });
      assert.equal(enBase, 1, 'un seul dossier ne doit occuper ce créneau de salle en base — jamais de double réservation silencieuse');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
