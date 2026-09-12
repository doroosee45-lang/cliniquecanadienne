// CLIN-04 (correction du 12 sept. 2026, audit indépendant) —
// laboratory.controller.js::create, radiology.controller.js::create et la
// génération auto depuis consultations.controller.js::create utilisaient
// tous countDocuments()+1 pour numeroter LabResult/ImagingResult : sous
// création concurrente, deux requêtes pouvaient lire le même compte avant
// que l'une ou l'autre ne persiste, produisant un doublon — vérifié
// réellement en base avant ce correctif (un doublon IMG-2026-0007 existait
// déjà dans les données réelles de développement). Corrigé : compteur
// atomique ($inc + upsert, utils/counter.js — même mécanisme déjà utilisé
// par chirurgie/bloc/pregnancy/etc.) partagé entre les deux voies de
// création, plus un index unique en filet de sécurité final.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('CLIN-04 — numérotation LabResult/ImagingResult atomique et unique, jamais de doublon même sous création concurrente', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Consultation = require('../models/Consultation');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const laboC = require('../controllers/laboratory.controller');
  const radioC = require('../controllers/radiology.controller');
  const consultationsC = require('../controllers/consultations.controller');

  // L'index unique est construit de façon asynchrone à la connexion
  // (autoIndex) — sans cet await, il pourrait ne pas encore exister au
  // moment du dernier test ci-dessous.
  await LabResult.init();
  await ImagingResult.init();

  const stamp = Date.now();
  const created = { patients: [], users: [], catalogues: [], consultations: [], labResults: [], imagingResults: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `Clin04-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);
    const medecin = await User.create({ email: `_clin04-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test4', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    await t.test('laboratory.controller.js::create — deux créations concurrentes reçoivent des numeros distincts, jamais un doublon', async () => {
      const reqBody = { patient: patient._id, medecin: medecin._id, service_demandeur: 'Test' };
      const [{ body: b1 }, { body: b2 }] = await Promise.all([
        call(laboC.create, { user: medecin, ip: '127.0.0.1', body: reqBody }),
        call(laboC.create, { user: medecin, ip: '127.0.0.1', body: reqBody }),
      ]);
      created.labResults.push(b1.result._id, b2.result._id);
      assert.notEqual(b1.result.numero, b2.result.numero, 'deux créations concurrentes ne doivent jamais produire le même numero');
      assert.match(b1.result.numero, /^LAB-\d{4}-\d{4}$/);
      assert.match(b2.result.numero, /^LAB-\d{4}-\d{4}$/);
    });

    await t.test('radiology.controller.js::create — deux créations concurrentes reçoivent des numeros distincts, jamais un doublon', async () => {
      const reqBody = { patient: patient._id, service_demandeur: 'Test' };
      const [{ body: b1 }, { body: b2 }] = await Promise.all([
        call(radioC.create, { user: medecin, ip: '127.0.0.1', body: reqBody }),
        call(radioC.create, { user: medecin, ip: '127.0.0.1', body: reqBody }),
      ]);
      created.imagingResults.push(b1.examen._id, b2.examen._id);
      assert.notEqual(b1.examen.numero, b2.examen.numero);
      assert.match(b1.examen.numero, /^IMG-\d{4}-\d{4}$/);
      assert.match(b2.examen.numero, /^IMG-\d{4}-\d{4}$/);
    });

    await t.test('la génération auto depuis la clôture de consultation partage la même séquence — jamais de collision avec la création directe', async () => {
      const catNFS = await ExamCatalogue.create({ nom: 'Numération Formule Sanguine', code: `NFS-C4-${stamp}`, type: 'laboratoire', prix: 5500, statut: 'actif' });
      created.catalogues.push(catNFS._id);

      const { status, body } = await call(consultationsC.create, {
        user: medecin, ip: '127.0.0.1',
        body: {
          patient: patient._id, medecin: medecin._id, service: 'Médecine générale', statut: 'terminee',
          examens_complementaires: [{ type: 'biologie', libelle: 'NFS complète', priorite: 'normal' }],
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.consultations.push(body.consultation._id);
      created.labResults.push(...body.lab_results);

      const lab = await LabResult.findById(body.lab_results[0]).lean();
      assert.match(lab.numero, /^LAB-\d{4}-\d{4}$/);

      // Aucun autre LabResult créé pendant ce test (direct ou via
      // consultation) ne partage ce numero — même compteur, jamais de
      // collision entre les deux voies de création.
      const tousLesNumeros = await LabResult.find({ _id: { $in: created.labResults } }).distinct('numero');
      assert.equal(tousLesNumeros.length, created.labResults.length, 'chaque LabResult créé dans ce test a un numero réellement unique');
    });

    await t.test('preuve du filet de sécurité final : l\'index unique en base rejette réellement un numero dupliqué, même hors du chemin applicatif normal', async () => {
      const existant = await LabResult.findById(created.labResults[0]).lean();
      await assert.rejects(
        () => LabResult.create({ patient: patient._id, numero: existant.numero, statut: 'en_attente' }),
        (err) => err && (err.code === 11000 || /duplicate/i.test(err.message)),
        'MongoDB doit refuser un numero dupliqué grâce à l\'index unique, indépendamment de la logique applicative'
      );
    });
  } finally {
    await LabResult.deleteMany({ _id: { $in: created.labResults } });
    await ImagingResult.deleteMany({ _id: { $in: created.imagingResults } });
    await Consultation.deleteMany({ _id: { $in: created.consultations } });
    await ExamCatalogue.deleteMany({ _id: { $in: created.catalogues } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
