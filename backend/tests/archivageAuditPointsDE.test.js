// AUDIT-ARCHIVAGE-D — GET /audit était restreint à superadmin seul, alors
// que l'objectif du chantier est "invisible pour tous sauf superadmin et
// adminclinique". Vérifié en HTTP réel (le seul moyen honnête de tester un
// middleware authorize() de routeur — appeler le contrôleur directement ne
// passe jamais par lui, cf. accessMatrix.test.js dont ce test reprend
// l'infrastructure de serveur isolé).
//
// AUDIT-ARCHIVAGE-E — 2 gaps mineurs inclus (photo patient/médicament,
// pièce jointe message), testés directement via les contrôleurs (pas de
// middleware de rôle en jeu ici, contrairement au Point D).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'ArchivageAuditDTest2026!';

async function login(base, email) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}
async function call(base, cookie, method, path) {
  const res = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie } });
  return res.status;
}

test('Archivage/Audit — Point D : /audit accessible à adminclinique, toujours refusé au-delà (HTTP réel)', { skip: !mongodExists() && 'mongod introuvable — impossible de démarrer un serveur isolé' }, async (t) => {
  const server = await startIsolatedServer();
  const BASE = server.baseUrl;
  const stamp = Date.now();

  try {
    await mongoose.connect(server.mongoUri);
    const User = require('../models/User');

    const adminclinique = `_archd-adminclinique-${stamp}@_test.local`;
    const superadmin    = `_archd-superadmin-${stamp}@_test.local`;
    const medecin       = `_archd-medecin-${stamp}@_test.local`;
    await User.create({ email: adminclinique, password: PASSWORD, nom: 'T', prenom: 'AdminClinique', role: 'adminclinique', statut: 'actif' });
    await User.create({ email: superadmin,    password: PASSWORD, nom: 'T', prenom: 'SuperAdmin',    role: 'superadmin',    statut: 'actif' });
    await User.create({ email: medecin,       password: PASSWORD, nom: 'T', prenom: 'Medecin',       role: 'medecin',       statut: 'actif' });

    const cookieAdminClinique = await login(BASE, adminclinique);
    const cookieSuperadmin    = await login(BASE, superadmin);
    const cookieMedecin       = await login(BASE, medecin);

    const endpoints = [
      { method: 'GET',  path: '/audit' },
      { method: 'GET',  path: '/audit/connexions' },
      { method: 'GET',  path: '/audit/suspects' },
      { method: 'GET',  path: '/audit/stats' },
      { method: 'POST', path: '/audit/archive' },
    ];

    for (const { method, path } of endpoints) {
      const statusAdminClinique = await call(BASE, cookieAdminClinique, method, path);
      assert.notEqual(statusAdminClinique, 403, `adminclinique doit désormais accéder à ${method} ${path}`);

      const statusSuperadmin = await call(BASE, cookieSuperadmin, method, path);
      assert.notEqual(statusSuperadmin, 403, `superadmin doit toujours accéder à ${method} ${path} (comportement inchangé)`);

      const statusMedecin = await call(BASE, cookieMedecin, method, path);
      assert.equal(statusMedecin, 403, `médecin ne doit toujours PAS accéder à ${method} ${path} — l'élargissement ne doit jamais dépasser superadmin+adminclinique`);
    }

    await User.deleteMany({ email: { $regex: /@_test\.local$/ } });
  } finally {
    await mongoose.disconnect();
    await server.stop();
  }
});

test('Archivage/Audit — Point E : gaps mineurs désormais tracés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Medication = require('../models/Medication');
  const User = require('../models/User');
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const AuditLog = require('../models/AuditLog');
  const patientsC = require('../controllers/patients.controller');
  const pharmacyC = require('../controllers/pharmacy.controller');
  const messagesC = require('../controllers/messages.controller');

  const stamp = Date.now();
  const created = { patients: [], meds: [], users: [], conversations: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  try {
    await t.test('patients.controller.js::uploadPhoto — désormais tracé', async () => {
      const patient = await Patient.create({ nom: `T-ARCHE1-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const admin = await User.create({ email: `t-arche1-${stamp}@test.local`, nom: 'A', prenom: 'A', role: 'superadmin', statut: 'actif' });
      created.users.push(admin);

      const { status } = await call(patientsC.uploadPhoto, { params: { id: patient._id.toString() }, file: { filename: `photo-${stamp}.jpg` }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);

      const log = await AuditLog.findOne({ action: 'UPDATE', module: 'patients', entite_id: patient._id.toString(), message: /Photo/ }).sort('-createdAt').lean();
      assert.ok(log, 'un changement de photo patient doit désormais produire une entrée AuditLog');
    });

    await t.test('pharmacy.controller.js::uploadPhoto — désormais tracé', async () => {
      const med = await Medication.create({ nom_commercial: `T-ARCHE2-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 10, stock_minimum: 5, prix_vente: 100, statut: 'disponible' });
      created.meds.push(med);
      const admin = await User.create({ email: `t-arche2-${stamp}@test.local`, nom: 'A', prenom: 'A', role: 'pharmacien', statut: 'actif' });
      created.users.push(admin);

      const { status } = await call(pharmacyC.uploadPhoto, { params: { id: med._id.toString() }, file: { filename: `photo-${stamp}.jpg` }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);

      const log = await AuditLog.findOne({ action: 'UPDATE', module: 'pharmacy', entite_id: med._id.toString(), message: /Photo/ }).sort('-createdAt').lean();
      assert.ok(log, 'un changement de photo médicament doit désormais produire une entrée AuditLog');
    });

    await t.test('messages.controller.js::sendAttachment — envoi réussi tracé, ET refus non-membre tracé (trouvé en marge)', async () => {
      const u1 = await User.create({ email: `t-arche3-1-${stamp}@test.local`, nom: 'U1', prenom: 'A', role: 'medecin', statut: 'actif' });
      const u2 = await User.create({ email: `t-arche3-2-${stamp}@test.local`, nom: 'U2', prenom: 'B', role: 'medecin', statut: 'actif' });
      created.users.push(u1, u2);
      const conv = await Conversation.create({ type: 'direct', membres: [u1._id, u2._id] });
      created.conversations.push(conv);

      const { status: statusOk } = await call(messagesC.sendAttachment, { params: { id: conv._id.toString() }, file: { filename: `piece-${stamp}.pdf`, originalname: 'piece.pdf' }, body: {}, user: u1, ip: '127.0.0.1' });
      assert.equal(statusOk, 200);
      const logOk = await AuditLog.findOne({ action: 'CREATE', module: 'messages', entite_id: conv._id.toString(), statut: 'succes', message: /Pièce jointe/ }).sort('-createdAt').lean();
      assert.ok(logOk, 'un envoi de pièce jointe réussi doit désormais produire une entrée AuditLog');

      const u3 = await User.create({ email: `t-arche3-3-${stamp}@test.local`, nom: 'U3', prenom: 'C', role: 'medecin', statut: 'actif' });
      created.users.push(u3);
      const { status: statusRefus } = await call(messagesC.sendAttachment, { params: { id: conv._id.toString() }, file: { filename: `piece2-${stamp}.pdf`, originalname: 'piece2.pdf' }, body: {}, user: u3, ip: '127.0.0.1' });
      assert.equal(statusRefus, 403);
      const logRefus = await AuditLog.findOne({ action: 'CREATE', module: 'messages', statut: 'echec', message: /non membre/ }).sort('-createdAt').lean();
      assert.ok(logRefus, 'un refus d\'envoi de pièce jointe (non membre) doit aussi être tracé en échec');
    });
  } finally {
    // AUDIT-ELEVE-5 — sendAttachment crée désormais un vrai document Message
    // (collection dédiée, plus Conversation.messages) : nettoyé ici pour ne
    // pas laisser de débris de test.
    for (const c of created.conversations) await Message.deleteMany({ conversation_id: c._id });
    for (const c of created.conversations) await Conversation.findByIdAndDelete(c._id);
    for (const m of created.meds) await Medication.findByIdAndDelete(m._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
