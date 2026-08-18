// AUDIT-P7-5 — hospitalization.controller.js::create réservait un lit en
// deux temps (Room.findById → vérifier bed.statut en mémoire → room.save()),
// laissant une fenêtre entre lecture et écriture où deux admissions
// concurrentes pouvaient toutes les deux lire statut:'libre' avant que la
// première n'ait sauvegardé, aboutissant à une double occupation du même
// lit. Remplacé par un Room.findOneAndUpdate atomique filtré sur
// lits.statut:'libre'. Ce test prouve, sur une vraie course (Promise.all,
// pas séquentiel) : exactement une admission réussit, toutes les autres
// échouent explicitement (409), et l'état final du lit ne reflète qu'un
// seul patient — jamais de double occupation silencieuse.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 15;

test('P7-5 — réservation de lit atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Room = require('../models/Room');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_p75-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'P75', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const cleanup = [() => User.findByIdAndDelete(medecin._id)];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test(`${N} admissions concurrentes sur un seul lit libre → exactement une réussit`, async () => {
      const room = await Room.create({ numero: `P75-Chambre-${stamp}`, lits: [{ numero: 'L1', statut: 'libre' }] });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      const patients = await Promise.all(Array.from({ length: N }, (_, i) =>
        Patient.create({ nom: `P75-${stamp}`, prenom: `Concurrent${i}`, date_naissance: '1990-01-01', sexe: i % 2 ? 'F' : 'M' })
      ));
      cleanup.push(() => Patient.deleteMany({ _id: { $in: patients.map(p => p._id) } }));

      const results = await Promise.all(patients.map(p =>
        call(hospC.create, { body: { patient: p._id, motif_entree: 'Observation concurrente', lit_numero: 'L1', chambre: room._id }, user })
      ));
      cleanup.push(() => Hospitalization.deleteMany({ patient: { $in: patients.map(p => p._id) } }));

      const successes = results.filter(r => r.status === 201);
      const conflicts = results.filter(r => r.status === 409);
      assert.equal(successes.length, 1, `exactement 1 admission doit réussir sur ${N} concurrentes, obtenu ${successes.length}`);
      assert.equal(conflicts.length, N - 1, `les ${N - 1} autres doivent échouer explicitement en 409, obtenu ${conflicts.length}`);
      for (const c of conflicts) assert.match(c.body.message, /n'est plus disponible/);

      const freshRoom = await Room.findById(room._id);
      const bed = freshRoom.lits.find(l => l.numero === 'L1');
      assert.equal(bed.statut, 'occupe');
      const winnerPatient = successes[0].body.hospitalization.patient;
      const winnerPatientId = winnerPatient?._id || winnerPatient;
      assert.equal(String(bed.patient_actuel), String(winnerPatientId), 'le lit ne doit référencer que le seul patient gagnant, pas un mélange');
    });

    await t.test('lit déjà occupé (hors course) → 409 explicite, chambre/lit introuvables → 404', async () => {
      const room = await Room.create({ numero: `P75-Chambre2-${stamp}`, lits: [{ numero: 'L2', statut: 'occupe' }] });
      cleanup.push(() => Room.findByIdAndDelete(room._id));
      const patient = await Patient.create({ nom: `P75-Solo-${stamp}`, prenom: 'X', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status, body } = await call(hospC.create, { body: { patient: patient._id, motif_entree: 'Test', lit_numero: 'L2', chambre: room._id }, user });
      assert.equal(status, 409);
      assert.match(body.message, /occupe/);

      const { status: status2, body: body2 } = await call(hospC.create, { body: { patient: patient._id, motif_entree: 'Test', lit_numero: 'INEXISTANT', chambre: room._id }, user });
      assert.equal(status2, 404);
      assert.match(body2.message, /introuvable/);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
