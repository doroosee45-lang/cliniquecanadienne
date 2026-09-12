// T9.5 (Finding B, groupe 2) — couverture fonctionnelle des fonctions
// create/add jamais testées : échographie, maternité, pédiatrie. Même
// priorité que le groupe 1 (logique métier avant get*/liste).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('couverture fonctionnelle — échographie, maternité, pédiatrie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Echographie = require('../models/Echographie');
  const Pregnancy = require('../models/Pregnancy');
  const Delivery = require('../models/Delivery');
  const Newborn = require('../models/Newborn');
  const Child = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const echoC = require('../controllers/echographieController');
  const matC  = require('../controllers/maternityController');
  const pedC  = require('../controllers/pediatrieController');

  const stamp = Date.now();
  const patient = await Patient.create({
    nom: `T95G2${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F',
    groupe_sanguin: 'A+', telephone: '060000001', antecedents_medicaux: ['Diabète'],
  });
  const medecin = await User.create({ email: `_t95g2-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T95G2', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

  const cleanup = [() => Patient.findByIdAndDelete(patient._id), () => User.findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('echographieController.create persiste une nouvelle demande avec numéro généré', async () => {
      const { status, body } = await call(echoC.create, { body: { patient: patient._id.toString(), patient_nom: 'T95G2 P', motif: 'Suivi grossesse' }, user });
      assert.equal(status, 201);
      cleanup.push(() => Echographie.findByIdAndDelete(body.demande._id));
      assert.ok(body.demande.numero, 'un numéro doit être généré');
      assert.equal(body.demande.statut, 'en_attente');
    });

    await t.test('maternityController.create copie les données patient et calcule le niveau de risque', async () => {
      const { status, body } = await call(matC.create, { body: { patient_id: patient._id, facteurs_risque: ['HTA', 'Diabète', 'Âge > 35 ans'] }, user });
      assert.equal(status, 201);
      cleanup.push(() => Pregnancy.findByIdAndDelete(body.grossesse._id));
      assert.equal(body.grossesse.patient_nom, patient.nom);
      assert.equal(body.grossesse.groupe_sanguin, 'A+', 'groupe sanguin repris du dossier patient si non fourni');
      assert.equal(body.grossesse.statut, 'a_risque');
      assert.equal(body.grossesse.niveau_risque, 'eleve', '3 facteurs de risque > 2 doit donner "eleve"');
    });

    await t.test('maternityController.addCPN, addEcho, addPostnatal ajoutent les sous-documents attendus', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: 'T95G2 P' });
      cleanup.push(() => Pregnancy.findByIdAndDelete(g._id));

      const { status: sC, body: bC } = await call(matC.addCPN, { params: { id: g._id }, body: { terme: 20, poids: 65 }, user });
      assert.equal(sC, 201);
      assert.equal(bC.cpn.terme, 20);

      const { status: sE, body: bE } = await call(matC.addEcho, { params: { id: g._id }, body: { type: 'morphologique', trimestre: 2 }, user });
      assert.equal(sE, 201);
      assert.equal(bE.echo.type, 'morphologique');

      const { status: sP } = await call(matC.addPostnatal, { params: { id: g._id }, body: { etat_mere: 'bonne' }, user });
      assert.equal(sP, 201);
      const fresh = await Pregnancy.findById(g._id);
      assert.equal(fresh.statut, 'suivi_postnatal', 'addPostnatal doit transitionner le statut du dossier');
    });

    await t.test('maternityController.createDelivery et createNewborn persistent réellement', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: 'T95G2 P', patient_prenom: 'P' });
      cleanup.push(() => Pregnancy.findByIdAndDelete(g._id));

      const { status: sD, body: bD } = await call(matC.createDelivery, { body: { grossesse_id: g._id, date_heure: new Date().toISOString(), type_accouchement: 'voie_basse' }, user });
      assert.equal(sD, 201);
      cleanup.push(() => Delivery.findByIdAndDelete(bD.accouchement._id));
      assert.ok(bD.accouchement.patient_id, 'patient_id doit être repris de la grossesse liée');
      const freshG = await Pregnancy.findById(g._id);
      assert.equal(freshG.statut, 'accouchee', 'createDelivery doit transitionner le statut de la grossesse');

      const { status: sN, body: bN } = await call(matC.createNewborn, { body: { mere_nom: 'T95G2 P', prenom: 'Bébé T95G2', sexe: 'M', poids: 3100 }, user });
      assert.equal(sN, 201);
      cleanup.push(() => Newborn.findByIdAndDelete(bN.nouveau_ne._id));
      assert.ok(bN.nouveau_ne.vaccinations?.length > 0, 'les vaccinations par défaut (BCG) doivent être appliquées à la naissance');
    });

    await t.test('pediatrieController.create persiste un dossier enfant', async () => {
      // SPEC-10 (correction du 12 sept. 2026) — create() exige désormais
      // réellement un patient_id existant, comme Pediatrie.jsx l'exige déjà.
      const { status, body } = await call(pedC.create, { body: { patient_id: patient._id.toString(), nom: `T95G2Enfant${stamp}`, prenom: 'Bébé', date_naissance: '2025-01-01', sexe: 'F' }, user });
      assert.equal(status, 201);
      cleanup.push(() => Child.findByIdAndDelete(body.enfant._id));
      assert.ok(body.enfant.numero, 'un numéro doit être généré');
    });

    await t.test('pediatrieController.addMesure calcule l\'IMC et met à jour les mesures actuelles', async () => {
      const child = await Child.create({ nom: `T95G2b${stamp}`, prenom: 'Enfant', date_naissance: '2023-01-01', sexe: 'M' });
      cleanup.push(() => Child.findByIdAndDelete(child._id));

      const { status, body } = await call(pedC.addMesure, { params: { id: child._id }, body: { poids: 15, taille: 100 }, user });
      assert.equal(status, 201);
      const h = 1; // 100cm = 1m
      assert.equal(body.enfant.mesures_croissance[0].imc, 15, 'imc = poids / taille² = 15 / 1² = 15');
      assert.equal(body.enfant.poids_actuel, 15);
      assert.equal(body.enfant.taille_actuelle, 100);

      // Relecture fraîche depuis la base (hors document mongoose en mémoire) — confirme
      // que ce ne sont pas des valeurs factices poids:0/taille:0 qui ont été persistées
      // (régression P6-4 : bouton "Ajouter" sans formulaire écrivait poids:0, taille:0).
      const fresh = await Child.findById(child._id).lean();
      assert.equal(fresh.mesures_croissance.length, 1);
      assert.equal(fresh.mesures_croissance[0].poids, 15);
      assert.equal(fresh.mesures_croissance[0].taille, 100);
      assert.equal(fresh.mesures_croissance[0].imc, 15);
      assert.notEqual(fresh.mesures_croissance[0].poids, 0);
      assert.notEqual(fresh.mesures_croissance[0].taille, 0);
    });

    await t.test('pediatrieController.addMaladieChron enregistre la maladie et passe le dossier en statut chronique', async () => {
      const child = await Child.create({ nom: `T95G2c${stamp}`, prenom: 'Enfant', date_naissance: '2023-01-01', sexe: 'M' });
      cleanup.push(() => Child.findByIdAndDelete(child._id));

      const { status, body } = await call(pedC.addMaladieChron, { params: { id: child._id }, body: { maladie: 'Asthme' }, user });
      assert.equal(status, 201);
      assert.equal(body.enfant.statut, 'chronique');
      assert.equal(body.enfant.maladies_chroniques.length, 1);
    });

    await t.test('pediatrieController.createConsultation dérive patient_nom et met à jour le poids de l\'enfant', async () => {
      const child = await Child.create({ nom: `T95G2d${stamp}`, prenom: 'Enfant', date_naissance: '2023-01-01', sexe: 'M' });
      cleanup.push(() => Child.findByIdAndDelete(child._id));

      const { status, body } = await call(pedC.createConsultation, { body: { child_id: child._id, motif: 'Fièvre', diagnostic: 'Rhume', poids: 12.5 }, user });
      assert.equal(status, 201);
      cleanup.push(() => PediatricConsultation.findByIdAndDelete(body.consultation._id));
      assert.equal(body.consultation.patient_nom, `${child.prenom} ${child.nom}`);

      const freshChild = await Child.findById(child._id);
      assert.equal(freshChild.poids_actuel, 12.5, 'le poids saisi à la consultation doit mettre à jour le dossier enfant');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
