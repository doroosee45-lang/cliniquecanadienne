// Vague 4 (audit global des données fictives, 17 sept. 2026) — Finance.jsx
// affichait un "Journal de caisse du jour" entièrement codé en dur (noms de
// patients et numéros de facture inventés, ex. "Consultation Jean Dupont —
// FAC-2026-0041"), avec un solde qui ne correspondait même pas
// arithmétiquement à ses propres lignes fabriquées. Le KPI "Trésorerie
// caisse" (kpis.solde_caisse) ne correspondait à aucun champ jamais renvoyé
// par GET /finance/stats — toujours 0 en silence via `|| 0`, jamais signalé
// comme non disponible.
//
// finance.controller.js::stats calcule désormais solde_caisse à partir de
// vraies données : encaissements réels en espèces (Invoice.paiements[]
// avec mode:'especes') moins dépenses réelles payées (Depense.statut:
// 'paye'). Approximation documentée dans le code (Depense n'a pas de champ
// mode de règlement) — jamais un chiffre inventé.
//
// Données synthétiques de démonstration — aucune donnée financière réelle.
// Comparaison AVANT/APRÈS (delta) car ce test tourne contre la base Atlas
// partagée, qui peut déjà contenir de vrais paiements/dépenses.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('Finance/stats — solde_caisse est un vrai calcul (espèces encaissées - dépenses payées), jamais un chiffre codé en dur (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const Depense = require('../models/Depense');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const avant = await call(finC.stats, {});
    assert.equal(avant.status, 200, JSON.stringify(avant.body));
    const soldeAvant = avant.body.solde_caisse;
    assert.equal(typeof soldeAvant, 'number', 'solde_caisse doit être un vrai nombre calculé, jamais undefined');

    // Encaissement réel en espèces — doit augmenter solde_caisse exactement
    // du montant réel encaissé.
    const invEspeces = await Invoice.create({
      numero_facture: `CAISSE-ESP-${stamp}`, patient_nom: 'Synthetique', montant_ttc: 20000,
      paiements: [{ montant: 20000, mode: 'especes' }], statut: 'payee', date_facture: new Date(),
    });
    cleanup.push(() => Invoice.findByIdAndDelete(invEspeces._id));

    // Encaissement réel en mobile money — ne doit PAS entrer dans le solde
    // caisse (n'est pas de l'argent physique en caisse).
    const invMobile = await Invoice.create({
      numero_facture: `CAISSE-MOB-${stamp}`, patient_nom: 'Synthetique', montant_ttc: 99000,
      paiements: [{ montant: 99000, mode: 'mobile_money' }], statut: 'payee', date_facture: new Date(),
    });
    cleanup.push(() => Invoice.findByIdAndDelete(invMobile._id));

    // Dépense réelle payée — doit diminuer solde_caisse exactement du
    // montant réel dépensé.
    const depPayee = await Depense.create({ categorie: 'Fournitures médicales', description: `Test synthétique ${stamp}`, montant: 7000, statut: 'paye' });
    cleanup.push(() => Depense.findByIdAndDelete(depPayee._id));

    // Dépense en attente — ne doit PAS diminuer solde_caisse (pas encore payée).
    const depAttente = await Depense.create({ categorie: 'Autre', description: `Test synthétique attente ${stamp}`, montant: 42000, statut: 'en_attente' });
    cleanup.push(() => Depense.findByIdAndDelete(depAttente._id));

    const apres = await call(finC.stats, {});
    assert.equal(apres.status, 200, JSON.stringify(apres.body));
    const delta = apres.body.solde_caisse - soldeAvant;
    assert.equal(delta, 20000 - 7000, 'le delta doit refléter exactement +20000 (espèces) - 7000 (dépense payée), jamais le mobile money ni la dépense en attente');
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
