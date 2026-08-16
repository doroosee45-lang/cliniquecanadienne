// T9.2 (R-09) — vérifie que audit.controller.js::getSuspects distingue
// correctement 3 scénarios suspects et 3 scénarios normaux, contre la base
// réelle. Chaque scénario utilise un utilisateur/IP synthétique unique et
// vérifie la présence/absence de SA propre entrée précisément — jamais une
// longueur totale de `suspects` — pour rester valide quel que soit le volume
// de bruit déjà présent dans la base (avant le nettoyage effectué pour ce
// ticket, il y avait 3537 entrées ACCESS_DENIED de bruit de test accumulées ;
// un test qui aurait vérifié un total exact aurait été fragile face à ça).
//
// Seuils retenus après comparaison empirique (voir commentaire au-dessus de
// getSuspects) : force brute par IP ≥3/≥5 (inchangé), accès refusé ≥5 agrégé
// PAR UTILISATEUR SEUL (pas par paire utilisateur+module — une agrégation
// par paire se serait révélée aveugle au scénario S3 ci-dessous, qui
// reproduit la forme réelle de balayage trouvée dans le bruit avant
// nettoyage : un même compte touchant plusieurs modules différents en
// rafale).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('getSuspects distingue 3 scénarios suspects et 3 scénarios normaux (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');
  const auditC = require('../controllers/audit.controller');

  const stamp = Date.now();
  const cleanup = [];

  const call = async () => {
    let body = null;
    const res = { status: () => res, json: (d) => { body = d; } };
    await auditC.getSuspects({}, res, (err) => { if (err) throw err; });
    return body;
  };

  const makeUser = async (tag) => {
    const u = await User.create({ email: `_t92-${tag}-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: `T92${tag}`, prenom: 'Test', role: 'receptionniste', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(u._id));
    return u;
  };

  const logDenied = (userId, module) => AuditLog.create({ utilisateur: userId, action: 'ACCESS_DENIED', module, ip_address: '127.0.0.1', statut: 'echec', message: `Accès refusé — probe ${module}` })
    .then(l => { cleanup.push(() => AuditLog.findByIdAndDelete(l._id)); return l; });

  const logFailedLogin = (ip) => AuditLog.create({ action: 'LOGIN_ECHEC', module: 'auth', ip_address: ip, statut: 'echec', message: 'probe login echec' })
    .then(l => { cleanup.push(() => AuditLog.findByIdAndDelete(l._id)); return l; });

  try {
    await t.test('S1 — force brute rapide (6 échecs, même IP) est détectée', async () => {
      const ip = `10.92.1.${stamp % 200}`;
      for (let i = 0; i < 6; i++) await logFailedLogin(ip);
      const body = await call();
      const found = body.suspects.find(s => s.type === 'Tentatives de force brute' && s.utilisateur === `IP: ${ip}`);
      assert.ok(found, 'la rafale de 6 échecs sur la même IP doit être détectée');
      assert.equal(found.severite, 'critique', '≥5 échecs doit être classé critique');
    });

    await t.test('S2 — accès refusé répété sur un même module (5x) est détecté', async () => {
      const u = await makeUser('s2');
      for (let i = 0; i < 5; i++) await logDenied(u._id, 'finance');
      const body = await call();
      const found = body.suspects.find(s => s.type === 'Accès refusé répété' && s.utilisateur.includes('T92s2'));
      assert.ok(found, '5 refus sur le même module doivent être détectés');
      assert.match(found.description, /5 tentative.*1 module/);
    });

    await t.test('S3 — balayage multi-module (5 modules différents, 1 utilisateur) est détecté — reproduit la forme réelle observée', async () => {
      const u = await makeUser('s3');
      const modules = ['dashboard', 'settings', 'hr', 'patients', 'finance'];
      for (const m of modules) await logDenied(u._id, m);
      const body = await call();
      const found = body.suspects.find(s => s.type === 'Accès refusé répété' && s.utilisateur.includes('T92s3'));
      assert.ok(found, 'un balayage sur 5 modules différents par le même compte doit être détecté malgré 1 seul refus par module');
      assert.match(found.description, /5 tentative.*5 module/);
    });

    await t.test('N1 — un seul échec de connexion n\'est pas détecté', async () => {
      const ip = `10.92.2.${stamp % 200}`;
      await logFailedLogin(ip);
      const body = await call();
      assert.equal(body.suspects.some(s => s.utilisateur === `IP: ${ip}`), false);
    });

    await t.test('N2 — deux échecs de connexion consécutifs ne sont pas détectés', async () => {
      const ip = `10.92.3.${stamp % 200}`;
      await logFailedLogin(ip); await logFailedLogin(ip);
      const body = await call();
      assert.equal(body.suspects.some(s => s.utilisateur === `IP: ${ip}`), false);
    });

    await t.test('N3 — un accès refusé isolé (ex. clic après changement de rôle) n\'est plus détecté', async () => {
      const u = await makeUser('n3');
      await logDenied(u._id, 'finance');
      const body = await call();
      assert.equal(body.suspects.some(s => s.utilisateur.includes('T92n3')), false, 'un refus isolé ne doit plus déclencher de suspect — c\'était le faux positif corrigé par T9.2');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
