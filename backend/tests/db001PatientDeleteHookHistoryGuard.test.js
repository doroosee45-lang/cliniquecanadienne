// DB-001 (audit métier du 13 sept. 2026, Phase 4) — patients.controller.js::
// remove() vérifiait déjà un historique clinique/financier réel
// (CASCADE_TARGETS) avant d'autoriser une suppression physique, mais
// UNIQUEMENT dans ce contrôleur. Constaté réellement en base : des
// Appointment/Consultation/Prescription/LabResult/ImagingResult/Invoice
// orphelins, laissés par du code appelant Patient.findByIdAndDelete()
// directement (hors du contrôleur), qui contournait donc entièrement cette
// protection — le hook pre('findOneAndDelete') existant (ticket 0008) ne
// vérifiait, lui, qu'un compte User actif encore lié, jamais l'historique
// clinique. Ce test prouve que la garde s'applique désormais au niveau du
// modèle, quel que soit l'appelant — y compris un appel direct qui ne passe
// jamais par remove().
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('DB-001 — Patient.findByIdAndDelete() refuse la suppression physique tant qu\'un historique clinique réel y fait référence, quel que soit l\'appelant (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Appointment = require('../models/Appointment');
  const Room = require('../models/Room');
  const cleanup = [];

  try {
    await t.test('appel direct Patient.findByIdAndDelete() (hors contrôleur) — refusé si un Appointment référence encore ce patient', async () => {
      const p = await Patient.create({ nom: `T-DB001-A-${Date.now()}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      const appt = await Appointment.create({ patient: p._id, medecin: new mongoose.Types.ObjectId(), date_heure: new Date(Date.now() + 86400000), duree_minutes: 30, type: 'consultation', motif: 'test' });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));

      await assert.rejects(
        () => Patient.findByIdAndDelete(p._id),
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /historique clinique ou financier/);
          return true;
        },
        'un appel direct au modèle, sans passer par remove(), doit être bloqué de la même façon'
      );

      const fresh = await Patient.findById(p._id).lean();
      assert.ok(fresh, 'le patient ne doit pas avoir été supprimé');
    });

    await t.test('appel direct Patient.findByIdAndDelete() — refusé si le patient occupe un lit (Room.lits.patient_actuel, refField imbriqué)', async () => {
      const p = await Patient.create({ nom: `T-DB001-B-${Date.now()}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      const room = await Room.create({ numero: `T-DB001-ROOM-${Date.now()}`, lits: [{ numero: '1', statut: 'occupe', patient_actuel: p._id }] });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      await assert.rejects(() => Patient.findByIdAndDelete(p._id), { statusCode: 409 });
      const fresh = await Patient.findById(p._id).lean();
      assert.ok(fresh, 'le patient ne doit pas avoir été supprimé pendant qu\'il occupe un lit');
    });

    await t.test('appel direct Patient.findByIdAndDelete() — accepté quand aucun historique réel n\'existe (non-régression)', async () => {
      const p = await Patient.create({ nom: `T-DB001-C-${Date.now()}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      await Patient.findByIdAndDelete(p._id);
      const fresh = await Patient.findById(p._id).lean();
      assert.equal(fresh, null, 'un patient sans aucun historique doit toujours pouvoir être supprimé physiquement');
    });

    await t.test('non-régression — le hook ticket 0008 (compte User actif lié) continue de fonctionner', async () => {
      const User = require('../models/User');
      const p = await Patient.create({ nom: `T-DB001-D-${Date.now()}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_t-db001-d-${Date.now()}@_test.local` });
      cleanup.push(() => Patient.findByIdAndDelete(p._id));
      const user = await User.create({ email: p.email, password: 'Xx1aaaaa', nom: p.nom, prenom: p.prenom, role: 'patient', statut: 'actif', patient_id: p._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      await assert.rejects(() => Patient.findByIdAndDelete(p._id), (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /compte portail actif/);
        return true;
      });
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
