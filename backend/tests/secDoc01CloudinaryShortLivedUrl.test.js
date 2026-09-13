// SEC-DOC-01 (audit métier du 13 sept. 2026, Phase 4) — utils/cloudinary.js::
// uploadBuffer() signe une URL SANS expires_at : valide indéfiniment une
// fois obtenue (la signature ne dépend que de public_id/type/resource_type/
// version + le secret, jamais d'un horodatage). Une fois cette URL exposée
// (réponse JSON, redirection), elle reste utilisable pour toujours, même
// après révocation d'un accès — un document médical resterait accessible
// indéfiniment à quiconque l'a obtenue une seule fois légitimement.
//
// Corrigé en régénérant, à CHAQUE lecture autorisée (document.controller.js
// ::getAll/getOne, portal.controller.js::downloadDocument), une URL signée
// à courte durée de vie (getSignedDeliveryUrl, jamais persistée) plutôt que
// de resservir l'URL figée stockée en base (models/Document.js::
// cloudinary_public_id + resource_type/format/version). Un document en
// repli disque local (cloudinary_public_id absent) n'est pas concerné —
// non-régression testée explicitement.
//
// Stubbe cloudinary.v2.url (propriété mutable du singleton, lue à chaque
// appel par utils/cloudinary.js) pour observer précisément les options
// passées, sans jamais solliciter le réseau ni une vraie clé API.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const cloudinaryLib = require('cloudinary').v2;

test('SEC-DOC-01 — getSignedDeliveryUrl() régénère une URL signée à courte durée de vie, jamais l\'URL permanente figée', async (t) => {
  const cloudinaryUtil = require('../utils/cloudinary');
  const env = require('../config/env');
  const original = { name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET };
  const originalUrl = cloudinaryLib.url;

  try {
    env.CLOUDINARY_CLOUD_NAME = 'demo'; env.CLOUDINARY_API_KEY = '123'; env.CLOUDINARY_API_SECRET = 'secret';

    await t.test('passe bien expires_at (proche futur) et jamais l\'URL figée sans expiration', () => {
      const calls = [];
      const beforeSec = Math.floor(Date.now() / 1000);
      cloudinaryLib.url = (publicId, opts) => { calls.push({ publicId, opts }); return `https://res.cloudinary.com/demo/image/authenticated/s--stub--/v1/medisync/documents/${publicId}.pdf?_a=stub&expires_at=${opts.expires_at}`; };

      const url = cloudinaryUtil.getSignedDeliveryUrl({ public_id: 'medisync/documents/doc1', resource_type: 'image', format: 'pdf', version: 1 });
      const afterSec = Math.floor(Date.now() / 1000);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].opts.sign_url, true);
      assert.ok(calls[0].opts.expires_at >= beforeSec + 250 && calls[0].opts.expires_at <= afterSec + 310, 'expires_at doit correspondre à un futur proche (~5 min), ni absent ni une durée arbitraire longue');
      assert.match(url, /expires_at=/, 'preuve que la signature dépend bien d\'un horodatage, contrairement à uploadBuffer()');
    });

    await t.test('deux appels successifs produisent des expires_at différents — jamais une URL réutilisable indéfiniment mise en cache', async () => {
      cloudinaryLib.url = (publicId, opts) => `stub?expires_at=${opts.expires_at}`;
      const url1 = cloudinaryUtil.getSignedDeliveryUrl({ public_id: 'x', resource_type: 'image', format: 'jpg', version: 1 }, 1);
      await new Promise((r) => setTimeout(r, 1100));
      const url2 = cloudinaryUtil.getSignedDeliveryUrl({ public_id: 'x', resource_type: 'image', format: 'jpg', version: 1 }, 1);
      assert.notEqual(url1, url2, 'chaque appel doit recalculer un expires_at courant, jamais une valeur figée réutilisée');
    });
  } finally {
    env.CLOUDINARY_CLOUD_NAME = original.name; env.CLOUDINARY_API_KEY = original.key; env.CLOUDINARY_API_SECRET = original.secret;
    cloudinaryLib.url = originalUrl;
  }
});

test('SEC-DOC-01 — portal.controller.js::downloadDocument redirige vers une URL fraîche, jamais l\'URL permanente stockée (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DocumentModel = require('../models/Document');
  const portalC = require('../controllers/portal.controller');
  const cloudinaryLib3 = require('cloudinary').v2;
  const originalUrl = cloudinaryLib3.url;
  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null, redirected = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; }, redirect: (url) => { redirected = url; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body, redirected };
  };

  try {
    const patient = await Patient.create({ nom: `T-SECDOC01-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_t-secdoc01-${stamp}@_test.local` });
    const user = await User.create({ email: patient.email, password: 'Xx1aaaaa', nom: patient.nom, prenom: patient.prenom, role: 'patient', statut: 'actif', patient_id: patient._id });
    // Nettoyage : User + Document (référencent patient) avant Patient
    // lui-même — hook pre('findOneAndDelete') de Patient (ticket 0008 +
    // DB-001).
    cleanup.push(() => User.findByIdAndDelete(user._id));

    const OLD_PERMANENT_URL = 'https://res.cloudinary.com/demo/authenticated/s--OLD-PERMANENT-NO-EXPIRY--/medisync/documents/doc1.pdf';
    const doc = await DocumentModel.create({
      nom: 'resultat.pdf', patient: patient._id, fichier_path: OLD_PERMANENT_URL,
      cloudinary_public_id: 'medisync/documents/doc1', cloudinary_resource_type: 'image', cloudinary_format: 'pdf', cloudinary_version: 1,
    });
    cleanup.push(() => DocumentModel.findByIdAndDelete(doc._id));

    cloudinaryLib3.url = (publicId, opts) => `https://res.cloudinary.com/demo/authenticated/s--FRESH--/${publicId}?expires_at=${opts.expires_at}`;
    const { status, redirected } = await call(portalC.downloadDocument, { user, ip: '127.0.0.1', params: { id: doc._id } });
    assert.equal(status, 200);
    assert.notEqual(redirected, OLD_PERMANENT_URL, 'ne doit jamais rediriger vers l\'URL permanente stockée en base');
    assert.match(redirected, /expires_at=/, 'doit rediriger vers une URL fraîchement signée avec une expiration');

    const docLocal = await DocumentModel.create({ nom: 'local.pdf', patient: patient._id, fichier_path: '/uploads/documents/inexistant.pdf' });
    cleanup.push(() => DocumentModel.findByIdAndDelete(docLocal._id));
    const { status: statusLocal } = await call(portalC.downloadDocument, { user, ip: '127.0.0.1', params: { id: docLocal._id } });
    assert.equal(statusLocal, 404, 'non-régression — un document en repli disque local continue de suivre le chemin fs.existsSync existant (fichier absent ici, 404 honnête attendu)');
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
  } finally {
    cloudinaryLib3.url = originalUrl;
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});

test('SEC-DOC-01 — document.controller.js::getOne/getAll régénèrent fichier_path à chaque lecture pour un document Cloudinary (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Document = require('../models/Document');
  require('../models/User');
  require('../models/Patient');
  const documentC = require('../controllers/document.controller');
  const cloudinaryLib2 = require('cloudinary').v2;
  const originalUrl = cloudinaryLib2.url;
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    let n = 0;
    cloudinaryLib2.url = (publicId, opts) => `https://res.cloudinary.com/demo/authenticated/s--stub--/${publicId}?exp=${opts.expires_at}&call=${++n}`;

    const doc = await Document.create({
      nom: 'test.pdf', fichier_path: 'https://res.cloudinary.com/demo/authenticated/s--OLD-PERMANENT--/medisync/documents/doc1.pdf',
      cloudinary_public_id: 'medisync/documents/doc1', cloudinary_resource_type: 'image', cloudinary_format: 'pdf', cloudinary_version: 1,
      created_by: admin._id,
    });
    cleanup.push(() => Document.findByIdAndDelete(doc._id));

    const r1 = await call(documentC.getOne, { params: { id: doc._id }, user: admin });
    const r2 = await call(documentC.getOne, { params: { id: doc._id }, user: admin });

    assert.notEqual(r1.body.document.fichier_path, 'https://res.cloudinary.com/demo/authenticated/s--OLD-PERMANENT--/medisync/documents/doc1.pdf', 'ne doit jamais renvoyer l\'URL brute figée stockée en base');
    assert.notEqual(r1.body.document.fichier_path, r2.body.document.fichier_path, 'deux lectures successives doivent produire deux URL différentes (régénérées, pas mises en cache)');

    const docLocal = await Document.create({ nom: 'local.pdf', fichier_path: '/uploads/documents/local.pdf', created_by: admin._id });
    cleanup.push(() => Document.findByIdAndDelete(docLocal._id));
    const r3 = await call(documentC.getOne, { params: { id: docLocal._id }, user: admin });
    assert.equal(r3.body.document.fichier_path, '/uploads/documents/local.pdf', 'un document en repli disque local (sans cloudinary_public_id) doit garder fichier_path inchangé — non-régression');
  } finally {
    cloudinaryLib2.url = originalUrl;
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
