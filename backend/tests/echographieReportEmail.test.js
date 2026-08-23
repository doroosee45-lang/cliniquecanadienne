// AUDIT-ECHOGRAPHIE-EMAIL — le bouton "Envoyer par email" du module
// Échographie était honnêtement désactivé (aucune route backend). Branché
// sur le pattern d'envoi email patient réel déjà construit en Phase D du
// module Messages (POST /messages/patient-email, utils/mail.js::sendEmail),
// sans pièce jointe (mail.js n'en supporte pour aucun module).
//
// AUDIT-11-7 — le compte-rendu (rapport_texte/conclusion/recommandations)
// était initialement mis en forme en HTML côté FRONTEND
// (buildRapportEmailHtml) et transmis tel quel comme `contenu`. En corrigeant
// l'échappement HTML de sendPatientEmail (échapper tout `contenu`, texte
// libre saisi par le personnel), ce chemin se serait cassé — <br>/<strong>
// auraient été échappés en texte littéral au lieu de mettre en forme le
// compte-rendu. Corrigé en déplaçant la construction du HTML côté BACKEND
// (messages.controller.js::buildRapportHtml) : le frontend envoie désormais
// les champs bruts (`rapport`), chacun échappé individuellement avant
// d'être inséré dans une mise en forme de confiance construite côté serveur
// — jamais de HTML pré-construit côté client accepté tel quel (rapport_texte
// etc. restent du texte libre : un compte échographiste compromis pourrait y
// injecter du HTML actif tout comme dans un message classique).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('messages.controller.sendPatientEmail — compte-rendu échographie (base réelle, SMTP stubbé)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  const originalSendEmail = mailModule.sendEmail;
  const echographiste = await User.create({ email: `_echo-md-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Radiologue', prenom: 'Echo', role: 'radiologue', statut: 'actif' });
  const patient = await Patient.create({ nom: `EchoMail${stamp}`, prenom: 'Patiente', date_naissance: '1992-03-10', sexe: 'F', email: `_echo-pat-${stamp}@_test.local` });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test("l'échographiste envoie le compte-rendu à la patiente réelle — 200, mise en forme préservée, tracé dans AuditLog", async () => {
      let received = null;
      mailModule.sendEmail = async ({ to, subject, html }) => { received = { to, subject, html }; return { simulated: true }; };

      const rapport = {
        type: 'Obstétricale', sous_type: 'Morphologique T2',
        rapport_texte: "Foie :\n- Taille / Dimensions : normale\n- Aspect général : homogène\n- Anomalies : RAS",
        conclusion: 'Examen morphologique sans anomalie détectée.',
        recommandations: 'Contrôle échographique dans 4 semaines.',
      };
      const { status, body } = await call(msgC.sendPatientEmail, {
        user: echographiste, ip: '127.0.0.1',
        body: { patient: patient._id.toString(), sujet: `Compte-rendu d'échographie — Obstétricale (Morphologique T2) — ECH-2026-0042`, rapport },
      });

      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.equal(received.to, patient.email, "l'email doit partir vers l'adresse réelle de la patiente, pas une adresse devinée");
      assert.equal(received.subject, `Compte-rendu d'échographie — Obstétricale (Morphologique T2) — ECH-2026-0042`);
      assert.match(received.html, /<strong>Type d'examen :<\/strong> Obstétricale — Morphologique T2/, 'la mise en forme de confiance (gras) doit être réellement construite côté serveur');
      assert.match(received.html, /Foie :<br>- Taille \/ Dimensions : normale/, 'les sauts de ligne organe par organe doivent être préservés (\\n → <br>, pas collapsés)');
      assert.match(received.html, /<strong>Conclusion :<\/strong><br>Examen morphologique sans anomalie détectée\./);
      assert.match(received.html, /<strong>Recommandations :<\/strong><br>Contrôle échographique dans 4 semaines\./);

      const entry = await AuditLog.findOne({ module: 'messages', action: 'SEND_EMAIL', entite_id: patient._id.toString() }).sort('-createdAt').lean();
      assert.ok(entry, "l'envoi doit être tracé dans AuditLog");
      assert.equal(entry.statut, 'succes');

      mailModule.sendEmail = originalSendEmail;
    });

    await t.test('AUDIT-11-7 — un rapport_texte contenant du HTML actif (compte échographiste compromis) est échappé, jamais transmis actif', async () => {
      let received = null;
      mailModule.sendEmail = async ({ to, subject, html }) => { received = { to, subject, html }; return { simulated: true }; };

      const rapport = {
        type: 'Obstétricale',
        rapport_texte: '<script>alert(document.cookie)</script>',
        conclusion: '<a href="http://phishing.evil/rapport">Voir le rapport complet</a>',
      };
      const { status } = await call(msgC.sendPatientEmail, {
        user: echographiste, ip: '127.0.0.1',
        body: { patient: patient._id.toString(), sujet: 'Compte-rendu — test échappement', rapport },
      });
      assert.equal(status, 200);
      assert.ok(!received.html.includes('<script>alert(document.cookie)</script>'), 'rapport_texte ne doit plus contenir de balise <script> active');
      assert.ok(!received.html.includes('<a href="http://phishing.evil/rapport">'), 'conclusion ne doit plus contenir de lien actif arbitraire');
      assert.ok(received.html.includes('&lt;script&gt;'), 'rapport_texte doit apparaître littéralement échappé');
      // La mise en forme de confiance construite côté serveur reste active.
      assert.ok(received.html.includes("<strong>Type d'examen :</strong>"), 'la mise en forme de confiance (gras) construite côté serveur ne doit jamais être échappée elle-même');

      mailModule.sendEmail = originalSendEmail;
    });
  } finally {
    mailModule.sendEmail = originalSendEmail;
    await User.findByIdAndDelete(echographiste._id);
    await Patient.findByIdAndDelete(patient._id);
    await AuditLog.deleteMany({ module: 'messages', action: 'SEND_EMAIL', entite_id: patient._id.toString() });
    await mongoose.disconnect();
  }
});
