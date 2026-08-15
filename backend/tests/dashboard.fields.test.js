// Test de non-régression — cohérence des tableaux de bord avec les schémas
// réels. Avant correction, la quasi-totalité des handlers de
// dashboard.controller.js interrogeaient des champs/valeurs d'énumération
// inexistants (silencieusement — Mongo ne lève pas d'erreur sur un champ
// absent) et renvoyaient des KPI systématiquement à zéro. Ce test :
//  1) vérifie que les champs dont dépend le tableau de bord existent bien
//     dans les schémas Mongoose ;
//  2) exécute réellement les 9 handlers par rôle contre la base configurée
//     (MONGO_URI) et vérifie qu'aucun ne lève d'exception et que la forme de
//     réponse attendue par le frontend est respectée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('schémas Mongoose — champs requis par le tableau de bord', async (t) => {
  await t.test('Consultation a bien date_consultation (pas date)', () => {
    const Consultation = require('../models/Consultation');
    assert.ok(Consultation.schema.path('date_consultation'), 'date_consultation doit exister');
    assert.equal(Consultation.schema.path('date'), undefined, 'date ne doit PAS exister (ancien champ erroné)');
  });
  await t.test('Hospitalization a bien date_entree (pas date_admission)', () => {
    const Hospitalization = require('../models/Hospitalization');
    assert.ok(Hospitalization.schema.path('date_entree'));
    assert.equal(Hospitalization.schema.path('date_admission'), undefined);
  });
  await t.test('Invoice.statut n\'a pas de valeur "impayee" (enum réel)', () => {
    const Invoice = require('../models/Invoice');
    const enumValues = Invoice.schema.path('statut').enumValues;
    assert.ok(enumValues.includes('emise'));
    assert.ok(!enumValues.includes('impayee'));
    assert.equal(Invoice.schema.path('montant_total'), undefined, 'montant_total n\'existe pas — utiliser montant_ttc/montant_restant');
  });
  await t.test('Medication a bien date_peremption (pas date_expiration)', () => {
    const Medication = require('../models/Medication');
    assert.ok(Medication.schema.path('date_peremption'));
    assert.equal(Medication.schema.path('date_expiration'), undefined);
  });
  await t.test('Prescription.statut contient "dispensee" (pas "delivree")', () => {
    const Prescription = require('../models/Prescription');
    const enumValues = Prescription.schema.path('statut').enumValues;
    assert.ok(enumValues.includes('dispensee'));
    assert.ok(!enumValues.includes('delivree'));
  });
  await t.test('User.role contient sage_femme', () => {
    const User = require('../models/User');
    assert.ok(User.schema.path('role').enumValues.includes('sage_femme'));
  });
  await t.test('User n\'a pas de champ statut_service/date_service (n\'existe pas — utiliser Staff)', () => {
    const User = require('../models/User');
    assert.equal(User.schema.path('statut_service'), undefined);
    assert.equal(User.schema.path('date_service'), undefined);
  });
});

test('handlers de tableau de bord — exécution réelle sans exception', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  // Charge l'arborescence complète des routes pour enregistrer tous les
  // modèles (ex: ExamCatalogue, requis via laboratory.controller.js, sinon
  // absent tant qu'aucune route ne l'a chargé) — reproduit l'ordre de
  // chargement réel du serveur (server.js require('./routes') au démarrage).
  require('../routes');
  const dashC = require('../controllers/dashboard.controller');
  const User = require('../models/User');

  const ROLE_HANDLERS = {
    superadmin: 'superAdminStats', adminclinique: 'adminCliniqueStats', medecin: 'medecinStats',
    infirmier: 'infirmierStats', laborantin: 'laborantinStats', pharmacien: 'pharmacienStats',
    receptionniste: 'receptionnisteStats', comptable: 'comptableStats', radiologue: 'radiologueStats',
  };

  for (const [role, handlerName] of Object.entries(ROLE_HANDLERS)) {
    await t.test(`dashboard.${handlerName} (rôle ${role}) répond sans erreur`, async () => {
      const user = (await User.findOne({ role }).lean()) || { _id: new mongoose.Types.ObjectId(), role };
      const req = { user };
      let captured = null;
      const res = { json: (data) => { captured = data; } };
      const next = (err) => { throw err; };
      await dashC[handlerName](req, res, next);
      assert.ok(captured, 'le handler doit répondre');
      assert.equal(captured.success, true);
      assert.ok(captured.stats && typeof captured.stats === 'object', 'la réponse doit contenir stats{}');
    });
  }

  t.after(async () => { await mongoose.disconnect(); });
});
