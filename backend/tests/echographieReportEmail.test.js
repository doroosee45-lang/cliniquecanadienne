// AUDIT-ECHOGRAPHIE-EMAIL — le bouton "Envoyer par email" du module
// Échographie était honnêtement désactivé (aucune route backend). Branché
// sur le pattern d'envoi email patient réel déjà construit en Phase D du
// module Messages (POST /messages/patient-email, utils/mail.js::sendEmail),
// sans pièce jointe (mail.js n'en supporte pour aucun module) : le
// compte-rendu (rapport_texte/conclusion/recommandations, déjà persistés
// via saveRapport) est mis en forme en HTML côté frontend
// (buildRapportEmailHtml) et envoyé comme corps de l'email. Ce test vérifie
// que le backend accepte et transmet réellement ce contenu, base réelle,
// avec mail.sendEmail stubbée (même raison que les autres tests
// sendPatientEmail : SMTP réellement configuré en dev, sans stub la suite
// enverrait un vrai email à chaque exécution).
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

  // Contenu HTML exact que buildRapportEmailHtml() (Echographie.jsx) construit
  // à partir de rapport_texte/conclusion/recommandations.
  const contenu = "<strong>Type d'examen :</strong> Obstétricale — Morphologique T2<br><br>Foie :<br>- Taille / Dimensions : normale<br>- Aspect général : homogène<br>- Anomalies : RAS<br><br><strong>Conclusion :</strong><br>Examen morphologique sans anomalie détectée.<br><br><strong>Recommandations :</strong><br>Contrôle échographique dans 4 semaines.";

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test("l'échographiste envoie le compte-rendu à la patiente réelle — 200, HTML transmis intact, tracé dans AuditLog", async () => {
      let received = null;
      mailModule.sendEmail = async ({ to, subject, html }) => { received = { to, subject, html }; return { simulated: true }; };

      const { status, body } = await call(msgC.sendPatientEmail, {
        user: echographiste, ip: '127.0.0.1',
        body: { patient: patient._id.toString(), sujet: `Compte-rendu d'échographie — Obstétricale (Morphologique T2) — ECH-2026-0042`, contenu },
      });

      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.equal(received.to, patient.email, "l'email doit partir vers l'adresse réelle de la patiente, pas une adresse devinée");
      assert.equal(received.subject, `Compte-rendu d'échographie — Obstétricale (Morphologique T2) — ECH-2026-0042`);
      assert.ok(received.html.includes(contenu), 'le HTML du compte-rendu doit être transmis intact à sendEmail, pas altéré');
      assert.match(received.html, /Foie :<br>- Taille/, 'les sauts de ligne organe par organe doivent être préservés (<br>, pas collapsés)');

      const entry = await AuditLog.findOne({ module: 'messages', action: 'SEND_EMAIL', entite_id: patient._id.toString() }).sort('-createdAt').lean();
      assert.ok(entry, "l'envoi doit être tracé dans AuditLog");
      assert.equal(entry.statut, 'succes');

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
