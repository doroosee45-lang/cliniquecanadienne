// A-MSG-01 (audit métier du 13 sept. 2026, Phase 4) — createGroup()
// (POST /messages/groups) construisait Conversation.membres directement
// depuis req.body.membres, sans jamais vérifier l'existence ni le rôle de
// ces IDs — contrairement à getOrCreate() (SEC-B-06), qui applique déjà
// cette garde pour la conversation directe. Un ID de patient (ou fabriqué)
// pouvait donc rejoindre un groupe professionnel, obtenant ensuite un accès
// légitime aux échanges via GET /messages/:id (membres: req.user._id,
// aucune restriction de rôle à ce niveau-là). Cette messagerie est
// explicitement réservée aux échanges entre membres du personnel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('A-MSG-01 — createGroup rejette un membre patient ou fabriqué, accepte de vrais comptes staff (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const Conversation = require('../models/Conversation');
  const messagesC = require('../controllers/messages.controller');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({
      nom: `AMSG01-Medecin-${stamp}`, prenom: 'Test', email: `amsg01-medecin-${stamp}@test.local`,
      password: 'Test123456!', role: 'medecin', statut: 'actif',
    });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));
    const collegue = await User.create({
      nom: `AMSG01-Infirmier-${stamp}`, prenom: 'Test', email: `amsg01-infirmier-${stamp}@test.local`,
      password: 'Test123456!', role: 'infirmier', statut: 'actif',
    });
    cleanup.push(() => User.findByIdAndDelete(collegue._id));

    const req = { user: { _id: medecin._id } };

    await t.test('un patient réel dans membres est refusé (403), aucun groupe créé', async () => {
      const patient = await Patient.create({ nom: `AMSG01Pat-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      // Patients ne sont pas des Users dans ce schéma — le scénario réel de
      // l'audit est un ID de compte role:'patient' (portail patient, User
      // avec role='patient'), simulé ici directement pour rester fidèle au
      // modèle réellement vérifié par messages.controller.js (User.role).
      const comptePatient = await User.create({
        nom: `AMSG01PatUser-${stamp}`, prenom: 'Portail', email: `amsg01-patient-${stamp}@test.local`,
        password: 'Test123456!', role: 'patient', statut: 'actif', patient_id: patient._id,
      });
      cleanup.push(() => User.findByIdAndDelete(comptePatient._id));

      const r = await call(messagesC.createGroup, { ...req, ip: '127.0.0.1', body: { nom: `Groupe-${stamp}-A`, membres: [String(collegue._id), String(comptePatient._id)] } });
      assert.equal(r.status, 403, JSON.stringify(r.body));
      const count = await Conversation.countDocuments({ nom: `Groupe-${stamp}-A` });
      assert.equal(count, 0);
    });

    await t.test('un ID de membre fabriqué (format valide, mais aucun User réel) est refusé (400), aucun groupe créé', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const r = await call(messagesC.createGroup, { ...req, ip: '127.0.0.1', body: { nom: `Groupe-${stamp}-B`, membres: [String(collegue._id), String(fauxId)] } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Conversation.countDocuments({ nom: `Groupe-${stamp}-B` });
      assert.equal(count, 0);
    });

    await t.test('scénario nominal — des membres staff réels sont acceptés (non-régression)', async () => {
      const r = await call(messagesC.createGroup, { ...req, ip: '127.0.0.1', body: { nom: `Groupe-${stamp}-C`, membres: [String(collegue._id)] } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Conversation.findByIdAndDelete(r.body.conversation._id));
      const membreIds = r.body.conversation.membres.map(m => String(m._id || m));
      assert.ok(membreIds.includes(String(medecin._id)), 'le créateur doit toujours être membre');
      assert.ok(membreIds.includes(String(collegue._id)));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
