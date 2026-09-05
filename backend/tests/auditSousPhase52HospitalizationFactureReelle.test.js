// Sous-phase 5.2 (suite, demande explicite du 6 sept. 2026) — l'onglet
// "Facturation" de Hospitalization.jsx calculait un montant entièrement
// fabriqué côté client (prixChambre {standard:15000, privee:35000,
// vip:75000}, "Frais de consultation médicale" fixe à 25000, tous les autres
// postes à un prix unitaire inventé (5000/18000/12000/35000), et
// paye = Math.round(totalF*0.65) un taux de paiement fictif sans le moindre
// paiement réel enregistré). Distinct de FLOW-002/Correction A (qui n'avaient
// traité que la CRÉATION réelle de l'Invoice à la sortie, hors périmètre
// explicite : "la migration des 8 onglets frontend Facturation... non
// traités").
//
// Ce correctif ajoute hospitalization.controller.js::getFacture, sur le même
// principe que Correction 2 (Blocoperatoire) : expose la vraie Invoice liée
// (Invoice.hospitalisation, le champ dédié posé par FLOW-002 — pas
// source_module/source_id, générique mais non utilisé par ce module) si le
// séjour est déjà clôturé, sinon une estimation réelle (jamais persistée,
// jamais un numero_facture) calculée avec exactement la même formule que
// discharge() : tarif réel du lit occupé (Room.lits[].prix_par_jour) × durée
// réelle écoulée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

test('Sous-phase 5.2 (Hospitalization) — getFacture() expose la vraie facture ou une estimation réelle, jamais un montant inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Room = require('../models/Room');
  const Hospitalization = require('../models/Hospitalization');
  const Invoice = require('../models/Invoice');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], rooms: [], hospitalizations: [], invoices: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_51bhosp-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: '52', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    const PRIX_LIT = 14000;
    const room = await Room.create({
      numero: `RM-T52-${stamp}`, type: 'privee', etage: 1, capacite: 1, statut: 'actif',
      lits: [{ numero: `L-T52-${stamp}`, type: 'standard', statut: 'libre', prix_par_jour: PRIX_LIT }],
    });
    created.rooms.push(room._id);

    let hospIdEnCours;
    await t.test("séjour en cours (lit réel) — aucune facture, estimation réelle (tarif réel × durée réelle écoulée)", async () => {
      const patient = await Patient.create({ nom: `T52-Hosp-A-${stamp}`, prenom: 'P', date_naissance: '1985-03-03', sexe: 'F' });
      created.patients.push(patient._id);

      const DUREE_JOURS = 4;
      const dateEntree = new Date(Date.now() - (DUREE_JOURS * MS_PAR_JOUR - 5000));

      const { status: sCreate, body: bCreate } = await call(hospC.create, {
        body: {
          patient: patient._id.toString(), motif_entree: 'Test52 en cours',
          chambre: room._id.toString(), lit_numero: `L-T52-${stamp}`,
          date_entree: dateEntree.toISOString(),
        },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      hospIdEnCours = bCreate.hospitalization._id;
      created.hospitalizations.push(hospIdEnCours);

      const { status, body } = await call(hospC.getFacture, { params: { id: hospIdEnCours } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.invoice, null, "aucune facture réelle ne doit exister avant la sortie (discharge() est le seul mécanisme qui en crée une)");
      assert.ok(body.estimation, "une estimation réelle doit être calculée (lit réel avec tarif réel)");
      assert.equal(body.estimation.tarif_jour, PRIX_LIT, "le tarif doit être exactement celui du lit réel, jamais un tarif de chambre inventé");
      assert.equal(body.estimation.jours, DUREE_JOURS);
      assert.equal(body.estimation.montant, PRIX_LIT * DUREE_JOURS, "l'estimation doit être tarif réel × durée réelle, jamais un ratio ou un tarif inventés");
    });

    await t.test("après sortie (discharge()) — getFacture() expose la VRAIE Invoice créée, jamais recalculée ni inventée", async () => {
      const { status: sDischarge, body: bDischarge } = await call(hospC.discharge, {
        params: { id: hospIdEnCours }, body: { diagnostic_sortie: 'Guéri', etat_patient: 'gueri' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sDischarge, 200, JSON.stringify(bDischarge));
      assert.ok(bDischarge.invoice, 'la sortie doit générer une vraie facture (tarif réel du lit)');
      created.invoices.push(bDischarge.invoice._id);

      const { status, body } = await call(hospC.getFacture, { params: { id: hospIdEnCours } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'getFacture() doit désormais exposer la vraie facture liée');
      assert.equal(String(body.invoice._id), String(bDischarge.invoice._id));
      assert.equal(body.invoice.montant_ttc, bDischarge.invoice.montant_ttc);
      assert.equal(body.estimation, null, "une fois une vraie facture liée, aucune estimation ne doit plus être renvoyée");
    });

    await t.test("LIMITE DOCUMENTÉE — séjour en cours sans lit structuré (chambre en texte libre) → ni facture ni estimation inventées", async () => {
      const patient = await Patient.create({ nom: `T52-Hosp-B-${stamp}`, prenom: 'P', date_naissance: '1992-07-07', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(hospC.create, {
        body: { patient: patient._id.toString(), motif_entree: 'Test52 sans lit structuré', chambre_num: 'B7 (texte libre)' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const hospId = bCreate.hospitalization._id;
      created.hospitalizations.push(hospId);
      assert.equal(bCreate.hospitalization.chambre, null);

      const { status, body } = await call(hospC.getFacture, { params: { id: hospId } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.invoice, null);
      assert.equal(body.estimation, null, "sans lit structuré, aucune estimation ne doit être fabriquée avec un tarif inventé");
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await Hospitalization.deleteMany({ _id: { $in: created.hospitalizations } });
    await Room.deleteMany({ _id: { $in: created.rooms } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
