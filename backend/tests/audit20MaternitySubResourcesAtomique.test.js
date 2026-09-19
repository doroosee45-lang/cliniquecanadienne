// AUDIT-20-8 (19 sept. 2026, audit indépendant) —
// maternityController.js::addCPN/addEcho/addPostnatal faisaient tous trois
// g.push(...) + g.save() — même PATTERN de code que le reste de ce
// chantier (AUDIT-20-6/7).
//
// PRÉCISION IMPORTANTE, à ne pas passer sous silence : contrairement aux
// cas déjà prouvés d'AUDIT-20-6/7 (mutation d'un ÉLÉMENT EXISTANT via
// .id(sid), ou unshift()), les trois fonctions ici ne font qu'un push() en
// fin de tableau (+ un $set de statut pour addPostnatal). Des tentatives
// sérieuses de reproduction (addCPN+addEcho+addPostnatal en parallèle sur
// un même dossier, 8 addCPN concurrents, 15 paires addCPN×addEcho en
// Promise.all unique — contre le mongod local à faible latence) n'ont
// PRODUIT AUCUNE VersionError ni aucune perte, y compris pour la mutation
// combinée d'addPostnatal. Vraisemblablement parce que Mongoose peut
// exprimer un push() de fin de tableau (même combiné à un $set scalaire)
// via .save() comme de vraies opérations $push/$set Mongo atomiques, sans
// jamais avoir besoin du contrôle de version. Corrigé quand même par
// cohérence de style avec le reste du chantier — mais ce correctif n'a PAS
// de preuve de régression réellement corrigée, contrairement à
// AUDIT-20-6/7/l'addConsommation d'AUDIT-20-8. Les tests ci-dessous
// valident la CORRECTION (comportement correct après réécriture), pas une
// reproduction du bug avant.
//
// updateTravail (models/Pregnancy.js::salle_travail) n'est PAS concerné :
// déjà findByIdAndUpdate atomique (remplace un objet, pas un tableau) —
// faux positif du balayage automatisé du lot précédent (fenêtre de 15
// lignes débordant sur addPostnatal). Non touché, non modifié ; testé
// ci-dessous uniquement en non-régression.
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

test('AUDIT-20-8 — maternityController.js::addCPN/addEcho/addPostnatal atomiques sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Pregnancy = require('../models/Pregnancy');
  const matC = require('../controllers/maternityController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Concurrence' };
  const created = { patients: [], pregnancies: [] };

  try {
    const patient = await Patient.create({ nom: `Audit20-8-${stamp}`, prenom: 'P', sexe: 'F', date_naissance: '1995-01-01' });
    created.patients.push(patient._id);

    await t.test('addCPN + addEcho + addPostnatal en parallèle sur le même dossier → les 3 réussissent (201)', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, ddr: '2026-01-01' });
      created.pregnancies.push(g._id);

      const [rCpn, rEcho, rPostnatal] = await Promise.all([
        call(matC.addCPN, { params: { id: g._id.toString() }, user, ip: '127.0.0.1', body: { terme: 20, poids: 60 } }),
        call(matC.addEcho, { params: { id: g._id.toString() }, user, ip: '127.0.0.1', body: { terme: 20, type: 'morphologique' } }),
        call(matC.addPostnatal, { params: { id: g._id.toString() }, user, ip: '127.0.0.1', body: { observations: 'RAS' } }),
      ]);

      assert.equal(rCpn.status, 201, JSON.stringify(rCpn.body));
      assert.equal(rEcho.status, 201, JSON.stringify(rEcho.body));
      assert.equal(rPostnatal.status, 201, JSON.stringify(rPostnatal.body));

      const fresh = await Pregnancy.findById(g._id).lean();
      assert.equal(fresh.cpns.length, 1, 'la CPN ajoutée en parallèle doit être réellement persistée, jamais perdue');
      assert.equal(fresh.echographies.length, 1, 'l\'échographie ajoutée en parallèle doit être réellement persistée, jamais perdue');
      assert.equal(fresh.consultations_postnatales.length, 1, 'la consultation postnatale ajoutée en parallèle doit être réellement persistée, jamais perdue');
      assert.equal(fresh.statut, 'suivi_postnatal', 'le changement de statut doit être réellement appliqué malgré la course');
    });

    await t.test('8 addCPN concurrents sur le même dossier → les 8 persistées, aucune perdue', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, ddr: '2026-01-01' });
      created.pregnancies.push(g._id);

      const N = 8;
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(matC.addCPN, { params: { id: g._id.toString() }, user, ip: '127.0.0.1', body: { terme: 10 + i } })
      ));
      for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));

      const fresh = await Pregnancy.findById(g._id).lean();
      assert.equal(fresh.cpns.length, N, `les ${N} CPN doivent toutes être persistées, aucune perdue sous concurrence réelle`);
    });

    await t.test('non-régression — contrat de réponse addCPN/addEcho inchangé (grossesse + dernier élément créé)', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, ddr: '2026-01-01' });
      created.pregnancies.push(g._id);

      const { status, body } = await call(matC.addCPN, { params: { id: g._id.toString() }, user, ip: '127.0.0.1', body: { terme: 15, poids: 55 } });
      assert.equal(status, 201, JSON.stringify(body));
      assert.equal(body.success, true);
      assert.ok(body.grossesse, 'le document grossesse complet doit être renvoyé');
      assert.ok(body.cpn, 'la cpn créée doit être renvoyée séparément');
      assert.equal(body.cpn.terme, 15);
    });

    await t.test('non-régression — 404 sur dossier inexistant (addCPN/addEcho/addPostnatal)', async () => {
      const fauxId = new mongoose.Types.ObjectId().toString();
      const { status: s1 } = await call(matC.addCPN, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { terme: 10 } });
      assert.equal(s1, 404);
      const { status: s2 } = await call(matC.addEcho, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { terme: 10 } });
      assert.equal(s2, 404);
      const { status: s3 } = await call(matC.addPostnatal, { params: { id: fauxId }, user, ip: '127.0.0.1', body: {} });
      assert.equal(s3, 404);
    });

    await t.test('non-régression — updateTravail (non concerné par ce correctif) fonctionne toujours normalement', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, ddr: '2026-01-01' });
      created.pregnancies.push(g._id);
      const { status, body } = await call(matC.updateTravail, { params: { id: g._id.toString() }, user, ip: '127.0.0.1', body: { dilatation: 5 } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.grossesse.salle_travail.en_travail, true);
      assert.equal(body.grossesse.salle_travail.dilatation, 5);
    });
  } finally {
    for (const id of created.pregnancies) await Pregnancy.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
