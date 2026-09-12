// LAB-03 (correction du 12 sept. 2026, audit indépendant) — le formulaire
// de validation d'analyse exigeait "Technicien de laboratoire"/"Biologiste
// responsable" en champs texte libre requis, mais LabResult.validate() ne
// les persistait jamais (technicien est un ObjectId ref User côté schéma,
// biologiste n'existait pas du tout) — saisie perdue en silence. Ce test
// prouve que le vrai technicien (celui qui saisit les résultats) et le vrai
// biologiste (celui qui valide) sont désormais dérivés du compte
// authentifié réel et réellement persistés/relus, jamais d'un texte
// fabriqué par le client.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('LAB-03 — technicien et biologiste sont dérivés du compte réel, jamais d\'un champ texte client', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const LabResult = require('../models/LabResult');
  const labC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Lab03-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'F' });
  const technicien = await User.create({ email: `lab03-tech-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Nzeba', prenom: 'Alice', role: 'laborantin', statut: 'actif' });
  const biologiste = await User.create({ email: `lab03-bio-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Okemba', prenom: 'Paul', role: 'laborantin', statut: 'actif' });

  const lab = await LabResult.create({ patient: patient._id, statut: 'preleve', numero: `LAB03-${stamp}` });

  try {
    await t.test('saisirResultats() dérive le technicien du compte réel qui saisit, jamais un champ client', async () => {
      const { status, body } = await call(labC.saisirResultats, {
        params: { id: lab._id.toString() },
        user: { _id: technicien._id },
        ip: '127.0.0.1',
        body: { resultats: [{ exam_id: 'e1', valeur: '5.2' }], technicien: 'Nom Fabriqué Par Le Client' },
      });
      assert.equal(status, 200);
      assert.equal(String(body.result.technicien._id || body.result.technicien), String(technicien._id));

      const fresh = await LabResult.findById(lab._id).populate('technicien', 'nom prenom');
      assert.equal(fresh.technicien.nom, 'Nzeba');
      assert.equal(fresh.technicien.prenom, 'Alice');
    });

    await t.test('validate() dérive le biologiste (validateur) du compte réel qui signe, jamais un champ client', async () => {
      const { status, body } = await call(labC.validate, {
        params: { id: lab._id.toString() },
        user: { _id: biologiste._id },
        ip: '127.0.0.1',
        body: { resultats: [{ exam_id: 'e1', valeur: '5.2' }], commentaires: 'RAS', est_critique: false, biologiste: 'Nom Fabriqué Par Le Client' },
      });
      assert.equal(status, 200);
      assert.equal(String(body.result.validateur._id || body.result.validateur), String(biologiste._id));

      const fresh = await LabResult.findById(lab._id).populate('validateur', 'nom prenom').populate('technicien', 'nom prenom');
      assert.equal(fresh.validateur.nom, 'Okemba');
      assert.equal(fresh.validateur.prenom, 'Paul');
      // le technicien saisi à l'étape précédente reste intact après validation
      assert.equal(fresh.technicien.nom, 'Nzeba');
    });

    await t.test('getOne() renvoie technicien/validateur réellement peuplés (nom/prenom), pas de simples ObjectId opaques', async () => {
      const { body } = await call(labC.getOne, { params: { id: lab._id.toString() } });
      assert.equal(body.result.technicien.prenom, 'Alice');
      assert.equal(body.result.validateur.prenom, 'Paul');
    });
  } finally {
    await LabResult.findByIdAndDelete(lab._id);
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(technicien._id);
    await User.findByIdAndDelete(biologiste._id);
    await mongoose.disconnect();
  }
});
