// AUDIT-18-7 (18 sept. 2026) — prescriptions.controller.js::cancel()
// n'avait aucune garde de statut : une ordonnance pouvait être "annulée"
// alors même que pharmacy.controller.js::dispenser() avait déjà réellement
// décrémenté le stock du médicament — l'annulation ne restaure jamais ce
// stock, créant un écart entre l'état affiché (annulée) et ce qui s'est
// réellement passé (médicament physiquement remis). Décision produit
// tranchée : une fois dispensée, l'acte est cliniquement irréversible ;
// "annuler" n'est plus possible à ce stade (le signalement d'une erreur
// post-dispensation est un type d'action distinct, non construit ici).
//
// Corrigé avec le même pattern atomique qu'AUDIT-M-B6 (publier()) : la
// garde est portée par le filtre du findOneAndUpdate lui-même
// ({_id, statut:{$nin:['dispensee','expiree','annulee']}}), jamais par une
// lecture séparée suivie d'une écriture — pour éviter exactement la même
// course qu'une annulation concurrente à une dispensation en cours.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
  return { status, body };
};

test('AUDIT-18-7 — cancel() bloqué après dispensation, atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Prescription = require('../models/Prescription');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Medication = require('../models/Medication');
  const Invoice = require('../models/Invoice');
  const prescC = require('../controllers/prescriptions.controller');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const created = { prescriptions: [], patients: [], users: [], meds: [], invoices: [] };

  try {
    const medecin = await User.create({ email: `_18-7-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: '18-7', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin);
    const patient = await Patient.create({ nom: `18-7-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient);
    const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

    await t.test('cancel() — refusé (400) sur une ordonnance déjà dispensee, message explicite', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'dispensee', lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
      created.prescriptions.push(rx);
      const { status, body } = await call(prescC.cancel, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(body.message, /déjà dispensée/, 'le message doit être explicite sur la raison du refus');

      const fresh = await Prescription.findById(rx._id).lean();
      assert.equal(fresh.statut, 'dispensee', 'le statut ne doit jamais avoir été modifié par la tentative bloquée');
    });

    await t.test('cancel() — refusé (400) sur une ordonnance déjà expiree', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'expiree', lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
      created.prescriptions.push(rx);
      const { status, body } = await call(prescC.cancel, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(body.message, /expirée/);

      const fresh = await Prescription.findById(rx._id).lean();
      assert.equal(fresh.statut, 'expiree');
    });

    await t.test('cancel() — refusé (400) sur une ordonnance déjà annulee (idempotence explicite, pas un no-op silencieux)', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'annulee', lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
      created.prescriptions.push(rx);
      const { status, body } = await call(prescC.cancel, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(body.message, /déjà annulée/);
    });

    for (const statutDepart of ['brouillon', 'active', 'publiee']) {
      await t.test(`cancel() — non-régression : toujours autorisé depuis ${statutDepart}`, async () => {
        const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: statutDepart, lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
        created.prescriptions.push(rx);
        const { status, body } = await call(prescC.cancel, { params: { id: rx._id.toString() }, body: { motif: 'Test non-régression' }, user, ip: '127.0.0.1' });
        assert.equal(status, 200, JSON.stringify(body));
        assert.equal(body.prescription.statut, 'annulee');
        assert.equal(body.prescription.motif_annulation, 'Test non-régression');
      });
    }

    // ── Course concurrente réelle : dispenser() vs cancel() ──────────────
    // Un médicament réel et suffisamment approvisionné est nécessaire pour
    // que dispenser() puisse réellement atteindre sa propre transition de
    // statut (sinon il échouerait pour une tout autre raison — stock
    // insuffisant — sans jamais tester la course qui nous intéresse ici).
    const setupCourse = async () => {
      const med = await Medication.create({ nom_commercial: `18-7-Med-${stamp}-${Math.random()}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 100, stock_minimum: 5, prix_vente: 100, prix_achat: 50, statut: 'disponible' });
      created.meds.push(med);
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 5 }] });
      created.prescriptions.push(rx);
      return { med, rx };
    };

    await t.test('dispenser()/cancel() — course concurrente réelle (Promise.all) : exactement une des deux transitions gagne, jamais les deux, jamais un état incohérent', async () => {
      const N = 10;
      const setups = await Promise.all(Array.from({ length: N }, setupCourse));

      const results = await Promise.all(setups.map(({ rx }) => Promise.all([
        call(pharmaC.dispenser, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' }),
        call(prescC.cancel, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' }),
      ])));

      for (let i = 0; i < N; i++) {
        const { med, rx } = setups[i];
        const [rDispenser, rCancel] = results[i];
        const fresh = await Prescription.findById(rx._id).lean();
        const freshMed = await Medication.findById(med._id).lean();

        assert.ok(['dispensee', 'annulee'].includes(fresh.statut), `Rx ${rx._id} : état final inattendu ${fresh.statut}`);

        // Exactement un des deux appels réussit (200/201), l'autre échoue
        // proprement (400/409) — jamais les deux à 2xx, jamais un crash.
        const succes = [rDispenser, rCancel].filter(r => r.status >= 200 && r.status < 300).length;
        assert.equal(succes, 1, `Rx ${rx._id} : ${succes} succès sur les deux appels concurrents (attendu exactement 1) — dispenser:${rDispenser.status}, cancel:${rCancel.status}`);

        if (rDispenser.status >= 200 && rDispenser.status < 300) {
          // dispenser() a gagné : cancel() doit avoir été rejeté par la
          // nouvelle garde (déjà dispensee au moment de son atomique), le
          // stock doit refléter la dispensation réelle (100 - 5 = 95),
          // jamais recrédité.
          assert.equal(fresh.statut, 'dispensee');
          assert.equal(rCancel.status, 400, `Rx ${rx._id} : dispenser() a gagné mais cancel() n'a pas été rejeté (400)`);
          assert.equal(freshMed.stock_actuel, 95, `Rx ${rx._id} : le stock doit rester décrémenté (dispensation réelle et gagnante)`);
          if (rDispenser.body.invoice) created.invoices.push(rDispenser.body.invoice._id);
        } else {
          // cancel() a gagné : dispenser() doit avoir échoué sur son propre
          // filtre-garde (statut déjà annulee), et — c'est le point central
          // de ce correctif — le stock doit être intact (jamais décrémenté
          // pour une dispensation qui n'a in fine jamais réellement abouti ;
          // dispenser() recrédite déjà tout décrément partiel via
          // crediterRetour avant de renvoyer son échec, comme pour
          // AUDIT-M-B5).
          assert.equal(fresh.statut, 'annulee');
          assert.ok([400, 409].includes(rDispenser.status), `Rx ${rx._id} : cancel() a gagné mais dispenser() n'a pas échoué proprement (400/409) — obtenu ${rDispenser.status}`);
          assert.equal(freshMed.stock_actuel, 100, `Rx ${rx._id} : le stock ne doit jamais rester décrémenté pour une dispensation qui a perdu la course contre l'annulation`);
        }
      }
    });
  } finally {
    for (const i of created.invoices) await Invoice.findByIdAndDelete(i);
    for (const rx of created.prescriptions) await Prescription.findByIdAndDelete(rx._id);
    for (const m of created.meds) await Medication.findByIdAndDelete(m._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
