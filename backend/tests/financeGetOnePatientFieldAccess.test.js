// Mission harmonisation sélection patient (17 sept. 2026) — Vague 3.
// finance.controller.js::getOne faisait `.populate('patient')` SANS
// restriction, renvoyant le dossier Patient complet (antecedents_medicaux,
// notes...) à n'importe quel rôle autorisé à lire une facture, y compris
// comptable — un rôle restreint qui ne doit recevoir, selon la matrice
// RESTRICTED_FIELDS (patients.controller.js), que démographique +
// assurances. getAll()/getAssurances() appliquaient déjà des jeux de
// champs sûrs ; seul getOne() exposait le dossier complet. Même défaut,
// même correctif que prescriptions/laboratory (Vagues 1/2).
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Finance/getOne — respecte RESTRICTED_FIELDS sur le patient peuplé, jamais le dossier complet à un rôle restreint (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Invoice = require('../models/Invoice');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({
      nom: `FinGetOne-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1988-06-20', telephone: '060000003',
      antecedents_medicaux: ['Asthme (synthétique)'], notes: 'Notes cliniques confidentielles synthétiques',
      assurances: [{ compagnie: 'ACME Synthétique', numero_police: 'SYN-1', taux: 70 }],
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const comptable = await User.create({ email: `_fingetone-comptable-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Comptable', role: 'comptable', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(comptable._id));
    const invoice = await Invoice.create({ patient: patient._id, patient_nom: 'Synthetique FinGetOne', montant_ttc: 15000, statut: 'emise' });
    cleanup.push(() => Invoice.findByIdAndDelete(invoice._id));

    const callGetOne = async (role) => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await finC.getOne({ params: { id: invoice._id }, user: { role } }, res, (err) => { if (err) throw err; });
      assert.equal(status, 200, JSON.stringify(body));
      return body.invoice;
    };

    await t.test('comptable (rôle restreint) : patient peuplé limité à démographique + assurances, jamais antecedents_medicaux/notes', async () => {
      const inv = await callGetOne('comptable');
      assert.equal(inv.patient.nom, `FinGetOne-${stamp}`);
      assert.ok(inv.patient.assurances?.length, 'comptable a droit aux assurances (facturation)');
      assert.equal(inv.patient.antecedents_medicaux, undefined, 'jamais un champ clinique non autorisé pour comptable');
      assert.equal(inv.patient.notes, undefined, 'jamais les notes cliniques pour comptable');
    });

    await t.test('superadmin (dossier complet) : aucune régression, tous les champs cliniques toujours présents', async () => {
      const inv = await callGetOne('superadmin');
      assert.deepEqual(inv.patient.antecedents_medicaux, ['Asthme (synthétique)']);
      assert.equal(inv.patient.notes, 'Notes cliniques confidentielles synthétiques');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
