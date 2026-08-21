// AUDIT-2.1 — hospitalization.controller.js::discharge libérait un lit en
// deux temps (Room.findById → modifier le lit trouvé en mémoire → room.save()),
// exactement le même motif non atomique déjà corrigé pour l'admission
// (AUDIT-P7-5). Deux sorties concurrentes sur des LITS DIFFÉRENTS de la MÊME
// chambre pouvaient s'écraser mutuellement : la seconde sauvegarde, basée sur
// une lecture du document antérieure à la première, réécrit tout le tableau
// lits et annule silencieusement la libération déjà faite par la première.
// Remplacé par un Room.findOneAndUpdate atomique avec arrayFilters, comme
// l'admission. Ce test prouve, sur une vraie course (Promise.all, pas
// séquentiel) : N sorties concurrentes sur N lits distincts de la même
// chambre libèrent bien les N lits, sans qu'aucune libération ne soit perdue.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 10;

test('AUDIT-2.1 — libération de lits atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Room = require('../models/Room');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_t21-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T21', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const cleanup = [() => User.findByIdAndDelete(medecin._id)];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test(`${N} sorties concurrentes sur ${N} lits distincts de la même chambre → tous les lits libérés`, async () => {
      const patients = await Promise.all(Array.from({ length: N }, (_, i) =>
        Patient.create({ nom: `T21-${stamp}`, prenom: `Concurrent${i}`, date_naissance: '1990-01-01', sexe: i % 2 ? 'F' : 'M' })
      ));
      cleanup.push(() => Patient.deleteMany({ _id: { $in: patients.map(p => p._id) } }));

      const room = await Room.create({
        numero: `T21-Chambre-${stamp}`,
        lits: patients.map((p, i) => ({ numero: `L${i}`, statut: 'occupe', patient_actuel: p._id })),
      });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      const hosps = await Promise.all(patients.map((p, i) => Hospitalization.create({
        patient: p._id,
        motif_entree: 'Observation concurrente',
        lit_numero: `L${i}`,
        chambre: room._id,
        chambre_num: room.numero,
        statut: 'en_cours',
      })));
      cleanup.push(() => Hospitalization.deleteMany({ patient: { $in: patients.map(p => p._id) } }));

      const results = await Promise.all(hosps.map(h =>
        call(hospC.discharge, { params: { id: h._id }, body: {}, user })
      ));

      const successes = results.filter(r => r.status === 200 || r.status === undefined);
      assert.equal(successes.length, N, `les ${N} sorties concurrentes doivent toutes réussir, obtenu ${successes.length}`);

      const freshRoom = await Room.findById(room._id);
      for (let i = 0; i < N; i++) {
        const bed = freshRoom.lits.find(l => l.numero === `L${i}`);
        assert.equal(bed.statut, 'libre', `le lit L${i} doit être libéré (perdu si le motif non atomique était encore en place)`);
        assert.equal(bed.patient_actuel, undefined, `le lit L${i} ne doit plus référencer de patient`);
      }
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
