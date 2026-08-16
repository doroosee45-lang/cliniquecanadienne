// T9.5 (Finding B, groupe 3, dernier) — couverture fonctionnelle des
// fonctions create/add jamais testées : pharmacie (créations restantes),
// hospitalisation (create, addNote). Même priorité que les groupes 1-2.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('couverture fonctionnelle — pharmacie, hospitalisation (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Medication = require('../models/Medication');
  const Room = require('../models/Room');
  const Hospitalization = require('../models/Hospitalization');
  const pharmaC = require('../controllers/pharmacy.controller');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const patient = await Patient.create({ nom: `T95G3${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await User.create({ email: `_t95g3-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T95G3', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

  const cleanup = [() => Patient.findByIdAndDelete(patient._id), () => User.findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('pharmacy.controller.create persiste une nouvelle fiche médicament', async () => {
      const { status, body } = await call(pharmaC.create, { body: { nom_commercial: `T95G3-Med-${stamp}`, forme: 'comprime', stock_actuel: 50 }, user });
      assert.equal(status, 201);
      cleanup.push(() => Medication.findByIdAndDelete(body.medication._id));
      assert.equal(body.medication.stock_actuel, 50);
    });

    await t.test('pharmacy.controller.createVente décrémente le stock pour chaque article vendu', async () => {
      const med = await Medication.create({ nom_commercial: `T95G3-Vente-${stamp}`, stock_actuel: 30, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const { status, body } = await call(pharmaC.createVente, { body: { client: 'T95G3 Client', mode_paiement: 'especes', items: [{ medicament_id: med._id, quantite: 5, prix_unitaire: 200 }] }, user });
      assert.equal(status, 201);
      assert.equal(body.vente.total, 1000);
      const freshMed = await Medication.findById(med._id);
      assert.equal(freshMed.stock_actuel, 25, '30 - 5 = 25');
    });

    await t.test('pharmacy.controller.uploadPhoto met à jour le champ photo du médicament', async () => {
      const med = await Medication.create({ nom_commercial: `T95G3-Photo-${stamp}`, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const { status, body } = await call(pharmaC.uploadPhoto, { params: { id: med._id }, file: { filename: `t95g3-${stamp}.jpg` } });
      assert.equal(status, 200);
      assert.equal(body.photo, `/uploads/medications/t95g3-${stamp}.jpg`);
      const freshMed = await Medication.findById(med._id);
      assert.equal(freshMed.photo, body.photo);
    });

    await t.test('hospitalization.controller.create occupe le lit choisi et refuse un lit déjà occupé', async () => {
      const room = await Room.create({ numero: `T95G3-Chambre-${stamp}`, lits: [{ numero: 'L1', statut: 'libre' }] });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      const { status, body } = await call(hospC.create, { body: { patient: patient._id, motif_entree: 'Observation', lit_numero: 'L1', chambre: room._id }, user });
      assert.equal(status, 201);
      cleanup.push(() => Hospitalization.findByIdAndDelete(body.hospitalization._id));

      const freshRoom = await Room.findById(room._id);
      const bed = freshRoom.lits.find(l => l.numero === 'L1');
      assert.equal(bed.statut, 'occupe', 'le lit doit passer occupé après admission');
      assert.equal(String(bed.patient_actuel), String(patient._id));

      // Tenter d'admettre un second patient sur le même lit doit être refusé.
      const patient2 = await Patient.create({ nom: `T95G3b${stamp}`, prenom: 'P2', date_naissance: '1990-01-01', sexe: 'F' });
      cleanup.push(() => Patient.findByIdAndDelete(patient2._id));
      const { status: status2, body: body2 } = await call(hospC.create, { body: { patient: patient2._id, motif_entree: 'Observation', lit_numero: 'L1', chambre: room._id }, user });
      assert.equal(status2, 400);
      assert.match(body2.message, /n'est pas disponible/);
    });

    await t.test('hospitalization.controller.addNote ajoute une note clinique horodatée avec son auteur', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, medecin_responsable: medecin._id, service_nom: 'Médecine', motif_entree: 'Test T95G3', lit_numero: 'X9' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));

      const { status, body } = await call(hospC.addNote, { params: { id: hosp._id }, body: { contenu: 'Patient stable' }, user });
      assert.equal(status, 200);
      assert.equal(body.hospitalization.notes_cliniques.length, 1);
      assert.equal(body.hospitalization.notes_cliniques[0].contenu, 'Patient stable');
      assert.equal(String(body.hospitalization.notes_cliniques[0].auteur), String(medecin._id));
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
