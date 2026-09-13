// PAT-TOGGLE-001 (audit métier du 13 sept. 2026, Phase 4) — le bouton
// Activer/Désactiver (Patients.jsx::handleToggleActifPanel,
// PatientDetail.jsx::handleToggleActif) affichait un succès mais ne
// persistait jamais rien : les deux appelaient PUT /patients/:id (update
// générique), dont actif/statut sont volontairement filtrés
// (PATIENT_BLOCKED_FIELDS, AUDIT-P2-1) pour empêcher CAN_WRITE de
// contourner le circuit d'activation portail. Ce test prouve, contre la
// base réelle : (1) que PUT /:id continue bien à ignorer silencieusement
// ces deux champs (comportement existant, volontaire — non-régression),
// (2) que la nouvelle route dédiée PUT /:id/toggle-actif persiste
// réellement le changement dans les deux sens, désactive/réactive le
// compte portail lié en cohérence, et refuse une désactivation si le
// patient occupe actuellement un lit (même garde que remove()).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('PAT-TOGGLE-001 — activer/désactiver un dossier patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Room = require('../models/Room');
  const patientsC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Toggle', nom: 'Test' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('non-régression — PUT /:id générique (update) continue d\'ignorer actif/statut', async () => {
      const p = await Patient.create({ nom: `T-TOGGLE-A-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', actif: true, statut: 'actif' });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      await call(patientsC.update, { params: { id: p._id }, body: { actif: false, statut: 'inactif' }, user: admin, ip: '127.0.0.1' });
      const fresh = await Patient.findById(p._id).lean();
      assert.equal(fresh.actif, true, 'update() générique ne doit toujours pas pouvoir toucher actif');
      assert.equal(fresh.statut, 'actif', 'update() générique ne doit toujours pas pouvoir toucher statut');
    });

    await t.test('toggle-actif — désactivation réelle : actif/statut persistés, compte portail lié bloqué', async () => {
      const p = await Patient.create({ nom: `T-TOGGLE-B-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', actif: true, statut: 'actif', email: `_t-toggle-b-${stamp}@_test.local` });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      const user = await User.create({ email: p.email, password: 'Xx1aaaaa', nom: p.nom, prenom: p.prenom, role: 'patient', statut: 'actif', patient_id: p._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(patientsC.toggleActif, { params: { id: p._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.patient.actif, false);
      assert.equal(body.patient.statut, 'inactif');

      const freshPatient = await Patient.findById(p._id).lean();
      assert.equal(freshPatient.actif, false, 'doit être réellement persisté en base');
      assert.equal(freshPatient.statut, 'inactif');
      const freshUser = await User.findById(user._id).lean();
      assert.equal(freshUser.statut, 'inactif', 'le compte portail lié doit être bloqué en cohérence');
    });

    await t.test('toggle-actif — réactivation réelle depuis un dossier désactivé : actif/statut persistés, compte portail réactivé', async () => {
      const p = await Patient.create({ nom: `T-TOGGLE-C-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', actif: false, statut: 'inactif', email: `_t-toggle-c-${stamp}@_test.local` });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      const user = await User.create({ email: p.email, password: 'Xx1aaaaa', nom: p.nom, prenom: p.prenom, role: 'patient', statut: 'inactif', patient_id: p._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(patientsC.toggleActif, { params: { id: p._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.patient.actif, true);
      assert.equal(body.patient.statut, 'actif');

      const freshPatient = await Patient.findById(p._id).lean();
      assert.equal(freshPatient.actif, true);
      assert.equal(freshPatient.statut, 'actif');
      const freshUser = await User.findById(user._id).lean();
      assert.equal(freshUser.statut, 'actif', 'le compte portail lié doit être réactivé en cohérence');
    });

    await t.test('toggle-actif — refuse la désactivation si le patient occupe actuellement un lit (même garde que remove())', async () => {
      const p = await Patient.create({ nom: `T-TOGGLE-D-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', actif: true, statut: 'actif' });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      const room = await Room.create({ numero: `T-TOGGLE-ROOM-${stamp}`, lits: [{ numero: '1', statut: 'occupe', patient_actuel: p._id }] });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      const { status, body } = await call(patientsC.toggleActif, { params: { id: p._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 409);
      assert.match(body.message, /occupe actuellement un lit/);

      const fresh = await Patient.findById(p._id).lean();
      assert.equal(fresh.actif, true, 'ne doit pas avoir été désactivé');
      assert.equal(fresh.statut, 'actif');
    });

    await t.test('toggle-actif — patient introuvable → 404', async () => {
      const { status } = await call(patientsC.toggleActif, { params: { id: new mongoose.Types.ObjectId() }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 404);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
