// R-08a — /patients reste ouvert en lecture à tout le personnel (matrice
// d'accès inchangée, voir accessMatrix.test.js), mais les rôles sans besoin
// clinique direct (laborantin, radiologue, pharmacien, receptionniste,
// comptable) ne doivent plus recevoir le dossier complet : les champs
// cliniques (antecedents_medicaux, antecedents_familiaux, notes) et le
// groupe sanguin/allergies hors des rôles concernés doivent être absents de
// la réponse, pas seulement "non affichés" côté frontend.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('projection de champs Patient par rôle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const medecinRef = await User.create({
    email: `_t08a-medref-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Referent', prenom: 'Dr', role: 'medecin', statut: 'actif',
  });
  const patient = await Patient.create({
    nom: 'Test08a', prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M', telephone: '060000000',
    groupe_sanguin: 'O+', allergies: ['Pénicilline'], antecedents_medicaux: ['Diabète type 2'],
    antecedents_familiaux: ['Hypertension'], notes: 'Notes cliniques confidentielles',
    medecin_referent: medecinRef._id,
    assurances: [{ compagnie: 'ACME', numero_police: 'X1', taux: 80 }],
    contact_urgence: { nom: 'Proche', relation: 'Conjoint', telephone: '061111111' },
  });

  const callGetOne = async (role) => {
    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await patC.getOne({ params: { id: patient._id }, user: { role } }, res, () => {});
    assert.equal(status, 200);
    return body.patient;
  };

  try {
    await t.test('comptable : démographique + assurances, aucun champ clinique', async () => {
      const p = await callGetOne('comptable');
      assert.equal(p.nom, 'Test08a');
      assert.ok(p.assurances?.length, 'assurances doit être présent');
      assert.equal(p.groupe_sanguin, undefined);
      assert.equal(p.allergies, undefined);
      assert.equal(p.antecedents_medicaux, undefined);
      assert.equal(p.antecedents_familiaux, undefined);
      assert.equal(p.notes, undefined);
      assert.equal(p.medecin_referent, undefined);
    });

    await t.test('receptionniste : démographique + assurances/contact_urgence/medecin_referent, aucun champ clinique', async () => {
      const p = await callGetOne('receptionniste');
      assert.ok(p.assurances?.length);
      assert.ok(p.contact_urgence);
      assert.ok(p.medecin_referent, 'medecin_referent doit être peuplé pour orienter un appel/patient');
      assert.equal(p.medecin_referent.prenom, 'Dr');
      assert.equal(p.groupe_sanguin, undefined);
      assert.equal(p.allergies, undefined);
      assert.equal(p.antecedents_medicaux, undefined);
      assert.equal(p.notes, undefined);
    });

    await t.test('laborantin : démographique + groupe_sanguin/allergies (risque prélèvement), rien de plus', async () => {
      const p = await callGetOne('laborantin');
      assert.equal(p.groupe_sanguin, 'O+');
      assert.deepEqual(p.allergies, ['Pénicilline']);
      assert.equal(p.antecedents_medicaux, undefined);
      assert.equal(p.assurances, undefined);
      assert.equal(p.medecin_referent, undefined);
    });

    await t.test('radiologue et pharmacien : démographique + allergies uniquement', async () => {
      for (const role of ['radiologue', 'pharmacien']) {
        const p = await callGetOne(role);
        assert.deepEqual(p.allergies, ['Pénicilline'], role);
        assert.equal(p.groupe_sanguin, undefined, role);
        assert.equal(p.antecedents_medicaux, undefined, role);
        assert.equal(p.assurances, undefined, role);
      }
    });

    await t.test('medecin : dossier complet, sans régression', async () => {
      const p = await callGetOne('medecin');
      assert.deepEqual(p.antecedents_medicaux, ['Diabète type 2']);
      assert.deepEqual(p.antecedents_familiaux, ['Hypertension']);
      assert.equal(p.notes, 'Notes cliniques confidentielles');
      assert.equal(p.groupe_sanguin, 'O+');
      assert.ok(p.assurances?.length);
      assert.ok(p.medecin_referent);
    });

    await t.test('getAll applique la même projection (comptable)', async () => {
      let body = null;
      const res = { status: () => res, json: (d) => { body = d; } };
      await patC.getAll({ query: {}, user: { role: 'comptable' } }, res, () => {});
      const found = body.patients.find(p => String(p._id) === String(patient._id));
      assert.ok(found);
      assert.equal(found.antecedents_medicaux, undefined);
      assert.ok(found.assurances?.length);
    });
  } finally {
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecinRef._id);
    await mongoose.disconnect();
  }
});
