// Test de non-régression — vérification RÉELLE (HTTP, pas statique) du
// contrôle d'accès par rôle sur les 14 fichiers de routes touchés par le
// commit d7a3d58. authorize() est un middleware au niveau du routeur : un
// test qui appelle un export de contrôleur directement ne passe jamais par
// lui et ne prouve rien sur l'accès réel — ce fichier fait de vraies
// requêtes HTTP contre le serveur, avec un compte de test par rôle.
//
// AUDIT-0 (gap "base de test indépendante") — ce test dépendait jusqu'ici
// implicitement du serveur de développement ambiant resté allumé sur
// localhost:5000 (voir l'ancien commentaire "prérequis : npm run dev").
// Tant que ce serveur ambiant et la connexion mongoose de CE fichier
// pointaient tous deux vers le même cluster Atlas partagé, la coïncidence
// masquait le problème ; basculé sur un mongod local isolé pour les tests
// (utils/run-tests-local-db.js), le serveur ambiant (encore branché sur
// l'ancienne base) et ce test (nouvelle base) divergent, et les comptes
// créés ici ne sont plus jamais trouvés par ce serveur ambiant (401 au lieu
// de 403 attendu — pas une régression de rôle, une divergence de base).
// Corrigé en démarrant une VRAIE instance dédiée (serveur + mongod isolé,
// tests/helpers/isolatedServer.js — même infrastructure que Phase 10),
// plutôt que de dépendre d'un serveur externe déjà lancé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'AccessMatrixTest2026!';
// 'patient' inclus délibérément : aucune des routes ci-dessous ne doit
// jamais l'autoriser — c'est la régression la plus grave possible (voir
// commit d7a3d58, fuite de données inter-patients corrigée en Phase 1).
const ALL_ROLES = [
  'superadmin','adminclinique','medecin','infirmier','sage_femme',
  'laborantin','radiologue','pharmacien','comptable','receptionniste','patient',
];
const FAKE_ID = '000000000000000000000000';

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

test('matrice d\'accès route × rôle (HTTP réel, 14 fichiers touchés par d7a3d58)', { skip: !mongodExists() && 'mongod introuvable — impossible de démarrer un serveur isolé pour ce test' }, async (t) => {
  // Le défaut partagé de startIsolatedServer (45s, voir isolatedServer.js)
  // couvre déjà la contention observée sur ce test en fin de suite
  // complète — pas de marge supplémentaire nécessaire ici.
  const server = await startIsolatedServer();
  const BASE = server.baseUrl;

  try {
    await mongoose.connect(server.mongoUri);
    const User = require('../models/User');

    // Un compte de test par rôle, créé pour la durée du test puis supprimé.
    const cookies = {};
    for (const role of ALL_ROLES) {
      const email = `_accessmatrix.${role}@_test.local`;
      await User.deleteOne({ email }); // au cas où une exécution précédente aurait échoué avant le nettoyage
      await User.create({ email, password: PASSWORD, nom: 'Test', prenom: role, role, statut: 'actif' });
      cookies[role] = await login(BASE, email);
    }

    // ── Matrice attendue : route représentative → rôles autorisés en lecture ──
    const READ_MATRIX = [
      { file: 'appointments.routes.js',      path: '/appointments',        allow: ['superadmin','adminclinique','medecin','infirmier','receptionniste'] },
      { file: 'chirurgieRoutes.js',          path: '/chirurgie',           allow: ['superadmin','adminclinique','medecin','infirmier'] },
      { file: 'consultations.routes.js',     path: '/consultations',       allow: ['superadmin','adminclinique','medecin','infirmier'] },
      { file: 'dashboard.routes.js',         path: '/dashboard',           allow: ['superadmin','adminclinique','medecin','infirmier','sage_femme','laborantin','radiologue','pharmacien','comptable','receptionniste'] },
      { file: 'finance.routes.js',           path: '/finance',             allow: ['superadmin','adminclinique','comptable'] },
      { file: 'hospitalization.routes.js',   path: '/hospitalization',     allow: ['superadmin','adminclinique','medecin','infirmier'] },
      { file: 'hr.routes.js',                path: '/hr/staff',            allow: ['superadmin','adminclinique'] },
      { file: 'laboratory.routes.js',        path: '/laboratory',          allow: ['superadmin','adminclinique','medecin','infirmier','laborantin'] },
      { file: 'patients.routes.js',          path: '/patients',            allow: ['superadmin','adminclinique','medecin','infirmier','sage_femme','receptionniste','laborantin','radiologue','pharmacien','comptable'] },
      // ACCES-PHARMACIE-001 (correction du 13 sept. 2026) — 'medecin' retiré :
      // le module Pharmacie est désormais exclusivement réservé à
      // pharmacien/adminclinique/superadmin (+ infirmier, inchangé). Un
      // médecin ne doit recevoir aucune donnée de cette route ; son seul
      // besoin réel (catalogue nom+prix pour Urgences) est servi par la
      // route dédiée /pharmacy/catalogue, vérifiée séparément plus bas.
      { file: 'pharmacy.routes.js',          path: '/pharmacy',            allow: ['superadmin','adminclinique','pharmacien','infirmier'] },
      { file: 'prescriptions.routes.js',     path: '/prescriptions',       allow: ['superadmin','adminclinique','medecin','infirmier','pharmacien'] },
      { file: 'radiology.routes.js',         path: '/radiology',           allow: ['superadmin','adminclinique','medecin','infirmier','radiologue'] },
      { file: 'recurring.routes.js',         path: '/recurring',           allow: ['superadmin','adminclinique','medecin','infirmier','receptionniste'] },
      { file: 'settings.routes.js',          path: '/settings/users',      allow: ['superadmin','adminclinique'] },
    ];

    const violations = [];
    for (const { file, path, allow } of READ_MATRIX) {
      for (const role of ALL_ROLES) {
        const status = await call(BASE, cookies[role], 'GET', path);
        const shouldAllow = allow.includes(role);
        const wasAllowed = status !== 403;
        if (shouldAllow !== wasAllowed) {
          violations.push(`${file} GET ${path} — rôle ${role} : attendu ${shouldAllow ? 'autorisé' : 'refusé'}, obtenu HTTP ${status}`);
        }
      }
    }
    assert.deepEqual(violations, [], `Écarts de matrice d'accès :\n${violations.join('\n')}`);

    // ── Combinaisons signalées comme à surveiller de près ──
    const write_chir_ok  = await call(BASE, cookies.medecin,    'POST', '/chirurgie');
    const write_chir_inf = await call(BASE, cookies.infirmier,  'POST', '/chirurgie');
    assert.notEqual(write_chir_ok,  403, 'médecin doit pouvoir créer un dossier chirurgical');
    // L'infirmier a un accès en LECTURE complet à la chirurgie (vérifié ci-dessus)
    // mais pas en écriture sur le dossier principal — seulement sur le bilan
    // (POST /:id/bilan), conformément à "bloc opératoire : lecture/participation"
    // du référentiel de rôles. Ce n'est pas une régression : c'est le
    // comportement voulu, vérifié ici explicitement pour qu'un futur écart
    // (dans un sens comme dans l'autre) soit détecté.
    assert.equal(write_chir_inf, 403, 'infirmier ne doit PAS pouvoir créer/modifier le dossier chirurgical principal (seulement y contribuer via /bilan)');

    const bilan_inf = await call(BASE, cookies.infirmier, 'POST', `/chirurgie/${FAKE_ID}/bilan`);
    assert.notEqual(bilan_inf, 403, 'infirmier doit pouvoir ajouter un bilan (participation) même sans écriture complète du dossier');

    const pharma_write_ok  = await call(BASE, cookies.pharmacien, 'PUT', `/pharmacy/${FAKE_ID}`);
    const pharma_write_med = await call(BASE, cookies.medecin,    'PUT', `/pharmacy/${FAKE_ID}`);
    assert.notEqual(pharma_write_ok, 403, 'pharmacien doit pouvoir modifier une fiche médicament');
    assert.equal(pharma_write_med, 403, 'médecin ne doit avoir aucun accès (ni lecture ni écriture) au module Pharmacie');

    // ACCES-PHARMACIE-001 — le seul accès pharmacie qu'un médecin conserve :
    // le catalogue minimal (nom+prix), pour Urgences.jsx, pas le module.
    const catalogue_med   = await call(BASE, cookies.medecin,    'GET', '/pharmacy/catalogue');
    const catalogue_pat   = await call(BASE, cookies.patient,    'GET', '/pharmacy/catalogue');
    assert.notEqual(catalogue_med, 403, 'médecin doit pouvoir lire le catalogue minimal (nom+prix) pour prescrire en urgence');
    assert.equal(catalogue_pat, 403, 'un patient ne doit jamais accéder, même au catalogue minimal');

    const lab_validate_ok  = await call(BASE, cookies.laborantin, 'PUT', `/laboratory/${FAKE_ID}/validate`);
    const lab_validate_med = await call(BASE, cookies.medecin,    'PUT', `/laboratory/${FAKE_ID}/validate`);
    assert.notEqual(lab_validate_ok, 403, 'laborantin doit pouvoir valider un résultat de laboratoire');
    assert.equal(lab_validate_med, 403, 'la validation labo est réservée au laborantin (et superadmin)');

    const radio_valid_ok   = await call(BASE, cookies.radiologue, 'PUT', `/radiology/${FAKE_ID}/validation`);
    const radio_valid_med  = await call(BASE, cookies.medecin,    'PUT', `/radiology/${FAKE_ID}/validation`);
    assert.notEqual(radio_valid_ok, 403, 'radiologue doit pouvoir valider un compte rendu d\'imagerie');
    assert.equal(radio_valid_med, 403, 'la validation radiologique est réservée au radiologue (et superadmin)');

    const finance_ok    = await call(BASE, cookies.comptable,      'GET', '/finance/stats');
    const finance_denied = await call(BASE, cookies.receptionniste, 'GET', '/finance/stats');
    assert.notEqual(finance_ok, 403, 'comptable doit accéder aux statistiques financières');
    assert.equal(finance_denied, 403, 'la réceptionniste ne doit pas accéder à Finance');

    // ── Nettoyage ──
    await User.deleteMany({ email: { $regex: /@_test\.local$/ } });
  } finally {
    await mongoose.disconnect();
    await server.stop();
  }
});
