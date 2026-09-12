// T9.11 — sauvegarde/restauration MongoDB. Ce test prouve une restauration
// RÉELLE (pas seulement "le script s'exécute sans erreur", explicitement
// exigé) : instance MongoDB locale isolée (jamais le cluster Atlas partagé,
// même principe que T9.8), collection source seedée avec des types variés
// (ObjectId, Date, nombres, tableaux, objets imbriqués) pour vérifier que
// EJSON préserve réellement les types au lieu de les corrompre en chaînes,
// backup() puis restore() vers une base cible DIFFÉRENTE sur la même
// instance, puis comparaison document par document entre source et cible.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { MongoClient, ObjectId } = require('mongodb');

// TEST-01 (correction du 12 sept. 2026) — chemin auparavant codé en dur ici
// (une copie indépendante de celui déjà corrigé dans helpers/isolatedServer.js) ;
// réutilise désormais la même résolution robuste (override MONGOD_PATH,
// PATH, emplacements connus par plateforme) au lieu d'une seconde copie
// figée sur une version précise.
const { MONGOD_PATH } = require('./helpers/isolatedServer');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForPort(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.createConnection({ port, host: '127.0.0.1' });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) return reject(new Error(`mongod n'a pas démarré sur le port ${port} dans le délai imparti`));
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

test('T9.11 — sauvegarde puis restauration réelle sur instance MongoDB locale isolée', { skip: !(MONGOD_PATH && fs.existsSync(MONGOD_PATH)) && `mongod introuvable (ni MONGOD_PATH, ni PATH, ni emplacement d'installation connu)` }, async (t) => {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 't911-mongod-'));
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 't911-backup-'));
  const port = await findFreePort();
  const baseUri = `mongodb://127.0.0.1:${port}`;

  let mongodProc;
  let client;

  try {
    await t.test('démarrage de mongod local isolé', async () => {
      mongodProc = spawn(MONGOD_PATH, ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet', '--noauth'], { stdio: 'ignore' });
      await waitForPort(port);
      assert.ok(mongodProc.pid, 'mongod doit avoir démarré avec un PID');
    });

    const sourceUri = `${baseUri}/t911_source`;
    const targetUri = `${baseUri}/t911_target`;
    const oid = new ObjectId();
    const now = new Date('2026-01-15T10:30:00.000Z');

    await t.test('seed de données source avec types variés (ObjectId, Date, nombres, tableaux, objets imbriqués)', async () => {
      client = new MongoClient(sourceUri);
      await client.connect();
      const db = client.db();
      await db.collection('patients_test').insertMany([
        { _id: oid, nom: 'Backup', prenom: 'Test', date_naissance: now, allergies: ['Pénicilline', 'Latex'], adresse: { ville: 'Souanké', pays: 'Congo' }, actif: true, score: 42.5 },
        { nom: 'Deuxième', prenom: 'Patient', date_naissance: new Date('1985-06-01'), allergies: [], actif: false },
      ]);
      await db.collection('consultations_test').insertMany([
        { patient_ref: oid, diagnostic: 'RAS', createdAt: now },
      ]);
      await client.close();
    });

    await t.test('backup() produit un manifeste et un fichier par collection', async () => {
      const { runBackup } = require('../utils/backup');
      const manifest = await runBackup({ uri: sourceUri, outDir: backupDir });
      assert.equal(manifest.collections.patients_test, 2);
      assert.equal(manifest.collections.consultations_test, 1);
      assert.ok(fs.existsSync(path.join(backupDir, 'patients_test.json')));
      assert.ok(fs.existsSync(path.join(backupDir, 'consultations_test.json')));
    });

    await t.test('restore() vers une base CIBLE différente reproduit exactement les documents, types inclus', async () => {
      const { runRestore } = require('../utils/restore');
      const result = await runRestore({ uri: targetUri, inDir: backupDir });
      assert.equal(result.restored.patients_test, 2);
      assert.equal(result.restored.consultations_test, 1);

      const targetClient = new MongoClient(targetUri);
      await targetClient.connect();
      try {
        const restoredPatient = await targetClient.db().collection('patients_test').findOne({ _id: oid });
        assert.ok(restoredPatient, 'le document restauré doit exister avec son _id original');
        assert.equal(restoredPatient.nom, 'Backup');
        assert.ok(restoredPatient._id instanceof ObjectId, '_id doit rester un vrai ObjectId, pas une chaîne — preuve que EJSON préserve les types');
        assert.ok(restoredPatient.date_naissance instanceof Date, 'date_naissance doit rester un vrai Date');
        assert.equal(restoredPatient.date_naissance.getTime(), now.getTime());
        assert.deepEqual(restoredPatient.allergies, ['Pénicilline', 'Latex']);
        assert.deepEqual(restoredPatient.adresse, { ville: 'Souanké', pays: 'Congo' });
        assert.equal(restoredPatient.score, 42.5);

        const restoredConsult = await targetClient.db().collection('consultations_test').findOne({});
        assert.ok(restoredConsult.patient_ref instanceof ObjectId);
        assert.equal(restoredConsult.patient_ref.toString(), oid.toString(), 'la référence ObjectId doit pointer vers le même id après restauration');

        const countSource = 2;
        const countTarget = await targetClient.db().collection('patients_test').countDocuments();
        assert.equal(countTarget, countSource, 'le nombre de documents restaurés doit correspondre exactement à la source');
      } finally {
        await targetClient.close();
      }
    });

    await t.test('restore() est destructif et idempotent : relancer une seconde fois ne duplique rien', async () => {
      const { runRestore } = require('../utils/restore');
      await runRestore({ uri: targetUri, inDir: backupDir });
      const targetClient = new MongoClient(targetUri);
      await targetClient.connect();
      try {
        const count = await targetClient.db().collection('patients_test').countDocuments();
        assert.equal(count, 2, 'une seconde restauration ne doit pas dupliquer les documents (vidage avant réinsertion)');
      } finally {
        await targetClient.close();
      }
    });
  } finally {
    if (mongodProc && !mongodProc.killed) {
      // Attendre la sortie réelle du process avant de toucher dbPath — sur
      // Windows, les fichiers WiredTiger restent verrouillés quelques
      // instants après kill(), un rmSync immédiat échoue en EPERM.
      await new Promise((resolve) => {
        mongodProc.once('exit', resolve);
        mongodProc.kill();
        setTimeout(resolve, 5000); // filet de sécurité si l'évènement n'arrive jamais
      });
    }
    for (let i = 0; i < 5; i++) {
      try {
        fs.rmSync(dbPath, { recursive: true, force: true });
        break;
      } catch (e) {
        if (i === 4) throw e;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});
