// AUDIT-20-8 (19 sept. 2026, audit indépendant) —
// pediatrieController.js::addVaccination/addMesure/addMaladieChron
// faisaient tous trois child.push(...) + child.save() — même PATTERN de
// code que le reste de ce chantier (AUDIT-20-6/7).
//
// PRÉCISION IMPORTANTE, à ne pas passer sous silence : contrairement aux
// cas déjà prouvés d'AUDIT-20-6/7 (mutation d'un ÉLÉMENT EXISTANT via
// .id(sid)), les trois fonctions ici ne font qu'un push() en fin de
// tableau (+ un $set conditionnel pour addMesure, + un $set de statut pour
// addMaladieChron). Des tentatives sérieuses de reproduction
// (addVaccination+addMesure+addMaladieChron en parallèle sur un même
// dossier, 8 addVaccination concurrentes, 15 paires
// addVaccination×addMesure en Promise.all unique — contre le mongod local
// à faible latence) n'ont PRODUIT AUCUNE VersionError ni aucune perte, y
// compris pour les mutations combinées d'addMesure/addMaladieChron.
// Vraisemblablement parce que Mongoose peut exprimer un push() de fin de
// tableau (même combiné à un $set scalaire) via .save() comme de vraies
// opérations $push/$set Mongo atomiques, sans jamais avoir besoin du
// contrôle de version. Corrigé quand même par cohérence de style avec le
// reste du chantier — mais ce correctif n'a PAS de preuve de régression
// réellement corrigée, contrairement à AUDIT-20-6/7/l'addConsommation
// d'AUDIT-20-8. Les tests ci-dessous valident la CORRECTION (comportement
// correct après réécriture), pas une reproduction du bug avant.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message, name: err.name }; } });
  return { status, body };
};

test('AUDIT-20-8 — pediatrieController.js::addVaccination/addMesure/addMaladieChron atomiques sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Child = require('../models/Child');
  const pedC = require('../controllers/pediatrieController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Concurrence' };
  const created = { patients: [], children: [] };

  try {
    const patient = await Patient.create({ nom: `Audit20-8-${stamp}`, prenom: 'P', sexe: 'M', date_naissance: '2020-01-01' });
    created.patients.push(patient._id);

    await t.test('addVaccination + addMesure + addMaladieChron en parallèle sur le même dossier → les 3 réussissent (201)', async () => {
      const child = await Child.create({ nom: `Audit20-8-${stamp}`, prenom: 'Enfant', date_naissance: '2020-01-01', sexe: 'M', patient_id: patient._id });
      created.children.push(child._id);

      const [rVacc, rMesure, rMaladie] = await Promise.all([
        call(pedC.addVaccination, { params: { id: child._id.toString() }, user, ip: '127.0.0.1', body: { vaccin: 'BCG' } }),
        call(pedC.addMesure, { params: { id: child._id.toString() }, user, ip: '127.0.0.1', body: { poids: 12.5, taille: 90 } }),
        call(pedC.addMaladieChron, { params: { id: child._id.toString() }, user, ip: '127.0.0.1', body: { maladie: 'Asthme' } }),
      ]);

      assert.equal(rVacc.status, 201, JSON.stringify(rVacc.body));
      assert.equal(rMesure.status, 201, JSON.stringify(rMesure.body));
      assert.equal(rMaladie.status, 201, JSON.stringify(rMaladie.body));

      const fresh = await Child.findById(child._id).lean();
      assert.equal(fresh.vaccinations.length, 1, 'la vaccination ajoutée en parallèle doit être réellement persistée, jamais perdue');
      assert.equal(fresh.mesures_croissance.length, 1, 'la mesure ajoutée en parallèle doit être réellement persistée, jamais perdue');
      assert.equal(fresh.maladies_chroniques.length, 1, 'la maladie ajoutée en parallèle doit être réellement persistée, jamais perdue');
      assert.equal(fresh.statut, 'chronique', 'le changement de statut doit être réellement appliqué malgré la course');
      assert.equal(fresh.poids_actuel, 12.5, 'poids_actuel doit refléter la mesure ajoutée en parallèle, jamais perdu');
      assert.equal(fresh.taille_actuelle, 90);
    });

    await t.test('8 addVaccination concurrentes sur le même dossier → les 8 persistées, aucune perdue', async () => {
      const child = await Child.create({ nom: `Audit20-8B-${stamp}`, prenom: 'Enfant', date_naissance: '2020-01-01', sexe: 'F', patient_id: patient._id });
      created.children.push(child._id);

      const N = 8;
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(pedC.addVaccination, { params: { id: child._id.toString() }, user, ip: '127.0.0.1', body: { vaccin: `Vaccin${i}` } })
      ));
      for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));

      const fresh = await Child.findById(child._id).lean();
      assert.equal(fresh.vaccinations.length, N, `les ${N} vaccinations doivent toutes être persistées, aucune perdue sous concurrence réelle`);
    });

    await t.test('non-régression — addMesure sans poids/taille ne touche jamais poids_actuel/taille_actuelle', async () => {
      const child = await Child.create({ nom: `Audit20-8C-${stamp}`, prenom: 'Enfant', date_naissance: '2020-01-01', sexe: 'M', patient_id: patient._id, poids_actuel: 10, taille_actuelle: 80 });
      created.children.push(child._id);
      const { status, body } = await call(pedC.addMesure, { params: { id: child._id.toString() }, user, ip: '127.0.0.1', body: { perimetre_cranien: 45 } });
      assert.equal(status, 201, JSON.stringify(body));
      assert.equal(body.enfant.poids_actuel, 10, 'poids_actuel ne doit jamais changer si aucun poids n\'est fourni dans cet ajout');
      assert.equal(body.enfant.taille_actuelle, 80);
    });

    await t.test('non-régression — 404 sur dossier inexistant (les 3 fonctions)', async () => {
      const fauxId = new mongoose.Types.ObjectId().toString();
      const { status: s1 } = await call(pedC.addVaccination, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { vaccin: 'X' } });
      assert.equal(s1, 404);
      const { status: s2 } = await call(pedC.addMesure, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { poids: 10 } });
      assert.equal(s2, 404);
      const { status: s3 } = await call(pedC.addMaladieChron, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { maladie: 'X' } });
      assert.equal(s3, 404);
    });
  } finally {
    for (const id of created.children) await Child.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
