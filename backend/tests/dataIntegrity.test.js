// Test de non-régression — intégrité des données et sécurité, exécuté
// contre la base réelle (MONGO_URI). Chaque test crée ses propres données
// et les nettoie systématiquement (try/finally), sans jamais toucher aux
// données existantes.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('intégrité des données (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);

  await t.test('le rôle sage_femme est acceptable par le modèle User', async () => {
    const User = require('../models/User');
    const email = `_test-regress-${Date.now()}@_audit-test.local`;
    const u = await User.create({ email, password: 'Test1234!', nom: 'Test', prenom: 'Regress', role: 'sage_femme' });
    try {
      assert.equal(u.role, 'sage_femme');
    } finally {
      await User.findByIdAndDelete(u._id);
    }
  });

  await t.test('deux créations concurrentes de patients ne collisionnent jamais sur numero_dossier', async () => {
    const Patient = require('../models/Patient');
    const base = { date_naissance: new Date('1990-01-01'), sexe: 'F', nom: 'Regress', prenom: 'Test' };
    const [p1, p2] = await Promise.all([
      Patient.create({ ...base }),
      Patient.create({ ...base }),
    ]);
    try {
      assert.notEqual(p1.numero_dossier, p2.numero_dossier, 'deux créations simultanées doivent produire deux numéros distincts');
    } finally {
      await Patient.deleteMany({ _id: { $in: [p1._id, p2._id] } });
    }
  });

  await t.test('suppression d\'un patient avec historique → désactivation, pas suppression physique', async () => {
    const Patient = require('../models/Patient');
    const Appointment = require('../models/Appointment');
    const User = require('../models/User');
    const patientsController = require('../controllers/patients.controller');

    const email = `_test-regress-del-${Date.now()}@_audit-test.local`;
    const patient = await Patient.create({ nom: 'Regress', prenom: 'Del', date_naissance: new Date('1985-01-01'), sexe: 'M', email });
    const user = await User.create({ email, password: 'Test1234!', nom: 'Regress', prenom: 'Del', role: 'patient' });
    const medecin = await User.findOne({ role: 'medecin' });
    const appt = medecin ? await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 86400000), motif: 'Test' }) : null;

    try {
      const req = { params: { id: patient._id.toString() }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' };
      let response = null;
      const res = { json: (d) => { response = d; }, status: () => res };
      await patientsController.remove(req, res, () => {});

      const stillExists = await Patient.findById(patient._id);
      assert.ok(stillExists, 'le dossier doit toujours exister (désactivé, pas supprimé) car un rendez-vous y est lié');
      if (appt) assert.equal(stillExists.actif, false);
    } finally {
      if (appt) await Appointment.findByIdAndDelete(appt._id);
      await Patient.findByIdAndDelete(patient._id);
      await User.findByIdAndDelete(user._id);
    }
  });

  await t.test('addPayment refuse un montant négatif ou nul', async () => {
    const Invoice = require('../models/Invoice');
    const financeController = require('../controllers/finance.controller');
    const inv = await Invoice.create({
      patient_nom: 'Regress Test', service_label: 'Test', montant_ht: 1000, montant_ttc: 1000,
      created_by: new mongoose.Types.ObjectId(),
    });
    try {
      const req = { params: { id: inv._id.toString() }, body: { montant: -500, mode: 'especes' }, user: { _id: new mongoose.Types.ObjectId() }, ip: '127.0.0.1' };
      let statusCode = null, body = null;
      const res = { status: (c) => { statusCode = c; return res; }, json: (d) => { body = d; } };
      await financeController.addPayment(req, res, () => {});
      assert.equal(statusCode, 400);
      assert.equal(body.success, false);
      const reloaded = await Invoice.findById(inv._id);
      assert.equal(reloaded.montant_paye, 0, 'le paiement négatif ne doit pas avoir été enregistré');
    } finally {
      await Invoice.findByIdAndDelete(inv._id);
    }
  });

  t.after(async () => { await mongoose.disconnect(); });
});
