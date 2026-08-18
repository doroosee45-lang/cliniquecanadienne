// AUDIT-P7-6 — appointments.controller.js::create vérifiait un conflit de
// créneau, mais update() (report/réassignation d'un RDV existant) et
// recurring.controller.js::planifier() (nouvelle occurrence d'un protocole
// récurrent) ne vérifiaient rien du tout : les deux pouvaient produire un
// double-booking silencieux du même médecin. Factorisé en
// utils/helpers.js::checkAppointmentConflict, réutilisé aux trois endroits.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P7-6 — conflit de créneau vérifié sur report de RDV et planification récurrente (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const apptC = require('../controllers/appointments.controller');
  const recC  = require('../controllers/recurring.controller');
  const Appointment = require('../models/Appointment');
  const RecurringProtocol = require('../models/RecurringProtocol');
  const Patient = require('../models/Patient');
  const User = require('../models/User');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_p76-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'P76', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const patient = await Patient.create({ nom: `P76-${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M' });
  const cleanup = [() => User.findByIdAndDelete(medecin._id), () => Patient.findByIdAndDelete(patient._id)];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test("update() — reporter un RDV sur un créneau déjà pris par le même médecin est refusé", async () => {
      const fixe = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date('2027-03-10T10:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Test P7-6', statut: 'planifie' });
      cleanup.push(() => Appointment.findByIdAndDelete(fixe._id));
      const aReporter = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date('2027-03-10T14:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Test P7-6', statut: 'planifie' });
      cleanup.push(() => Appointment.findByIdAndDelete(aReporter._id));

      const { status, body } = await call(apptC.update, { params: { id: aReporter._id }, body: { date_heure: '2027-03-10T10:15:00Z' }, user });
      assert.equal(status, 400);
      assert.match(body.message, /Conflit/);

      const fresh = await Appointment.findById(aReporter._id);
      assert.equal(fresh.date_heure.toISOString(), aReporter.date_heure.toISOString(), 'le RDV ne doit pas avoir bougé après un refus');
    });

    await t.test("update() — reporter vers un créneau libre réussit toujours", async () => {
      const rdv = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date('2027-03-11T09:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Test P7-6', statut: 'planifie' });
      cleanup.push(() => Appointment.findByIdAndDelete(rdv._id));

      const { status } = await call(apptC.update, { params: { id: rdv._id }, body: { date_heure: '2027-03-11T16:00:00Z' }, user });
      assert.equal(status, 200);
      const fresh = await Appointment.findById(rdv._id);
      assert.equal(fresh.date_heure.toISOString(), new Date('2027-03-11T16:00:00Z').toISOString());
    });

    await t.test("update() — modifier un RDV SANS toucher au créneau (ex: statut) ne se bloque jamais contre lui-même", async () => {
      const rdv = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date('2027-03-12T09:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Test P7-6', statut: 'planifie' });
      cleanup.push(() => Appointment.findByIdAndDelete(rdv._id));

      const { status, body } = await call(apptC.update, { params: { id: rdv._id }, body: { statut: 'confirme' }, user });
      assert.equal(status, 200);
      assert.equal(body.appointment.statut, 'confirme');
    });

    await t.test("recurring.controller.planifier() — occurrence sur un créneau déjà pris par le médecin du protocole est refusée", async () => {
      const fixe = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date('2027-03-15T11:00:00Z'), duree_minutes: 30, type: 'consultation', motif: 'Test P7-6', statut: 'planifie' });
      cleanup.push(() => Appointment.findByIdAndDelete(fixe._id));
      const protocol = await RecurringProtocol.create({ titre: 'Suivi P76', medecin: medecin._id, frequence: 'mensuel', prochaine_date: new Date('2027-03-15T11:00:00Z'), created_by: medecin._id });
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(protocol._id));

      const { status, body } = await call(recC.planifier, { params: { id: protocol._id }, body: { patient: patient._id, date_heure: '2027-03-15T11:15:00Z' }, user });
      assert.equal(status, 400);
      assert.match(body.message, /Conflit/);

      const count = await Appointment.countDocuments({ patient: patient._id, motif: 'Suivi P76' });
      assert.equal(count, 0, "aucun rendez-vous ne doit avoir été créé en cas de conflit");
    });

    await t.test("recurring.controller.planifier() — occurrence sur un créneau libre réussit et avance prochaine_date", async () => {
      const protocol = await RecurringProtocol.create({ titre: 'Suivi P76 libre', medecin: medecin._id, frequence: 'hebdomadaire', prochaine_date: new Date('2027-03-20T08:00:00Z'), created_by: medecin._id });
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(protocol._id));

      const { status, body } = await call(recC.planifier, { params: { id: protocol._id }, body: { patient: patient._id, date_heure: '2027-03-20T08:00:00Z' }, user });
      assert.equal(status, 201);
      cleanup.push(() => Appointment.findByIdAndDelete(body.appointment._id));

      const freshProtocol = await RecurringProtocol.findById(protocol._id);
      assert.ok(freshProtocol.prochaine_date.getTime() > new Date('2027-03-20T08:00:00Z').getTime(), 'prochaine_date doit avancer après planification réussie');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
