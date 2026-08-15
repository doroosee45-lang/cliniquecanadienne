// T2.3 — 20 créations simultanées d'un même modèle ne doivent produire aucun
// doublon de numéro. Testé sur Patient, Prescription et Invoice (les plus
// sollicités, comme demandé), contre la base réelle, données nettoyées après.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 20;

test('compteur atomique — 20 créations concurrentes, base réelle', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);

  await t.test(`${N} Patient créés en parallèle → ${N} numero_dossier distincts`, async () => {
    const Patient = require('../models/Patient');
    const base = { date_naissance: new Date('1990-01-01'), sexe: 'F', nom: 'ConcurrenceT23', prenom: 'Test' };
    const docs = await Promise.all(Array.from({ length: N }, () => Patient.create({ ...base })));
    try {
      const numeros = docs.map(d => d.numero_dossier);
      assert.equal(new Set(numeros).size, N, `attendu ${N} numéros distincts, obtenu ${new Set(numeros).size}`);
    } finally {
      await Patient.deleteMany({ _id: { $in: docs.map(d => d._id) } });
    }
  });

  await t.test(`${N} Prescription créées en parallèle → ${N} numero_rx distincts`, async () => {
    const Prescription = require('../models/Prescription');
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const medecin = (await User.findOne({ role: 'medecin' })) || { _id: new mongoose.Types.ObjectId() };
    const patient = (await Patient.findOne({})) || { _id: new mongoose.Types.ObjectId() };
    const docs = await Promise.all(Array.from({ length: N }, () =>
      Prescription.create({ patient: patient._id, medecin: medecin._id, lignes: [{ medicament_nom: 'Test', quantite: 1 }] })
    ));
    try {
      const numeros = docs.map(d => d.numero_rx);
      assert.equal(new Set(numeros).size, N, `attendu ${N} numéros distincts, obtenu ${new Set(numeros).size}`);
    } finally {
      await Prescription.deleteMany({ _id: { $in: docs.map(d => d._id) } });
    }
  });

  await t.test(`${N} Invoice créées en parallèle → ${N} numero_facture distincts`, async () => {
    const Invoice = require('../models/Invoice');
    const docs = await Promise.all(Array.from({ length: N }, () =>
      Invoice.create({ patient_nom: 'ConcurrenceT23', service_label: 'Test', montant_ht: 1000, montant_ttc: 1000, created_by: new mongoose.Types.ObjectId() })
    ));
    try {
      const numeros = docs.map(d => d.numero_facture);
      assert.equal(new Set(numeros).size, N, `attendu ${N} numéros distincts, obtenu ${new Set(numeros).size}`);
    } finally {
      await Invoice.deleteMany({ _id: { $in: docs.map(d => d._id) } });
    }
  });

  t.after(async () => { await mongoose.disconnect(); });
});
