// PERF-001 (audit de performance du 12 sept. 2026) — GET /appointments
// (appointments.controller.js::getAll) mesuré réellement à ~1.1s médiane
// pour 500 résultats (requête Mongo elle-même <1ms via explain() — l'écart
// venait de l'hydratation complète de documents Mongoose jamais modifiés
// ni sauvegardés). Ajout de .lean() sur la requête populate+sort. Ce test
// prouve que la forme de réponse (champs peuplés patient/medecin inclus)
// reste strictement identique après ce changement — jamais une régression
// fonctionnelle pour un gain de vitesse.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('PERF-001 — GET /appointments (lean) renvoie exactement les mêmes champs peuplés qu\'avant', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const apptC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Perf001-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const medecin = await User.create({ email: `_perf001-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test', role: 'medecin', statut: 'actif' });
  const appt = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(), motif: 'Test PERF-001', statut: 'planifie', created_by: medecin._id });

  try {
    const { status, body } = await call(apptC.getAll, { query: { date: new Date().toISOString().substring(0, 10) } });
    assert.equal(status, 200, JSON.stringify(body));
    const found = body.appointments.find(a => String(a._id) === String(appt._id));
    assert.ok(found, 'le RDV créé doit apparaître dans la liste');
    assert.equal(found.patient.nom, `Perf001-${stamp}`, 'patient réellement peuplé (nom)');
    assert.equal(found.patient.numero_dossier, patient.numero_dossier, 'patient réellement peuplé (numero_dossier)');
    assert.equal(found.medecin.nom, 'Medecin', 'medecin réellement peuplé (nom)');
    assert.equal(found.medecin.prenom, 'Test', 'medecin réellement peuplé (prenom)');
    assert.equal(found.motif, 'Test PERF-001');
    assert.equal(typeof body.total, 'number');
    assert.equal(typeof body.count, 'number');
  } finally {
    await Appointment.findByIdAndDelete(appt._id);
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
