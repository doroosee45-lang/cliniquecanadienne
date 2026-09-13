// Phase 10.1 — rejeu complet de la checklist de baseline
// (docs/decisions/baseline-checklist-10x23.md), 10 rôles × 23 modules.
//
// Contrairement à accessMatrix.test.js (qui exige un serveur démarré à la
// main et se contente de "skip" sinon — c'est exactement ce mécanisme qui,
// en présence d'un serveur de développement resté allumé, a fait tourner ce
// genre de test pour de vrai contre la base Atlas partagée et laissé le
// résidu nettoyé avant cette phase), ce fichier démarre et arrête son
// propre serveur isolé (tests/helpers/isolatedServer.js) : il s'exécute
// donc automatiquement dans `npm test`, jamais contre Atlas, jamais
// dépendant d'un process oublié.
//
// Reprend les 23 modules du regroupement documenté, avec pour chacun le
// verdict OK/Partiel/KO déjà consigné par rôle — objectif : faire passer
// les 10 modules encore "Vérifié statiquement" à une preuve HTTP réelle, et
// re-confirmer que les 13 déjà "Live-testé" n'ont pas régressé depuis leur
// dernière vérification.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'BaselinePhase10Test2026!';
// 'patient' inclus délibérément sur chaque module professionnel : aucun ne
// doit jamais l'autoriser (cf. accessMatrix.test.js, régression la plus
// grave possible).
const ALL_ROLES = [
  'superadmin','adminclinique','medecin','infirmier','sage_femme',
  'laborantin','radiologue','pharmacien','comptable','receptionniste','patient',
];

// ─── Les 23 modules du regroupement documenté ──────────────────────────────
// allow: rôles pour lesquels une lecture représentative doit répondre 200.
// Vérifié fraîchement contre le code actuel des 23 fichiers de routes avant
// d'écrire cette table (pas recopié depuis le document sans contrôle).
const MODULES = [
  { module: 'Patients',                    path: '/patients',       allow: ['superadmin','adminclinique','medecin','infirmier','sage_femme','laborantin','radiologue','pharmacien','comptable','receptionniste'] },
  { module: 'Rendez-vous',                 path: '/appointments',   allow: ['superadmin','adminclinique','medecin','infirmier','receptionniste'] },
  { module: 'Consultations',                path: '/consultations',  allow: ['superadmin','adminclinique','medecin','infirmier'] },
  { module: 'Prescriptions',                path: '/prescriptions',  allow: ['superadmin','adminclinique','medecin','infirmier','pharmacien'] },
  // ACCES-PHARMACIE-001 (correction du 13 sept. 2026) — 'medecin' retiré :
  // le module Pharmacie est exclusivement réservé à pharmacien (+
  // infirmier, inchangé). Voir pharmacy.routes.js::CAN_READ et
  // accessMatrix.test.js pour la même correction, avec le détail du
  // catalogue minimal (/pharmacy/catalogue) que medecin conserve.
  { module: 'Pharmacie',                    path: '/pharmacy',       allow: ['superadmin','adminclinique','pharmacien','infirmier'] },
  { module: 'Hospitalisation',              path: '/hospitalization',allow: ['superadmin','adminclinique','medecin','infirmier'] },
  { module: 'Chirurgie & Bloc opératoire',  path: '/chirurgie',      allow: ['superadmin','adminclinique','medecin','infirmier'] },
  { module: 'Urgences & Ambulances',        path: '/urgences',       allow: ['superadmin','adminclinique','medecin','infirmier','sage_femme'] },
  { module: 'Maternité',                    path: '/maternite/grossesses', allow: ['superadmin','adminclinique','medecin','infirmier','sage_femme'] },
  { module: 'Pédiatrie',                    path: '/pediatrie/enfants',    allow: ['superadmin','adminclinique','medecin','infirmier','sage_femme'] },
  { module: 'Laboratoire',                  path: '/laboratory',     allow: ['superadmin','adminclinique','medecin','infirmier','laborantin'] },
  { module: 'Imagerie / Radiologie',        path: '/radiology',      allow: ['superadmin','adminclinique','medecin','infirmier','radiologue'] },
  { module: 'Échographie',                  path: '/echographie',    allow: ['superadmin','adminclinique','medecin','infirmier','radiologue','sage_femme'] },
  { module: 'Finance & Facturation',        path: '/finance',        allow: ['superadmin','adminclinique','comptable'] },
  { module: 'Ressources Humaines',          path: '/hr/staff',       allow: ['superadmin','adminclinique'] },
  // Exception documentée (baseline-checklist-10x23.md, note 6) : ces deux
  // routes ne sont PAS restreintes par rôle (`protect` seul, pas
  // `authorize()`) — la portée réelle est appliquée au niveau contrôleur
  // (`membres: req.user._id`, `destinataire: req.user._id`), vérifiée par
  // lecture de code en Phase 1. Un compte patient obtient donc légitimement
  // 200 ici (ses propres conversations/notifications), contrairement aux 21
  // autres modules professionnels. Confirmé fraîchement contre
  // messages.routes.js / notifications.routes.js et leurs contrôleurs.
  { module: 'Messagerie',                   path: '/messages',       allow: ALL_ROLES },
  { module: 'Notifications',                path: '/notifications',  allow: ALL_ROLES },
  { module: 'Tableau de bord',              path: '/dashboard',      allow: ALL_ROLES.filter(r => r !== 'patient') },
  { module: 'Intelligence Artificielle',    path: '/ai/stats',       allow: ['superadmin','adminclinique','medecin'] },
  { module: 'Analytics',                    path: '/analytics/stats',allow: ['superadmin','adminclinique'] },
  // AUDIT-ARCHIVAGE-D — écart tranché : le document
  // docs/decisions/baseline-checklist-10x23.md affirmait "OK" pour
  // adminclinique sur le Journal d'audit, mais audit.routes.js ne
  // restreignait qu'à ['superadmin'] sur les 5 routes. Décision explicite
  // de l'utilisateur (chantier Archivage/Audit) : élargi à
  // ['superadmin','adminclinique'], conforme au document de référence —
  // ni une régression à corriger dans l'autre sens, ni un resserrement
  // délibéré. Ce test reflète désormais le code réel, aligné sur le document.
  { module: 'Journal d\'audit',             path: '/audit',          allow: ['superadmin', 'adminclinique'] },
  { module: 'Archivage',                    path: '/archives',       allow: ['superadmin','adminclinique'] },
  { module: 'Administration & Paramètres',  path: '/settings',       allow: ['superadmin','adminclinique'] },
];

// Sous-vérification dédiée pour Administration & Paramètres — la checklist
// documente une distinction fine (adminclinique a tout SAUF la gestion des
// comptes, qui reste superadmin seul ; les 9 autres rôles n'ont que la
// lecture des données de référence) qu'une seule ligne allow/deny ne peut
// pas exprimer.
const ADMIN_SUBCHECKS = [
  { label: 'GET /settings/users (gestion comptes)', path: '/settings/users', method: 'GET', allow: ['superadmin','adminclinique'] },
  { label: 'GET /settings/services (référence)',    path: '/settings/services', method: 'GET', allow: ALL_ROLES.filter(r => r !== 'patient') },
];

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

async function call(baseUrl, cookie, method, path) {
  const res = await fetch(`${baseUrl}${path}`, { method, headers: { Cookie: cookie } });
  return res.status;
}

test('Phase 10.1 — checklist de baseline complète, 10 rôles × 23 modules (serveur isolé)', { skip: !mongodExists() && 'mongod introuvable — infrastructure Phase 10 indisponible' }, async (t) => {
  let server;
  const cookies = {};

  try {
    await t.test('démarrage du serveur isolé + création des 11 comptes de test (10 rôles + patient)', async () => {
      server = await startIsolatedServer();
      await mongoose.connect(server.mongoUri);
      const User = require('../models/User');
      for (const role of ALL_ROLES) {
        const email = `_p10.${role}@_test.local`;
        await User.create({ email, password: PASSWORD, nom: 'P10', prenom: role, role, statut: 'actif' });
        cookies[role] = await login(server.baseUrl, email);
        assert.ok(cookies[role], `la connexion doit réussir pour le rôle ${role}`);
      }
    });

    for (const { module: moduleName, path, allow } of MODULES) {
      await t.test(`${moduleName} — ${path}`, async () => {
        const violations = [];
        for (const role of ALL_ROLES) {
          const status = await call(server.baseUrl, cookies[role], 'GET', path);
          const shouldAllow = allow.includes(role);
          const isAllowed = status !== 401 && status !== 403;
          if (shouldAllow && !isAllowed) violations.push(`${role} DEVRAIT avoir accès (attendu 200, obtenu ${status})`);
          if (!shouldAllow && isAllowed) violations.push(`${role} NE DEVRAIT PAS avoir accès (obtenu ${status} au lieu de 401/403)`);
        }
        assert.deepEqual(violations, [], `Écarts pour ${moduleName} :\n${violations.join('\n')}`);
      });
    }

    await t.test('Administration & Paramètres — distinction fine adminclinique (tout sauf comptes) vs 9 autres rôles (référence seule)', async () => {
      for (const { label, path, method, allow } of ADMIN_SUBCHECKS) {
        const violations = [];
        for (const role of ALL_ROLES) {
          const status = await call(server.baseUrl, cookies[role], method, path);
          const shouldAllow = allow.includes(role);
          const isAllowed = status !== 401 && status !== 403;
          if (shouldAllow !== isAllowed) violations.push(`${role}: attendu ${shouldAllow ? 'accès' : 'refus'}, obtenu ${status}`);
        }
        assert.deepEqual(violations, [], `Écarts pour ${label} :\n${violations.join('\n')}`);
      }
    });

    await t.test('rôle patient — aucun accès à aucun des 21 modules professionnels stricts (régression la plus grave possible)', async () => {
      // Messagerie/Notifications exclues ici : accès patient légitime et
      // documenté (note 6), déjà couvert par la boucle allow/deny ci-dessus.
      const leaks = [];
      for (const { module: moduleName, path } of MODULES) {
        if (moduleName === 'Messagerie' || moduleName === 'Notifications') continue;
        const status = await call(server.baseUrl, cookies.patient, 'GET', path);
        if (status !== 401 && status !== 403) leaks.push(`${moduleName} (${path}) → ${status}`);
      }
      assert.deepEqual(leaks, [], `Le rôle patient a accédé à des modules professionnels :\n${leaks.join('\n')}`);
    });
  } finally {
    await mongoose.disconnect();
    if (server) await server.stop();
  }
});
