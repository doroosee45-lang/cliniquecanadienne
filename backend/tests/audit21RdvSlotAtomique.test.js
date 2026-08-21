// AUDIT-2.1 — appointments.controller.js::create vérifiait l'absence de
// conflit (utils/helpers.js::checkAppointmentConflict) puis écrivait
// séparément : deux requêtes concurrentes sur le MÊME créneau exact pouvaient
// toutes deux passer la vérification avant que l'une n'ait écrit, produisant
// un double rendez-vous silencieux. Un index unique partiel
// (medecin+date_heure, limité aux statuts actifs) ferme désormais la course
// pour ce cas exact : la seconde écriture concurrente reçoit une erreur
// E11000, remontée en 409. Ce test prouve, sur une vraie course (Promise.all,
// pas séquentiel) : exactement un rendez-vous réussit sur N tentatives
// concurrentes pour le créneau identique, toutes les autres échouent
// explicitement (400 via la pré-vérification ou 409 via l'index selon
// l'ordre d'arrivée réel), et un seul document existe en base pour ce
// créneau au final — jamais de double réservation silencieuse.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 10;

test('AUDIT-2.1 — création de rendez-vous atomique sur créneau identique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const apptC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_t21-rdv-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T21', prenom: 'RdvMed', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const cleanup = [() => User.findByIdAndDelete(medecin._id)];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test(`${N} créations concurrentes sur le créneau identique du même médecin → exactement 1 réussit`, async () => {
      const patients = await Promise.all(Array.from({ length: N }, (_, i) =>
        Patient.create({ nom: `T21-Rdv-${stamp}`, prenom: `Concurrent${i}`, date_naissance: '1990-01-01', sexe: i % 2 ? 'F' : 'M' })
      ));
      cleanup.push(() => Patient.deleteMany({ _id: { $in: patients.map(p => p._id) } }));

      const dateHeure = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      const results = await Promise.all(patients.map(p => call(apptC.create, {
        body: { patient: p._id, medecin: medecin._id, date_heure: dateHeure, duree_minutes: 30, motif: 'Consultation concurrente' },
        user,
      })));
      cleanup.push(() => Appointment.deleteMany({ medecin: medecin._id }));

      const successes = results.filter(r => r.status === 201);
      const echecs    = results.filter(r => r.status === 400 || r.status === 409);
      assert.equal(successes.length, 1, `exactement 1 création doit réussir sur ${N} concurrentes pour le créneau identique, obtenu ${successes.length}`);
      assert.equal(echecs.length, N - 1, `les ${N - 1} autres doivent échouer explicitement (400 ou 409), obtenu ${echecs.length}`);

      const enBase = await Appointment.countDocuments({ medecin: medecin._id, date_heure: new Date(dateHeure) });
      assert.equal(enBase, 1, 'un seul rendez-vous doit exister en base pour ce créneau — jamais de double réservation silencieuse');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
