// RDV-CONSULT-002 (audit métier du 13 sept. 2026, Phase 4) — un rendez-vous
// marqué "Terminé" (Appointments.jsx) ne menait jamais à la création d'une
// Consultation liée : Consultation.appointment existe au schéma et le
// contrôleur le lisait déjà (buildConsultationFields), mais AUCUN mécanisme
// (navigation, state, query param) ne le peuplait jamais depuis le flux réel
// — confirmé par une recherche exhaustive de "appointment" dans
// Consultations.jsx (0 occurrence) avant ce correctif, et par le seul test
// qui peuplait ce champ (auditFaibleG3AppointmentRemoveDetach.test.js) le
// faisant artificiellement, sans jamais passer par le contrôleur.
//
// Corrigé par : (1) Appointments.jsx expose désormais un bouton "📋 Créer
// la consultation" sur un RDV "termine", qui navigue vers Consultations.jsx
// avec patient_id/appointment_id en état de navigation (même pattern que
// Urgences.jsx → Hospitalization.jsx) ; (2) consultations.controller.js::
// create() valide désormais `appointment` quand il est fourni : doit
// référencer un vrai Appointment DU MÊME patient, et ne peut être lié qu'à
// UNE seule Consultation (jamais de duplication).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('RDV-CONSULT-002 — Consultation.appointment réellement validé et lié (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Appointment = require('../models/Appointment');
  const Consultation = require('../models/Consultation');
  const consultC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const medecin = { _id: new mongoose.Types.ObjectId(), prenom: 'Doc', nom: 'Test', role: 'medecin' };
  const cleanup = [];
  const patientCleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const mkPatient = async (suffix) => {
    const p = await Patient.create({ nom: `RDV-C002-${suffix}-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    patientCleanup.push(() => Patient.findByIdAndDelete(p._id));
    return p;
  };
  const mkAppt = async (patient, suffix) => {
    const a = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(), motif: `RDV-C002-${suffix}`, statut: 'termine', created_by: medecin._id });
    cleanup.push(() => Appointment.findByIdAndDelete(a._id));
    return a;
  };

  try {
    await t.test('scénario nominal — RDV "terminé" du bon patient → consultation créée, réellement liée, retrouvable', async () => {
      const patient = await mkPatient('nominal');
      const appt = await mkAppt(patient, 'nominal');

      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id, appointment: appt._id, service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      cleanup.push(() => Consultation.findByIdAndDelete(body.consultation._id));

      const fresh = await Consultation.findById(body.consultation._id).lean();
      assert.equal(String(fresh.appointment), String(appt._id), 'la référence doit être réellement persistée, pas seulement acceptée en entrée');

      const found = await Consultation.findOne({ appointment: appt._id }).lean();
      assert.ok(found, 'la consultation doit être retrouvable par sa référence au rendez-vous (preuve d\'une vraie liaison en base, pas cosmétique)');
    });

    await t.test('non-régression — création SANS appointment (cas majoritaire) continue de fonctionner à l\'identique', async () => {
      const patient = await mkPatient('sans-rdv');
      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id, service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      cleanup.push(() => Consultation.findByIdAndDelete(body.consultation._id));
      const fresh = await Consultation.findById(body.consultation._id).lean();
      assert.equal(fresh.appointment, undefined, 'aucune référence ne doit être fabriquée quand aucun rendez-vous n\'est fourni');
    });

    await t.test('appointment fabriqué/orphelin → refusé (404), aucune consultation créée', async () => {
      const patient = await mkPatient('orphelin');
      const fauxId = new mongoose.Types.ObjectId();
      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id, appointment: fauxId, service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 404);
      const count = await Consultation.countDocuments({ patient: patient._id });
      assert.equal(count, 0, 'aucune consultation ne doit être créée sur un rendez-vous fabriqué');
    });

    await t.test('appointment mal formé (pas un ObjectId) → refusé (400)', async () => {
      const patient = await mkPatient('malforme');
      const { status } = await call(consultC.create, {
        body: { patient: patient._id, appointment: 'pas-un-objectid', service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 400);
      const count = await Consultation.countDocuments({ patient: patient._id });
      assert.equal(count, 0);
    });

    await t.test('appointment appartenant à un AUTRE patient → refusé (400), aucune consultation créée, aucune association incohérente', async () => {
      const patientA = await mkPatient('A');
      const patientB = await mkPatient('B');
      const apptDeA = await mkAppt(patientA, 'cross-patient');

      const { status, body } = await call(consultC.create, {
        body: { patient: patientB._id, appointment: apptDeA._id, service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 400);
      assert.match(body.message, /n'appartient pas/i);
      const countB = await Consultation.countDocuments({ patient: patientB._id });
      assert.equal(countB, 0, 'aucune consultation incohérente (patient B, rendez-vous de A) ne doit exister');
      const stillFreeForA = await Consultation.countDocuments({ appointment: apptDeA._id });
      assert.equal(stillFreeForA, 0, 'le rendez-vous de A ne doit pas non plus se retrouver lié par erreur');
    });

    await t.test('un rendez-vous déjà lié à une consultation → une seconde tentative est refusée (409), pas de duplication', async () => {
      const patient = await mkPatient('duplication');
      const appt = await mkAppt(patient, 'duplication');

      const r1 = await call(consultC.create, {
        body: { patient: patient._id, appointment: appt._id, service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(r1.status, 201, JSON.stringify(r1.body));
      cleanup.push(() => Consultation.findByIdAndDelete(r1.body.consultation._id));

      const r2 = await call(consultC.create, {
        body: { patient: patient._id, appointment: appt._id, service: 'Médecine générale', statut: 'terminee' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(r2.status, 409);

      const count = await Consultation.countDocuments({ appointment: appt._id });
      assert.equal(count, 1, 'un même rendez-vous ne doit jamais produire deux consultations liées');
    });
  } finally {
    for (const fn of cleanup) await fn();
    for (const fn of patientCleanup) await fn();
    await mongoose.disconnect();
  }
});
