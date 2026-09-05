// Correction 9 (relecture du 6 sept. 2026, FE-BUG-011) — le formulaire de
// contact public (home.jsx) capturait déjà la saisie dans un state
// contrôlé, mais le bouton "Envoyer le message" n'avait aucun onClick :
// rien n'était jamais transmis au serveur, quelle que soit la saisie.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 9 — le formulaire de contact réel persiste réellement la soumission', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ContactMessage = require('../models/ContactMessage');
  const contactC = require('../controllers/contact.controller');

  const stamp = Date.now();
  const created = { contacts: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('soumission réelle (nom/tel/email/sujet/message) → réellement persistée en base, jamais un faux succès', async () => {
      const payload = { nom: `Test Correction9 ${stamp}`, tel: '+242 06 000 0000', email: `_correction9-${stamp}@_test.local`, sujet: 'Question test', message: 'Ceci est un message de test Correction9.' };
      const { status, body } = await call(contactC.create, { body: payload, ip: '127.0.0.1' });
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.id);
      created.contacts.push(body.id);

      const fresh = await ContactMessage.findById(body.id).lean();
      assert.ok(fresh, 'le message doit exister en base, jamais juste un statut affiché sans état réel');
      assert.equal(fresh.nom, payload.nom);
      assert.equal(fresh.email, payload.email);
      assert.equal(fresh.message, payload.message);
      assert.equal(fresh.traite, false);
    });

    await t.test('LIMITE — champs obligatoires absents → vrai rejet 400, jamais un succès fabriqué', async () => {
      const { status, body } = await call(contactC.create, { body: { nom: '', email: '', message: '' }, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);
    });
  } finally {
    await ContactMessage.deleteMany({ _id: { $in: created.contacts } });
    await mongoose.disconnect();
  }
});
