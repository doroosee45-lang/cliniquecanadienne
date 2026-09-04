// FLOW-002 (audit indépendant du 4 sept. 2026) — aucun contrôleur clinique
// ne créait ni ne mettait à jour de Invoice. Les 8 onglets "Facturation"
// visibles sur Consultations, Hospitalization, Urgences, Chirurgie,
// Blocoperatoire, Laboratory, Radiology et Echographie calculaient un
// montant côté client à partir de tarifs/ratios arbitraires, sans lien réel
// avec le module Finance.
//
// PÉRIMÈTRE TRAITÉ DANS CETTE SESSION — uniquement les 2 contrôleurs
// sources demandés :
//   - consultations.controller.js::create (clôture d'une consultation)
//   - hospitalization.controller.js::discharge (sortie d'un séjour)
// Les 8 onglets frontend "Facturation" (remplacement du calcul local par un
// vrai chargement de la Invoice via l'API Finance) et les 6 autres modules
// cliniques (Urgences, Chirurgie, Blocoperatoire, Laboratory, Radiology,
// Echographie) NE SONT PAS traités ici — périmètre déclaré hors de cette
// session (voir note de cadrage de l'instruction), documentés séparément.
//
// Chaque assertion relit une VRAIE entrée en base (Invoice.findOne après
// l'action), jamais une assertion sur l'objet retourné en mémoire par le
// contrôleur — pour prouver que la persistance a réellement eu lieu.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('FLOW-002 — Consultation clôturée génère une vraie Invoice persistée (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const Invoice = require('../models/Invoice');
  const consultationsC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], consultations: [], invoices: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-FLOW002-${stamp}`, prenom: 'P', date_naissance: '1985-03-10', sexe: 'F' });
    created.patients.push(patient._id);
    const medecin = await User.create({ email: `_flow002-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'FLOW002', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    await t.test('consultation clôturée avec frais réels → vraie Invoice créée, liée, montant exact', async () => {
      const { status, body } = await call(consultationsC.create, {
        body: { patient: patient._id.toString(), statut: 'terminee', frais_consultation: 20000, type_consultation: 'Suivi' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.consultations.push(body.consultation._id);
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée');
      created.invoices.push(body.invoice._id);

      // Vraie relecture en base — pas l'objet en mémoire renvoyé par le contrôleur.
      const fresh = await Invoice.findOne({ consultation: body.consultation._id });
      assert.ok(fresh, 'une Invoice doit exister en base, liée à cette consultation');
      assert.equal(fresh.montant_ttc, 20000, 'le montant doit venir de frais_consultation, jamais un ratio/tarif inventé');
      assert.equal(String(fresh.patient), String(patient._id));
      assert.equal(fresh.lignes[0].montant, 20000);
      assert.ok(fresh.numero_facture, 'un vrai numéro de facture séquentiel doit avoir été généré');
    });

    await t.test('consultation clôturée SANS frais renseignés → aucune facture fantôme créée', async () => {
      const { status, body } = await call(consultationsC.create, {
        body: { patient: patient._id.toString(), statut: 'terminee', type_consultation: 'Suivi gratuit' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.consultations.push(body.consultation._id);
      assert.equal(body.invoice, null, 'aucune facture ne doit être fabriquée sans montant réel');

      const fresh = await Invoice.findOne({ consultation: body.consultation._id });
      assert.equal(fresh, null, 'aucune Invoice à 0 CFA ne doit exister en base pour cette consultation');
    });

    await t.test('consultation NON clôturée (en_cours) avec des frais renseignés → pas de facture prématurée', async () => {
      const { status, body } = await call(consultationsC.create, {
        body: { patient: patient._id.toString(), statut: 'en_cours', frais_consultation: 15000, type_consultation: 'Suivi' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.consultations.push(body.consultation._id);
      assert.equal(body.invoice, null, 'une consultation encore en cours ne doit pas générer de facture');

      const fresh = await Invoice.findOne({ consultation: body.consultation._id });
      assert.equal(fresh, null);
    });
  } finally {
    const Invoice = require('../models/Invoice');
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await require('../models/Consultation').deleteMany({ _id: { $in: created.consultations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});

test('FLOW-002 — Sortie d\'hospitalisation génère une vraie Invoice persistée quand un coût réel existe (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const Invoice = require('../models/Invoice');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], hospitalizations: [], invoices: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-FLOW002B-${stamp}`, prenom: 'P', date_naissance: '1979-11-02', sexe: 'M', email: `flow002b-${stamp}@_test.local` });
    created.patients.push(patient._id);
    const medecin = await User.create({ email: `_flow002b-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'FLOW002B', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    await t.test('séjour avec un vrai cout_total renseigné (via le vrai endpoint update) → vraie Invoice créée à la sortie', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test FLOW-002', statut: 'en_cours' });
      created.hospitalizations.push(hosp._id);

      // Simule une future capture réelle du coût de séjour, via le VRAI
      // endpoint générique de mise à jour (cout_total n'est pas dans
      // HOSP_BLOCKED_FIELDS) — pas une valeur injectée directement en base
      // pour "faire passer" le test.
      await call(hospC.update, { params: { id: hosp._id }, body: { cout_total: 45000 }, user: medecin, ip: '127.0.0.1' });

      const { status, body } = await call(hospC.discharge, {
        params: { id: hosp._id }, body: { diagnostic_sortie: 'Guéri', etat_patient: 'gueri' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée');
      created.invoices.push(body.invoice._id);

      const fresh = await Invoice.findOne({ hospitalisation: hosp._id });
      assert.ok(fresh, 'une Invoice doit exister en base, liée à ce séjour');
      assert.equal(fresh.montant_ttc, 45000, 'le montant doit venir du vrai cout_total, jamais un ratio/tarif inventé');
      assert.equal(String(fresh.patient), String(patient._id));
    });

    await t.test('LIMITE DOCUMENTÉE — séjour SANS cout_total renseigné (valeur par défaut du schéma, 0) → aucune facture créée', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test FLOW-002 sans coût', statut: 'en_cours' });
      created.hospitalizations.push(hosp._id);
      assert.equal(hosp.cout_total, 0, 'confirme que cout_total vaut bien 0 par défaut — jamais renseigné par le formulaire de sortie frontend actuel');

      const { status, body } = await call(hospC.discharge, {
        params: { id: hosp._id }, body: { diagnostic_sortie: 'Guéri', etat_patient: 'gueri' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.invoice, null, 'reproduit fidèlement la limite documentée : sans coût réel saisi, aucune facture automatique — le mécanisme ne doit jamais inventer un tarif pour compenser');

      const fresh = await Invoice.findOne({ hospitalisation: hosp._id });
      assert.equal(fresh, null);
    });
  } finally {
    const Invoice = require('../models/Invoice');
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await Hospitalization.deleteMany({ _id: { $in: created.hospitalizations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
