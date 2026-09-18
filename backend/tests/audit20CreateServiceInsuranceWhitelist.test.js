// AUDIT-20-4 (18 sept. 2026, audit indépendant) —
// settings.controller.js::createService/createInsurance appliquaient
// Model.create(req.body) sans aucune liste blanche, contrairement à
// updateService/updateInsurance (ADM-01, voir
// tests/adm01WhitelistServiceInsurance.test.js), qui en ont déjà une.
// Ni Service ni Insurance ne portent de champ système sensible (pas de mot
// de passe, pas de compteur interne, pas de rôle), contrairement au vrai
// bug AUDIT-11 sur User — priorité basse, appliqué pour la cohérence de
// convention. Réutilise telles quelles SERVICE_UPDATE_ALLOWED_FIELDS /
// INSURANCE_UPDATE_ALLOWED_FIELDS (aucun champ n'est create-only ou
// update-only sur ces deux modèles).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-20-4 — createService/createInsurance ignorent tout champ hors liste blanche', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Service = require('../models/Service');
  const Insurance = require('../models/Insurance');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const created = { services: [], insurances: [] };
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };

  try {
    await t.test('createService : champ fabriqué hors schéma ignoré, createdAt/_id fabriqués ignorés, champs légitimes acceptés', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const { status, body } = await call(settingsC.createService, {
        user, ip: '127.0.0.1',
        body: {
          nom: `Audit20-4-Service-${stamp}`, code: `AUDIT20-4-SVC-${stamp}`, etage: 3,
          _id: fauxId, createdAt: new Date('2000-01-01').toISOString(),
          champFabrique: 'valeur injectée',
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.services.push(body.service._id);

      assert.notEqual(String(body.service._id), String(fauxId), 'un _id fabriqué par le client ne doit jamais être utilisé — un vrai ObjectId généré par MongoDB doit prévaloir');
      const fresh = await Service.findById(body.service._id).lean();
      assert.equal(fresh.nom, `Audit20-4-Service-${stamp}`, 'champ de la liste blanche doit être appliqué');
      assert.equal(fresh.etage, 3, 'champ de la liste blanche doit être appliqué');
      assert.notEqual(new Date(fresh.createdAt).toISOString(), new Date('2000-01-01').toISOString(), 'createdAt fabriqué par le client ne doit jamais être utilisé — la vraie date de création doit prévaloir');
      assert.equal(fresh.champFabrique, undefined, 'un champ hors schéma/liste blanche ne doit jamais être persisté');
    });

    await t.test('createInsurance : champ fabriqué hors schéma ignoré, createdAt/_id fabriqués ignorés, champs légitimes acceptés', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const { status, body } = await call(settingsC.createInsurance, {
        user, ip: '127.0.0.1',
        body: {
          nom: `Audit20-4-Assurance-${stamp}`, code: `AUDIT20-4-INS-${stamp}`, taux_prise_en_charge: 65,
          _id: fauxId, createdAt: new Date('2000-01-01').toISOString(),
          champFabrique: 'valeur injectée',
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.insurances.push(body.insurance._id);

      assert.notEqual(String(body.insurance._id), String(fauxId), 'un _id fabriqué par le client ne doit jamais être utilisé');
      const fresh = await Insurance.findById(body.insurance._id).lean();
      assert.equal(fresh.nom, `Audit20-4-Assurance-${stamp}`, 'champ de la liste blanche doit être appliqué');
      assert.equal(fresh.taux_prise_en_charge, 65, 'champ de la liste blanche doit être appliqué');
      assert.notEqual(new Date(fresh.createdAt).toISOString(), new Date('2000-01-01').toISOString(), 'createdAt fabriqué par le client ne doit jamais être utilisé');
      assert.equal(fresh.champFabrique, undefined, 'un champ hors schéma/liste blanche ne doit jamais être persisté');
    });
  } finally {
    for (const id of created.services) await Service.findByIdAndDelete(id);
    for (const id of created.insurances) await Insurance.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
