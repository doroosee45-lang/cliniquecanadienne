// Correction 2 — module 5/6 (relecture du 6 sept. 2026) — l'onglet
// "Facturation" de Chirurgie.jsx calculait un montant entièrement inventé
// (Consultation 25000, Bilan préop 45000, Intervention 350000, Anesthésie
// 80000, Hospitalisation postop 120000, Soins 15000, Médicaments 35000 =
// 670000 CFA fixes, quelle que soit l'intervention réelle), avec des
// boutons "Générer facture officielle"/"Imprimer devis" non fonctionnels.
//
// LIMITE DOCUMENTÉE, jamais simulée : contrairement à Laboratoire/
// Radiology/Echographie/Urgences, aucun catalogue tarifaire réel n'existe
// dans ce système pour les interventions chirurgicales — DossierChirurgical.
// type_intervention est un champ texte libre, sans équivalent réel
// d'ExamCatalogue. Ce correctif n'invente donc PAS de génération
// automatique de facture : il expose uniquement une Invoice réelle si le
// personnel de facturation en a créé une manuellement via le module
// Finance en la liant à ce dossier (source_module:'chirurgie'), jamais un
// calcul fabriqué côté client.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 2 (Chirurgie) — getDossierById() expose une vraie Invoice si liée, jamais un montant inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Invoice = require('../models/Invoice');
  const chirC = require('../controllers/chirurgieController');

  const stamp = Date.now();
  const created = { patients: [], users: [], dossiers: [], invoices: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const chirurgien = await User.create({ email: `_correction2-chir-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chirurgien', prenom: 'Correction2', role: 'medecin', statut: 'actif' });
    created.users.push(chirurgien._id);

    await t.test('dossier avec une vraie Invoice liée manuellement (module Finance) → exposée telle quelle, montant réel jamais recalculé', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-CHIR-1-${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(chirC.createDossier, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), motif_consultation: 'Test', diagnostic_chirurgical: 'Test', type_intervention: 'Appendicectomie Test Correction2' },
        user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const dossierId = bCreate.dossier._id;
      created.dossiers.push(dossierId);

      // Facture réelle créée manuellement via le module Finance, liée à ce dossier — jamais générée automatiquement ici.
      const facture = await Invoice.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`, service_label: 'Chirurgie',
        source_module: 'chirurgie', source_id: dossierId, created_by: chirurgien._id,
        lignes: [{ libelle: 'Appendicectomie Test Correction2', categorie: 'autre', prix_unitaire: 180000, quantite: 1, montant: 180000 }],
        montant_ht: 180000, montant_ttc: 180000,
      });
      created.invoices.push(facture._id);

      const { status, body } = await call(chirC.getDossierById, { params: { id: dossierId } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la facture réelle liée doit être exposée');
      assert.equal(String(body.invoice._id), String(facture._id));
      assert.equal(body.invoice.montant_ttc, 180000, 'le montant exposé doit être exactement celui de la vraie facture, jamais les 670000 CFA inventés par l\'ancienne UI');
    });

    await t.test('LIMITE DOCUMENTÉE — dossier sans aucune Invoice liée → aucune facture inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-CHIR-2-${stamp}`, prenom: 'P', date_naissance: '1990-02-02', sexe: 'F' });
      created.patients.push(patient._id);

      const { body: bCreate } = await call(chirC.createDossier, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), motif_consultation: 'Test 2', diagnostic_chirurgical: 'Test 2', type_intervention: 'Cholécystectomie Test Correction2' },
        user: chirurgien, ip: '127.0.0.1',
      });
      const dossierId = bCreate.dossier._id;
      created.dossiers.push(dossierId);

      const { body } = await call(chirC.getDossierById, { params: { id: dossierId } });
      assert.equal(body.invoice, null, 'sans facture réelle liée, aucun montant ne doit être fabriqué (pas de génération automatique — aucun catalogue tarifaire réel n\'existe pour les interventions chirurgicales)');
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await DossierChirurgical.deleteMany({ _id: { $in: created.dossiers } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
