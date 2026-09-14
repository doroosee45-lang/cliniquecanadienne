// RX-EMPTY-003 (audit métier du 13 sept. 2026, Phase 4) — POST /prescriptions
// acceptait `lignes: []` (ou omis) sans aucun rejet : ni le schéma Mongoose
// ni le contrôleur ne vérifiaient la présence d'au moins un médicament
// réel — une ordonnance "brouillon"/"active" cliniquement vide était
// persistée avec un numero_rx valide. Seule la validation frontend
// (patient + diagnostic) existait, jamais la présence d'un médicament, et
// une protection frontend seule n'est jamais suffisante (contournable par
// un appel API direct).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('RX-EMPTY-003 — POST /prescriptions rejette réellement une ordonnance sans médicament (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Prescription = require('../models/Prescription');
  const prescC = require('../controllers/prescriptions.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Medecin' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `RXEMPTY-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    await t.test('lignes: [] est refusé (400), aucune ordonnance créée', async () => {
      const r = await call(prescC.create, { user, ip: '127.0.0.1', body: { patient: String(patient._id), diagnostic: 'Test RX-EMPTY-003', lignes: [] } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Prescription.countDocuments({ patient: patient._id });
      assert.equal(count, 0);
    });

    await t.test('lignes absent (omis) est refusé (400), aucune ordonnance créée', async () => {
      const r = await call(prescC.create, { user, ip: '127.0.0.1', body: { patient: String(patient._id), diagnostic: 'Test RX-EMPTY-003' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Prescription.countDocuments({ patient: patient._id });
      assert.equal(count, 0);
    });

    await t.test('lignes avec un seul élément vide (medicament_nom absent/blanc) est refusé (400)', async () => {
      const r = await call(prescC.create, { user, ip: '127.0.0.1', body: { patient: String(patient._id), diagnostic: 'Test RX-EMPTY-003', lignes: [{ medicament_nom: '   ', posologie: '1x/j' }] } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Prescription.countDocuments({ patient: patient._id });
      assert.equal(count, 0);
    });

    await t.test('scénario nominal — au moins un médicament réel est accepté (non-régression)', async () => {
      const r = await call(prescC.create, {
        user, ip: '127.0.0.1',
        body: { patient: String(patient._id), diagnostic: 'Test RX-EMPTY-003', lignes: [{ medicament_nom: 'Paracétamol', posologie: '1g x3/j', duree: '5 jours' }] },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Prescription.findByIdAndDelete(r.body.prescription._id));
      assert.equal(r.body.prescription.lignes.length, 1);
      assert.ok(r.body.prescription.numero_rx);
    });

    await t.test('non-régression — une ligne valide mélangée à une ligne vide reste acceptée (au moins une ligne réelle suffit)', async () => {
      const r = await call(prescC.create, {
        user, ip: '127.0.0.1',
        body: { patient: String(patient._id), diagnostic: 'Test RX-EMPTY-003', lignes: [{ medicament_nom: '' }, { medicament_nom: 'Ibuprofène', posologie: '400mg x2/j' }] },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Prescription.findByIdAndDelete(r.body.prescription._id));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
