// AUDIT-ELEVE-5 — preuve directe du nouveau comportement introduit par la
// migration Conversation.messages -> collection Message dédiée. Les autres
// fichiers de test (auditP2Messages, auditP2MessagingActions, analyticsPhase5,
// dashboard.fields...) ont été mis à jour pour rester compatibles avec le
// nouveau modèle, mais aucun ne prouvait explicitement le NOUVEAU comportement
// lui-même (pagination par curseur, portée exacte du marquage "lu",
// recalcul de dernier_message_apercu, cohérence des badges non-lus et du
// temps de réponse moyen sur un jeu de données connu). Ce fichier comble
// spécifiquement ce trou, sur base réelle, en appelant les vraies fonctions
// exportées (jamais une réimplémentation de la logique testée).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-ELEVE-5 — migration messagerie : preuve directe du nouveau comportement (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const msgC = require('../controllers/messages.controller');
  const dashboardC = require('../controllers/dashboard.controller');
  const portalC = require('../controllers/portal.controller');
  const analyticsC = require('../controllers/analytics.controller');
  const { computeAvgResponseTimeMin, groupMessagesByConversation } = analyticsC;

  const stamp = Date.now();
  const created = { users: [], conversations: [], patients: [] };

  // Même style de mock que le reste de la suite (auditP2Messages.test.js,
  // analyticsPhase5.test.js) : res.statusCode n'est jamais renseigné, donc
  // cacheStats() (personalized ou non) ne met jamais en cache la réponse
  // (`res.statusCode >= 200` est faux sur undefined) — chaque appel exécute
  // réellement le handler, ce qui est exactement ce qu'on veut vérifier ici.
  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const u1 = await User.create({ email: `_e5-u1-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'U1', role: 'medecin', statut: 'actif' });
    const u2 = await User.create({ email: `_e5-u2-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'U2', role: 'infirmier', statut: 'actif' });
    created.users.push(u1, u2);

    // ── 1. Pagination par curseur — 55 messages connus, page de 50 ────────
    await t.test('getMessages — pagination par curseur : 50 plus récents puis before charge les plus anciens, sans doublon ni trou', async () => {
      const conv = await Conversation.create({ type: 'direct', membres: [u1._id, u2._id] });
      created.conversations.push(conv);

      const base = new Date('2030-01-01T00:00:00Z').getTime();
      const TOTAL = 55;
      const docs = [];
      for (let i = 0; i < TOTAL; i++) {
        docs.push({
          conversation_id: conv._id,
          expediteur: i % 2 === 0 ? u1._id : u2._id,
          contenu: `E5-MSG-${i}`,
          date_envoi: new Date(base + i * 60000), // une minute d'écart, ordre croissant
        });
      }
      await Message.insertMany(docs);

      // Page 1 — pas de `before` : les 50 plus récents, hasMore=true.
      const { body: page1 } = await call(msgC.getMessages, { user: u1, params: { id: conv._id.toString() }, query: {} });
      assert.equal(page1.messages.length, 50, 'la première page doit contenir exactement 50 messages');
      assert.equal(page1.hasMore, true, 'il doit rester 5 messages plus anciens non chargés');
      // page1.messages est renvoyé en ordre chronologique (le plus ancien de
      // la page en premier) : ce sont les messages 5..54 (les 50 plus récents).
      assert.equal(page1.messages[0].contenu, 'E5-MSG-5', 'le premier message de la page doit être le 50e plus récent (index 5)');
      assert.equal(page1.messages[49].contenu, 'E5-MSG-54', 'le dernier message de la page doit être le tout dernier envoyé');

      // Page 2 — before = date_envoi du plus ancien déjà chargé : les 5 messages restants, hasMore=false.
      const oldestLoaded = page1.messages[0].date_envoi;
      const { body: page2 } = await call(msgC.getMessages, { user: u1, params: { id: conv._id.toString() }, query: { before: oldestLoaded } });
      assert.equal(page2.messages.length, 5, 'la seconde page doit contenir exactement les 5 messages restants');
      assert.equal(page2.hasMore, false, 'aucun message plus ancien ne doit rester après la seconde page');
      assert.equal(page2.messages[0].contenu, 'E5-MSG-0', 'le message le plus ancien de tous doit apparaître en tête de la seconde page');
      assert.equal(page2.messages[4].contenu, 'E5-MSG-4', 'la seconde page doit s\'arrêter juste avant le premier message déjà chargé en page 1');

      // Pas de doublon, pas de trou : l'union des deux pages doit reconstituer exactement les 55 messages, dans l'ordre.
      const combined = [...page2.messages, ...page1.messages];
      assert.equal(combined.length, TOTAL, 'l\'union des deux pages doit compter exactement les 55 messages, sans doublon ni trou');
      const ids = new Set(combined.map(m => m._id.toString()));
      assert.equal(ids.size, TOTAL, 'aucun message ne doit apparaître deux fois entre les deux pages');
      for (let i = 0; i < TOTAL; i++) {
        assert.equal(combined[i].contenu, `E5-MSG-${i}`, `le message combiné à la position ${i} doit être E5-MSG-${i} (ordre chronologique continu)`);
      }
    });

    // ── 2. Marquage comme lu : seuls les messages réellement non lus bougent ──
    await t.test('getMessages — marque comme lu uniquement les messages réellement non lus par le lecteur', async () => {
      const conv = await Conversation.create({ type: 'direct', membres: [u1._id, u2._id] });
      created.conversations.push(conv);

      // msgDejaLu : u2 l'a déjà lu avant l'appel (lu_par contient déjà u2).
      const msgDejaLu = await Message.create({ conversation_id: conv._id, expediteur: u1._id, contenu: 'E5-DEJA-LU', lu_par: [u1._id, u2._id] });
      // msgNonLu : u2 ne l'a pas encore lu.
      const msgNonLu = await Message.create({ conversation_id: conv._id, expediteur: u1._id, contenu: 'E5-NON-LU', lu_par: [u1._id] });
      // msgAutreConv : même expéditeur/lecteur mais dans UNE AUTRE conversation dont u2 n'est pas membre — ne doit jamais être touché.
      const tiers = await User.create({ email: `_e5-tiers-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'C', prenom: 'Tiers', role: 'medecin', statut: 'actif' });
      created.users.push(tiers);
      const convAutre = await Conversation.create({ type: 'direct', membres: [u1._id, tiers._id] });
      created.conversations.push(convAutre);
      const msgAutreConv = await Message.create({ conversation_id: convAutre._id, expediteur: u1._id, contenu: 'E5-AUTRE-CONV' });

      const updatedAtAvant = msgDejaLu.updatedAt.getTime();

      await call(msgC.getMessages, { user: u2, params: { id: conv._id.toString() }, query: {} });

      const dejaLuApres = await Message.findById(msgDejaLu._id).lean();
      const nonLuApres = await Message.findById(msgNonLu._id).lean();
      const autreConvApres = await Message.findById(msgAutreConv._id).lean();

      assert.equal(nonLuApres.lu_par.some(id => id.toString() === u2._id.toString()), true, 'le message réellement non lu doit désormais être marqué lu par u2');
      assert.equal(dejaLuApres.updatedAt.getTime(), updatedAtAvant, 'un message déjà lu par u2 ne doit pas être réécrit (updatedAt inchangé — $addToSet sur une valeur déjà présente ne modifie rien)');
      assert.equal(autreConvApres.lu_par.length, 0, 'un message d\'une conversation dont u2 n\'est pas membre ne doit jamais être touché par un appel scopé à une autre conversation');
    });

    // ── 3. toggleReaction / deleteMessage sur le nouveau modèle + recalcul dernier_message_apercu ──
    await t.test('toggleReaction et deleteMessage opèrent sur le nouveau modèle Message ; dernier_message_apercu recalculé correctement après suppression', async () => {
      // Paire d'utilisateurs DÉDIÉE à ce sous-test : u1/u2 ont déjà une
      // conversation directe créée par les sous-tests 1 et 2 (55 messages
      // datés 2030, non pertinents ici) — réutiliser getOrCreate(u1,u2) la
      // retrouverait (idempotent par construction) et polluerait le calcul
      // du "dernier message réel" ci-dessous avec ces messages hors-sujet.
      const u3 = await User.create({ email: `_e5-u3-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'D', prenom: 'U3', role: 'medecin', statut: 'actif' });
      const u4 = await User.create({ email: `_e5-u4-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'E', prenom: 'U4', role: 'infirmier', statut: 'actif' });
      created.users.push(u3, u4);

      const { body: getOrCreateBody } = await call(msgC.getOrCreate, { user: u3, body: { userId: u4._id.toString() } });
      const conv = getOrCreateBody.conversation;
      created.conversations.push(conv);

      const { body: b1 } = await call(msgC.sendMessage, { user: u3, params: { id: conv._id.toString() }, body: { contenu: 'E5-PREMIER' } });
      const msg1Id = b1.message._id;
      const { body: b2 } = await call(msgC.sendMessage, { user: u4, params: { id: conv._id.toString() }, body: { contenu: 'E5-DERNIER' } });
      const msg2Id = b2.message._id;

      let conv2 = await Conversation.findById(conv._id).lean();
      assert.equal(conv2.dernier_message_apercu, 'E5-DERNIER', 'sanity — le vrai dernier message envoyé doit être l\'aperçu courant');

      // toggleReaction — ajout puis retrait, sur msg1 (le nouveau modèle Message, pas un sous-document).
      const { body: r1 } = await call(msgC.toggleReaction, { user: u4, params: { msgId: msg1Id }, body: { emoji: '👍' } });
      assert.equal(r1.action, 'ajoutee');
      assert.equal(r1.reactions.length, 1);
      let msg1Doc = await Message.findById(msg1Id).lean();
      assert.equal(msg1Doc.reactions.length, 1, 'la réaction doit être réellement persistée sur le document Message');

      const { body: r2 } = await call(msgC.toggleReaction, { user: u4, params: { msgId: msg1Id }, body: { emoji: '👍' } });
      assert.equal(r2.action, 'retiree');
      msg1Doc = await Message.findById(msg1Id).lean();
      assert.equal(msg1Doc.reactions.length, 0, 'un second toggle du même emoji par le même utilisateur doit retirer la réaction en base');

      // deleteMessage — supprime le DERNIER message (msg2) : l'aperçu doit retomber sur msg1 (le nouveau dernier réel).
      const { status: delStatus1 } = await call(msgC.deleteMessage, { user: u4, params: { msgId: msg2Id } });
      assert.equal(delStatus1, 200);
      assert.equal(await Message.findById(msg2Id), null, 'le message supprimé ne doit plus exister en base');
      conv2 = await Conversation.findById(conv._id).lean();
      assert.equal(conv2.dernier_message_apercu, 'E5-PREMIER', 'après suppression du dernier message, l\'aperçu doit être recalculé sur le nouveau dernier message réel restant');

      // Supprime aussi msg1 (le seul restant) : plus aucun message → aperçu vidé (branche `last === null`).
      const { status: delStatus2 } = await call(msgC.deleteMessage, { user: u3, params: { msgId: msg1Id } });
      assert.equal(delStatus2, 200);
      conv2 = await Conversation.findById(conv._id).lean();
      assert.equal(conv2.dernier_message_apercu, '', 'quand plus aucun message ne reste dans la conversation, l\'aperçu doit être vidé, jamais laissé stale sur un message supprimé');
    });

    // ── 4. Badges non-lus (dashboard, portail) + computeAvgResponseTimeMin — jeu de données connu ──
    await t.test('badges non-lus (dashboard réceptionniste, portail patient) et temps de réponse moyen — valeurs exactes sur jeu de données connu', async () => {
      // -- Réceptionniste : membre de 2 conversations, une avec un message non lu (par elle), une entièrement lue.
      const receptionniste = await User.create({ email: `_e5-recept-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'R', prenom: 'Recept', role: 'receptionniste', statut: 'actif' });
      created.users.push(receptionniste);

      const convNonLue = await Conversation.create({ type: 'direct', membres: [u1._id, receptionniste._id] });
      const convLue = await Conversation.create({ type: 'direct', membres: [u2._id, receptionniste._id] });
      created.conversations.push(convNonLue, convLue);

      await Message.create({ conversation_id: convNonLue._id, expediteur: u1._id, contenu: 'E5-RECEPT-NONLU', lu_par: [u1._id] });
      await Message.create({ conversation_id: convLue._id, expediteur: u2._id, contenu: 'E5-RECEPT-LU', lu_par: [u2._id, receptionniste._id] });

      const { body: receptBody } = await call(dashboardC.receptionnisteStats, { user: receptionniste, query: {} });
      assert.equal(receptBody.stats.kpis.messages, 1, 'exactement 1 conversation sur les 2 doit compter comme non lue pour la réceptionniste (jeu de données connu)');

      // -- Portail patient : User role=patient lié à un vrai dossier Patient, 1 conversation avec 1 message non lu.
      const patientDoc = await Patient.create({ nom: `T-E5-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F', email: `_e5-patient-${stamp}@_test.local` });
      created.patients.push(patientDoc);
      const patientUser = await User.create({ email: `_e5-patient-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'P', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientDoc._id });
      created.users.push(patientUser);

      const convPatient = await Conversation.create({ type: 'direct', membres: [u1._id, patientUser._id] });
      created.conversations.push(convPatient);
      await Message.create({ conversation_id: convPatient._id, expediteur: u1._id, contenu: 'E5-PATIENT-NONLU', lu_par: [u1._id] });

      const { status: portalStatus, body: portalBody } = await call(portalC.getDashboard, { user: patientUser, query: {} });
      assert.equal(portalStatus, 200);
      assert.equal(portalBody.stats.kpis.messages_non_lus, 1, 'le portail patient doit compter exactement 1 conversation non lue (jeu de données connu)');

      // -- computeAvgResponseTimeMin, via groupMessagesByConversation sur de vrais documents Message (câblage réel, pas un mock à la main).
      const convAvg = await Conversation.create({ type: 'direct', membres: [u1._id, u2._id] });
      created.conversations.push(convAvg);
      const debut = new Date('2031-01-01T00:00:00Z'), fin = new Date('2031-01-02T00:00:00Z');
      await Message.insertMany([
        { conversation_id: convAvg._id, expediteur: u1._id, contenu: 'r1', date_envoi: new Date('2031-01-01T10:00:00Z') },
        { conversation_id: convAvg._id, expediteur: u2._id, contenu: 'r2', date_envoi: new Date('2031-01-01T10:05:00Z') }, // +5 min, expéditeur différent -> 1 échantillon réel
        { conversation_id: convAvg._id, expediteur: u2._id, contenu: 'r3', date_envoi: new Date('2031-01-01T10:07:00Z') }, // même expéditeur consécutif -> jamais un échantillon
      ]);
      const realMessages = await Message.find({ conversation_id: convAvg._id }).lean();
      const avg = computeAvgResponseTimeMin(groupMessagesByConversation(realMessages), debut, fin);
      assert.equal(avg, 5, 'un seul vrai changement d\'expéditeur (delta de 5 min) doit produire une moyenne exacte de 5, calculée sur de vrais documents Message regroupés par conversation');
    });
  } finally {
    for (const c of created.conversations) await Message.deleteMany({ conversation_id: c._id });
    for (const c of created.conversations) await Conversation.findByIdAndDelete(c._id);
    // AUDIT-ELEVE-5 — les Users doivent être supprimés AVANT les Patients :
    // models/Patient.js::pre('findOneAndDelete') refuse (409) la suppression
    // d'un dossier Patient tant qu'un compte portail actif le référence
    // encore par patient_id (règle métier réelle, cf. patientUser créé
    // ci-dessus) — sinon Patient.findByIdAndDelete rejette, ce qui saute le
    // mongoose.disconnect() suivant et laisse le process bloqué indéfiniment
    // sur la socket TLS encore ouverte (constaté en diagnostic direct).
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
