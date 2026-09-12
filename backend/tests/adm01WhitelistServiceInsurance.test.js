// ADM-01 (correction du 12 sept. 2026, audit indépendant) —
// settings.controller.js::updateService/updateInsurance appliquaient
// findByIdAndUpdate(id, req.body) sans aucune liste blanche : l'audit
// maintient la majeure malgré la restriction ADMIN déjà en place sur ces
// routes (un JWT volé ou un compte admin compromis reste un accès admin
// authentifié). Corrigé via SERVICE_UPDATE_ALLOWED_FIELDS /
// INSURANCE_UPDATE_ALLOWED_FIELDS, même principe que
// APPT_CREATE_ALLOWED_FIELDS (CLIN-05) / NEWBORN_CREATE_ALLOWED_FIELDS
// (SPEC-02).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ADM-01 — updateService/updateInsurance ignorent tout champ hors liste blanche', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Service = require('../models/Service');
  const Insurance = require('../models/Insurance');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const service = await Service.create({ nom: `Adm01-Service-${stamp}`, code: `ADM01-SVC-${stamp}` });
  const insurance = await Insurance.create({ nom: `Adm01-Assurance-${stamp}`, code: `ADM01-INS-${stamp}` });
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };

  try {
    await t.test('updateService : champ fabriqué hors schéma ignoré, createdAt fabriqué ignoré, champ légitime accepté', async () => {
      const createdAtAvant = service.createdAt.toISOString();
      const { status, body } = await call(settingsC.updateService, {
        params: { id: service._id }, user, ip: '127.0.0.1',
        body: {
          nom: 'Service Renommé',
          statut: 'ferme',
          createdAt: new Date('2000-01-01').toISOString(),
          champFabrique: 'valeur injectée',
        },
      });
      assert.equal(status, 200, JSON.stringify(body));

      const fresh = await Service.findById(service._id).lean();
      assert.equal(fresh.nom, 'Service Renommé', 'champ de la liste blanche doit être appliqué');
      assert.equal(fresh.statut, 'ferme', 'champ de la liste blanche doit être appliqué');
      assert.equal(new Date(fresh.createdAt).toISOString(), createdAtAvant, 'createdAt fabriqué par le client ne doit jamais écraser la vraie date de création');
      assert.equal(fresh.champFabrique, undefined, 'un champ hors schéma/liste blanche ne doit jamais être persisté');
    });

    await t.test('updateInsurance : champ fabriqué hors schéma ignoré, createdAt fabriqué ignoré, champ légitime accepté', async () => {
      const createdAtAvant = insurance.createdAt.toISOString();
      const { status, body } = await call(settingsC.updateInsurance, {
        params: { id: insurance._id }, user, ip: '127.0.0.1',
        body: {
          taux_prise_en_charge: 55,
          createdAt: new Date('2000-01-01').toISOString(),
          champFabrique: 'valeur injectée',
        },
      });
      assert.equal(status, 200, JSON.stringify(body));

      const fresh = await Insurance.findById(insurance._id).lean();
      assert.equal(fresh.taux_prise_en_charge, 55, 'champ de la liste blanche doit être appliqué');
      assert.equal(new Date(fresh.createdAt).toISOString(), createdAtAvant, 'createdAt fabriqué par le client ne doit jamais écraser la vraie date de création');
      assert.equal(fresh.champFabrique, undefined, 'un champ hors schéma/liste blanche ne doit jamais être persisté');
    });
  } finally {
    await Service.findByIdAndDelete(service._id);
    await Insurance.findByIdAndDelete(insurance._id);
    await mongoose.disconnect();
  }
});
