// AUDIT-M-B5 (Groupe B, Point 5) — pharmacy.controller.js::dispenser()
// vérifiait prescription.statut en mémoire puis transitionnait vers
// 'dispensee' via prescription.save() — non atomique. Contrairement au
// Point 4 (contrainte ENTRE documents, RDV), la contrainte ici porte sur
// l'état d'UN SEUL document (Prescription._id) : même famille que
// finance.controller.js::addPayment et hospitalization.controller.js::
// discharge, corrigé avec le même findOneAndUpdate à filtre-garde
// ({_id, statut:{$in:[...]}}) plutôt que le mécanisme de compensation du
// Point 4. Décrément de stock déjà atomique par ligne (chantier critique
// précédent) — ce test prouve spécifiquement qu'avec un stock SUFFISANT
// pour DEUX dispensations (donc les décréments individuels réussiraient
// tous les deux), une seule dispensation de la MÊME ordonnance aboutit —
// la vraie double dispensation que le décrément atomique seul ne peut pas
// empêcher.
//
// receptionCommande() avait la même famille de bug (med.stock_actuel += X
// en mémoire puis med.save()) sur un flux différent (réception de bon de
// commande) — corrigé avec un $inc atomique, même principe.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-M-B5 — dispensation et réception de commande atomiques sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const Prescription = require('../models/Prescription');
  const Commande = require('../models/Commande');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const created = { meds: [], prescriptions: [], commandes: [], patients: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  try {
    const pharmacien = await User.create({ email: `_b5-pharma-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B5', prenom: 'Pharma', role: 'pharmacien', statut: 'actif' });
    created.users.push(pharmacien);
    const user = { _id: pharmacien._id, prenom: pharmacien.prenom, nom: pharmacien.nom, role: 'pharmacien' };
    const patient = await Patient.create({ nom: `B5-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient);

    await t.test('dispenser() — non-régression : une dispensation normale, seule, réussit toujours', async () => {
      const med = await Medication.create({ nom_commercial: `B5-Med-Normal-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 100, stock_minimum: 5, prix_vente: 100, statut: 'disponible' });
      created.meds.push(med);
      const rx = await Prescription.create({ patient: patient._id, medecin: pharmacien._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 5 }] });
      created.prescriptions.push(rx);

      const { status, body } = await call(pharmaC.dispenser, { params: { id: rx._id }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.prescription.statut, 'dispensee');

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 95);
    });

    await t.test('dispenser() — deux dispensations concurrentes de la MÊME ordonnance, stock LARGEMENT suffisant pour les deux : une seule aboutit, stock décrémenté une seule fois', async () => {
      const med = await Medication.create({ nom_commercial: `B5-Med-Double-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 1000, stock_minimum: 5, prix_vente: 100, statut: 'disponible' });
      created.meds.push(med);
      const rx = await Prescription.create({ patient: patient._id, medecin: pharmacien._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 10 }] });
      created.prescriptions.push(rx);

      // Le perdant peut être rejeté soit par la garde initiale (400, si son
      // tour d'event-loop arrive après que le gagnant a déjà entièrement
      // transitionné le statut), soit par le findOneAndUpdate à filtre-garde
      // final (409) — l'entrelacement réel sous Promise.all n'est pas
      // déterministe, les deux issues sont correctes : seul compte
      // "exactement un succès, jamais un crash ni une double dispensation".
      const req = () => ({ params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      const [rA, rB] = await Promise.all([call(pharmaC.dispenser, req()), call(pharmaC.dispenser, req())]);
      const successCount = [rA, rB].filter(r => r.status === 200).length;
      const rejectCount = [rA, rB].filter(r => r.status === 400 || r.status === 409).length;
      assert.equal(successCount, 1, 'exactement une des deux dispensations concurrentes de la même ordonnance doit réussir — même avec un stock largement suffisant pour les deux');
      assert.equal(rejectCount, 1, `l'autre doit être rejetée proprement (400 ou 409), jamais un crash — statuts observés : ${rA.status},${rB.status}`);

      const freshRx = await Prescription.findById(rx._id).lean();
      assert.equal(freshRx.statut, 'dispensee');

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 990, 'le stock net ne doit refléter qu\'UNE seule dispensation réelle (990 = 1000 - 10), jamais deux (ce qui donnerait 980)');
      // Le perdant peut avoir décrémenté puis été recrédité avant de perdre
      // la course sur le statut (le décrément par ligne est atomique et
      // indépendant de la garde de statut finale) — un mouvement
      // 'dispensation' + 'retour' apparié pour sa tentative annulée est donc
      // légitime dans l'historique (jamais de suppression de l'historique,
      // même principe que le rollback "stock insuffisant" déjà établi
      // au-dessus dans ce fichier) : ce qui compte est que dispensation et
      // retour s'équilibrent exactement, jamais un déséquilibre.
      const mvts = freshMed.mouvements.filter(m => m.reference === freshRx.numero_rx);
      const dispensations = mvts.filter(m => m.type === 'dispensation').reduce((s, m) => s + m.quantite, 0);
      const retours = mvts.filter(m => m.type === 'retour').reduce((s, m) => s + m.quantite, 0);
      assert.equal(dispensations - retours, 10, 'net dispensation/retour pour cette ordonnance doit correspondre exactement à une seule vraie dispensation (10), jamais deux (20)');
    });

    await t.test('dispenser() — une seconde tentative séquentielle sur une ordonnance déjà dispensée est rejetée proprement, pas un crash', async () => {
      const med = await Medication.create({ nom_commercial: `B5-Med-Seq-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 50, stock_minimum: 5, prix_vente: 100, statut: 'disponible' });
      created.meds.push(med);
      const rx = await Prescription.create({ patient: patient._id, medecin: pharmacien._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 5 }] });
      created.prescriptions.push(rx);

      const { status: s1 } = await call(pharmaC.dispenser, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(s1, 200);
      // Séquentiel (pas concurrent) : la première dispensation est déjà
      // entièrement terminée quand la seconde lit prescription.statut — la
      // garde initiale (ligne 348, pré-existante) la rejette donc en 400,
      // sans jamais atteindre le nouveau findOneAndUpdate à filtre-garde
      // (celui-ci ne tranche que la vraie course concurrente, testée
      // séparément ci-dessus).
      const { status: s2, body: b2 } = await call(pharmaC.dispenser, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(s2, 400);
      assert.equal(b2.success, false);

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 45, 'la seconde tentative ne doit jamais décrémenter à nouveau le stock');
    });

    await t.test('receptionCommande() — deux réceptions concurrentes sur le même médicament : le stock reflète la somme des deux, aucun incrément perdu', async () => {
      const med = await Medication.create({ nom_commercial: `B5-Med-Reception-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 0, stock_minimum: 5, prix_vente: 100, statut: 'rupture' });
      created.meds.push(med);
      const cmd1 = await Commande.create({ fournisseur: `B5-Fournisseur1-${stamp}`, lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 100, prix_unitaire: 50 }] });
      const cmd2 = await Commande.create({ fournisseur: `B5-Fournisseur2-${stamp}`, lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 100, prix_unitaire: 50 }] });
      created.commandes.push(cmd1, cmd2);

      const [rA, rB] = await Promise.all([
        call(pharmaC.receptionCommande, { params: { id: cmd1._id.toString() }, body: { receptions: [{ index: 0, quantite_recue: 30 }] }, user, ip: '127.0.0.1' }),
        call(pharmaC.receptionCommande, { params: { id: cmd2._id.toString() }, body: { receptions: [{ index: 0, quantite_recue: 45 }] }, user, ip: '127.0.0.1' }),
      ]);
      assert.equal(rA.status, 200);
      assert.equal(rB.status, 200);

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 75, 'le stock doit refléter la somme exacte des deux réceptions concurrentes (30+45=75), aucun incrément perdu');
      assert.equal(freshMed.statut, 'disponible', 'le statut rupture doit être levé après une réception réelle');
    });
  } finally {
    for (const c of created.commandes) await Commande.findByIdAndDelete(c._id);
    for (const rx of created.prescriptions) await Prescription.findByIdAndDelete(rx._id);
    for (const m of created.meds) await Medication.findByIdAndDelete(m._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
