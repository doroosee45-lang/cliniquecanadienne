// AUDIT-07 — messages.controller.js est réellement utilisé (Messages.jsx
// appelle bien ces 4 endpoints) mais n'avait aucune couverture de test.
// Couvre explicitement le scoping par utilisateur (une conversation n'est
// visible/accessible qu'à ses membres, vérifié via 403 sur un tiers) en
// plus du comportement fonctionnel — c'est le seul des 3 contrôleurs
// AUDIT-07 où l'accès est scopé par appartenance plutôt que par rôle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { withLocalUploadFallback } = require('./helpers/forceLocalUploadFallback');

test('messages.controller — les 4 endpoints réellement utilisés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const User = require('../models/User');

  const stamp = Date.now();
  const userA = await User.create({ email: `_msg-a-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'MsgA', role: 'medecin', statut: 'actif' });
  const userB = await User.create({ email: `_msg-b-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'MsgB', role: 'infirmier', statut: 'actif' });
  const userTiers = await User.create({ email: `_msg-c-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'C', prenom: 'MsgTiers', role: 'medecin', statut: 'actif' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [
    () => User.findByIdAndDelete(userA._id),
    () => User.findByIdAndDelete(userB._id),
    () => User.findByIdAndDelete(userTiers._id),
  ];

  try {
    let convId;

    await t.test('getOrCreate — crée une conversation directe, idempotent au second appel', async () => {
      const { status, body } = await call(msgC.getOrCreate, { user: userA, body: { userId: userB._id.toString() } });
      assert.equal(status, 200);
      assert.equal(body.conversation.type, 'direct');
      assert.equal(body.conversation.membres.length, 2);
      convId = body.conversation._id;
      cleanup.push(() => Conversation.findByIdAndDelete(convId));
      cleanup.push(() => Message.deleteMany({ conversation_id: convId }));

      // Rappel avec la même paire — ne doit pas créer une seconde conversation.
      const { body: body2 } = await call(msgC.getOrCreate, { user: userA, body: { userId: userB._id.toString() } });
      assert.equal(body2.conversation._id.toString(), convId.toString(), 'un second appel avec la même paire doit renvoyer la conversation existante, pas en créer une nouvelle');
      const total = await Conversation.countDocuments({ membres: { $all: [userA._id, userB._id] } });
      assert.equal(total, 1, 'une seule conversation directe doit exister pour cette paire');
    });

    await t.test('getConversations — scopé au membre courant (userA la voit, userTiers non)', async () => {
      const { body: bodyA } = await call(msgC.getConversations, { user: userA });
      assert.ok(bodyA.conversations.some(c => c._id.toString() === convId.toString()), 'userA doit voir la conversation dont il est membre');

      const { body: bodyTiers } = await call(msgC.getConversations, { user: userTiers });
      assert.ok(!bodyTiers.conversations.some(c => c._id.toString() === convId.toString()), 'userTiers ne doit pas voir une conversation dont il n\'est pas membre');
    });

    await t.test('sendMessage — persiste le message, refuse un non-membre (403)', async () => {
      const { status, body } = await call(msgC.sendMessage, { user: userA, params: { id: convId }, body: { contenu: `Bonjour ${stamp}` } });
      assert.equal(status, 200);
      assert.equal(body.message.contenu, `Bonjour ${stamp}`);
      // expediteur est peuplé (nom/prenom/avatar/role) par sendMessage avant réponse.
      assert.equal(body.message.expediteur._id.toString(), userA._id.toString());

      // AUDIT-ELEVE-5 — persistance vérifiée dans la collection Message
      // dédiée (plus Conversation.messages, migré).
      const relu = await Message.find({ conversation_id: convId }).lean();
      assert.equal(relu.length, 1, 'le message doit être réellement persisté en base');
      assert.equal(relu[0].contenu, `Bonjour ${stamp}`);

      // Autorisation : un tiers non membre ne doit pas pouvoir écrire dans la conversation.
      let statusTiers;
      const resTiers = { status: (c) => { statusTiers = c; return resTiers; }, json: () => {} };
      await msgC.sendMessage({ user: userTiers, params: { id: convId }, body: { contenu: 'Intrusion' } }, resTiers, (e) => { if (e) throw e; });
      assert.equal(statusTiers, 403, 'un utilisateur non membre de la conversation doit recevoir 403');
      const apresIntrusionCount = await Message.countDocuments({ conversation_id: convId });
      assert.equal(apresIntrusionCount, 1, 'le message du tiers non autorisé ne doit pas avoir été ajouté');
    });

    await t.test('getMessages — marque comme lu pour le lecteur, refuse un non-membre (403)', async () => {
      const { status, body } = await call(msgC.getMessages, { user: userB, params: { id: convId }, query: {} });
      assert.equal(status, 200);
      assert.equal(body.messages.length, 1);

      const relu = await Message.findOne({ conversation_id: convId }).lean();
      const luPar = relu.lu_par.map(id => id.toString());
      assert.ok(luPar.includes(userB._id.toString()), 'userB doit être ajouté à lu_par après avoir lu la conversation');

      let statusTiers;
      const resTiers = { status: (c) => { statusTiers = c; return resTiers; }, json: () => {} };
      await msgC.getMessages({ user: userTiers, params: { id: convId }, query: {} }, resTiers, (e) => { if (e) throw e; });
      assert.equal(statusTiers, 403, 'un utilisateur non membre ne doit pas pouvoir lire la conversation');
    });

    // AUDIT-MESSAGES-PhaseA
    await t.test('sendMessage — persiste dernier_message_apercu (aperçu réel du dernier message)', async () => {
      const relu = await Conversation.findById(convId).lean();
      assert.equal(relu.dernier_message_apercu, `Bonjour ${stamp}`, 'dernier_message_apercu doit contenir le texte réel du dernier message envoyé');
    });

    // AUDIT-MESSAGES-PhaseA — getDirectory remplace GET /admin/users (réservé
    // ADMIN) comme source de la modale "Nouveau message" : n'importe quel
    // rôle authentifié doit pouvoir lister ses collègues, jamais les patients.
    await t.test('getDirectory — accessible à un rôle non-admin (infirmier), exclut soi-même et les patients', async () => {
      const patientUser = await User.create({ email: `_msg-patient-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'D', prenom: 'MsgPatient', role: 'patient', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(patientUser._id));

      const { status, body } = await call(msgC.getDirectory, { user: userB });
      assert.equal(status, 200);
      const ids = body.users.map(u => u._id.toString());
      assert.ok(ids.includes(userA._id.toString()), 'un autre membre du personnel (userA, rôle non-admin) doit apparaître dans l\'annuaire');
      assert.ok(!ids.includes(userB._id.toString()), 'l\'utilisateur courant ne doit pas apparaître dans son propre annuaire');
      assert.ok(!ids.includes(patientUser._id.toString()), 'un compte patient ne doit jamais apparaître dans l\'annuaire collègues');
      // Projection minimale : ni statut, ni email, ni tout champ sensible
      // (mongoose expose ces chemins comme accesseurs même hors sélection,
      // d'où la vérification sur la valeur plutôt que sur la présence de clé
      // — c'est aussi ce que verrait un vrai client HTTP après JSON.stringify).
      const sample = body.users[0];
      assert.equal(sample.statut, undefined, 'la projection ne doit jamais exposer le statut du compte');
      assert.equal(sample.email, undefined, 'la projection ne doit jamais exposer l\'email');
      assert.equal(sample.reset_password_token, undefined, 'la projection ne doit jamais exposer de champ sensible');
    });

    // AUDIT-MESSAGES-PhaseB
    await t.test('toggleFavori — bascule et persiste par utilisateur, refuse un non-membre (403)', async () => {
      const { status, body } = await call(msgC.toggleFavori, { user: userA, params: { id: convId } });
      assert.equal(status, 200);
      assert.equal(body.favori, true);
      const relu = await Conversation.findById(convId).lean();
      assert.ok(relu.favoris.some(id => id.toString() === userA._id.toString()));

      const { body: body2 } = await call(msgC.toggleFavori, { user: userA, params: { id: convId } });
      assert.equal(body2.favori, false, 'un second appel doit retirer le favori');

      let statusTiers;
      const resTiers = { status: (c) => { statusTiers = c; return resTiers; }, json: () => {} };
      await msgC.toggleFavori({ user: userTiers, params: { id: convId } }, resTiers, (e) => { if (e) throw e; });
      assert.equal(statusTiers, 403, 'un utilisateur non membre ne doit pas pouvoir favoriser la conversation');
    });

    await t.test('toggleArchive — masque la conversation pour cet utilisateur uniquement', async () => {
      const { status, body } = await call(msgC.toggleArchive, { user: userB, params: { id: convId } });
      assert.equal(status, 200);
      assert.equal(body.archivee, true);
      const relu = await Conversation.findById(convId).lean();
      assert.ok(relu.archivee_par.some(id => id.toString() === userB._id.toString()));
      assert.ok(!relu.archivee_par.some(id => id.toString() === userA._id.toString()), 'archiver ne doit affecter que l\'utilisateur qui archive');
      // Restaure pour ne pas affecter les tests suivants.
      await call(msgC.toggleArchive, { user: userB, params: { id: convId } });
    });

    await t.test('sendAttachment — persiste la pièce jointe et l\'aperçu de conversation', async () => {
      // MIGRATION-CLOUDINARY — req.file.buffer (multer memoryStorage), plus
      // de filename généré côté disque par multer. Force le repli disque
      // local même si CLOUDINARY_* est réellement configuré dans le .env de
      // cette machine.
      const fakeFile = { originalname: 'vocal.webm', buffer: Buffer.from('audio-data') };
      const { status, body } = await withLocalUploadFallback(() => call(msgC.sendAttachment, { user: userA, params: { id: convId }, body: { type: 'audio', duration: '7' }, file: fakeFile }));
      assert.equal(status, 200);
      assert.equal(body.message.pieceJointe.type, 'audio');
      assert.match(body.message.pieceJointe.path, /^\/uploads\/messages\/\d+-vocal\.webm$/);
      const relu = await Conversation.findById(convId).lean();
      assert.equal(relu.dernier_message_apercu, '🎙️ Message vocal');
      await fs.promises.unlink(path.join(__dirname, '..', body.message.pieceJointe.path)).catch(() => {});
    });

    await t.test('sendMessage — refuse un transfert de pièce jointe hors /uploads/messages/ (path traversal)', async () => {
      const { status, body } = await call(msgC.sendMessage, { user: userA, params: { id: convId }, body: { contenu: '', pieceJointe: { path: '/uploads/patients/secret.jpg', type: 'image' } } });
      assert.equal(status, 400);
      assert.equal(body.success, false);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
