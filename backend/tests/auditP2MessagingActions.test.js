// AUDIT-07 / Messagerie — implémentation réelle de createGroup, toggleReaction
// et deleteMessage (Conversation/MessageSchema réutilisés, aucun nouveau
// modèle hors le champ description sur Conversation et reactions sur
// MessageSchema). Couvre exactement les cas demandés : persistance réelle,
// scoping par appartenance, règle d'auteur pour la suppression, toggle des
// réactions, échecs propres sur données invalides.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('messages.controller — créer un groupe, réactions, suppression (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const Conversation = require('../models/Conversation');
  const User = require('../models/User');

  const stamp = Date.now();
  const createur = await User.create({ email: `_grp-createur-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Createur', prenom: 'Grp', role: 'medecin', statut: 'actif' });
  const membre1  = await User.create({ email: `_grp-m1-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'M1', prenom: 'Grp', role: 'infirmier', statut: 'actif' });
  const membre2  = await User.create({ email: `_grp-m2-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'M2', prenom: 'Grp', role: 'infirmier', statut: 'actif' });
  const exterieur = await User.create({ email: `_grp-ext-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Ext', prenom: 'Grp', role: 'medecin', statut: 'actif' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [
    () => User.findByIdAndDelete(createur._id),
    () => User.findByIdAndDelete(membre1._id),
    () => User.findByIdAndDelete(membre2._id),
    () => User.findByIdAndDelete(exterieur._id),
  ];

  try {
    // ── Créer un groupe ──────────────────────────────────────
    let groupId;

    await t.test('createGroup — création persistée, créateur automatiquement membre, membres corrects', async () => {
      const { status, body } = await call(msgC.createGroup, {
        user: createur,
        body: { nom: `Groupe Test ${stamp}`, description: 'Une description', membres: [membre1._id.toString(), membre2._id.toString()] },
      });
      assert.equal(status, 201);
      assert.equal(body.conversation.type, 'groupe');
      assert.equal(body.conversation.nom, `Groupe Test ${stamp}`);
      groupId = body.conversation._id;
      cleanup.push(() => Conversation.findByIdAndDelete(groupId));

      const relu = await Conversation.findById(groupId).lean();
      assert.equal(relu.description, 'Une description', 'description doit être réellement persistée');
      const membresIds = relu.membres.map(m => m.toString());
      assert.ok(membresIds.includes(createur._id.toString()), 'le créateur doit être automatiquement membre');
      assert.ok(membresIds.includes(membre1._id.toString()));
      assert.ok(membresIds.includes(membre2._id.toString()));
      assert.equal(membresIds.length, 3, 'pas de doublon même si le créateur se sélectionne aussi lui-même');
      assert.equal(relu.created_by.toString(), createur._id.toString());
    });

    await t.test('createGroup — visible dans getConversations pour ses membres, invisible pour un tiers', async () => {
      const { body: bodyMembre } = await call(msgC.getConversations, { user: membre1 });
      assert.ok(bodyMembre.conversations.some(c => c._id.toString() === groupId.toString()), 'un membre du groupe doit le voir dans ses conversations');

      const { body: bodyExterieur } = await call(msgC.getConversations, { user: exterieur });
      assert.ok(!bodyExterieur.conversations.some(c => c._id.toString() === groupId.toString()), 'un utilisateur extérieur ne doit pas voir le groupe');
    });

    await t.test('createGroup — utilisable immédiatement avec sendMessage/getMessages existants', async () => {
      const { status } = await call(msgC.sendMessage, { user: membre2, params: { id: groupId }, body: { contenu: `Message groupe ${stamp}` } });
      assert.equal(status, 200);
      const { body } = await call(msgC.getMessages, { user: createur, params: { id: groupId } });
      assert.ok(body.messages.some(m => m.contenu === `Message groupe ${stamp}`), 'le message envoyé dans le groupe doit être lisible par un autre membre');
    });

    await t.test('createGroup — échec propre sur données invalides (nom manquant, aucun membre)', async () => {
      const { status: s1, body: b1 } = await call(msgC.createGroup, { user: createur, body: { nom: '', membres: [membre1._id.toString()] } });
      assert.equal(s1, 400);
      assert.equal(b1.success, false);

      const { status: s2, body: b2 } = await call(msgC.createGroup, { user: createur, body: { nom: 'Sans membres', membres: [] } });
      assert.equal(s2, 400);
      assert.equal(b2.success, false);
    });

    // ── Réactions ─────────────────────────────────────────────
    let msgId;

    await t.test('toggleReaction — un membre ajoute une réaction, réellement persistée', async () => {
      const { body: sendBody } = await call(msgC.sendMessage, { user: createur, params: { id: groupId }, body: { contenu: `Msg à réagir ${stamp}` } });
      msgId = sendBody.message._id;

      const { status, body } = await call(msgC.toggleReaction, { user: membre1, params: { msgId }, body: { emoji: '👍' } });
      assert.equal(status, 200);
      assert.equal(body.action, 'ajoutee');
      assert.equal(body.reactions.length, 1);

      const relu = await Conversation.findById(groupId).lean();
      const reluMsg = relu.messages.find(m => m._id.toString() === msgId.toString());
      assert.equal(reluMsg.reactions.length, 1, 'la réaction doit être réellement persistée (relecture base fraîche)');
      assert.equal(reluMsg.reactions[0].emoji, '👍');
      assert.equal(reluMsg.reactions[0].utilisateur.toString(), membre1._id.toString());
    });

    await t.test('toggleReaction — même emoji par le même utilisateur = toggle (retrait), pas de doublon', async () => {
      const { status, body } = await call(msgC.toggleReaction, { user: membre1, params: { msgId }, body: { emoji: '👍' } });
      assert.equal(status, 200);
      assert.equal(body.action, 'retiree');
      assert.equal(body.reactions.length, 0);

      const relu = await Conversation.findById(groupId).lean();
      const reluMsg = relu.messages.find(m => m._id.toString() === msgId.toString());
      assert.equal(reluMsg.reactions.length, 0, 'la réaction retirée doit disparaître de la base, pas juste de la réponse');
    });

    await t.test('toggleReaction — deux utilisateurs différents peuvent réagir avec le même emoji sans se supprimer mutuellement', async () => {
      await call(msgC.toggleReaction, { user: membre1, params: { msgId }, body: { emoji: '❤️' } });
      const { body } = await call(msgC.toggleReaction, { user: membre2, params: { msgId }, body: { emoji: '❤️' } });
      assert.equal(body.reactions.length, 2, 'deux utilisateurs distincts doivent pouvoir avoir chacun leur réaction ❤️ sur le même message');
    });

    await t.test('toggleReaction — un utilisateur non membre reçoit 403', async () => {
      let status;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      await msgC.toggleReaction({ user: exterieur, params: { msgId }, body: { emoji: '👍' } }, res, (e) => { if (e) throw e; });
      assert.equal(status, 403);
    });

    // ── Suppression ───────────────────────────────────────────
    await t.test('deleteMessage — l\'auteur peut supprimer son propre message, réellement retiré de la base', async () => {
      const { body: sendBody } = await call(msgC.sendMessage, { user: membre1, params: { id: groupId }, body: { contenu: `À supprimer ${stamp}` } });
      const toDeleteId = sendBody.message._id;

      const { status } = await call(msgC.deleteMessage, { user: membre1, params: { msgId: toDeleteId } });
      assert.equal(status, 200);

      const relu = await Conversation.findById(groupId).lean();
      assert.ok(!relu.messages.some(m => m._id.toString() === toDeleteId.toString()), 'le message doit être absent après relecture depuis MongoDB');
    });

    // AUDIT-MESSAGES-PhaseC
    await t.test('deleteMessage — dernier_message_apercu est recalculé, pas laissé à afficher un message supprimé', async () => {
      await call(msgC.sendMessage, { user: membre1, params: { id: groupId }, body: { contenu: `Avant-dernier ${stamp}` } });
      const { body: sendBody } = await call(msgC.sendMessage, { user: membre1, params: { id: groupId }, body: { contenu: `Dernier message ${stamp}` } });
      const lastId = sendBody.message._id;

      let relu = await Conversation.findById(groupId).lean();
      assert.equal(relu.dernier_message_apercu, `Dernier message ${stamp}`);

      await call(msgC.deleteMessage, { user: membre1, params: { msgId: lastId } });

      relu = await Conversation.findById(groupId).lean();
      assert.equal(relu.dernier_message_apercu, `Avant-dernier ${stamp}`, "l'aperçu doit refléter le nouveau dernier message, pas celui qui vient d'être supprimé");
    });

    await t.test('deleteMessage — un autre membre (non-auteur) reçoit 403, le message survit', async () => {
      const { body: sendBody } = await call(msgC.sendMessage, { user: membre1, params: { id: groupId }, body: { contenu: `Protégé ${stamp}` } });
      const protectedId = sendBody.message._id;

      let status;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      await msgC.deleteMessage({ user: membre2, params: { msgId: protectedId } }, res, (e) => { if (e) throw e; });
      assert.equal(status, 403);

      const relu = await Conversation.findById(groupId).lean();
      assert.ok(relu.messages.some(m => m._id.toString() === protectedId.toString()), 'le message ne doit pas avoir été supprimé par un non-auteur');
    });

    await t.test('deleteMessage — un utilisateur extérieur reçoit 403', async () => {
      const { body: sendBody } = await call(msgC.sendMessage, { user: createur, params: { id: groupId }, body: { contenu: `Protégé2 ${stamp}` } });
      const protectedId = sendBody.message._id;

      let status;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      await msgC.deleteMessage({ user: exterieur, params: { msgId: protectedId } }, res, (e) => { if (e) throw e; });
      assert.equal(status, 403);
    });

    await t.test('deleteMessage — message inexistant reçoit 404', async () => {
      let status;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      await msgC.deleteMessage({ user: createur, params: { msgId: new mongoose.Types.ObjectId() } }, res, (e) => { if (e) throw e; });
      assert.equal(status, 404);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
