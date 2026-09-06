// Correction 5 — le formulaire de contact public fonctionne et persiste
// réellement (Correction 9/FE-BUG-011) depuis Sous-phase 4, mais aucune
// interface n'existait pour qu'un membre du personnel consulte les messages
// reçus — fonctionnel techniquement, inutile en pratique. Ce test soumet un
// message via le VRAI formulaire public (contactC.create), puis vérifie
// qu'il apparaît réellement dans la nouvelle interface admin (contactC.
// getAll), qu'il peut réellement être marqué "traité" (persisté, relu après
// un getAll() frais), et que authorize(...ADMIN, 'receptionniste') — la
// vraie fonction montée sur ces routes — refuse un rôle non autorisé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 5 — un message soumis via le vrai formulaire public apparaît dans la vraie interface admin', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ContactMessage = require('../models/ContactMessage');
  const contactC = require('../controllers/contact.controller');
  const { authorize } = require('../middleware/auth');

  const stamp = Date.now();
  const created = { contacts: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    let contactId;

    await t.test('soumission réelle via le vrai formulaire public (POST /contact)', async () => {
      const payload = { nom: `Test Correction5 ${stamp}`, tel: '+242 06 000 0001', email: `_correction5-${stamp}@_test.local`, sujet: 'Demande de rendez-vous', message: 'Message réel de test Correction5.' };
      const { status, body } = await call(contactC.create, { body: payload, ip: '127.0.0.1' });
      assert.equal(status, 201, JSON.stringify(body));
      contactId = body.id;
      created.contacts.push(contactId);
    });

    await t.test('apparaît réellement dans la nouvelle interface admin (GET /contact)', async () => {
      const { status, body } = await call(contactC.getAll, { query: {} });
      assert.equal(status, 200);
      const mine = body.messages.find(m => String(m._id) === String(contactId));
      assert.ok(mine, 'le message soumis via le vrai formulaire public doit réellement apparaître');
      assert.equal(mine.nom, `Test Correction5 ${stamp}`);
      assert.equal(mine.traite, false);
    });

    await t.test('marquer "traité" persiste réellement, relu après un getAll() frais', async () => {
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
      const { status, body } = await call(contactC.markTraite, { params: { id: contactId }, body: { traite: true }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.message.traite, true);

      // Preuve anti-"faux succès" : relecture par un getAll() frais, pas
      // seulement la réponse du PUT.
      const { body: reloaded } = await call(contactC.getAll, { query: { traite: 'true' } });
      const mine = reloaded.messages.find(m => String(m._id) === String(contactId));
      assert.ok(mine, 'doit réapparaître dans le filtre "traité" après un rechargement complet');
    });

    await t.test('filtre "non traité" exclut réellement le message désormais traité', async () => {
      const { body } = await call(contactC.getAll, { query: { traite: 'false' } });
      const mine = body.messages.find(m => String(m._id) === String(contactId));
      assert.equal(mine, undefined, 'un message marqué traité ne doit plus apparaître dans le filtre "non traité"');
    });

    await t.test('markTraite rejette un body sans "traite" booléen (400), ne modifie rien', async () => {
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
      const { status } = await call(contactC.markTraite, { params: { id: contactId }, body: {}, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 400);
      const fresh = await ContactMessage.findById(contactId).lean();
      assert.equal(fresh.traite, true, 'inchangé après un rejet 400');
    });

    await t.test("authorize(...ADMIN, 'receptionniste') — la vraie fonction montée sur ces routes — refuse un rôle non autorisé (403)", async () => {
      let status = 200, body = null, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'medecin' }, baseUrl: '/contact', originalUrl: '/contact', method: 'GET', ip: '127.0.0.1' };
      await authorize('superadmin', 'adminclinique', 'receptionniste')(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false);
      assert.equal(body.success, false);
    });

    await t.test("authorize(...ADMIN, 'receptionniste') laisse passer réceptionniste", async () => {
      let nextCalled = false;
      const res = { status: () => res, json: () => {} };
      const req = { user: { role: 'receptionniste' }, baseUrl: '/contact', originalUrl: '/contact', method: 'GET', ip: '127.0.0.1' };
      await authorize('superadmin', 'adminclinique', 'receptionniste')(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });
  } finally {
    await ContactMessage.deleteMany({ _id: { $in: created.contacts } });
    await mongoose.disconnect();
  }
});
