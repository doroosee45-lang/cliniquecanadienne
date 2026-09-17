// R-14 (Finance) — /finance/depenses, /salaires, /assurances étaient des
// stubs figés (tableaux vides) ; /finance/depenses n'avait même pas de
// route POST (addDepense du frontend visait un endpoint inexistant).
//
// POST5-019 (audit indépendant post-Phase 5, 14 sept. 2026) — le commentaire
// précédent attribuait un échec intermittent de "payerSalaire" à un manque
// d'isolation des données entre fichiers de test concurrents. C'était
// factuellement faux : la vraie cause, isolée avec certitude, est que
// finance.controller.js::getSalaires effectue un populate() imbriqué sur
// Staff.utilisateur (ref:'User') sans jamais avoir chargé models/User.js
// lui-même — en exécution isolée (ce fichier seul, sans qu'aucun autre test
// déjà exécuté dans le même process n'ait chargé User.js en premier), le
// populate échoue réellement ("Schema hasn't been registered for model
// 'User'"). Corrigé à la source (finance.controller.js charge désormais
// explicitement models/User.js) — ce test ne devrait donc plus jamais
// dépendre de l'ordre/la concurrence d'exécution des autres fichiers.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('dépenses/salaires/assurances (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Depense = require('../models/Depense');
  const Salaire = require('../models/Salaire');
  const Staff = require('../models/Staff');
  const Patient = require('../models/Patient');
  const Invoice = require('../models/Invoice');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
  let depId, staffId, salId, patId, invPayeeId, invEnAttenteId;

  try {
    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('createDepense persiste et refuse un montant/description manquant', async () => {
      await finC.createDepense({ user, body: { description: '', montant: 0 } }, res, () => {});
      assert.equal(status, 400);

      body = null; status = 200;
      await finC.createDepense({ user, body: { date: '2026-09-01', categorie: 'Maintenance', description: `T14-${stamp}`, montant: 15000, fournisseur: 'ACME', statut: 'paye' } }, res, () => {});
      assert.equal(status, 201);
      depId = body.depense._id;
      const inDb = await Depense.findById(depId);
      assert.equal(inDb.montant, 15000);
    });

    await t.test('getDepenses retourne la dépense créée', async () => {
      body = null;
      await finC.getDepenses({ query: {} }, res, () => {});
      assert.ok(body.depenses.some(d => String(d._id) === String(depId)));
    });

    await t.test('getSalaires génère un bulletin manquant depuis Staff.salaire_base', async () => {
      const staff = await Staff.create({ prenom: 'T14', nom: `Sal${stamp}`, poste: 'infirmier', salaire_base: 250000, statut: 'actif' });
      staffId = staff._id;
      const mois = '2026-09';

      body = null;
      await finC.getSalaires({ query: { mois } }, res, () => {});
      const mine = body.salaires.find(s => s.employe === `T14 Sal${stamp}`);
      assert.ok(mine, 'un bulletin doit être auto-généré');
      assert.equal(mine.base, 250000);
      assert.equal(mine.net, 250000);
      assert.equal(mine.statut, 'en_attente');
      salId = mine._id;

      // Idempotence : un second appel ne doit pas dupliquer le bulletin.
      body = null;
      await finC.getSalaires({ query: { mois } }, res, () => {});
      const count = body.salaires.filter(s => s.employe === `T14 Sal${stamp}`).length;
      assert.equal(count, 1, 'pas de doublon au second appel');
    });

    await t.test('payerSalaire marque payé, refuse le double paiement', async () => {
      status = 200; body = null;
      await finC.payerSalaire({ params: { id: salId }, user }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.salaire.statut, 'paye');
      assert.ok(body.salaire.date_paiement);

      status = 200; body = null;
      await finC.payerSalaire({ params: { id: salId }, user }, res, () => {});
      assert.equal(status, 400, 'déjà payé');
    });

    await t.test('getAssurances agrège la portion assurance des factures', async () => {
      const patient = await Patient.create({
        nom: `T14Pat${stamp}`, prenom: 'Assur', date_naissance: '1990-01-01', sexe: 'F',
        assurances: [{ compagnie: 'MutuelleTest', numero_police: 'P1', taux: 70 }],
      });
      patId = patient._id;

      const invPayee = await Invoice.create({
        patient: patId, patient_nom: `Assur T14Pat${stamp}`, montant_ttc: 100000, montant_assurance: 70000,
        lignes: [{ libelle: 'Consultation', prix_unitaire: 100000, quantite: 1, montant: 100000 }],
        paiements: [{ montant: 100000, mode: 'especes' }], // déclenche statut 'payee' via le hook Invoice
      });
      invPayeeId = invPayee._id;

      const invEnAttente = await Invoice.create({
        patient: patId, patient_nom: `Assur T14Pat${stamp}`, montant_ttc: 50000, montant_assurance: 35000,
        lignes: [{ libelle: 'Radio', prix_unitaire: 50000, quantite: 1, montant: 50000 }],
      });
      invEnAttenteId = invEnAttente._id;

      body = null;
      await finC.getAssurances({}, res, () => {});
      const payee = body.assurances.find(a => String(a._id) === String(invPayeeId));
      const attente = body.assurances.find(a => String(a._id) === String(invEnAttenteId));
      assert.ok(payee); assert.ok(attente);
      assert.equal(payee.compagnie, 'MutuelleTest');
      assert.equal(payee.rembourse, 70000);
      assert.equal(payee.en_attente, 0);
      assert.equal(payee.statut, 'rembourse');
      assert.equal(attente.rembourse, 0);
      assert.equal(attente.en_attente, 35000);
      assert.equal(attente.statut, 'en_attente');
    });
  } finally {
    if (depId) await Depense.findByIdAndDelete(depId);
    if (staffId) { await Salaire.deleteMany({ staff: staffId }); await Staff.findByIdAndDelete(staffId); }
    if (invPayeeId) await Invoice.findByIdAndDelete(invPayeeId);
    if (invEnAttenteId) await Invoice.findByIdAndDelete(invEnAttenteId);
    if (patId) await Patient.findByIdAndDelete(patId);
    await mongoose.disconnect();
  }
});
