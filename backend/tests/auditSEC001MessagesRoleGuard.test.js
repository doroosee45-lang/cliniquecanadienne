// SEC-001 (audit indépendant du 4 sept. 2026) — POST /messages/patient-sms et
// POST /messages/patient-email n'avaient aucune restriction de rôle : un
// compte role:'patient' authentifié pouvait déclencher un vrai envoi SMS/
// e-mail vers n'importe quel autre patient de la base. Corrigé par
// authorize(...STAFF) dans messages.routes.js (STAFF exclut explicitement
// 'patient', utils/roles.js).
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (tests/helpers/
// isolatedServer.js — vrai server.js, vrai routeur Express, vrai middleware
// authorize(), vraie base MongoDB locale jetable), via de vraies requêtes
// HTTP avec un vrai cookie de session obtenu par un vrai POST /auth/login —
// jamais un appel direct au contrôleur qui contournerait le routeur/
// middleware, et jamais un mock de sms.sendSms/mail.sendEmail : ce qui est
// vérifié ici est la porte d'autorisation et la journalisation réelle en
// base, pas le canal d'envoi lui-même (déjà couvert ailleurs, avec stub
// explicite, par auditP2MessagingActions.test.js).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'SEC001TestPass1!';
// AUDIT-SEC-001-TEST — isolatedServer.js ne vide que RESEND_API_KEY pour
// le serveur spawné, jamais TWILIO_*. Un vrai envoi SMS déclencherait donc un
// vrai appel réseau sortant vers l'API Twilio avec les identifiants réels
// (connus invalides, cf. audit du 4 sept. — l'API Twilio répond
// "Authenticate") ; dans cet environnement sandbox, cet appel sortant peut
// bloquer plutôt qu'échouer vite. Chaque fetch est donc borné explicitement
// (10s) pour échouer proprement plutôt que de bloquer la session en cas de
// souci réseau — indépendant de ce que teste réellement SEC-001.
const FETCH_TIMEOUT_MS = 10000;
const withTimeout = (opts) => ({ ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, withTimeout({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  if (res.status !== 200) throw new Error(`login ${email} a échoué (${res.status})`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('SEC-001 — POST /messages/patient-sms et /patient-email refusent réellement le rôle patient (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  // AUDIT-SEC-001-TEST — variables déclarées en amont et nettoyage dans un
  // SEUL finally couvrant tout, pour qu'un échec de création de fixture (ou
  // n'importe quelle étape) ne saute jamais mongoose.disconnect()/server.stop()
  // — un premier brouillon de ce test laissait la connexion Mongo ouverte sur
  // une erreur de fixture, ce qui empêchait le process de se terminer
  // proprement (~90s de blocage constaté avant correction).
  const created = { users: [], patients: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const AuditLog = require('../models/AuditLog');

    const stamp = Date.now();

    // Compte patient (l'attaquant potentiel) + son propre dossier Patient.
    const patientCible = await Patient.create({
      nom: `Cible-${stamp}`, prenom: 'P', date_naissance: '1988-04-12', sexe: 'F',
      telephone: '+242061112222', email: `cible-${stamp}@_test.local`,
    });
    created.patients.push(patientCible._id);
    const patientAttaquant = await Patient.create({
      nom: `Attaquant-${stamp}`, prenom: 'A', date_naissance: '1990-01-01', sexe: 'M',
    });
    created.patients.push(patientAttaquant._id);
    const userPatient = await User.create({
      email: `_sec001-patient-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Attaquant', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientAttaquant._id,
    });
    created.users.push(userPatient._id);

    // Compte professionnel autorisé (contrôle négatif — doit toujours passer).
    const userMedecin = await User.create({
      email: `_sec001-medecin-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Test', prenom: 'Medecin', role: 'medecin', statut: 'actif',
    });
    created.users.push(userMedecin._id);

    const cookiePatient = await login(server.baseUrl, userPatient.email);
    const cookieMedecin = await login(server.baseUrl, userMedecin.email);

    await t.test('rôle patient → 403 réel sur /messages/patient-sms (vraie requête HTTP, vrai cookie de session)', async () => {
      const before = await AuditLog.countDocuments({ action: 'ACCESS_DENIED', utilisateur: userPatient._id });
      const res = await fetch(`${server.baseUrl}/messages/patient-sms`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookiePatient },
        body: JSON.stringify({ patient: patientCible._id.toString(), contenu: 'Message non sollicité' }),
      }));
      assert.equal(res.status, 403, 'un compte role:patient doit recevoir un 403 réel du serveur, pas un contournement côté test');

      // Le refus doit être une vraie écriture en base (authorize() journalise
      // ACCESS_DENIED), pas seulement une réponse HTTP isolée.
      const after = await AuditLog.countDocuments({ action: 'ACCESS_DENIED', utilisateur: userPatient._id });
      assert.equal(after, before + 1, 'le refus doit être journalisé dans AuditLog (vraie écriture en base)');
    });

    await t.test('rôle patient → 403 réel sur /messages/patient-email', async () => {
      const res = await fetch(`${server.baseUrl}/messages/patient-email`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookiePatient },
        body: JSON.stringify({ patient: patientCible._id.toString(), sujet: 'Sujet', contenu: 'Message non sollicité' }),
      }));
      assert.equal(res.status, 403);
    });

    await t.test('rôle medecin (STAFF) → passe toujours la porte d\'autorisation (pas de 403)', async () => {
      // AUDIT-SEC-001-TEST — contenu volontairement vide : sendPatientSms
      // (messages.controller.js) valide `contenu` AVANT tout accès à
      // Patient/sms.sendSms (retour 400 immédiat) — ce qui prouve que la
      // requête a bien franchi authorize()+STAFF et atteint le contrôleur,
      // sans dépendre d'un vrai envoi Twilio (indisponible/lent dans cet
      // environnement, cf. commentaire d'en-tête). Un 403 ici serait encore
      // la porte d'autorisation qui bloque ; un 400 prouve qu'elle a laissé
      // passer et que c'est la validation MÉTIER qui répond ensuite.
      const res = await fetch(`${server.baseUrl}/messages/patient-sms`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieMedecin },
        body: JSON.stringify({ patient: patientCible._id.toString(), contenu: '' }),
      }));
      assert.notEqual(res.status, 403, 'un rôle professionnel ne doit jamais être bloqué par cette restriction');
      assert.equal(res.status, 400, 'doit atteindre la validation métier du contrôleur (contenu vide), pas être arrêté par authorize()');
      const body = await res.json();
      assert.match(body.message, /Message requis/);
    });
  } finally {
    if (connected) {
      const AuditLog = require('../models/AuditLog');
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await AuditLog.deleteMany({ utilisateur: { $in: created.users } });
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
