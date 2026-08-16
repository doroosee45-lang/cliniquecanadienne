// T9.5 — couverture explicite manquante pour deux correctifs Phase 4-5
// vérifiés présents dans le code pendant l'audit T9.5 (voir échange sur
// T4.1/T4.2/T4.3/T5.2), mais jamais testés pour leur propre compte :
//  - T4.1 (R-12) : hospitalization.controller.js::discharge ne devait plus
//    planter quand hosp.chambre est absent (séjour admis avec une simple
//    chambre_num texte libre, pas de référence Room structurée). Un test
//    existant (auditBeforeAfterExtended.test.js) exerce ce chemin par
//    accident — sa fixture n'a jamais de chambre — mais ne l'affirme nulle
//    part comme son objet. Rendu explicite ici.
//  - T4.3 (R-04b) : pharmacy.controller.js::dispenser doit refuser une
//    dispensation si le stock est insuffisant, et décrémenter exactement la
//    quantité prescrite sinon. Testé pour le cas de succès (avant/apres,
//    T9.3) mais jamais pour le rejet ni pour le montant exact du décompte.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('T4.1 — discharge() sans chambre structurée ne plante pas (R-12)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T4.1', nom: 'Test' };
  const patient = await Patient.create({ nom: `T41-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const hosp = await Hospitalization.create({
    patient: patient._id, medecin_responsable: user._id, service_nom: 'Médecine',
    motif_entree: 'Test T4.1', lit_numero: 'X-libre-texte', statut: 'en_cours',
    // chambre volontairement absent — admission en texte libre, exactement
    // le cas que R-12 constatait comme faisant planter discharge().
  });

  try {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await hospC.discharge({ params: { id: hosp._id }, body: {}, user, ip: '127.0.0.1' }, res, (err) => { if (err) throw err; });

    assert.equal(status, 200, `discharge() ne doit pas planter sans chambre structurée : ${JSON.stringify(body)}`);
    assert.equal(body.hospitalization.statut, 'sorti');
    assert.equal(body.hospitalization.chambre, undefined, 'aucune chambre à libérer — le champ doit rester vide, pas une erreur');
  } finally {
    await Hospitalization.findByIdAndDelete(hosp._id);
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});

test('T4.3 — dispenser() refuse un stock insuffisant, décrémente exactement la quantité prescrite sinon (R-04b)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Medication = require('../models/Medication');
  const Prescription = require('../models/Prescription');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T4.3', nom: 'Test' };
  const patient = await Patient.create({ nom: `T43-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await User.create({ email: `_t43-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'T43', role: 'medecin', statut: 'actif' });

  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await pharmaC.dispenser(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  try {
    await t.test('refuse la dispensation si le stock est insuffisant, sans rien modifier', async () => {
      const med = await Medication.create({ nom_commercial: `T43-Insuffisant-${stamp}`, stock_actuel: 2, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 5 }] });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      const { status, body } = await call({ params: { id: rx._id }, user });
      assert.equal(status, 400);
      assert.match(body.message, /Stock insuffisant/);

      const freshMed = await Medication.findById(med._id);
      const freshRx = await Prescription.findById(rx._id);
      assert.equal(freshMed.stock_actuel, 2, 'le stock ne doit pas bouger si la dispensation est refusée');
      assert.equal(freshRx.statut, 'active', 'l\'ordonnance ne doit pas être marquée dispensée si le stock est insuffisant');
    });

    await t.test('décrémente exactement la quantité prescrite quand le stock est suffisant', async () => {
      const med = await Medication.create({ nom_commercial: `T43-Suffisant-${stamp}`, stock_actuel: 20, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 7 }] });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      const { status } = await call({ params: { id: rx._id }, user });
      assert.equal(status, 200);

      const freshMed = await Medication.findById(med._id);
      assert.equal(freshMed.stock_actuel, 13, '20 - 7 = 13, exactement la quantité prescrite décomptée');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
