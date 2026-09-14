// ANOM-MAT-02 (audit métier du 13 sept. 2026, Phase 4) — createDelivery
// (POST /maternite/accouchements) ne validait patient_id (format ObjectId +
// existence réelle) que lorsqu'il était dérivé d'un grossesse_id fourni ;
// un patient_id transmis directement, sans grossesse_id, n'était vérifié ni
// pour son format ni pour son existence — contrairement à create(Pregnancy)
// et createNewborn, qui valident systématiquement. Non exploitable via
// l'interface normale (Maternite.jsx impose toujours une grossesse liée),
// mais réel via un appel API direct.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ANOM-MAT-02 — createDelivery valide réellement un patient_id fourni sans grossesse_id (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient  = require('../models/Patient');
  const Pregnancy = require('../models/Pregnancy');
  const Delivery = require('../models/Delivery');
  const maternityC = require('../controllers/maternityController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId() };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('patient_id fabriqué (format valide, mais aucun Patient réel) est rejeté, aucun Delivery créé', async () => {
      const fauxPatientId = new mongoose.Types.ObjectId();
      const r = await call(maternityC.createDelivery, {
        user, ip: '127.0.0.1',
        body: { patient_id: String(fauxPatientId), date_heure: new Date().toISOString(), type_accouchement: 'voie_basse' },
      });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const created = await Delivery.countDocuments({ patient_id: fauxPatientId });
      assert.equal(created, 0, 'aucun Delivery orphelin ne doit être créé');
    });

    await t.test('patient_id au format invalide (non-ObjectId) est rejeté', async () => {
      const r = await call(maternityC.createDelivery, {
        user, ip: '127.0.0.1',
        body: { patient_id: 'pas-un-objectid', date_heure: new Date().toISOString(), type_accouchement: 'voie_basse' },
      });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    await t.test('patient_id réel et existant, sans grossesse_id, est accepté (comportement inchangé, juste vérifié)', async () => {
      const patient = await Patient.create({ nom: `MAT02-${stamp}`, prenom: 'Direct', sexe: 'F', date_naissance: '1990-01-01', telephone: '060000002' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const r = await call(maternityC.createDelivery, {
        user, ip: '127.0.0.1',
        body: { patient_id: String(patient._id), date_heure: new Date().toISOString(), type_accouchement: 'voie_basse' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Delivery.findByIdAndDelete(r.body.accouchement._id));
      assert.equal(String(r.body.accouchement.patient_id), String(patient._id));
    });

    await t.test('non-régression — un accouchement rattaché via grossesse_id reste inchangé (patient_id dérivé de la grossesse, jamais revalidé en doublon)', async () => {
      const patient = await Patient.create({ nom: `MAT02B-${stamp}`, prenom: 'ViaGrossesse', sexe: 'F', date_naissance: '1991-01-01', telephone: '060000003' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const gRes = await call(maternityC.create, { user, ip: '127.0.0.1', body: { patient_id: String(patient._id), ddr: new Date().toISOString() } });
      assert.equal(gRes.status, 201, JSON.stringify(gRes.body));
      cleanup.push(() => Pregnancy.findByIdAndDelete(gRes.body.grossesse._id));

      const r = await call(maternityC.createDelivery, {
        user, ip: '127.0.0.1',
        body: { grossesse_id: String(gRes.body.grossesse._id), date_heure: new Date().toISOString(), type_accouchement: 'cesarienne' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Delivery.findByIdAndDelete(r.body.accouchement._id));
      assert.equal(String(r.body.accouchement.patient_id), String(patient._id), 'patient_id doit toujours être dérivé de la grossesse liée');
    });

    await t.test('non-régression — ni patient_id ni grossesse_id fournis : toujours accepté (le champ reste optionnel, seule la validation quand il est présent a changé)', async () => {
      const r = await call(maternityC.createDelivery, {
        user, ip: '127.0.0.1',
        body: { date_heure: new Date().toISOString(), type_accouchement: 'voie_basse' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Delivery.findByIdAndDelete(r.body.accouchement._id));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
