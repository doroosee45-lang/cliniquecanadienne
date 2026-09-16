// POST5-008 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE.
// finance.controller.js::create gardait un `patient` au format ObjectId
// valide tel quel, sans jamais vérifier qu'il référence réellement un
// Patient existant — un texte libre était déjà correctement reconverti en
// patient_nom (cas géré), mais un ObjectId fabriqué/orphelin passait sans
// contrôle. Même correctif que POST5-007 (laboratoire/radiologie),
// appliqué ici au chemin de facturation générique.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('POST5-008 — finance.controller.js::create valide réellement l\'existence du patient quand un ObjectId est fourni (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Invoice = require('../models/Invoice');
  const financeC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Comptable' };
  const cleanup = [];

  try {
    await t.test('patient fabriqué (ObjectId au format valide, mais aucun Patient réel) — refusé (400), aucune facture créée', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { patient: String(fauxId), service: 'Consultation', montant: 15000 } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Invoice.countDocuments({ patient: fauxId });
      assert.equal(count, 0, 'aucune facture orpheline ne doit être créée');
    });

    await t.test('scénario nominal — patient réel et existant est accepté et persisté', async () => {
      const patient = await Patient.create({ nom: `P5008-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { patient: String(patient._id), service: 'Consultation', montant: 15000 } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      assert.equal(String(r.body.invoice.patient_id), String(patient._id));
      const fresh = await Invoice.findById(r.body.invoice._id).lean();
      assert.equal(String(fresh.patient), String(patient._id), 'la référence réelle doit être persistée en base');
    });

    await t.test('non-régression — un patient en texte libre (pas un ObjectId) continue de fonctionner via patient_nom, jamais bloqué par cette validation', async () => {
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { patient: 'Jean Dupont (non enregistré)', service: 'Consultation', montant: 10000 } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      assert.equal(r.body.invoice.patient, 'Jean Dupont (non enregistré)');
      assert.equal(r.body.invoice.patient_id, null, 'aucun ObjectId ne doit être inventé pour un texte libre');
      const fresh = await Invoice.findById(r.body.invoice._id).lean();
      assert.equal(fresh.patient, undefined, 'le champ patient (référence) ne doit jamais être renseigné pour un texte libre');
      assert.equal(fresh.patient_nom, 'Jean Dupont (non enregistré)');
    });

    await t.test('non-régression — aucun patient fourni du tout reste accepté (facture sans patient identifié, comportement préexistant inchangé)', async () => {
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { service: 'Consultation', montant: 5000 } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
