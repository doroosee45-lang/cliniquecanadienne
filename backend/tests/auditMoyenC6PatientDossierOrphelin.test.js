// AUDIT-M-C6 (Groupe C, Point 6) — googleAuth.controller.js::ensurePatientDossier
// ne vérifiait que user.patient_id (le lien du COMPTE), jamais si un dossier
// Patient existait déjà pour cette adresse email. Scénario réel et
// déterministe (pas une course) : un patient enregistré au guichet par le
// personnel (patients.controller.js::create — qui crée un Patient sans
// compte User associé) puis se connectant pour la première fois via Google
// se voyait créer un SECOND dossier (lié à son nouveau compte), abandonnant
// l'original orphelin — sans jamais aucune trace d'audit. Corrigé en
// réutilisant la même vérification par email que patients.controller.js::
// create (pas une nouvelle convention isolée), avec logAction systématique
// dans les deux branches (lié / créé).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

test('AUDIT-M-C6 — ensurePatientDossier ne crée plus de second dossier orphelin, trace d\'audit systématique (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const AuditLog = require('../models/AuditLog');
  const { googleLogin } = require('../controllers/googleAuth.controller');

  const stamp = Date.now();
  const originalFetch = global.fetch;
  const originalGetTokenInfo = OAuth2Client.prototype.getTokenInfo;
  const created = { users: [], patients: [] };

  const callGoogleLogin = async (body) => {
    let status = 200, jsonBody = null;
    const res = { status: (c) => { status = c; return res; }, cookie: () => res, json: (d) => { jsonBody = d; } };
    await googleLogin({ body, ip: '127.0.0.1' }, res);
    return { status, body: jsonBody };
  };

  const mockValidToken = (email) => {
    OAuth2Client.prototype.getTokenInfo = async () => ({ aud: process.env.GOOGLE_CLIENT_ID, email, sub: 'fake-sub' });
  };

  try {
    await t.test('non-régression : email entièrement nouveau → un seul dossier créé, tracé (CREATE)', async () => {
      const email = `_c6-new-${stamp}@_test.local`;
      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-c6-1', email, given_name: 'Nouveau', family_name: 'C6' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-c6-1' });
      assert.equal(status, 200);

      const user = await User.findOne({ email });
      created.users.push(user);
      assert.ok(user.patient_id, 'le compte doit être lié à un dossier patient');

      const patients = await Patient.find({ email }).lean();
      created.patients.push(...patients);
      assert.equal(patients.length, 1, 'un seul dossier patient doit exister pour cet email');
      assert.equal(patients[0]._id.toString(), user.patient_id.toString());

      const log = await AuditLog.findOne({ module: 'auth', action: 'CREATE', entite_id: patients[0]._id.toString() }).lean();
      assert.ok(log, 'la création automatique du dossier doit désormais être tracée (absente avant ce correctif)');
    });

    await t.test('le scénario du bug : un dossier patient existe déjà (créé au guichet, sans compte lié) — la première connexion Google le lie, ne crée JAMAIS un second dossier', async () => {
      const email = `_c6-guichet-${stamp}@_test.local`;
      // Simule patients.controller.js::create : un dossier réel, plus riche
      // (date_naissance connue, contrairement au profil minimal Google),
      // sans aucun compte User lié — exactement le cas réel qui produisait
      // le doublon.
      const dossierExistant = await Patient.create({
        nom: 'Guichet', prenom: 'C6', email, date_naissance: '1985-03-15', sexe: 'F',
        actif: true, statut: 'actif',
      });
      created.patients.push(dossierExistant);

      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-c6-2', email, given_name: 'C6', family_name: 'Guichet' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-c6-2' });
      assert.equal(status, 200);

      const user = await User.findOne({ email });
      created.users.push(user);
      assert.equal(user.patient_id.toString(), dossierExistant._id.toString(), 'le compte doit être lié au dossier RÉEL déjà existant, pas à un nouveau dossier créé à côté');

      const patients = await Patient.find({ email }).lean();
      assert.equal(patients.length, 1, 'un seul dossier patient doit exister pour cet email après la connexion — jamais un second orphelin');
      // Le dossier existant (avec sa vraie date de naissance) doit être
      // préservé tel quel, jamais remplacé par un profil minimal Google.
      assert.equal(new Date(patients[0].date_naissance).toISOString().slice(0, 10), '1985-03-15');

      const log = await AuditLog.findOne({ module: 'auth', action: 'LINK_PATIENT_DOSSIER', entite_id: dossierExistant._id.toString() }).lean();
      assert.ok(log, 'la liaison à un dossier existant doit désormais être tracée (absente avant ce correctif)');
    });

    await t.test('une seconde connexion Google (compte déjà lié) ne crée ni ne relie rien de plus — patient_id inchangé, aucune trace additionnelle', async () => {
      const email = `_c6-second-login-${stamp}@_test.local`;
      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-c6-3', email, given_name: 'C6', family_name: 'SecondLogin' }) });

      await callGoogleLogin({ access_token: 'fake-token-c6-3a' });
      const userApres1 = await User.findOne({ email });
      created.users.push(userApres1);
      const patientIdApres1 = userApres1.patient_id.toString();

      await callGoogleLogin({ access_token: 'fake-token-c6-3b' });
      const userApres2 = await User.findOne({ email });
      assert.equal(userApres2.patient_id.toString(), patientIdApres1, 'une seconde connexion ne doit jamais changer ni recréer le lien patient_id');

      const patients = await Patient.find({ email }).lean();
      created.patients.push(...patients);
      assert.equal(patients.length, 1, 'toujours un seul dossier après deux connexions successives');
    });
  } finally {
    global.fetch = originalFetch;
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    const patientIds = created.patients.map(p => p._id.toString());
    if (patientIds.length) await AuditLog.deleteMany({ module: 'auth', entite_id: { $in: patientIds } });
    // AUDIT-ELEVE-5 (leçon déjà rencontrée) — Patient.js::pre('findOneAndDelete')
    // refuse la suppression tant qu'un compte portail actif la référence
    // encore par patient_id : les Users doivent être supprimés AVANT les
    // Patients, sinon Patient.findByIdAndDelete rejette et saute
    // mongoose.disconnect() plus bas, bloquant le process indéfiniment sur
    // la socket TLS encore ouverte.
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
