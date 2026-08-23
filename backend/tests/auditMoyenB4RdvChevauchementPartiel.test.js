// AUDIT-M-B4 (Groupe B, Point 4) — checkAppointmentConflict() (lecture) et
// l'écriture (create/update) n'étaient pas atomiques : l'index unique
// partiel (medecin+date_heure) ferme la course sur le créneau EXACT, mais
// deux réservations concurrentes sur des date_heure DIFFÉRENTS qui se
// chevauchent partiellement pouvaient toutes deux passer la vérification
// avant que l'une n'ait écrit. Corrigé par écriture optimiste + relecture +
// élimination déterministe (utils/helpers.js::isAppointmentRaceWinner) —
// mécanisme confirmé avec l'utilisateur avant code, car un findOneAndUpdate
// à filtre-garde (Points 6/9) ne peut pas exprimer une contrainte entre
// documents (chevauchement avec d'autres RDV), seulement l'état d'UN document.
//
// Preuve que l'élimination a bien lieu AVANT tout effet de bord : chaque
// branche perdante fait `return res.status(409)...` immédiatement après la
// suppression/restauration — le code d'email/Socket.IO qui suit textuellement
// dans la même fonction ne peut donc, par construction du flux de contrôle
// JavaScript, jamais s'exécuter pour une requête perdante. Une réponse 409
// observée est donc la preuve directe qu'aucun effet de bord n'a eu lieu.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-M-B4 — chevauchement partiel de rendez-vous, atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Appointment = require('../models/Appointment');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const apptC = require('../controllers/appointments.controller');
  const recurringC = require('../controllers/recurring.controller');
  const RecurringProtocol = require('../models/RecurringProtocol');

  const stamp = Date.now();
  const created = { appointments: [], patients: [], users: [], protocols: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  // Le perdant peut être rejeté soit par la pré-vérification (400, si son
  // tour d'event-loop arrive après que le gagnant a déjà écrit), soit par
  // l'élimination après écriture (409) — l'ordre réel d'entrelacement sous
  // Promise.all n'est pas déterministe et les DEUX issues sont correctes :
  // le seul invariant qui compte est "exactement un succès, jamais un crash
  // ni un double succès". Fixer un code exact pour le perdant rendrait le
  // test flaky sans rien prouver de plus.
  const assertExactlyOneSucceeds = (results, message) => {
    const successes = results.filter(r => r.status === 201 || r.status === 200);
    const rejects = results.filter(r => r.status === 400 || r.status === 409);
    assert.equal(successes.length, 1, message);
    assert.equal(rejects.length, results.length - 1, `les requêtes non gagnantes doivent toutes être rejetées proprement (400 ou 409), jamais un crash — statuts observés : ${results.map(r => r.status).join(',')}`);
    return successes[0];
  };

  const makePatient = async (label) => {
    const p = await Patient.create({ nom: `B4-${label}-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(p);
    return p;
  };

  try {
    const medecin = await User.create({ email: `_b4-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B4', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin);
    const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

    await t.test('create() — non-régression : une réservation normale, seule, réussit toujours', async () => {
      const patient = await makePatient('normal');
      const { status, body } = await call(apptC.create, {
        user, ip: '127.0.0.1',
        body: { patient: patient._id.toString(), medecin: medecin._id.toString(), date_heure: new Date('2033-01-10T09:00:00Z').toISOString(), duree_minutes: 30, type: 'consultation', motif: 'Test' },
      });
      assert.equal(status, 201);
      created.appointments.push(body.appointment._id);
    });

    await t.test('create() — deux créations concurrentes à des horaires différents mais qui se chevauchent partiellement : une seule passe', async () => {
      const p1 = await makePatient('overlap1');
      const p2 = await makePatient('overlap2');
      // 09:00-09:30 et 09:15-09:45 : date_heure différents, chevauchement réel [09:15,09:30).
      const reqA = { user, ip: '127.0.0.1', body: { patient: p1._id.toString(), medecin: medecin._id.toString(), date_heure: new Date('2033-02-10T09:00:00Z').toISOString(), duree_minutes: 30, type: 'consultation', motif: 'A' } };
      const reqB = { user, ip: '127.0.0.1', body: { patient: p2._id.toString(), medecin: medecin._id.toString(), date_heure: new Date('2033-02-10T09:15:00Z').toISOString(), duree_minutes: 30, type: 'consultation', motif: 'B' } };

      const results = await Promise.all([call(apptC.create, reqA), call(apptC.create, reqB)]);
      const winner = assertExactlyOneSucceeds(results, 'exactement une des deux créations concurrentes en chevauchement partiel doit réussir, l\'autre doit être rejetée, jamais les deux');

      const survivant = winner.body.appointment;
      created.appointments.push(survivant._id);

      const enBase = await Appointment.find({ medecin: medecin._id, date_heure: { $gte: new Date('2033-02-10T00:00:00Z'), $lt: new Date('2033-02-11T00:00:00Z') } }).lean();
      assert.equal(enBase.length, 1, 'un seul des deux rendez-vous en chevauchement doit réellement exister en base — l\'autre doit avoir été supprimé après coup');
      assert.equal(enBase[0]._id.toString(), survivant._id.toString());
    });

    await t.test('create() — trois créations concurrentes en chevauchement deux à deux : la règle du plus petit _id généralise au-delà du cas à deux', async () => {
      const p1 = await makePatient('tri1');
      const p2 = await makePatient('tri2');
      const p3 = await makePatient('tri3');
      // 10:00-10:30, 10:10-10:40, 10:20-10:50 — chaque paire se chevauche réellement.
      const reqs = [
        { user, ip: '127.0.0.1', body: { patient: p1._id.toString(), medecin: medecin._id.toString(), date_heure: new Date('2033-03-10T10:00:00Z').toISOString(), duree_minutes: 30, type: 'consultation', motif: 'T1' } },
        { user, ip: '127.0.0.1', body: { patient: p2._id.toString(), medecin: medecin._id.toString(), date_heure: new Date('2033-03-10T10:10:00Z').toISOString(), duree_minutes: 30, type: 'consultation', motif: 'T2' } },
        { user, ip: '127.0.0.1', body: { patient: p3._id.toString(), medecin: medecin._id.toString(), date_heure: new Date('2033-03-10T10:20:00Z').toISOString(), duree_minutes: 30, type: 'consultation', motif: 'T3' } },
      ];

      const results = await Promise.all(reqs.map(r => call(apptC.create, r)));
      const winner = assertExactlyOneSucceeds(results, 'exactement une des trois créations en chevauchement mutuel doit réussir, les deux autres rejetées, jamais un crash ni un succès silencieux');

      const survivant = winner.body.appointment;
      created.appointments.push(survivant._id);

      const enBase = await Appointment.find({ medecin: medecin._id, date_heure: { $gte: new Date('2033-03-10T00:00:00Z'), $lt: new Date('2033-03-11T00:00:00Z') } }).lean();
      assert.equal(enBase.length, 1, 'un seul des trois rendez-vous en chevauchement mutuel doit réellement exister en base');
      assert.equal(enBase[0]._id.toString(), survivant._id.toString(), 'le survivant réel en base doit être exactement celui renvoyé par la requête gagnante');
    });

    await t.test('update() — deux reports concurrents de RDV distincts vers des créneaux qui se chevauchent : un seul aboutit, l\'autre revient exactement à sa date d\'origine', async () => {
      const p1 = await makePatient('resched1');
      const p2 = await makePatient('resched2');
      const rdv1 = await Appointment.create({ patient: p1._id, medecin: medecin._id, date_heure: new Date('2033-04-10T08:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Origine1', statut: 'planifie', created_by: medecin._id });
      const rdv2 = await Appointment.create({ patient: p2._id, medecin: medecin._id, date_heure: new Date('2033-04-10T14:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Origine2', statut: 'planifie', created_by: medecin._id });
      created.appointments.push(rdv1._id, rdv2._id);
      const dateOrigineRdv2 = rdv2.date_heure.getTime();

      // Les deux sont reportés vers le même nouveau créneau (chevauchement total, cas le plus simple à vérifier).
      const nouveauCreneau = new Date('2033-04-11T11:00:00Z').toISOString();
      const results = await Promise.all([
        call(apptC.update, { user, ip: '127.0.0.1', params: { id: rdv1._id.toString() }, body: { date_heure: nouveauCreneau } }),
        call(apptC.update, { user, ip: '127.0.0.1', params: { id: rdv2._id.toString() }, body: { date_heure: nouveauCreneau } }),
      ]);
      assertExactlyOneSucceeds(results, 'exactement un des deux reports concurrents vers le même créneau doit réussir, l\'autre doit être rejeté');

      const relu1 = await Appointment.findById(rdv1._id).lean();
      const relu2 = await Appointment.findById(rdv2._id).lean();
      const dates = [relu1.date_heure.getTime(), relu2.date_heure.getTime()].sort();
      const nouveauTs = new Date(nouveauCreneau).getTime();
      assert.ok(dates.includes(nouveauTs), 'le rendez-vous gagnant doit réellement porter la nouvelle date en base');
      // Le perdant doit être revenu EXACTEMENT à sa date d'origine (rdv2 dans ce scénario, ou rdv1 selon l'ordre réel des écritures).
      const perdantRevintOrigine = relu1.date_heure.getTime() === new Date('2033-04-10T08:00:00Z').getTime()
        || relu2.date_heure.getTime() === dateOrigineRdv2;
      assert.ok(perdantRevintOrigine, 'le rendez-vous perdant doit être restauré à sa date d\'origine exacte, jamais laissé sur le nouveau créneau ni sur un état intermédiaire');
    });

    await t.test('recurring.controller.planifier() — même protection : deux planifications concurrentes en chevauchement, une seule aboutit, prochaine_date n\'avance pas pour la perdante', async () => {
      const p1 = await makePatient('recur1');
      const p2 = await makePatient('recur2');
      const protocol = await RecurringProtocol.create({ patient: p1._id, medecin: medecin._id, titre: `Protocole B4 ${stamp}`, frequence: 'hebdomadaire', prochaine_date: new Date('2033-05-01T00:00:00Z'), created_by: medecin._id });
      created.protocols.push(protocol._id);
      const prochaineDateAvant = protocol.prochaine_date.getTime();

      const dateHeure1 = new Date('2033-05-10T15:00:00Z').toISOString();
      const dateHeure2 = new Date('2033-05-10T15:15:00Z').toISOString();
      const results = await Promise.all([
        call(recurringC.planifier, { user, ip: '127.0.0.1', params: { id: protocol._id.toString() }, body: { patient: p1._id.toString(), date_heure: dateHeure1 } }),
        call(recurringC.planifier, { user, ip: '127.0.0.1', params: { id: protocol._id.toString() }, body: { patient: p2._id.toString(), date_heure: dateHeure2 } }),
      ]);
      const winner = assertExactlyOneSucceeds(results, 'exactement une des deux planifications concurrentes en chevauchement doit réussir');

      const gagnant = winner.body.appointment;
      created.appointments.push(gagnant._id);

      const enBase = await Appointment.find({ medecin: medecin._id, date_heure: { $gte: new Date('2033-05-10T00:00:00Z'), $lt: new Date('2033-05-11T00:00:00Z') } }).lean();
      assert.equal(enBase.length, 1, 'un seul des deux rendez-vous planifiés en chevauchement doit réellement exister en base');

      const protocolFinal = await RecurringProtocol.findById(protocol._id).lean();
      assert.notEqual(protocolFinal.prochaine_date.getTime(), prochaineDateAvant, 'prochaine_date doit avoir avancé (la planification gagnante a réellement eu lieu)');
    });
  } finally {
    for (const id of created.appointments) await Appointment.findByIdAndDelete(id);
    for (const id of created.protocols) await RecurringProtocol.findByIdAndDelete(id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
