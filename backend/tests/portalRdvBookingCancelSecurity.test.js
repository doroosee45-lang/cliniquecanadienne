// PORTAL-RDV-001 (audit du 12 sept. 2026, mission "Correction et vérification
// complète du portail patient") — Portal.jsx n'avait aucune prise de
// rendez-vous ni annulation fonctionnelle (AUDIT-11 : la modale ne postait
// vers aucune route réelle). Ajout de POST /portal/appointments et
// PUT /portal/appointments/:id/cancel, réutilisant les mêmes garanties
// anti-conflit que le personnel (checkAppointmentConflict/
// isAppointmentRaceWinner, utils/helpers.js — jamais une seconde logique de
// détection de créneau). Ce test couvre en particulier la règle de sécurité
// obligatoire de la mission (section 12) : un patient A ne doit jamais
// pouvoir agir sur les données/rendez-vous d'un patient B, même en
// fournissant son propre identifiant ou celui d'un tiers.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Prise de RDV et annulation patient (portal.controller.js) — fonctionnel + sécurité inter-patients', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient     = require('../models/Patient');
  const User        = require('../models/User');
  const Service     = require('../models/Service');
  const Appointment = require('../models/Appointment');
  const portalC     = require('../controllers/portal.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patientA = await Patient.create({ nom: `PortalRdvA-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const patientB = await Patient.create({ nom: `PortalRdvB-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-05-05' });
  const userA = await User.create({ email: `_portalrdv-a-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientA._id });
  const userB = await User.create({ email: `_portalrdv-b-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientB._id });
  const medecin = await User.create({ email: `_portalrdv-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test', role: 'medecin', statut: 'actif' });
  const medecinInactif = await User.create({ email: `_portalrdv-medinactif-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Inactif', prenom: 'Test', role: 'medecin', statut: 'inactif' });
  const service = await Service.create({ nom: `Service Portal RDV ${stamp}`, statut: 'actif' });
  const createdAppts = [];

  try {
    await t.test('getBookingOptions — expose uniquement des services/médecins actifs, champs patient-safe', async () => {
      const { status, body } = await call(portalC.getBookingOptions, { user: userA });
      assert.equal(status, 200);
      assert.ok(body.services.some(s => String(s._id) === String(service._id)));
      assert.ok(body.medecins.some(m => String(m._id) === String(medecin._id)));
      assert.ok(!body.medecins.some(m => String(m._id) === String(medecinInactif._id)), 'un médecin inactif ne doit jamais être proposé à la prise de RDV');
      const m = body.medecins.find(m => String(m._id) === String(medecin._id));
      assert.equal(m.password, undefined, 'jamais le hash de mot de passe exposé au patient');
      assert.equal(m.email, undefined, 'jamais l\'email interne du médecin exposé au patient');
      assert.equal(m.tentatives_echouees, undefined);
    });

    await t.test('createAppointment — persiste réellement, statut en_attente, apparaît ensuite dans getAppointments', async () => {
      const date_heure = new Date(Date.now() + 3600_000).toISOString();
      const { status, body } = await call(portalC.createAppointment, {
        user: userA, ip: '127.0.0.1',
        body: { medecin: medecin._id, service: service._id, date_heure, motif: 'Contrôle de routine' },
      });
      assert.equal(status, 201, JSON.stringify(body));
      createdAppts.push(body.appointment._id);
      assert.equal(body.appointment.statut, 'en_attente');
      assert.equal(String(body.appointment.patient), String(patientA._id));

      const { body: listBody } = await call(portalC.getAppointments, { user: userA });
      assert.ok(listBody.appointments.some(a => String(a._id) === String(body.appointment._id)), 'le RDV créé doit réellement apparaître dans "Mes RDV"');
    });

    await t.test('SÉCURITÉ — un patient ne peut jamais réserver pour un autre patient, même en fournissant son _id', async () => {
      const date_heure = new Date(Date.now() + 5 * 3600_000).toISOString();
      const { status, body } = await call(portalC.createAppointment, {
        user: userA, ip: '127.0.0.1',
        // patient B injecté explicitement par le "client" — doit être ignoré.
        body: { patient: patientB._id, medecin: medecin._id, date_heure, motif: 'Tentative de réservation pour un tiers' },
      });
      assert.equal(status, 201, JSON.stringify(body));
      createdAppts.push(body.appointment._id);
      assert.equal(String(body.appointment.patient), String(patientA._id), 'le champ patient fourni par le client doit toujours être ignoré au profit du patient réellement connecté');
    });

    await t.test('validation — médecin invalide, motif manquant, date passée sont rejetés (400)', async () => {
      const now = new Date(Date.now() + 3_600_000).toISOString();
      let r = await call(portalC.createAppointment, { user: userA, ip: '127.0.0.1', body: { medecin: 'not-an-id', date_heure: now, motif: 'x' } });
      assert.equal(r.status, 400);
      r = await call(portalC.createAppointment, { user: userA, ip: '127.0.0.1', body: { medecin: medecin._id, date_heure: now, motif: '' } });
      assert.equal(r.status, 400);
      r = await call(portalC.createAppointment, { user: userA, ip: '127.0.0.1', body: { medecin: medecin._id, date_heure: new Date(Date.now() - 3600_000).toISOString(), motif: 'x' } });
      assert.equal(r.status, 400);
      r = await call(portalC.createAppointment, { user: userA, ip: '127.0.0.1', body: { medecin: medecinInactif._id, date_heure: now, motif: 'x' } });
      assert.equal(r.status, 404, 'un médecin inactif ne doit jamais être bookable');
    });

    await t.test('conflit de créneau réel — refuse un second RDV au même médecin, même horaire exact', async () => {
      const date_heure = new Date(Date.now() + 48 * 3600_000).toISOString();
      const first = await call(portalC.createAppointment, { user: userA, ip: '127.0.0.1', body: { medecin: medecin._id, date_heure, motif: 'Premier RDV' } });
      assert.equal(first.status, 201, JSON.stringify(first.body));
      createdAppts.push(first.body.appointment._id);

      const second = await call(portalC.createAppointment, { user: userB, ip: '127.0.0.1', body: { medecin: medecin._id, date_heure, motif: 'Second RDV, même créneau' } });
      assert.equal(second.status, 400, 'le même médecin ne peut pas avoir deux RDV actifs sur le même créneau');
    });

    await t.test('SÉCURITÉ CRITIQUE (section 12) — patient A ne peut pas annuler un RDV appartenant à patient B', async () => {
      const date_heure = new Date(Date.now() + 72 * 3600_000).toISOString();
      const { body: apptB } = await call(portalC.createAppointment, { user: userB, ip: '127.0.0.1', body: { medecin: medecin._id, date_heure, motif: 'RDV de B' } });
      createdAppts.push(apptB.appointment._id);

      const { status, body } = await call(portalC.cancelAppointment, { user: userA, ip: '127.0.0.1', params: { id: apptB.appointment._id } });
      assert.equal(status, 403, JSON.stringify(body));

      const stillActive = await Appointment.findById(apptB.appointment._id).lean();
      assert.equal(stillActive.statut, 'en_attente', 'le RDV de B ne doit subir aucune modification suite à la tentative illégitime de A');
    });

    await t.test('annulation légitime — le patient annule bien son propre RDV, statut passe à annule', async () => {
      const date_heure = new Date(Date.now() + 96 * 3600_000).toISOString();
      const { body: appt } = await call(portalC.createAppointment, { user: userA, ip: '127.0.0.1', body: { medecin: medecin._id, date_heure, motif: 'À annuler' } });
      createdAppts.push(appt.appointment._id);

      const { status, body } = await call(portalC.cancelAppointment, { user: userA, ip: '127.0.0.1', params: { id: appt.appointment._id } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.appointment.statut, 'annule');

      const fresh = await Appointment.findById(appt.appointment._id).lean();
      assert.equal(fresh.statut, 'annule');
    });

    await t.test('un RDV déjà passé ne peut plus être annulé', async () => {
      const passe = await Appointment.create({ patient: patientA._id, medecin: medecin._id, date_heure: new Date(Date.now() - 24 * 3600_000), motif: 'Ancien RDV', statut: 'termine', created_by: userA._id });
      createdAppts.push(passe._id);
      const { status } = await call(portalC.cancelAppointment, { user: userA, ip: '127.0.0.1', params: { id: passe._id } });
      assert.equal(status, 400);
    });
  } finally {
    await Appointment.deleteMany({ _id: { $in: createdAppts } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id, medecin._id, medecinInactif._id] } });
    await Patient.deleteMany({ _id: { $in: [patientA._id, patientB._id] } });
    await Service.findByIdAndDelete(service._id);
    await mongoose.disconnect();
  }
});
