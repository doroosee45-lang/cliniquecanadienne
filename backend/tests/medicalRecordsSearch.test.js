// Module « Dossiers Médicaux » — recherche transversale (medicalRecordsController.js).
// Un fixture par collection (9), tous rattachés au même patient et partageant
// un mot-clé unique dans leur champ de recherche réel, prouve :
// (a) chaque type retourne bien son propre dossier réel pour un rôle
//     autorisé, (b) un rôle non autorisé pour CETTE collection reçoit un
//     résultat vide (jamais les données d'une autre collection),
// (c) le filtre UI "imagerie" couvre 2 collections à matrice de rôles
//     différente (ImagingResult exclut sage_femme, Echographie l'inclut) —
//     vérifié par collection, jamais par filtre UI,
// (d) une recherche combinée sans filtre de type retrouve les 9 dossiers
//     fusionnés et triés, en un seul appel (Promise.all réellement parallèle).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Dossiers Médicaux — recherche transversale (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const medicalRecordsC = require('../controllers/medicalRecordsController');
  const Patient               = require('../models/Patient');
  const User                  = require('../models/User');
  const Consultation          = require('../models/Consultation');
  const Hospitalization       = require('../models/Hospitalization');
  const DossierChirurgical    = require('../models/DossierChirurgical');
  const LabResult             = require('../models/LabResult');
  const ImagingResult         = require('../models/ImagingResult');
  const Echographie           = require('../models/Echographie');
  const Urgence                = require('../models/Urgence');
  const Child                 = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const Prescription          = require('../models/Prescription');

  const stamp = Date.now();
  const KW = `KWSTAMP${stamp}`;
  const cleanup = [];
  const asRole = (role) => ({ _id: new mongoose.Types.ObjectId(), role });

  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await medicalRecordsC.search(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({
      nom: `Rechercher${stamp}`, prenom: 'Testeur', sexe: 'M',
      date_naissance: new Date('1990-01-01'), numero_dossier: `DM-TEST-${stamp}`,
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    const medecin = await User.create({
      email: `_dm-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa',
      nom: 'Praticien', prenom: 'Dr', role: 'medecin', statut: 'actif',
    });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));

    const consultation = await Consultation.create({
      patient: patient._id, medecin: medecin._id, diagnostic: `Diagnostic ${KW}`, statut: 'en_cours',
    });
    cleanup.push(() => Consultation.findByIdAndDelete(consultation._id));

    const hospitalisation = await Hospitalization.create({
      patient: patient._id, medecin_responsable: medecin._id, motif_entree: `Motif ${KW}`, statut: 'en_cours',
    });
    cleanup.push(() => Hospitalization.findByIdAndDelete(hospitalisation._id));

    const chirurgie = await DossierChirurgical.create({
      numero: `CHIR-DM-${stamp}`, patient: patient._id, patient_nom: patient.nom,
      chirurgien_id: medecin._id, diagnostic_chirurgical: `Diagnostic ${KW}`, statut: 'consultation',
    });
    cleanup.push(() => DossierChirurgical.findByIdAndDelete(chirurgie._id));

    const labo = await LabResult.create({
      patient: patient._id, patient_nom: patient.nom, medecin_prescripteur: medecin._id,
      commentaires: `Commentaire ${KW}`, statut: 'prescrit',
    });
    cleanup.push(() => LabResult.findByIdAndDelete(labo._id));

    const imagerie = await ImagingResult.create({
      patient: patient._id, patient_nom: patient.nom, medecin_prescripteur: medecin._id,
      motif: `Motif ${KW}`, statut: 'programme',
    });
    cleanup.push(() => ImagingResult.findByIdAndDelete(imagerie._id));

    const echographie = await Echographie.create({
      patient: patient._id, patient_nom: patient.nom, medecin_presc: 'Dr Presc',
      motif: `Motif ${KW}`, statut: 'en_attente', date_prescription: new Date(),
    });
    cleanup.push(() => Echographie.findByIdAndDelete(echographie._id));

    const urgence = await Urgence.create({
      patient: patient._id, patient_nom: patient.nom, medecin_responsable: medecin._id,
      motif: `Motif ${KW}`, statut: 'attente',
    });
    cleanup.push(() => Urgence.findByIdAndDelete(urgence._id));

    const child = await Child.create({
      patient_id: patient._id, nom: patient.nom, prenom: patient.prenom,
      date_naissance: new Date('2015-01-01'), sexe: 'M',
    });
    cleanup.push(() => Child.findByIdAndDelete(child._id));
    const pediatrie = await PediatricConsultation.create({
      child_id: child._id, patient_nom: patient.nom, motif: 'Contrôle', diagnostic: `Diagnostic ${KW}`, medecin: 'Dr Presc',
    });
    cleanup.push(() => PediatricConsultation.findByIdAndDelete(pediatrie._id));

    const ordonnance = await Prescription.create({
      patient: patient._id, medecin: medecin._id,
      lignes: [{ medicament_nom: `Medicament${KW}`, posologie: '1x/j' }],
      statut: 'active',
    });
    cleanup.push(() => Prescription.findByIdAndDelete(ordonnance._id));

    // ── (a) + (b) un test par type : rôle autorisé trouve, rôle refusé ne trouve rien ──
    const CASES = [
      { types: ['consultation'],    allowedRole: 'medecin',    deniedRole: 'laborantin', expectId: consultation._id },
      { types: ['hospitalisation'], allowedRole: 'medecin',    deniedRole: 'laborantin', expectId: hospitalisation._id },
      { types: ['chirurgie'],       allowedRole: 'medecin',    deniedRole: 'pharmacien', expectId: chirurgie._id },
      { types: ['laboratoire'],     allowedRole: 'laborantin', deniedRole: 'pharmacien', expectId: labo._id },
      { types: ['urgence'],         allowedRole: 'sage_femme', deniedRole: 'radiologue', expectId: urgence._id },
      { types: ['pediatrie'],       allowedRole: 'sage_femme', deniedRole: 'laborantin', expectId: pediatrie._id },
      { types: ['ordonnance'],      allowedRole: 'pharmacien', deniedRole: 'laborantin', expectId: ordonnance._id },
    ];

    for (const c of CASES) {
      await t.test(`type ${c.types[0]} — rôle autorisé (${c.allowedRole}) trouve le dossier réel`, async () => {
        const { status, body } = await call({ user: asRole(c.allowedRole), query: { q: KW, types: c.types } });
        assert.equal(status, 200);
        assert.ok(body.results.some(r => String(r.recordId) === String(c.expectId)), 'le dossier réel doit apparaître');
        assert.ok(body.results.every(r => r.type === c.types[0]), 'aucun autre type ne doit apparaître (filtre types respecté)');
      });

      await t.test(`type ${c.types[0]} — rôle non autorisé (${c.deniedRole}) ne voit rien pour ce type`, async () => {
        const { status, body } = await call({ user: asRole(c.deniedRole), query: { q: KW, types: c.types } });
        assert.equal(status, 200);
        assert.equal(body.results.length, 0, 'un rôle sans accès à cette collection ne doit recevoir aucun résultat, jamais une donnée d\'une autre collection');
      });
    }

    // ── (c) filtre "imagerie" = 2 collections, matrice de rôles distincte ──
    await t.test('type imagerie — radiologue voit ImagingResult ET Echographie', async () => {
      const { body } = await call({ user: asRole('radiologue'), query: { q: KW, types: ['imagerie'] } });
      const ids = body.results.map(r => String(r.recordId));
      assert.ok(ids.includes(String(imagerie._id)), 'ImagingResult doit apparaître pour radiologue');
      assert.ok(ids.includes(String(echographie._id)), 'Echographie doit apparaître pour radiologue');
    });

    await t.test('type imagerie — sage_femme voit Echographie mais PAS ImagingResult (matrice par collection, pas par filtre UI)', async () => {
      const { body } = await call({ user: asRole('sage_femme'), query: { q: KW, types: ['imagerie'] } });
      const ids = body.results.map(r => String(r.recordId));
      assert.ok(ids.includes(String(echographie._id)), 'Echographie autorise sage_femme (echographie.routes.js)');
      assert.ok(!ids.includes(String(imagerie._id)), 'ImagingResult (radiology.routes.js) exclut sage_femme — ne doit jamais fuiter ici');
    });

    // ── (d) recherche combinée multi-types, sans filtre — tout en un appel ──
    await t.test('recherche combinée — superadmin sans filtre de type retrouve les 9 dossiers fusionnés', async () => {
      const { status, body } = await call({ user: asRole('superadmin'), query: { q: KW } });
      assert.equal(status, 200);
      const ids = body.results.map(r => String(r.recordId));
      for (const expected of [consultation, hospitalisation, chirurgie, labo, imagerie, echographie, urgence, pediatrie, ordonnance]) {
        assert.ok(ids.includes(String(expected._id)), `le dossier ${expected._id} doit apparaître dans la recherche combinée`);
      }
      assert.equal(body.total, 9, 'les 9 dossiers doivent être comptés (fusion en mémoire complète avant pagination)');
      // Champs de navigation honnêtes : jamais un lien fictif pour un type sans onglet réel.
      const pedResult = body.results.find(r => String(r.recordId) === String(pediatrie._id));
      assert.equal(pedResult.tabTarget, null, 'aucun onglet PatientDetail.jsx réel pour la pédiatrie — jamais un lien fictif');
      assert.equal(pedResult.moduleRoute, '/pediatrie');
      const consultResult = body.results.find(r => String(r.recordId) === String(consultation._id));
      assert.equal(consultResult.tabTarget, 'consult');
      assert.equal(String(consultResult.patientId), String(patient._id));
    });

    await t.test('recherche combinée — pagination en mémoire respecte page/limit', async () => {
      const { body } = await call({ user: asRole('superadmin'), query: { q: KW, page: '1', limit: '3' } });
      assert.equal(body.results.length, 3);
      assert.equal(body.total, 9);
      assert.equal(body.page, 1);
      assert.equal(body.limit, 3);
    });

    // ── FICHE-UNIQUE-001 — patientId cible directement un patient déjà
    // identifié (fiche unique regroupée) : mêmes 9 dossiers retrouvés sans
    // aucun mot-clé, la matrice de permissions reste appliquée à l'identique. ──
    await t.test('patientId — retrouve les 9 dossiers de CE patient, sans aucun mot-clé', async () => {
      const { status, body } = await call({ user: asRole('superadmin'), query: { patientId: String(patient._id), limit: '50' } });
      assert.equal(status, 200);
      const ids = body.results.map(r => String(r.recordId));
      for (const expected of [consultation, hospitalisation, chirurgie, labo, imagerie, echographie, urgence, pediatrie, ordonnance]) {
        assert.ok(ids.includes(String(expected._id)), `patientId doit retrouver ${expected._id} sans mot-clé`);
      }
      assert.ok(body.results.every(r => String(r.patientId) === String(patient._id)), 'patientId ne doit jamais retourner le dossier d\'un autre patient');
    });

    await t.test('patientId — la matrice de permissions par rôle reste appliquée à l\'identique', async () => {
      const { body } = await call({ user: asRole('laborantin'), query: { patientId: String(patient._id), limit: '50' } });
      const types = new Set(body.results.map(r => r.type));
      assert.ok(types.has('laboratoire'), 'laborantin doit voir le laboratoire de ce patient');
      assert.ok(!types.has('consultation'), 'laborantin ne doit jamais voir les consultations, même via patientId');
      assert.ok(!types.has('ordonnance'), 'laborantin ne doit jamais voir les ordonnances, même via patientId');
    });

    await t.test('patientId invalide (pas un ObjectId) — ignoré proprement, jamais une erreur 500', async () => {
      const { status } = await call({ user: asRole('superadmin'), query: { patientId: 'not-an-object-id' } });
      assert.equal(status, 200);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});

// FICHE-UNIQUE-001 — PER_SOURCE_CAP (200) doit être signalé honnêtement
// (sourcesTruncated), jamais tronquer silencieusement une fiche patient.
// Fixture séparée (201 vraies consultations, un seul patient, un mot-clé
// unique) pour ne jamais interférer avec les comptes du test principal.
test('Dossiers Médicaux — PER_SOURCE_CAP signale honnêtement une troncature (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const medicalRecordsC = require('../controllers/medicalRecordsController');
  const Patient         = require('../models/Patient');
  const User            = require('../models/User');
  const Consultation    = require('../models/Consultation');

  const stamp = Date.now();
  const KW = `KWCAP${stamp}`;
  const cleanup = [];
  const asRole = (role) => ({ _id: new mongoose.Types.ObjectId(), role });
  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await medicalRecordsC.search(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({
      nom: `Cap${stamp}`, prenom: 'Testeur', sexe: 'F',
      date_naissance: new Date('1985-01-01'), numero_dossier: `DM-CAP-${stamp}`,
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecin = await User.create({
      email: `_dm-cap-${stamp}@_test.local`, password: 'Xx1aaaaa',
      nom: 'Praticien', prenom: 'Dr', role: 'medecin', statut: 'actif',
    });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));

    // 201 consultations réelles, un même patient — PER_SOURCE_CAP=200 doit
    // couper à 200, jamais 201, et le signaler.
    const docs = Array.from({ length: 201 }, (_, i) => ({
      patient: patient._id, medecin: medecin._id,
      diagnostic: `Diagnostic ${KW} ${i}`, statut: 'en_cours',
      date_consultation: new Date(Date.now() - i * 60000),
    }));
    const inserted = await Consultation.insertMany(docs, { ordered: false });
    cleanup.push(() => Consultation.deleteMany({ _id: { $in: inserted.map(d => d._id) } }));

    await t.test('sourcesTruncated signale "consultation" au-delà de PER_SOURCE_CAP', async () => {
      const { status, body } = await call({ user: asRole('superadmin'), query: { q: KW, types: ['consultation'], limit: '500' } });
      assert.equal(status, 200);
      assert.equal(body.results.length, 200, 'jamais plus de PER_SOURCE_CAP résultats bruts pour une seule collection');
      assert.ok(body.sourcesTruncated.includes('consultation'), 'la troncature doit être signalée, jamais silencieuse');
    });

    await t.test('patientId ciblé sur CE patient — 200 restent le plafond par collection, mais ce plafond est déjà bien au-delà d\'un historique réel pour 1 patient', async () => {
      const { body } = await call({ user: asRole('superadmin'), query: { patientId: String(patient._id), types: ['consultation'], limit: '500' } });
      assert.equal(body.results.length, 200);
      assert.ok(body.sourcesTruncated.includes('consultation'));
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
