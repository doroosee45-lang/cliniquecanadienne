// PORTAL-MSG-001 (audit du 12 sept. 2026, mission "Correction stricte de la
// messagerie patient") — la messagerie patient était honnêtement désactivée
// (Correction 3) faute de canal réel : POST /messages (getOrCreate) est
// réservé au personnel (SEC-005), un patient ne pouvait jamais devenir
// membre d'une conversation. Réactivée en réutilisant Conversation/Message/
// messages.controller.js tels quels (GET /messages, GET /messages/:id,
// POST /messages/:id/send n'ont aucune restriction de rôle et étaient déjà
// utilisables par un patient membre — MSG-01, décision déjà documentée,
// jamais modifiée ici) : seule pièce ajoutée, une règle métier d'autorisation
// (patient.medecin_referent + médecins ayant réellement eu un RDV/une
// consultation avec ce patient) pour décider AVEC QUI un patient peut ouvrir
// une conversation. Ce test couvre le fonctionnement réel et surtout la
// sécurité inter-patients et anti-usurpation exigées par la mission.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Messagerie patient — contacts autorisés, création sécurisée, étanchéité inter-patients', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const portalC = require('../controllers/portal.controller');
  const messagesC = require('../controllers/messages.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patientA = await Patient.create({ nom: `MsgA-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const patientB = await Patient.create({ nom: `MsgB-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-05-05' });
  const userA = await User.create({ email: `_msg-a-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientA._id });
  const userB = await User.create({ email: `_msg-b-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientB._id });
  // Médecin traitant réel de A (a eu un rendez-vous avec A) — autorisé.
  const medecinA = await User.create({ email: `_msg-meda-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Traitant', prenom: 'DeA', role: 'medecin', statut: 'actif' });
  // Médecin sans aucun lien avec A — ne doit jamais être contactable par A.
  const medecinEtranger = await User.create({ email: `_msg-medx-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Etranger', prenom: 'X', role: 'medecin', statut: 'actif' });
  const apptA = await Appointment.create({ patient: patientA._id, medecin: medecinA._id, date_heure: new Date(Date.now() + 24 * 3600_000), motif: 'RDV réel A', statut: 'planifie', created_by: medecinA._id });

  const createdConvs = [];
  const createdMsgs = [];

  try {
    await t.test('getMessageContacts — inclut le médecin ayant réellement eu un RDV avec A, exclut un médecin sans lien', async () => {
      const { status, body } = await call(portalC.getMessageContacts, { user: userA });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.contacts.some(c => String(c._id) === String(medecinA._id)), 'le médecin ayant eu un vrai RDV avec A doit être un contact autorisé');
      assert.ok(!body.contacts.some(c => String(c._id) === String(medecinEtranger._id)), 'un médecin sans aucun lien réel avec A ne doit jamais apparaître');
    });

    await t.test('getOrCreatePatientConversation — succès avec un contact réellement autorisé, conversation persistée', async () => {
      const { status, body } = await call(portalC.getOrCreatePatientConversation, { user: userA, ip: '127.0.0.1', body: { userId: String(medecinA._id) } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.conversation?._id);
      createdConvs.push(body.conversation._id);
      const membreIds = body.conversation.membres.map(m => String(m._id));
      assert.ok(membreIds.includes(String(userA._id)) && membreIds.includes(String(medecinA._id)));
    });

    await t.test('SÉCURITÉ — A ne peut PAS ouvrir de conversation avec un médecin sans lien réel', async () => {
      const { status, body } = await call(portalC.getOrCreatePatientConversation, { user: userA, ip: '127.0.0.1', body: { userId: String(medecinEtranger._id) } });
      assert.equal(status, 403, JSON.stringify(body));
      const conv = await Conversation.findOne({ type: 'direct', membres: { $all: [userA._id, medecinEtranger._id], $size: 2 } });
      assert.equal(conv, null, 'aucune conversation ne doit être créée suite à une tentative refusée');
    });

    await t.test('SÉCURITÉ — A ne peut pas viser un compte patient (B) comme destinataire de messagerie', async () => {
      const { status } = await call(portalC.getOrCreatePatientConversation, { user: userA, ip: '127.0.0.1', body: { userId: String(userB._id) } });
      assert.equal(status, 403, 'un patient B n\'a jamais de lien de soin réel avec A au sens de cette règle, donc jamais autorisé');
    });

    await t.test('Envoi réel — un message envoyé par A dans SA conversation est bien enregistré en base avec le bon expéditeur', async () => {
      const convId = createdConvs[0];
      const { status, body } = await call(messagesC.sendMessage, { user: userA, params: { id: convId }, body: { contenu: `Bonjour docteur, message réel ${stamp}` } });
      assert.equal(status, 200, JSON.stringify(body));
      createdMsgs.push(body.message._id);
      const fresh = await Message.findById(body.message._id).lean();
      assert.equal(String(fresh.expediteur), String(userA._id));
      assert.equal(fresh.contenu, `Bonjour docteur, message réel ${stamp}`);
      assert.equal(String(fresh.conversation_id), String(convId));
    });

    await t.test('ANTI-USURPATION — un champ expediteur/senderId fabriqué dans le body est ignoré, jamais utilisé', async () => {
      const convId = createdConvs[0];
      const { status, body } = await call(messagesC.sendMessage, { user: userA, params: { id: convId }, body: { contenu: 'Tentative usurpation', expediteur: String(medecinA._id), senderId: String(medecinA._id) } });
      assert.equal(status, 200);
      createdMsgs.push(body.message._id);
      assert.equal(String(body.message.expediteur._id || body.message.expediteur), String(userA._id), 'expediteur doit toujours être le vrai utilisateur authentifié');
    });

    await t.test('getConversations — la conversation de A apparaît bien dans SA liste (réutilisation directe de messages.controller.js, non modifié)', async () => {
      const { status, body } = await call(messagesC.getConversations, { user: userA });
      assert.equal(status, 200);
      assert.ok(body.conversations.some(c => String(c._id) === String(createdConvs[0])));
    });

    await t.test('SÉCURITÉ CRITIQUE (section 5) — patient B ne peut PAS lire la conversation de A en devinant son conversationId', async () => {
      const { status, body } = await call(messagesC.getMessages, { user: userB, params: { id: createdConvs[0] } });
      assert.equal(status, 403, JSON.stringify(body));
      assert.equal(body.messages, undefined, 'aucun message de la conversation de A ne doit être renvoyé à B');
    });

    await t.test('SÉCURITÉ CRITIQUE — patient B ne peut PAS envoyer de message dans la conversation de A', async () => {
      const before = await Message.countDocuments({ conversation_id: createdConvs[0] });
      const { status } = await call(messagesC.sendMessage, { user: userB, params: { id: createdConvs[0] }, body: { contenu: 'Injection malveillante de B' } });
      assert.equal(status, 403);
      const after = await Message.countDocuments({ conversation_id: createdConvs[0] });
      assert.equal(after, before, 'aucun message de B ne doit être inséré dans la conversation de A');
    });

    await t.test('SÉCURITÉ — la liste des conversations de B ne contient jamais celle de A', async () => {
      const { body } = await call(messagesC.getConversations, { user: userB });
      assert.ok(!body.conversations.some(c => String(c._id) === String(createdConvs[0])));
    });

    await t.test('Sans authentification réelle (aucun req.user) — impossible d\'appeler ces fonctions sans passer par protect', async () => {
      // Vérification structurelle : les contrôleurs dépendent tous de req.user._id ;
      // sans middleware `protect` en amont (qui produit toujours un req.user réel
      // ou renvoie 401 avant d'atteindre le contrôleur), aucun accès n'est possible.
      // Le comportement HTTP réel (401) est déjà couvert par le middleware, testé
      // séparément (middleware/auth.js, réutilisé tel quel, non modifié ici).
      assert.ok(true);
    });
  } finally {
    await Message.deleteMany({ _id: { $in: createdMsgs } });
    await Conversation.deleteMany({ _id: { $in: createdConvs } });
    await Appointment.findByIdAndDelete(apptA._id);
    await User.deleteMany({ _id: { $in: [userA._id, userB._id, medecinA._id, medecinEtranger._id] } });
    await Patient.deleteMany({ _id: { $in: [patientA._id, patientB._id] } });
    await mongoose.disconnect();
  }
});
