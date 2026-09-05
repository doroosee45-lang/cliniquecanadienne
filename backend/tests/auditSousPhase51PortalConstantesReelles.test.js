// Sous-phase 5.1 (relecture du 6 sept. 2026) — Portal.jsx affichait
// "Constantes récentes"/"Tableau Santé Personnel" à partir de CONSTANTES,
// un tableau codé en dur (3 lignes fixes), identique pour absolument tout
// patient connecté. Remplacé par les vraies constantes du patient
// (portal.controller.js::getDashboard, Consultation.signes_vitaux réels).
//
// Preuve avec 2 patients différents (2 jeux de données réels distincts) :
// le tableau de bord de chacun doit refléter SES propres constantes, pas les
// mêmes valeurs fixes pour tout le monde.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Portal) — constantes réelles, différentes selon le patient', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], consultations: [] };

  const call = async (user) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await portalC.getDashboard({ user }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_51portal-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: '51', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    // Patient A : 2 consultations réelles avec constantes, la plus récente
    // en second (date_consultation postérieure).
    const patientA = await Patient.create({ nom: `T51A-${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });
    created.patients.push(patientA._id);
    const userA = await User.create({ email: `_51portal-userA-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'UserA', prenom: 'P', role: 'patient', statut: 'actif', patient_id: patientA._id });
    created.users.push(userA._id);
    const consA1 = await Consultation.create({ patient: patientA._id, medecin: medecin._id, diagnostic: 'Test51 A1', date_consultation: new Date('2026-01-10'), signes_vitaux: { poids: 70, taille: 175, tension_systolique: 120, tension_diastolique: 80, pouls: 68 } });
    const consA2 = await Consultation.create({ patient: patientA._id, medecin: medecin._id, diagnostic: 'Test51 A2', date_consultation: new Date('2026-03-15'), signes_vitaux: { poids: 72, taille: 175, tension_systolique: 125, tension_diastolique: 82, pouls: 71 } });
    created.consultations.push(consA1._id, consA2._id);

    // Patient B : une seule consultation réelle, valeurs très différentes.
    const patientB = await Patient.create({ nom: `T51B-${stamp}`, prenom: 'P', date_naissance: '1990-02-02', sexe: 'F' });
    created.patients.push(patientB._id);
    const userB = await User.create({ email: `_51portal-userB-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'UserB', prenom: 'P', role: 'patient', statut: 'actif', patient_id: patientB._id });
    created.users.push(userB._id);
    const consB1 = await Consultation.create({ patient: patientB._id, medecin: medecin._id, diagnostic: 'Test51 B1', date_consultation: new Date('2026-02-01'), signes_vitaux: { poids: 55, taille: 160, tension_systolique: 110, tension_diastolique: 70, pouls: 60 } });
    created.consultations.push(consB1._id);

    // Patient C : aucune consultation réelle -> état vide honnête.
    const patientC = await Patient.create({ nom: `T51C-${stamp}`, prenom: 'P', date_naissance: '1975-03-03', sexe: 'M' });
    created.patients.push(patientC._id);
    const userC = await User.create({ email: `_51portal-userC-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'UserC', prenom: 'P', role: 'patient', statut: 'actif', patient_id: patientC._id });
    created.users.push(userC._id);

    await t.test('Patient A — dernière constante = consultation la plus récente (A2), historique réel des 2', async () => {
      const { status, body } = await call(userA);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.stats.constantes.poids, 72, 'la constante affichée doit être celle de la consultation la plus récente (A2), pas une valeur fixe');
      assert.equal(body.stats.constantes.tension, '125/82');
      assert.equal(body.stats.constantes.imc, 23.5, 'IMC calculé réellement depuis poids/taille réels (72 / 1.75² = 23.51... arrondi 23.5)');
      assert.equal(body.stats.constantes_historique.length, 2, 'les 2 vraies consultations avec constantes doivent apparaître dans l\'historique');
      assert.equal(body.stats.constantes_historique[0].poids, 72, 'l\'historique doit être trié du plus récent au plus ancien');
      assert.equal(body.stats.constantes_historique[1].poids, 70);
    });

    await t.test('Patient B — constantes réellement différentes de celles du Patient A (pas la même valeur fixe pour tout le monde)', async () => {
      const { status, body } = await call(userB);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.stats.constantes.poids, 55);
      assert.equal(body.stats.constantes.tension, '110/70');
      assert.equal(body.stats.constantes_historique.length, 1);
      assert.notEqual(body.stats.constantes.poids, 72, 'le patient B ne doit jamais voir les constantes du patient A');
    });

    await t.test('Patient C — aucune consultation réelle -> constantes vides honnêtes, jamais une valeur inventée', async () => {
      const { status, body } = await call(userC);
      assert.equal(status, 200, JSON.stringify(body));
      assert.deepEqual(body.stats.constantes, {});
      assert.deepEqual(body.stats.constantes_historique, []);
    });
  } finally {
    await Consultation.deleteMany({ _id: { $in: created.consultations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
