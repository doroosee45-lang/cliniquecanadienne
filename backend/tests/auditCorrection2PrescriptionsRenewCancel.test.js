// Correction 2 (relecture du 6 sept. 2026, FE-BUG-004) — "Nouvelle date
// d'expiration"/"Note de renouvellement" (modale renouvellement) et "Motif
// d'annulation" (modale annulation) étaient saisis dans Prescriptions.jsx
// mais jamais transmis : renewOrd()/cancelOrd() postaient sans body utile,
// et aucun champ n'existait même dans le schéma Prescription pour les
// recevoir. Bug annexe corrigé au passage (nécessaire pour que la date
// choisie ne soit pas ignorée) : le hook pre('save') écrasait
// inconditionnellement date_expiration à +30 jours, même quand renouveler()
// la posait déjà — même bug déjà corrigé sur Invoice.date_echeance (T5.2).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 2 — renouvellement/annulation persistent réellement les valeurs saisies', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Prescription = require('../models/Prescription');
  const rxC = require('../controllers/prescriptions.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], prescriptions: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction2-rx-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction2', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const patient = await Patient.create({ nom: `T-CORRECTION2-RX-${stamp}`, prenom: 'P', date_naissance: '1985-01-01', sexe: 'F' });
    created.patients.push(patient._id);

    const original = await Prescription.create({ patient: patient._id, medecin: medecin._id, lignes: [{ medicament_nom: 'Test Med', posologie: '1cp/j', duree: '10j' }], statut: 'active' });
    created.prescriptions.push(original._id);

    await t.test('renouveler() — date d\'expiration choisie et note réellement persistées, jamais +30j imposé', async () => {
      const dateChoisie = '2027-01-15';
      const { status, body } = await call(rxC.renouveler, {
        params: { id: original._id.toString() },
        body: { date_expiration: dateChoisie, note: 'Renouvellement test Correction2' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.prescriptions.push(body.prescription._id);

      const fresh = await Prescription.findById(body.prescription._id).lean();
      assert.equal(new Date(fresh.date_expiration).toISOString().substring(0, 10), dateChoisie, 'la date choisie par l\'utilisateur doit être exactement celle persistée, jamais +30 jours imposés par le hook');
      assert.equal(fresh.note_renouvellement, 'Renouvellement test Correction2');
    });

    await t.test('LIMITE — renouveler() sans date fournie → le défaut +30 jours legitime s\'applique toujours', async () => {
      const { status, body } = await call(rxC.renouveler, {
        params: { id: original._id.toString() }, body: {}, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.prescriptions.push(body.prescription._id);
      const fresh = await Prescription.findById(body.prescription._id).lean();
      const diffJours = Math.round((new Date(fresh.date_expiration) - new Date(fresh.createdAt)) / 86400000);
      assert.ok(diffJours >= 29 && diffJours <= 31, `attendu ~30 jours, obtenu ${diffJours}`);
      assert.equal(fresh.note_renouvellement, undefined);
    });

    await t.test('cancel() — motif d\'annulation réellement persisté', async () => {
      const toCancel = await Prescription.create({ patient: patient._id, medecin: medecin._id, lignes: [{ medicament_nom: 'Test Med 2' }], statut: 'active' });
      created.prescriptions.push(toCancel._id);

      const { status, body } = await call(rxC.cancel, {
        params: { id: toCancel._id.toString() }, body: { motif: 'Contre-indication découverte — test Correction2' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      const fresh = await Prescription.findById(toCancel._id).lean();
      assert.equal(fresh.statut, 'annulee');
      assert.equal(fresh.motif_annulation, 'Contre-indication découverte — test Correction2');
    });
  } finally {
    await Prescription.deleteMany({ _id: { $in: created.prescriptions } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
