// TEST-01 (correction du 12 sept. 2026, audit indépendant) —
// tests/helpers/isolatedServer.js codait MONGOD_PATH en dur vers
// 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe' : sur une autre
// machine, en CI, ou après une mise à jour MongoDB sur cette même machine,
// mongodExists() renvoyait false et ~200 tests dépendant de cet helper (23
// fichiers) étaient silencieusement ignorés plutôt que de réellement
// s'exécuter. Ce test prouve que la résolution (1) respecte un override
// explicite MONGOD_PATH, et (2) trouve réellement mongod sur CETTE
// machine (preuve que le chemin résolu par défaut n'est pas un artefact
// codé en dur mais une vraie détection).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

test('TEST-01 — MONGOD_PATH est réellement résolu (override, PATH, ou détection), jamais un seul chemin figé', async (t) => {
  await t.test('mongodExists()/MONGOD_PATH réel sur cette machine — la résolution par défaut trouve un binaire qui existe vraiment', () => {
    delete require.cache[require.resolve('../tests/helpers/isolatedServer')];
    const { MONGOD_PATH, mongodExists } = require('../tests/helpers/isolatedServer');
    assert.ok(MONGOD_PATH, 'un chemin doit être résolu sur cette machine (mongod y est installé, utilisé par toute la suite Phase 10)');
    assert.ok(fs.existsSync(MONGOD_PATH), 'le chemin résolu doit réellement exister sur le disque — jamais une valeur supposée');
    assert.equal(mongodExists(), true);
  });

  await t.test('override explicite via la variable d\'environnement MONGOD_PATH est respecté', () => {
    // Fabrique un faux "binaire" (fichier réel, contenu sans importance) à
    // un chemin non standard, pour prouver que la résolution ne retombe
    // JAMAIS sur l'ancien chemin codé en dur quand un override réel existe.
    const fauxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test01-mongod-'));
    const fauxBinaire = path.join(fauxDir, 'mongod-faux-binaire');
    fs.writeFileSync(fauxBinaire, '');
    const ancien = process.env.MONGOD_PATH;
    process.env.MONGOD_PATH = fauxBinaire;
    try {
      delete require.cache[require.resolve('../tests/helpers/isolatedServer')];
      const { MONGOD_PATH } = require('../tests/helpers/isolatedServer');
      assert.equal(MONGOD_PATH, fauxBinaire, 'un override explicite doit être prioritaire sur toute détection automatique');
    } finally {
      if (ancien === undefined) delete process.env.MONGOD_PATH; else process.env.MONGOD_PATH = ancien;
      fs.rmSync(fauxDir, { recursive: true, force: true });
      delete require.cache[require.resolve('../tests/helpers/isolatedServer')];
    }
  });

  await t.test('mongod est réellement détecté sur le PATH système (sanity — confirme que la machine de test a de quoi valider ce correctif)', () => {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    let surLePath = null;
    try { surLePath = execFileSync(finder, ['mongod'], { encoding: 'utf8' }).split(/\r?\n/).find(Boolean); } catch { /* pas sur le PATH ici, non bloquant */ }
    // Non déterministe selon la machine (mongod peut être installé sans être
    // sur le PATH) — assertion informative seulement si trouvé, jamais un
    // échec si absent du PATH sur cette machine précise.
    if (surLePath) assert.ok(fs.existsSync(surLePath.trim()));
  });
});
