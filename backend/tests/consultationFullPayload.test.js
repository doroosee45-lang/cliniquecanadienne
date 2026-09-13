// T5.2 (R-04a) — Consultation.js ne déclarait qu'une douzaine de champs alors
// que le formulaire frontend (Consultations.jsx) en envoie ~28 : prescriptions,
// examens_complementaires, décision de sortie, RDV de suivi, facturation, et
// 6 champs d'examen par système étaient silencieusement supprimés par Mongoose
// (Consultation.create({ ...req.body }) sans strict:false), sans erreur ni
// signal. Ce test envoie le payload EXACT construit par Consultations.jsx et
// vérifie que chaque champ ressort intact de la base — c'est le test qui
// aurait détecté le problème d'origine. Vérifie aussi la génération
// automatique du document Prescription formel à partir des lignes de
// prescription saisies pendant la consultation.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('création de consultation — payload complet persisté, prescription générée (T5.2)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Consultation = require('../models/Consultation');
  const Prescription = require('../models/Prescription');
  const Patient = require('../models/Patient');
  const Invoice = require('../models/Invoice');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const consultC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const medecin = { _id: new mongoose.Types.ObjectId(), prenom: 'Doc', nom: 'Test', role: 'medecin' };
  const cleanup = [];
  // Patients supprimés après les Consultation/Prescription créées dans le
  // même sous-test, qui les référencent encore (hook pre('findOneAndDelete')
  // de Patient).
  const patientCleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  // consultC.create génère aussi, selon le payload (statut='terminee' +
  // frais_consultation>0 / examens_complementaires pontés au catalogue), une
  // vraie Invoice et/ou de vrais LabResult/ImagingResult liés au patient —
  // jamais nettoyés jusqu'ici, laissant ces documents orphelins fuiter en
  // base à chaque exécution (constaté via le hook pre('findOneAndDelete') de
  // Patient, désormais bloquant). Nettoyage générique de tout ce que la
  // réponse contient réellement, plutôt que de suivre au cas par cas.
  const cleanupConsultationSideEffects = (body) => {
    if (body.invoice) cleanup.push(() => Invoice.findByIdAndDelete(body.invoice._id));
    for (const lab of body.lab_results || []) cleanup.push(() => LabResult.findByIdAndDelete(lab._id));
    for (const img of body.imaging_results || []) cleanup.push(() => ImagingResult.findByIdAndDelete(img._id));
  };

  // Payload construit champ pour champ à l'identique de Consultations.jsx
  // (frontend/src/pages/Consultations.jsx, ~ligne 927-972) — pas une version
  // simplifiée, sinon le test ne couvre pas le vrai scénario qui a échoué.
  const buildFullPayload = (patientId) => ({
    patient: patientId,
    numero: `CONS-2026-${stamp}`,
    date_consultation: new Date().toISOString(),
    type_consultation: 'suivi',
    service: 'Médecine générale',
    signes_vitaux: {
      tension_systolique: 130, tension_diastolique: 85, pouls: 78,
      temperature: 37.2, spo2: 97, poids: 70, taille: 175,
    },
    anamnese: 'Douleur abdominale depuis 3 jours',
    examen_clinique: 'Abdomen souple',
    examen_cardiovasculaire: 'Bruits du cœur réguliers',
    examen_pulmonaire: 'Murmure vésiculaire normal',
    examen_abdominal: 'Sensibilité en fosse iliaque droite',
    examen_neurologique: 'RAS',
    examen_orl: 'RAS',
    examen_dermatologie: 'RAS',
    diagnostic: 'Suspicion appendicite',
    diagnostic_code: 'K35',
    gravite: 'modere',
    recommandations: 'Consultation chirurgicale en urgence',
    prescriptions: [
      { medicament_nom: `Paracétamol-${stamp}`, posologie: '1g x3/j', duree: '3 jours', notes: 'Si douleur' },
      { medicament_nom: `Amoxicilline-${stamp}`, posologie: '500mg x2/j', duree: '7 jours', notes: '' },
    ],
    examens_complementaires: [
      { type: 'biologie', libelle: 'NFS', priorite: 'urgent', note: '' },
      { type: 'imagerie', libelle: 'Échographie abdominale', priorite: 'semi_urgent', note: 'À jeun' },
    ],
    decision: 'hospitalisation',
    rdv_date: '',
    rdv_note: '',
    frais_consultation: 15000,
    statut_paiement: 'paye',
    statut: 'terminee',
  });

  try {
    await t.test('chaque champ du payload complet est retrouvé intact en base — aucun champ silencieusement perdu', async () => {
      const patient = await Patient.create({ nom: `T5.2-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'M' });
      patientCleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const payload = buildFullPayload(patient._id);
      const { status, body } = await call(consultC.create, { body: payload, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 201);
      const consultId = body.consultation._id;
      cleanup.push(() => Consultation.findByIdAndDelete(consultId));
      if (body.prescription) cleanup.push(() => Prescription.findByIdAndDelete(body.prescription._id));
      cleanupConsultationSideEffects(body);

      const fresh = await Consultation.findById(consultId).lean();

      assert.equal(fresh.numero, payload.numero);
      assert.equal(fresh.type_consultation, payload.type_consultation);
      assert.equal(fresh.service, payload.service);
      assert.equal(fresh.examen_cardiovasculaire, payload.examen_cardiovasculaire);
      assert.equal(fresh.examen_pulmonaire, payload.examen_pulmonaire);
      assert.equal(fresh.examen_abdominal, payload.examen_abdominal);
      assert.equal(fresh.examen_neurologique, payload.examen_neurologique);
      assert.equal(fresh.examen_orl, payload.examen_orl);
      assert.equal(fresh.examen_dermatologie, payload.examen_dermatologie);
      assert.equal(fresh.gravite, payload.gravite);
      assert.equal(fresh.decision, payload.decision);
      assert.equal(fresh.rdv_note, payload.rdv_note);
      assert.equal(fresh.frais_consultation, payload.frais_consultation);
      assert.equal(fresh.statut_paiement, payload.statut_paiement);
      assert.equal(fresh.prescriptions.length, 2, 'les lignes de prescription doivent être persistées sur la consultation elle-même');
      assert.equal(fresh.prescriptions[0].medicament_nom, payload.prescriptions[0].medicament_nom);
      assert.equal(fresh.examens_complementaires.length, 2, 'les examens complémentaires doivent être persistés');
      assert.equal(fresh.examens_complementaires[0].libelle, payload.examens_complementaires[0].libelle);
    });

    await t.test('génère automatiquement une Prescription formelle depuis les lignes saisies', async () => {
      const patient = await Patient.create({ nom: `T5.2b-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'M' });
      patientCleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const payload = buildFullPayload(patient._id);
      const { body } = await call(consultC.create, { body: payload, user: medecin, ip: '127.0.0.1' });
      cleanup.push(() => Consultation.findByIdAndDelete(body.consultation._id));
      cleanupConsultationSideEffects(body);

      assert.ok(body.prescription, 'la réponse doit inclure la prescription générée');
      cleanup.push(() => Prescription.findByIdAndDelete(body.prescription._id));

      const rx = await Prescription.findById(body.prescription._id);
      assert.ok(rx.numero_rx?.startsWith('RX-'), 'numero_rx doit être généré par le hook du modèle');
      assert.equal(String(rx.consultation), String(body.consultation._id));
      assert.equal(String(rx.patient), String(patient._id));
      assert.equal(rx.statut, 'active');
      assert.equal(rx.lignes.length, 2);
      assert.equal(rx.lignes[0].medicament_nom, payload.prescriptions[0].medicament_nom);
      assert.equal(rx.lignes[0].posologie, payload.prescriptions[0].posologie);
    });

    await t.test('aucune Prescription générée si la consultation n\'a aucune ligne de prescription', async () => {
      const patient = await Patient.create({ nom: `T5.2c-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'M' });
      patientCleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const payload = { ...buildFullPayload(patient._id), prescriptions: [] };
      const { body } = await call(consultC.create, { body: payload, user: medecin, ip: '127.0.0.1' });
      cleanup.push(() => Consultation.findByIdAndDelete(body.consultation._id));
      cleanupConsultationSideEffects(body);

      assert.equal(body.prescription, null);
      const count = await Prescription.countDocuments({ consultation: body.consultation._id });
      assert.equal(count, 0);
    });

    await t.test('aucune Prescription générée si la consultation n\'est pas terminée (statut en_cours)', async () => {
      const patient = await Patient.create({ nom: `T5.2d-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'M' });
      patientCleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const payload = { ...buildFullPayload(patient._id), statut: 'en_cours' };
      const { body } = await call(consultC.create, { body: payload, user: medecin, ip: '127.0.0.1' });
      cleanup.push(() => Consultation.findByIdAndDelete(body.consultation._id));

      assert.equal(body.prescription, null);
    });
  } finally {
    for (const fn of cleanup) await fn();
    for (const fn of patientCleanup) await fn();
    await mongoose.disconnect();
  }
});
