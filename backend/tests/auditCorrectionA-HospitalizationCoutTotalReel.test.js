// Correction A (relecture du 5 sept. 2026, post-Phase 0) — FLOW-002 avait posé
// un mécanisme de facturation réel à la sortie d'hospitalisation, mais basé
// sur Hospitalization.cout_total, un champ jamais alimenté par aucun
// mécanisme réel : toute sortie générait donc une facture à 0 (aucune
// facture), le travail de FLOW-002 restant inerte en pratique.
//
// Ce correctif branche cout_total sur une source de tarif RÉELLE déjà
// présente dans le schéma (Room.lits[].prix_par_jour, vérifiée avant d'en
// inventer une nouvelle — cf. utils/seed.js qui la peuple avec des valeurs
// réelles différenciées par type de lit), via le vrai sélecteur chambre→lit
// déjà branché à l'admission (AUDIT-P7-5). Calcul automatique : tarif
// journalier réel du lit occupé × durée réelle du séjour — jamais un tarif
// ou un ratio inventés. Une saisie manuelle réelle (nouveau champ optionnel
// du formulaire de sortie) prend le pas si fournie.
//
// Chaque assertion relit une VRAIE entrée en base (Hospitalization.findById
// et Invoice.findOne après l'action), jamais l'objet en mémoire renvoyé par
// le contrôleur.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

test('Correction A — cout_total calculé depuis le vrai tarif du lit occupé, jamais inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
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
    const medecin = await User.create({ email: `_correcta-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'CorrectionA', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    const PRIX_LIT = 12000;
    const room = await Room.create({
      numero: `RM-CORRA-${stamp}`, type: 'privee', etage: 1, capacite: 1, statut: 'actif',
      lits: [
        { numero: `L-CORRA-A-${stamp}`, type: 'standard', statut: 'libre', prix_par_jour: PRIX_LIT },
        { numero: `L-CORRA-B-${stamp}`, type: 'standard', statut: 'libre', prix_par_jour: PRIX_LIT },
      ],
    });
    created.rooms.push(room._id);

    await t.test('lit structuré, aucune saisie manuelle → cout_total = tarif réel du lit × durée réelle, vraie Invoice liée', async () => {
      const patient = await Patient.create({ nom: `T-CORRA-1-${stamp}`, prenom: 'P', date_naissance: '1988-05-01', sexe: 'F' });
      created.patients.push(patient._id);

      const DUREE_JOURS = 10;
      const dateEntree = new Date(Date.now() - (DUREE_JOURS * MS_PAR_JOUR - 5000)); // légèrement < 10 jours pile

      const { status: sCreate, body: bCreate } = await call(hospC.create, {
        body: {
          patient: patient._id.toString(), motif_entree: 'Test Correction A',
          chambre: room._id.toString(), lit_numero: `L-CORRA-A-${stamp}`,
          date_entree: dateEntree.toISOString(),
        },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const hospId = bCreate.hospitalization._id;
      created.hospitalizations.push(hospId);

      const { status, body } = await call(hospC.discharge, {
        params: { id: hospId }, body: { diagnostic_sortie: 'Guéri', etat_patient: 'gueri' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée automatiquement');
      created.invoices.push(body.invoice._id);

      const freshHosp = await Hospitalization.findById(hospId);
      const attendu = PRIX_LIT * DUREE_JOURS;
      assert.equal(freshHosp.cout_total, attendu, 'cout_total doit être exactement tarif réel du lit × durée réelle, jamais une valeur inventée');
      assert.match(freshHosp.cout_detail || '', new RegExp(`${DUREE_JOURS} jour`), 'la traçabilité du calcul doit être persistée');

      const freshInvoice = await Invoice.findOne({ hospitalisation: hospId });
      assert.ok(freshInvoice, 'une Invoice doit exister en base, liée à ce séjour');
      assert.equal(freshInvoice.montant_ttc, attendu);
    });

    await t.test('saisie manuelle réelle de cout_total à la sortie → prévaut sur le calcul automatique', async () => {
      const patient = await Patient.create({ nom: `T-CORRA-2-${stamp}`, prenom: 'P', date_naissance: '1990-02-02', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(hospC.create, {
        body: { patient: patient._id.toString(), motif_entree: 'Test Correction A manuel', chambre: room._id.toString(), lit_numero: `L-CORRA-B-${stamp}` },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const hospId = bCreate.hospitalization._id;
      created.hospitalizations.push(hospId);

      const MONTANT_MANUEL = 77777;
      const { status, body } = await call(hospC.discharge, {
        params: { id: hospId }, body: { diagnostic_sortie: 'Guéri', etat_patient: 'gueri', cout_total: MONTANT_MANUEL },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      created.invoices.push(body.invoice._id);

      const freshHosp = await Hospitalization.findById(hospId);
      assert.equal(freshHosp.cout_total, MONTANT_MANUEL, 'la saisie manuelle réelle ne doit jamais être écrasée par le calcul automatique');

      const freshInvoice = await Invoice.findOne({ hospitalisation: hospId });
      assert.equal(freshInvoice.montant_ttc, MONTANT_MANUEL);
    });

    await t.test('LIMITE DOCUMENTÉE — aucun lit structuré rattaché (chambre non renseignée) → aucun calcul inventé, aucune facture', async () => {
      const patient = await Patient.create({ nom: `T-CORRA-3-${stamp}`, prenom: 'P', date_naissance: '1975-09-09', sexe: 'F' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(hospC.create, {
        body: { patient: patient._id.toString(), motif_entree: 'Test Correction A sans lit structuré', chambre_num: 'A12 (texte libre)' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const hospId = bCreate.hospitalization._id;
      created.hospitalizations.push(hospId);
      assert.equal(bCreate.hospitalization.chambre, null, 'confirme qu\'aucune chambre structurée (ObjectId réel) n\'est rattachée à ce séjour');

      const { status, body } = await call(hospC.discharge, {
        params: { id: hospId }, body: { diagnostic_sortie: 'Guéri', etat_patient: 'gueri' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.invoice, null, 'sans lit structuré ni saisie manuelle, aucune facture ne doit être fabriquée avec un tarif inventé');

      const freshHosp = await Hospitalization.findById(hospId);
      assert.equal(freshHosp.cout_total, 0);
      const freshInvoice = await Invoice.findOne({ hospitalisation: hospId });
      assert.equal(freshInvoice, null);
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
