// AUDIT-20-2 (18 sept. 2026, audit indépendant) — même défaut que
// Insurance.code (AUDIT-19-1) : ExamCatalogue.code portait un index unique
// SANS sparse alors que le champ est optionnel. Dormant aujourd'hui (aucun
// controller ne crée d'ExamCatalogue — seul utils/seed.js le fait, en
// fournissant toujours un code, vérifié directement dans le code), mais un
// futur endpoint de création créant une 2e entrée sans code échouerait
// immédiatement (E11000 dup key { code: null }), exactement comme
// Insurance avant correction. Corrigé par précaution + migration de
// l'index déjà construit en base
// (utils/migrate-examcatalogue-code-sparse-index.js, exécutée manuellement).
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-20-2 — ExamCatalogue.code sparse : plusieurs entrées sans code peuvent coexister (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ExamCatalogue = require('../models/ExamCatalogue');

  const stamp = Date.now();
  const created = [];

  try {
    await t.test('deux entrées créées consécutivement sans code coexistent sans E11000', async () => {
      const a = await ExamCatalogue.create({ nom: `Audit20-A-${stamp}`, type: 'laboratoire' });
      created.push(a._id);
      assert.equal(a.code, undefined);

      const b = await ExamCatalogue.create({ nom: `Audit20-B-${stamp}`, type: 'laboratoire' });
      created.push(b._id);
      assert.equal(b.code, undefined);

      const count = await ExamCatalogue.countDocuments({ _id: { $in: [a._id, b._id] } });
      assert.equal(count, 2, 'les deux documents doivent réellement exister en base, aucun n\'a été rejeté silencieusement');
    });

    await t.test('non-régression — l\'unicité reste appliquée entre deux codes réellement renseignés et identiques', async () => {
      const a = await ExamCatalogue.create({ nom: `Audit20-C-${stamp}`, type: 'imagerie', code: `AUDIT20-${stamp}` });
      created.push(a._id);
      await assert.rejects(
        () => ExamCatalogue.create({ nom: `Audit20-D-${stamp}`, type: 'imagerie', code: `AUDIT20-${stamp}` }),
        /E11000/,
        'deux entrées avec le MÊME code réel doivent toujours être rejetées'
      );
    });
  } finally {
    await ExamCatalogue.deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
  }
});
