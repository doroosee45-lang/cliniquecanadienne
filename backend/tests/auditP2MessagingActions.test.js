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
  const Message = require('../models/Message');
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
      cleanup.push(() => Message.deleteMany({ conversation_id: groupId }));

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
      const { body } = await call(msgC.getMessages, { user: createur, params: { id: groupId }, query: {} });
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

      const reluMsg = await Message.findById(msgId).lean();
      assert.equal(reluMsg.reactions.length, 1, 'la réaction doit être réellement persistée (relecture base fraîche)');
      assert.equal(reluMsg.reactions[0].emoji, '👍');
      assert.equal(reluMsg.reactions[0].utilisateur.toString(), membre1._id.toString());
    });

    await t.test('toggleReaction — même emoji par le même utilisateur = toggle (retrait), pas de doublon', async () => {
      const { status, body } = await call(msgC.toggleReaction, { user: membre1, params: { msgId }, body: { emoji: '👍' } });
      assert.equal(status, 200);
      assert.equal(body.action, 'retiree');
      assert.equal(body.reactions.length, 0);

      const reluMsg = await Message.findById(msgId).lean();
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

      const reluMsg = await Message.findById(toDeleteId).lean();
      assert.equal(reluMsg, null, 'le message doit être absent après relecture depuis MongoDB');
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

      const reluMsg = await Message.findById(protectedId).lean();
      assert.ok(reluMsg, 'le message ne doit pas avoir été supprimé par un non-auteur');
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

// AUDIT-MESSAGES-PhaseD — sendPatientSms : sms.sendSms est stubbée pour la
// durée du test (même pattern que appointmentReminders.test.js avec
// utils/mail.js) — TWILIO_* est réellement configuré dans le .env de dev,
// donc sans ce stub la suite automatisée enverrait un vrai SMS à chaque
// exécution. La vérification d'un envoi Twilio réel se fait séparément
// (hors suite automatisée), avec preuve manuelle.
test('messages.controller — sendPatientSms (base réelle, Twilio stubbé)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const smsModule = require('../utils/sms');

  const stamp = Date.now();
  const originalSendSms = smsModule.sendSms;
  const agent = await User.create({ email: `_sms-agent-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'Sms', role: 'infirmier', statut: 'actif' });
  const patientAvecTel = await Patient.create({ nom: `Sms${stamp}`, prenom: 'AvecTel', date_naissance: '1990-01-01', sexe: 'F', telephone: '+242060000000' });
  const patientSansTel = await Patient.create({ nom: `Sms${stamp}`, prenom: 'SansTel', date_naissance: '1990-01-01', sexe: 'M' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('patient avec téléphone, envoi réussi (stub) — 200, tracé succès dans AuditLog, sans le contenu du secret Twilio', async () => {
      smsModule.sendSms = async ({ to }) => { assert.equal(to, '+242060000000'); return { simulated: true }; };
      const { status, body } = await call(msgC.sendPatientSms, { user: agent, body: { patient: patientAvecTel._id.toString(), contenu: `Test ${stamp}` }, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.success, true);

      const entry = await AuditLog.findOne({ module: 'messages', action: 'SEND_SMS', entite_id: patientAvecTel._id.toString() }).sort('-createdAt').lean();
      assert.ok(entry, "l'envoi doit être tracé dans AuditLog");
      assert.equal(entry.statut, 'succes');
      assert.ok(!JSON.stringify(entry).includes(process.env.TWILIO_AUTH_TOKEN || '§never§'), 'le AuditLog ne doit jamais contenir le token Twilio');
    });

    await t.test('échec Twilio (stub qui rejette) — vraie erreur renvoyée, pas un faux succès, tracé en échec', async () => {
      smsModule.sendSms = async () => { throw new Error("Numéro de destination invalide (simulation d'échec Twilio réel)"); };
      const { status, body } = await call(msgC.sendPatientSms, { user: agent, body: { patient: patientAvecTel._id.toString(), contenu: `Test échec ${stamp}` }, ip: '127.0.0.1' });
      assert.equal(status, 502);
      assert.equal(body.success, false);
      assert.match(body.message, /invalide/);

      const entry = await AuditLog.findOne({ module: 'messages', action: 'SEND_SMS', entite_id: patientAvecTel._id.toString(), statut: 'echec' }).sort('-createdAt').lean();
      assert.ok(entry, "l'échec doit aussi être tracé dans AuditLog");
    });

    await t.test('patient sans téléphone — 400, aucun envoi tenté', async () => {
      let called = false;
      smsModule.sendSms = async () => { called = true; return { simulated: true }; };
      const { status, body } = await call(msgC.sendPatientSms, { user: agent, body: { patient: patientSansTel._id.toString(), contenu: `Test ${stamp}` }, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);
      assert.equal(called, false, 'sendSms ne doit jamais être appelée si le patient n\'a pas de téléphone');
    });

    await t.test('patient introuvable — 404', async () => {
      const { status } = await call(msgC.sendPatientSms, { user: agent, body: { patient: new mongoose.Types.ObjectId().toString(), contenu: 'x' }, ip: '127.0.0.1' });
      assert.equal(status, 404);
    });

    await t.test('message vide — 400', async () => {
      const { status } = await call(msgC.sendPatientSms, { user: agent, body: { patient: patientAvecTel._id.toString(), contenu: '  ' }, ip: '127.0.0.1' });
      assert.equal(status, 400);
    });
  } finally {
    smsModule.sendSms = originalSendSms;
    await User.findByIdAndDelete(agent._id);
    await Patient.findByIdAndDelete(patientAvecTel._id);
    await Patient.findByIdAndDelete(patientSansTel._id);
    await AuditLog.deleteMany({ module: 'messages', action: 'SEND_SMS', entite_id: { $in: [patientAvecTel._id.toString(), patientSansTel._id.toString()] } });
    await mongoose.disconnect();
  }
});

// AUDIT-MESSAGES-PhaseD — sendPatientEmail : mail.sendEmail stubbée pour la
// même raison que sms.sendSms ci-dessus — SMTP est réellement configuré
// dans le .env de dev, sans stub la suite enverrait un vrai email.
test('messages.controller — sendPatientEmail (base réelle, SMTP stubbé)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  const originalSendEmail = mailModule.sendEmail;
  const agent = await User.create({ email: `_email-agent-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'Email', role: 'medecin', statut: 'actif' });
  const patientAvecEmail = await Patient.create({ nom: `Email${stamp}`, prenom: 'AvecEmail', date_naissance: '1990-01-01', sexe: 'F', email: `_pat-${stamp}@_test.local` });
  const patientSansEmail = await Patient.create({ nom: `Email${stamp}`, prenom: 'SansEmail', date_naissance: '1990-01-01', sexe: 'M' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('patient avec email, envoi réussi (stub) — 200, tracé succès dans AuditLog', async () => {
      mailModule.sendEmail = async ({ to }) => { assert.equal(to, `_pat-${stamp}@_test.local`); return { simulated: true }; };
      const { status, body } = await call(msgC.sendPatientEmail, { user: agent, body: { patient: patientAvecEmail._id.toString(), sujet: 'Sujet test', contenu: `Test ${stamp}` }, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.success, true);
      const entry = await AuditLog.findOne({ module: 'messages', action: 'SEND_EMAIL', entite_id: patientAvecEmail._id.toString() }).sort('-createdAt').lean();
      assert.ok(entry);
      assert.equal(entry.statut, 'succes');
    });

    await t.test('échec SMTP (stub qui rejette) — vraie erreur renvoyée, tracée en échec', async () => {
      mailModule.sendEmail = async () => { throw new Error('Relais SMTP indisponible (simulation)'); };
      const { status, body } = await call(msgC.sendPatientEmail, { user: agent, body: { patient: patientAvecEmail._id.toString(), sujet: 'x', contenu: 'y' }, ip: '127.0.0.1' });
      assert.equal(status, 502);
      assert.equal(body.success, false);
      const entry = await AuditLog.findOne({ module: 'messages', action: 'SEND_EMAIL', entite_id: patientAvecEmail._id.toString(), statut: 'echec' }).sort('-createdAt').lean();
      assert.ok(entry);
    });

    await t.test('patient sans email — 400, aucun envoi tenté', async () => {
      let called = false;
      mailModule.sendEmail = async () => { called = true; return { simulated: true }; };
      const { status } = await call(msgC.sendPatientEmail, { user: agent, body: { patient: patientSansEmail._id.toString(), sujet: 'x', contenu: 'y' }, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(called, false);
    });

    await t.test('sujet ou message manquant — 400', async () => {
      const { status } = await call(msgC.sendPatientEmail, { user: agent, body: { patient: patientAvecEmail._id.toString(), sujet: '', contenu: 'y' }, ip: '127.0.0.1' });
      assert.equal(status, 400);
    });
  } finally {
    mailModule.sendEmail = originalSendEmail;
    await User.findByIdAndDelete(agent._id);
    await Patient.findByIdAndDelete(patientAvecEmail._id);
    await Patient.findByIdAndDelete(patientSansEmail._id);
    await AuditLog.deleteMany({ module: 'messages', action: 'SEND_EMAIL', entite_id: { $in: [patientAvecEmail._id.toString(), patientSansEmail._id.toString()] } });
    await mongoose.disconnect();
  }
});

// AUDIT-MESSAGES-PhaseD — getHistorique : vérifie que les KPIs/répartition
// par service/journal sont calculés depuis de vraies données (pas fabriqués),
// scopés aux conversations dont l'utilisateur est membre.
test('messages.controller — getHistorique (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const User = require('../models/User');
  const Service = require('../models/Service');

  const stamp = Date.now();
  // AUDIT-M-A1 — User.service est désormais une référence (plus une chaîne
  // libre) : services réels créés ici, ni medecin ni infirmier n'ont de
  // fiche Staff liée dans ce test, donc User.service est bien la valeur
  // effectivement résolue (repli attendu en l'absence de liaison Staff).
  const svcMedecine = await Service.create({ nom: `Médecine générale ${stamp}` });
  const svcInfirmier = await Service.create({ nom: `Soins infirmiers ${stamp}` });
  const medecin = await User.create({ email: `_hist-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'Hist', role: 'medecin', statut: 'actif', service: svcMedecine._id });
  const infirmier = await User.create({ email: `_hist-inf-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Inf', prenom: 'Hist', role: 'infirmier', statut: 'actif', service: svcInfirmier._id });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  let convId;
  try {
    // AUDIT-ELEVE-5 — messages créés dans la collection Message dédiée
    // (plus Conversation.messages, migré).
    const conv = await Conversation.create({ type: 'direct', membres: [medecin._id, infirmier._id] });
    convId = conv._id;
    await Message.create([
      { conversation_id: convId, expediteur: medecin._id, contenu: `Envoyé par moi ${stamp}`, lu_par: [medecin._id] },
      { conversation_id: convId, expediteur: infirmier._id, contenu: `Reçu ${stamp} 1`, lu_par: [infirmier._id] },
      { conversation_id: convId, expediteur: infirmier._id, contenu: `Reçu ${stamp} 2`, lu_par: [infirmier._id] },
    ]);

    await t.test('KPIs réels : envoyés/reçus corrects, scopés à mes conversations', async () => {
      const { status, body } = await call(msgC.getHistorique, { user: medecin });
      assert.equal(status, 200);
      assert.equal(body.kpis.messages_envoyes, 1);
      assert.equal(body.kpis.messages_recus, 2);
      assert.ok(body.kpis.conversations_actives >= 1);
    });

    await t.test('répartition par service réelle : les 2 messages reçus sont attribués au service infirmier', async () => {
      const { body } = await call(msgC.getHistorique, { user: medecin });
      const infService = body.par_service.find(s => s.service === svcInfirmier.nom);
      assert.ok(infService, 'le service de l\'expéditeur réel doit apparaître');
      assert.equal(infService.count, 2);
    });

    await t.test('un utilisateur extérieur à la conversation ne voit pas ces messages dans ses propres totaux', async () => {
      const exterieur = await User.create({ email: `_hist-ext-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Ext', prenom: 'Hist', role: 'medecin', statut: 'actif' });
      try {
        const { body } = await call(msgC.getHistorique, { user: exterieur });
        assert.equal(body.kpis.messages_envoyes, 0);
        assert.equal(body.kpis.messages_recus, 0);
      } finally {
        await User.findByIdAndDelete(exterieur._id);
      }
    });

    // AUDIT-MESSAGES-PhaseD (correctif) — le journal était org-wide dans un
    // endpoint protect seul (fenêtre de visibilité équivalente à /audit sans
    // son authorize('superadmin')). Doit désormais être scopé comme les
    // KPIs : mes conversations pour CREATE/DELETE, mes propres envois pour
    // SEND_SMS/SEND_EMAIL.
    await t.test("journal — un membre de la conversation voit l'action CREATE tracée dessus", async () => {
      const { logAction } = require('../utils/helpers');
      await logAction({ utilisateur: infirmier._id, action: 'CREATE', module: 'messages', entite_id: convId, message: `Conversation créée ${stamp}` });
      const { body } = await call(msgC.getHistorique, { user: medecin });
      assert.ok(body.journal.some(j => j.detail === `Conversation créée ${stamp}`), 'un membre de la conversation doit voir cette action dans son journal');
    });

    await t.test("journal — un utilisateur extérieur à la conversation ne voit PAS cette action", async () => {
      const exterieur = await User.create({ email: `_hist-ext2-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Ext2', prenom: 'Hist', role: 'medecin', statut: 'actif' });
      try {
        const { body } = await call(msgC.getHistorique, { user: exterieur });
        assert.ok(!body.journal.some(j => j.detail === `Conversation créée ${stamp}`), "une action sur une conversation où l'utilisateur n'est pas membre ne doit jamais apparaître dans son journal");
      } finally {
        await User.findByIdAndDelete(exterieur._id);
      }
    });

    await t.test("journal — un envoi SMS/Email n'apparaît que dans le journal de l'expéditeur, jamais chez un autre membre du personnel", async () => {
      const { logAction } = require('../utils/helpers');
      const Patient = require('../models/Patient');
      const patient = await Patient.create({ nom: `HistSms${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
      try {
        await logAction({ utilisateur: infirmier._id, action: 'SEND_SMS', module: 'messages', entite_id: patient._id, message: `SMS test ${stamp}` });
        const { body: bodyExpediteur } = await call(msgC.getHistorique, { user: infirmier });
        assert.ok(bodyExpediteur.journal.some(j => j.detail === `SMS test ${stamp}`), "l'expéditeur doit voir son propre envoi");

        const { body: bodyAutre } = await call(msgC.getHistorique, { user: medecin });
        assert.ok(!bodyAutre.journal.some(j => j.detail === `SMS test ${stamp}`), "un autre membre du personnel (même conversation ou non) ne doit jamais voir l'envoi SMS/Email d'un collègue à un patient");
      } finally {
        await Patient.findByIdAndDelete(patient._id);
        const AuditLog = require('../models/AuditLog');
        await AuditLog.deleteMany({ message: `SMS test ${stamp}` });
      }
    });
  } finally {
    if (convId) await Message.deleteMany({ conversation_id: convId });
    if (convId) await Conversation.findByIdAndDelete(convId);
    await User.findByIdAndDelete(medecin._id);
    await User.findByIdAndDelete(infirmier._id);
    await Service.findByIdAndDelete(svcMedecine._id);
    await Service.findByIdAndDelete(svcInfirmier._id);
    const AuditLog = require('../models/AuditLog');
    await AuditLog.deleteMany({ message: `Conversation créée ${stamp}` });
    await mongoose.disconnect();
  }
});
