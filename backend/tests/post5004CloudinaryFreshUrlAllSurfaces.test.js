// POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — HAUTE. La
// re-signature à chaque lecture autorisée (SEC-DOC-01) n'avait été appliquée
// qu'à Document (document.controller.js/portal.controller.js) : photos
// patients, photos médicaments, images radiologie, images échographie et
// pièces jointes de messagerie stockaient une URL Cloudinary signée SANS
// expiration (utils/cloudinary.js::uploadBuffer — valide et partageable
// indéfiniment une fois obtenue), jamais régénérée à la lecture.
//
// Corrigé en appliquant exactement le même principe que
// secDoc01CloudinaryShortLivedUrl.test.js pour Document : chaque surface
// stocke désormais public_id/resource_type/format/version, et régénère une
// URL signée à courte durée de vie (getSignedDeliveryUrl) à CHAQUE lecture
// autorisée, jamais persistée.
//
// Même technique de test que le précédent SEC-DOC-01 : stub de
// cloudinary.v2.url (propriété mutable du singleton, lue à chaque appel),
// jamais de vraie requête réseau Cloudinary. Base MongoDB réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const cloudinaryLib = require('cloudinary').v2;

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('POST5-004 — photo/image/pièce jointe : URL Cloudinary régénérée à chaque lecture, jamais l\'URL permanente figée (base réelle, 5 surfaces)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const env = require('../config/env');
  const original = { name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET };
  const originalUrl = cloudinaryLib.url;
  const stamp = Date.now();
  const cleanup = [];

  const OLD_PERMANENT = (publicId) => `https://res.cloudinary.com/demo/authenticated/s--OLD-PERMANENT-NO-EXPIRY--/${publicId}`;

  try {
    env.CLOUDINARY_CLOUD_NAME = 'demo'; env.CLOUDINARY_API_KEY = '123'; env.CLOUDINARY_API_SECRET = 'secret';
    let n = 0;
    cloudinaryLib.url = (publicId, opts) => `https://res.cloudinary.com/demo/authenticated/s--stub--/${publicId}?exp=${opts.expires_at}&call=${++n}`;

    const Patient = require('../models/Patient');
    const Medication = require('../models/Medication');
    const ImagingResult = require('../models/ImagingResult');
    const Echographie = require('../models/Echographie');
    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');
    const patientsC = require('../controllers/patients.controller');
    const pharmacyC = require('../controllers/pharmacy.controller');
    const radiologyC = require('../controllers/radiology.controller');
    const echographieC = require('../controllers/echographieController');
    const messagesC = require('../controllers/messages.controller');

    const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };

    await t.test('Patient.photo — getOne/getAll régénèrent une URL fraîche, jamais l\'URL figée stockée', async () => {
      const publicId = `medisync/patients/p-${stamp}`;
      const patient = await Patient.create({
        nom: `POST5004-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01',
        photo: OLD_PERMANENT(publicId), photo_public_id: publicId, photo_resource_type: 'image', photo_format: 'jpg', photo_version: 1,
      });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const r1 = await call(patientsC.getOne, { params: { id: patient._id }, user: admin });
      const r2 = await call(patientsC.getOne, { params: { id: patient._id }, user: admin });
      assert.notEqual(r1.body.patient.photo, OLD_PERMANENT(publicId), 'ne doit jamais renvoyer l\'URL brute figée');
      assert.notEqual(r1.body.patient.photo, r2.body.patient.photo, 'deux lectures successives doivent produire deux URL différentes');

      const rAll = await call(patientsC.getAll, { query: {}, user: admin });
      const found = rAll.body.patients.find(p => String(p._id) === String(patient._id));
      assert.ok(found);
      assert.notEqual(found.photo, OLD_PERMANENT(publicId));

      const patientLocal = await Patient.create({ nom: `POST5004L-${stamp}`, prenom: 'Local', sexe: 'F', date_naissance: '1990-01-01', photo: '/uploads/patients/local.jpg' });
      cleanup.push(() => Patient.findByIdAndDelete(patientLocal._id));
      const rLocal = await call(patientsC.getOne, { params: { id: patientLocal._id }, user: admin });
      assert.equal(rLocal.body.patient.photo, '/uploads/patients/local.jpg', 'non-régression — repli disque local inchangé');
    });

    await t.test('Medication.photo — getOne/getAll régénèrent une URL fraîche, jamais l\'URL figée stockée', async () => {
      const publicId = `medisync/medications/m-${stamp}`;
      const med = await Medication.create({
        nom_commercial: `POST5004-Med-${stamp}`, dci: 'Test', forme: 'comprime', dosage: '500mg',
        photo: OLD_PERMANENT(publicId), photo_public_id: publicId, photo_resource_type: 'image', photo_format: 'jpg', photo_version: 1,
      });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const r1 = await call(pharmacyC.getOne, { params: { id: med._id } });
      const r2 = await call(pharmacyC.getOne, { params: { id: med._id } });
      assert.notEqual(r1.body.medication.photo, OLD_PERMANENT(publicId));
      assert.notEqual(r1.body.medication.photo, r2.body.medication.photo);

      const rAll = await call(pharmacyC.getAll, { query: {} });
      const found = rAll.body.medications.find(m => String(m._id) === String(med._id));
      assert.ok(found);
      assert.notEqual(found.photo, OLD_PERMANENT(publicId));
    });

    await t.test('ImagingResult.images (Radiologie) — normalize() régénère une URL fraîche par image, jamais l\'URL figée', async () => {
      const publicId = `medisync/radiology/r-${stamp}`;
      const img = await ImagingResult.create({
        patient_nom: 'Test', type_examen: 'Radio', numero: `IMG-POST5004-${stamp}`,
        images: [{ filename: 'x.jpg', path: OLD_PERMANENT(publicId), type_mime: 'image/jpeg', taille: 100, cloudinary_public_id: publicId, cloudinary_resource_type: 'image', cloudinary_format: 'jpg', cloudinary_version: 1 }],
      });
      cleanup.push(() => ImagingResult.findByIdAndDelete(img._id));

      const r1 = await call(radiologyC.getOne, { params: { id: img._id } });
      const r2 = await call(radiologyC.getOne, { params: { id: img._id } });
      assert.notEqual(r1.body.examen.images[0].path, OLD_PERMANENT(publicId));
      assert.notEqual(r1.body.examen.images[0].path, r2.body.examen.images[0].path);
    });

    await t.test('Echographie.images — getOne/getAll régénèrent une URL fraîche par image, jamais l\'URL figée', async () => {
      const publicId = `medisync/echographie/e-${stamp}`;
      const patientEcho = await Patient.create({ nom: `POST5004E-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patientEcho._id));
      const echo = await Echographie.create({
        patient: patientEcho._id, patient_nom: 'Test', type: 'Test',
        images: [{ url: OLD_PERMANENT(publicId), description: 'x.jpg', cloudinary_public_id: publicId, cloudinary_resource_type: 'image', cloudinary_format: 'jpg', cloudinary_version: 1 }],
      });
      cleanup.push(() => Echographie.findByIdAndDelete(echo._id));

      const r1 = await call(echographieC.getOne, { params: { id: echo._id } });
      const r2 = await call(echographieC.getOne, { params: { id: echo._id } });
      assert.notEqual(r1.body.demande.images[0].url, OLD_PERMANENT(publicId));
      assert.notEqual(r1.body.demande.images[0].url, r2.body.demande.images[0].url);

      const rAll = await call(echographieC.getAll, { query: {} });
      const found = rAll.body.demandes.find(d => String(d._id) === String(echo._id));
      assert.ok(found);
      assert.notEqual(found.images[0].url, OLD_PERMANENT(publicId));
    });

    await t.test('Message.pieceJointe — getMessages régénère une URL fraîche, jamais l\'URL figée stockée', async () => {
      const publicId = `medisync/messages/msg-${stamp}`;
      const conv = await Conversation.create({ type: 'direct', membres: [admin._id, new mongoose.Types.ObjectId()], created_by: admin._id });
      cleanup.push(() => Conversation.findByIdAndDelete(conv._id));
      const msg = await Message.create({
        conversation_id: conv._id, expediteur: admin._id, contenu: '',
        pieceJointe: { filename: 'x.jpg', path: OLD_PERMANENT(publicId), type: 'image', cloudinary_public_id: publicId, cloudinary_resource_type: 'image', cloudinary_format: 'jpg', cloudinary_version: 1 },
        lu_par: [admin._id],
      });
      cleanup.push(() => Message.findByIdAndDelete(msg._id));

      const r1 = await call(messagesC.getMessages, { params: { id: conv._id }, query: {}, user: admin });
      const r2 = await call(messagesC.getMessages, { params: { id: conv._id }, query: {}, user: admin });
      const found1 = r1.body.messages.find(m => String(m._id) === String(msg._id));
      const found2 = r2.body.messages.find(m => String(m._id) === String(msg._id));
      assert.ok(found1); assert.ok(found2);
      assert.notEqual(found1.pieceJointe.path, OLD_PERMANENT(publicId), 'ne doit jamais renvoyer l\'URL brute figée');
      assert.notEqual(found1.pieceJointe.path, found2.pieceJointe.path, 'deux lectures successives doivent produire deux URL différentes');
    });
  } finally {
    env.CLOUDINARY_CLOUD_NAME = original.name; env.CLOUDINARY_API_KEY = original.key; env.CLOUDINARY_API_SECRET = original.secret;
    cloudinaryLib.url = originalUrl;
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
