// P7-3 (audit2-9) — Pharmacie : dispensation d'ordonnance impossible en pratique.
//
// Constat : Prescription.statut a pour valeurs possibles
// ['brouillon','active','publiee','dispensee','expiree','annulee']. Le flux
// normal de publication (prescriptions.controller.js::publier) fait
// transitionner brouillon → 'publiee' DIRECTEMENT — jamais via 'active'. Or
// pharmacy.controller.js::dispenser n'acceptait que le statut 'active'
// (`if (prescription.statut !== 'active') return res.status(400)...`), un
// état que le flux réel n'atteint jamais. Résultat : aucune ordonnance
// publiée via le parcours normal ne pouvait jamais être marquée dispensée.
//
// Correctif : dispenser() accepte désormais 'active' OU 'publiee'.
//
// Ce test couvre :
//  (a) une prescription 'publiee' peut désormais être dispensée (statut →
//      'dispensee' en base après relecture fraîche .lean(), dispensee_par
//      et date_dispensation posés, stock décrémenté) ;
//  (b) une prescription 'active' fonctionne toujours (non-régression) ;
//  (c) une prescription 'brouillon' ou 'dispensee' est toujours rejetée en
//      400 (machine à états toujours gardée, pas grande ouverte) ;
//  (d) GET /pharmacy/prescriptions?statut=publiee retourne bien les
//      prescriptions publiées réelles créées dans ce test.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P7-3 — dispenser() accepte "publiee" en plus de "active" (audit2-9)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Medication = require('../models/Medication');
  const Prescription = require('../models/Prescription');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'P7.3', nom: 'Test' };
  const patient = await Patient.create({ nom: `P73-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await User.create({ email: `_p73-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'P73', role: 'medecin', statut: 'actif' });

  const callDispenser = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await pharmaC.dispenser(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const callGetPrescriptions = async (query) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await pharmaC.getPrescriptions({ query }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  try {
    await t.test('(a) une prescription "publiee" peut désormais être dispensée avec succès', async () => {
      const med = await Medication.create({ nom_commercial: `P73-Med-Publiee-${stamp}`, stock_actuel: 20, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const rx = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'publiee',
        lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 6 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      const { status, body } = await callDispenser({ params: { id: rx._id }, user });
      assert.equal(status, 200, `dispenser() doit réussir sur une ordonnance 'publiee' : ${JSON.stringify(body)}`);

      const freshRx = await Prescription.findById(rx._id).lean();
      assert.equal(freshRx.statut, 'dispensee', 'le statut doit passer à dispensee en base après relecture fraîche');
      assert.ok(freshRx.dispensee_par, 'dispensee_par doit être posé');
      assert.equal(String(freshRx.dispensee_par), String(user._id));
      assert.ok(freshRx.date_dispensation, 'date_dispensation doit être posée');

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 14, '20 - 6 = 14, stock décrémenté de la quantité prescrite');
    });

    await t.test('(b) une prescription "active" fonctionne toujours (non-régression)', async () => {
      const med = await Medication.create({ nom_commercial: `P73-Med-Active-${stamp}`, stock_actuel: 10, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const rx = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'active',
        lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 3 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      const { status } = await callDispenser({ params: { id: rx._id }, user });
      assert.equal(status, 200);

      const freshRx = await Prescription.findById(rx._id).lean();
      assert.equal(freshRx.statut, 'dispensee');
      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 7, '10 - 3 = 7');
    });

    await t.test('(c) une prescription "brouillon" est toujours rejetée en 400', async () => {
      const rx = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'brouillon',
        lignes: [{ medicament_nom: 'Texte libre', quantite: 1 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      const { status, body } = await callDispenser({ params: { id: rx._id }, user });
      assert.equal(status, 400);
      assert.match(body.message, /non dispensable/);

      const freshRx = await Prescription.findById(rx._id).lean();
      assert.equal(freshRx.statut, 'brouillon', 'le statut ne doit pas bouger sur un rejet');
    });

    await t.test('(c) une prescription déjà "dispensee" est toujours rejetée en 400', async () => {
      const rx = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'dispensee',
        lignes: [{ medicament_nom: 'Texte libre', quantite: 1 }],
        dispensee_par: medecin._id, date_dispensation: new Date(),
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

      const { status, body } = await callDispenser({ params: { id: rx._id }, user });
      assert.equal(status, 400);
      assert.match(body.message, /non dispensable/);
    });

    await t.test('(d) GET /pharmacy/prescriptions?statut=publiee retourne les prescriptions publiées réelles', async () => {
      const rxPubliee1 = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'publiee',
        lignes: [{ medicament_nom: `Med-Filtre-A-${stamp}`, quantite: 1 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rxPubliee1._id));
      const rxPubliee2 = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'publiee',
        lignes: [{ medicament_nom: `Med-Filtre-B-${stamp}`, quantite: 2 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rxPubliee2._id));
      // Ne doit PAS apparaître dans le filtre statut=publiee.
      const rxBrouillon = await Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'brouillon',
        lignes: [{ medicament_nom: `Med-Filtre-C-${stamp}`, quantite: 1 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rxBrouillon._id));

      const { status, body } = await callGetPrescriptions({ statut: 'publiee' });
      assert.equal(status, 200);
      const ids = body.prescriptions.map(p => String(p._id));
      assert.ok(ids.includes(String(rxPubliee1._id)), 'rxPubliee1 doit être retournée');
      assert.ok(ids.includes(String(rxPubliee2._id)), 'rxPubliee2 doit être retournée');
      assert.ok(!ids.includes(String(rxBrouillon._id)), 'la prescription brouillon ne doit pas apparaître');
      assert.ok(body.prescriptions.every(p => p.statut === 'publiee'), 'toutes les prescriptions retournées doivent être publiee');
      const found1 = body.prescriptions.find(p => String(p._id) === String(rxPubliee1._id));
      assert.equal(found1.numero_rx, rxPubliee1.numero_rx, 'numero_rx doit être présent et exact — utilisé par le frontend pour matcher la saisie utilisateur');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
