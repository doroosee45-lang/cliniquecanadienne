// AUDIT-20-11 (19 sept. 2026, audit indépendant) —
// archive.controller.js::exportAll construisait chaque ligne CSV par
// interpolation directe (`"${a.titre}",...`) sans échapper les guillemets
// internes (RFC 4180 : " à l'intérieur d'un champ doit devenir ""). Une
// archive dont le titre contient un guillemet corrompait la structure du
// CSV exporté (le guillemet interne ferme prématurément le champ). CONFIRMÉ
// ET REPRODUIT ci-dessous : sur l'ancien code, une archive avec un titre
// contenant un guillemet + une virgule produit une ligne CSV qui ne parse
// plus en 6 colonnes.
// Corrigé via utils/helpers.js::escapeCsvField (même principe minimaliste
// qu'escapeRegex/escapeHtml déjà dans ce fichier) : double les guillemets
// internes, ET préfixe d'une apostrophe toute valeur commençant par
// =, +, - ou @ pour neutraliser l'injection de formule Excel/Sheets
// (recommandation OWASP), appliqué aux 6 colonnes avant assemblage.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Parseur CSV minimal conforme RFC 4180 (champs toujours entre guillemets,
// "" pour un guillemet littéral) — suffisant pour vérifier la structure des
// lignes produites par exportAll, pas une dépendance ajoutée au projet.
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '"') throw new Error(`Champ non entouré de guillemets à la position ${i} : ${line.slice(i, i + 20)}`);
    i++;
    let field = '';
    while (i < line.length) {
      if (line[i] === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 2; continue; }
        i++; // fin du champ
        break;
      }
      field += line[i];
      i++;
    }
    fields.push(field);
    if (line[i] === ',') i++;
  }
  return fields;
}

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = {
    status: (c) => { status = c; return res; },
    json: (d) => { body = d; return res; },
    setHeader: () => {},
    send: (d) => { body = d; return res; },
  };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('AUDIT-20-11 — archive.controller.js::exportAll échappe correctement les CSV (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ArchiveEntry = require('../models/ArchiveEntry');
  const archiveC = require('../controllers/archive.controller');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const created = [];

  try {
    await t.test('un titre contenant un guillemet et une virgule reste parseable en 6 colonnes, valeur intacte au parsing', async () => {
      const titre = `Dossier "urgent", confidentiel ${stamp}`;
      const entry = await ArchiveEntry.create({
        titre, categorie: 'patient', patient_nom: `O"Brien ${stamp}`,
        statut: 'archive', priorite: 'haute',
      });
      created.push(entry._id);

      const { status, body } = await call(archiveC.exportAll, { query: { format: 'csv' }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(typeof body, 'string');

      const lines = body.replace(/^﻿/, '').split('\n');
      const dataLine = lines.find(l => l.includes(stamp.toString()));
      assert.ok(dataLine, 'la ligne correspondant à cette archive doit exister dans le CSV exporté');

      const fields = parseCsvLine(dataLine);
      assert.equal(fields.length, 6, `la ligne doit parser en exactement 6 colonnes (Titre,Categorie,Patient,Statut,Date archivage,Priorite) — obtenu ${fields.length} : structure corrompue si différent`);
      assert.equal(fields[0], titre, 'le titre doit réapparaître intact au parsing, guillemet interne compris');
      assert.equal(fields[2], `O"Brien ${stamp}`, 'le nom patient doit aussi réapparaître intact, guillemet interne compris');
    });

    await t.test('un titre commençant par = est préfixé d\'une apostrophe — neutralise l\'injection de formule Excel/Sheets', async () => {
      const titre = `=SUM(A1:A9)+CMD|'/C calc'!A0 ${stamp}`;
      const entry = await ArchiveEntry.create({
        titre, categorie: 'document', statut: 'archive', priorite: 'normale',
      });
      created.push(entry._id);

      const { body } = await call(archiveC.exportAll, { query: { format: 'csv' }, user: admin, ip: '127.0.0.1' });
      const lines = body.replace(/^﻿/, '').split('\n');
      const dataLine = lines.find(l => l.includes(stamp.toString()));
      assert.ok(dataLine);

      const fields = parseCsvLine(dataLine);
      assert.equal(fields[0], `'${titre}`, 'le champ doit être préfixé d\'une apostrophe pour empêcher un tableur de l\'interpréter comme une formule');
    });

    await t.test('non-régression — une archive sans caractère spécial reste inchangée dans le CSV', async () => {
      const entry = await ArchiveEntry.create({
        titre: `Dossier normal ${stamp}`, categorie: 'laboratoire', patient_nom: 'Jean Dupont',
        statut: 'archive', priorite: 'basse',
      });
      created.push(entry._id);

      const { body } = await call(archiveC.exportAll, { query: { format: 'csv' }, user: admin, ip: '127.0.0.1' });
      const lines = body.replace(/^﻿/, '').split('\n');
      const dataLine = lines.find(l => l.includes(`Dossier normal ${stamp}`));
      assert.ok(dataLine);
      const fields = parseCsvLine(dataLine);
      assert.equal(fields[0], `Dossier normal ${stamp}`);
      assert.equal(fields[1], 'laboratoire');
      assert.equal(fields[2], 'Jean Dupont');
      assert.equal(fields[3], 'archive');
      assert.equal(fields[5], 'basse');
    });
  } finally {
    for (const id of created) await ArchiveEntry.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
