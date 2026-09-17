// Audit du 17 sept. 2026 — 4 corrections vérifiées ici (la 5e,
// facturation de dispenser(), est conditionnée à une validation métier
// séparée et n'est pas encore appliquée) :
//
// Correction 1+4 — validerQuantiteLigne() partagée par createVente/
// dispenser : Math.abs(item.quantite || 0) suivi de `if (quantite === 0)
// continue` laissait passer NaN (Math.abs(NaN||0)===NaN, NaN===0 est faux)
// jusqu'à un $inc Mongo — corruption silencieuse et définitive de
// Medication.stock_actuel en NaN. Rejette désormais explicitement (400).
//
// Correction 2 — une vente "assurance" était marquée payee/montant_paye:
// total comme un paiement cash réel ; routée désormais dans
// montant_assurance (champ dédié), statut 'emise' (à recouvrer).
//
// Correction 3 — receptionCommande() incrémentait Medication.stock_actuel
// via $inc AVANT que la protection de concurrence sur Commande (lecture
// en mémoire → save(), non atomique) ne s'applique : un double-clic/retry
// pouvait doubler l'incrément. Le recrédit de quantite_recue sur Commande
// est désormais lui-même un findOneAndUpdate conditionnel (filtré sur la
// valeur lue), rendant toute la réception idempotente sous concurrence.
//
// Données synthétiques de démonstration — aucune donnée réelle.
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

test('Pharmacie — audit du 17 sept. 2026 (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const Commande = require('../models/Commande');
  const Invoice = require('../models/Invoice');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Pharmacien' };
  const cleanup = [];

  try {
    // ── Correction 1 — createVente rejette une quantité invalide ──
    await t.test('createVente — quantité NaN explicitement rejetée (400), jamais un $inc silencieux', async () => {
      const med = await Medication.create({ nom_commercial: `C1-Med-${stamp}`, stock_actuel: 20, prix_vente: 1000, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const r = await call(pharmaC.createVente, { user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: String(med._id), quantite: 'pas-un-nombre' }] } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.match(r.body.message, /Quantité invalide/);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 20, 'le stock ne doit jamais être touché par une quantité invalide');
      assert.ok(!Number.isNaN(fresh.stock_actuel));
    });

    await t.test('createVente — quantité négative/zéro explicitement rejetée (400)', async () => {
      const med = await Medication.create({ nom_commercial: `C1b-Med-${stamp}`, stock_actuel: 20, prix_vente: 1000, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const r = await call(pharmaC.createVente, { user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: String(med._id), quantite: 0 }] } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    await t.test('createVente — non-régression : une vente avec des quantités réelles valides fonctionne toujours', async () => {
      const med = await Medication.create({ nom_commercial: `C1c-Med-${stamp}`, stock_actuel: 20, prix_vente: 1500, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const r = await call(pharmaC.createVente, { user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: String(med._id), quantite: 3 }] } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 17);
    });

    // ── Correction 4 — dispenser rejette une quantité invalide ──
    await t.test('dispenser — ligne de prescription à quantité invalide explicitement rejetée (400), jamais un $inc silencieux', async () => {
      const Patient = require('../models/Patient');
      const Prescription = require('../models/Prescription');
      const patient = await Patient.create({ nom: `C4-Pat-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const med = await Medication.create({ nom_commercial: `C4-Med-${stamp}`, stock_actuel: 20, prix_vente: 800, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      // 0 plutôt que NaN : Mongoose rejette NaN au niveau du cast de schéma
      // dès Prescription.create() (avant même d'atteindre le contrôleur) —
      // 0 est un Number valide pour le schéma mais toujours métier-invalide,
      // exerçant réellement validerQuantiteLigne() dans le contrôleur.
      const rx = await Prescription.create({
        patient: patient._id, medecin: user._id, statut: 'active',
        lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 0 }],
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));
      const r = await call(pharmaC.dispenser, { params: { id: String(rx._id) }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 20, 'le stock ne doit jamais être touché par une ligne de prescription invalide');
      const freshRx = await Prescription.findById(rx._id).lean();
      assert.equal(freshRx.statut, 'active', 'la prescription ne doit jamais transitionner sur un échec de validation');
    });

    // ── Correction 2 — vente assurance routée dans montant_assurance ──
    await t.test('createVente — mode "assurance" : facture emise/montant_assurance=total, jamais payee/montant_paye', async () => {
      const med = await Medication.create({ nom_commercial: `C2-Med-${stamp}`, stock_actuel: 20, prix_vente: 2000, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const r = await call(pharmaC.createVente, { user, ip: '127.0.0.1', body: { client: 'Assuré Test', mode_paiement: 'assurance', items: [{ medicament_id: String(med._id), quantite: 2 }] } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      const inv = await Invoice.findById(r.body.invoice._id).lean();
      assert.equal(inv.statut, 'emise', 'une vente assurance reste à recouvrer, jamais "payee"');
      assert.equal(inv.montant_assurance, 4000);
      assert.equal(inv.montant_paye, 0);
      assert.equal(inv.montant_restant, 4000);
      assert.equal(inv.paiements.length, 0, 'jamais un règlement direct fictif pour une vente assurance');
    });

    await t.test('createVente — non-régression : mode "especes" reste payee/montant_paye=total', async () => {
      const med = await Medication.create({ nom_commercial: `C2b-Med-${stamp}`, stock_actuel: 20, prix_vente: 1000, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const r = await call(pharmaC.createVente, { user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: String(med._id), quantite: 1 }] } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      const inv = await Invoice.findById(r.body.invoice._id).lean();
      assert.equal(inv.statut, 'payee');
      assert.equal(inv.montant_paye, 1000);
      assert.equal(inv.montant_assurance, 0);
    });

    // ── Correction 3 — réception concurrente idempotente ──
    await t.test('receptionCommande — deux appels concurrents sur la même ligne : stock incrémenté une seule fois au total', async () => {
      const med = await Medication.create({ nom_commercial: `C3-Med-${stamp}`, stock_actuel: 0, prix_vente: 500, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const commande = await Commande.create({
        fournisseur: 'Fournisseur Test C3',
        lignes: [{ medicament: med._id, nom: med.nom_commercial, quantite: 10, prix_unitaire: 500 }],
        montant: 5000, cree_par: user._id,
      });
      cleanup.push(() => Commande.findByIdAndDelete(commande._id));

      const reqBody = { params: { id: String(commande._id) }, user, ip: '127.0.0.1', body: { receptions: [{ index: 0, quantite_recue: 10 }] } };
      const [r1, r2] = await Promise.all([
        call(pharmaC.receptionCommande, reqBody),
        call(pharmaC.receptionCommande, reqBody),
      ]);
      const statuses = [r1.status, r2.status].sort();
      assert.ok(statuses.includes(200), 'au moins un des deux appels concurrents doit réussir');

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 10, 'le stock ne doit être incrémenté qu\'une seule fois au total (10, jamais 20)');

      const freshCommande = await Commande.findById(commande._id).lean();
      assert.equal(freshCommande.lignes[0].quantite_recue, 10, 'quantite_recue ne doit jamais dépasser la quantité réellement commandée');
      assert.equal(freshCommande.statut, 'recu');
    });

    await t.test('receptionCommande — non-régression : réception séquentielle normale (non concurrente) fonctionne toujours', async () => {
      const med = await Medication.create({ nom_commercial: `C3b-Med-${stamp}`, stock_actuel: 0, prix_vente: 500, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const commande = await Commande.create({
        fournisseur: 'Fournisseur Test C3b',
        lignes: [{ medicament: med._id, nom: med.nom_commercial, quantite: 10, prix_unitaire: 500 }],
        montant: 5000, cree_par: user._id,
      });
      cleanup.push(() => Commande.findByIdAndDelete(commande._id));

      const r1 = await call(pharmaC.receptionCommande, { params: { id: String(commande._id) }, user, ip: '127.0.0.1', body: { receptions: [{ index: 0, quantite_recue: 4 }] } });
      assert.equal(r1.status, 200, JSON.stringify(r1.body));
      const r2 = await call(pharmaC.receptionCommande, { params: { id: String(commande._id) }, user, ip: '127.0.0.1', body: { receptions: [{ index: 0, quantite_recue: 6 }] } });
      assert.equal(r2.status, 200, JSON.stringify(r2.body));

      const freshMed = await Medication.findById(med._id).lean();
      assert.equal(freshMed.stock_actuel, 10, 'deux réceptions partielles réelles (4+6) doivent s\'additionner correctement');
      const freshCommande = await Commande.findById(commande._id).lean();
      assert.equal(freshCommande.statut, 'recu');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
