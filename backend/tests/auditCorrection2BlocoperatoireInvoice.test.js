// Correction 2 — module 6/6, le dernier et le plus complexe (relecture du
// 6 sept. 2026) — l'onglet "Facturation" de Blocoperatoire.jsx calculait un
// montant entièrement inventé (Salle 150000, Honoraires chirurgien 200000,
// Honoraires anesthésiste 100000, Consommables quantite*2000, Médicaments
// anesthésiques 45000, Stérilisation 20000) avec un "payé = 60% du total"
// arbitraire et trois boutons ("Générer facture"/"Imprimer devis"/"Envoyer
// à la facturation") sans aucun handler.
//
// LIMITE DOCUMENTÉE, jamais simulée : même constat que Chirurgie
// (Correction 2/5) — Blocoperatoire partage le même modèle
// (DossierChirurgical), qui ne porte aucun champ tarifaire réel pour les
// actes de bloc opératoire. Ce correctif n'invente donc PAS de génération
// automatique : il expose uniquement une Invoice réelle si le personnel de
// facturation en a créé une manuellement via le module Finance en la
// liant à cette intervention (source_module:'blocoperatoire', distinct de
// 'chirurgie' pour permettre une facturation séparée du volet bloc
// opératoire du même dossier).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 2 (Blocoperatoire) — getFacture() expose une vraie Invoice si liée, jamais un montant inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Invoice = require('../models/Invoice');
  const boC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const created = { patients: [], users: [], dossiers: [], invoices: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const chirurgien = await User.create({ email: `_correction2-bloc-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chirurgien', prenom: 'Correction2', role: 'medecin', statut: 'actif' });
    created.users.push(chirurgien._id);

    await t.test('intervention avec une vraie Invoice bloc opératoire liée manuellement (module Finance) → exposée telle quelle', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-BLOC-1-${stamp}`, prenom: 'P', date_naissance: '1982-04-04', sexe: 'F' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Cholécystectomie Test Correction2', salle: 'BO-1', date_heure_op: new Date().toISOString() },
        user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const dossierId = (bCreate.intervention || bCreate.dossier)._id;
      created.dossiers.push(dossierId);

      const facture = await Invoice.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`, service_label: 'Bloc opératoire',
        source_module: 'blocoperatoire', source_id: dossierId, created_by: chirurgien._id,
        lignes: [{ libelle: 'Salle + honoraires — Cholécystectomie Test Correction2', categorie: 'autre', prix_unitaire: 420000, quantite: 1, montant: 420000 }],
        montant_ht: 420000, montant_ttc: 420000,
      });
      created.invoices.push(facture._id);

      const { status, body } = await call(boC.getFacture, { params: { id: dossierId } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la facture réelle liée doit être exposée');
      assert.equal(String(body.invoice._id), String(facture._id));
      assert.equal(body.invoice.montant_ttc, 420000, 'le montant exposé doit être exactement celui de la vraie facture, jamais un montant inventé (150000+200000+100000+45000+20000+consommables)');
    });

    await t.test('LIMITE DOCUMENTÉE — intervention sans aucune Invoice bloc opératoire liée → aucune facture inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-BLOC-2-${stamp}`, prenom: 'P', date_naissance: '1995-06-06', sexe: 'M' });
      created.patients.push(patient._id);

      const { body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Appendicectomie Test Correction2', salle: 'BO-2', date_heure_op: new Date().toISOString() },
        user: chirurgien, ip: '127.0.0.1',
      });
      const dossierId = (bCreate.intervention || bCreate.dossier)._id;
      created.dossiers.push(dossierId);

      const { body } = await call(boC.getFacture, { params: { id: dossierId } });
      assert.equal(body.invoice, null, 'sans facture réelle liée, aucun montant ne doit être fabriqué');
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await DossierChirurgical.deleteMany({ _id: { $in: created.dossiers } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
