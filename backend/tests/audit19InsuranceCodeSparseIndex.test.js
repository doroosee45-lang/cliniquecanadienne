// AUDIT-19-1 (18 sept. 2026, audit indépendant) — Insurance.code portait un
// index unique SANS sparse alors que le champ est optionnel
// (settings.controller.js::createInsurance fait Insurance.create(req.body)
// sans jamais l'exiger). MongoDB traite toute valeur absente comme le même
// `null` : la 2e assurance créée sans code échouait systématiquement avec
// E11000 dup key { code: null } — reproduit directement contre la base
// réelle avant correction. Corrigé par sparse: true (models/Insurance.js) +
// migration de l'index déjà construit en base
// (utils/migrate-insurance-code-sparse-index.js, exécutée manuellement).
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-19-1 — Insurance.code sparse : plusieurs assurances sans code peuvent coexister (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Insurance = require('../models/Insurance');

  const stamp = Date.now();
  const created = [];

  try {
    await t.test('deux assurances créées consécutivement sans code coexistent sans E11000', async () => {
      const a = await Insurance.create({ nom: `Audit19-A-${stamp}` });
      created.push(a._id);
      assert.equal(a.code, undefined);

      const b = await Insurance.create({ nom: `Audit19-B-${stamp}` });
      created.push(b._id);
      assert.equal(b.code, undefined);

      const count = await Insurance.countDocuments({ _id: { $in: [a._id, b._id] } });
      assert.equal(count, 2, 'les deux documents doivent réellement exister en base, aucun n\'a été rejeté silencieusement');
    });

    await t.test('non-régression — l\'unicité reste appliquée entre deux codes réellement renseignés et identiques', async () => {
      const a = await Insurance.create({ nom: `Audit19-C-${stamp}`, code: `AUDIT19-${stamp}` });
      created.push(a._id);
      await assert.rejects(
        () => Insurance.create({ nom: `Audit19-D-${stamp}`, code: `AUDIT19-${stamp}` }),
        /E11000/,
        'deux assurances avec le MÊME code réel doivent toujours être rejetées — sparse ne doit jamais affaiblir l\'unicité entre valeurs réellement renseignées'
      );
    });
  } finally {
    await Insurance.deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
  }
});
