// SEC-B-06 (correction du 12 sept. 2026, audit indépendant) —
// messages.controller.js::getOrCreate acceptait n'importe quel userId
// fourni par le client, sans vérifier que la cible est un vrai membre du
// personnel actif (le modèle métier de cette messagerie exclut déjà les
// patients — getDirectory() les filtre explicitement) ni même que la
// cible existe réellement. Corrigé : userId doit résoudre vers un User
// réel, jamais role:'patient'.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SEC-B-06 — getOrCreate() n\'autorise une conversation qu\'avec un vrai membre du personnel, jamais un patient ni un ID fabriqué', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Conversation = require('../models/Conversation');
  const msgC = require('../controllers/messages.controller');

  const stamp = Date.now();
  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await msgC.getOrCreate(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const staffA = await User.create({ email: `_secb06-staffA-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'Staff', role: 'medecin', statut: 'actif' });
  const staffB = await User.create({ email: `_secb06-staffB-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'Staff', role: 'infirmier', statut: 'actif' });
  const patientUser = await User.create({ email: `_secb06-patient-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Patient', prenom: 'Compte', role: 'patient', statut: 'actif' });
  const created = { convs: [] };

  try {
    await t.test('staff → staff réel : conversation créée normalement (non-régression)', async () => {
      const { status, body } = await call({ user: staffA, ip: '127.0.0.1', body: { userId: staffB._id.toString() } });
      assert.equal(status, 200, JSON.stringify(body));
      created.convs.push(body.conversation._id);
    });

    await t.test('staff → compte role:patient : refusé (403), aucune conversation créée', async () => {
      const { status, body } = await call({ user: staffA, ip: '127.0.0.1', body: { userId: patientUser._id.toString() } });
      assert.equal(status, 403, JSON.stringify(body));
      const conv = await Conversation.findOne({ type: 'direct', membres: { $all: [staffA._id, patientUser._id], $size: 2 } });
      assert.equal(conv, null, 'aucune conversation ne doit exister entre un staff et un compte patient');
    });

    await t.test('staff → utilisateur inexistant (ID fabriqué) : refusé (404), aucune conversation créée', async () => {
      const idFabrique = new mongoose.Types.ObjectId();
      const { status, body } = await call({ user: staffA, ip: '127.0.0.1', body: { userId: idFabrique.toString() } });
      assert.equal(status, 404, JSON.stringify(body));
      const conv = await Conversation.findOne({ type: 'direct', membres: { $all: [staffA._id, idFabrique], $size: 2 } });
      assert.equal(conv, null);
    });

    await t.test('userId absent du corps de la requête : refusé (400)', async () => {
      const { status } = await call({ user: staffA, ip: '127.0.0.1', body: {} });
      assert.equal(status, 400);
    });
  } finally {
    await Conversation.deleteMany({ _id: { $in: created.convs } });
    await User.deleteMany({ _id: { $in: [staffA._id, staffB._id, patientUser._id] } });
    await mongoose.disconnect();
  }
});
