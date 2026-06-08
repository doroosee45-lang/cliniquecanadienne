const nodemailer = require('nodemailer');

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn(`[MAIL] SMTP non configuré — email simulé → ${to}`);
    console.log(`[MAIL] Sujet : ${subject}`);
    return { simulated: true };
  }
  const info = await getTransporter().sendMail({
    from: process.env.SMTP_FROM || '"Clinique Canadienne" <noreply@clinique.cg>',
    to,
    subject,
    html,
  });
  return info;
};

const sendActivationEmail = async ({ email, prenom, nom, token, motDePasse }) => {
  const lien = `${process.env.CLIENT_URL}/activate/${token}`;
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <h2 style="color:#0B1E3B;font-size:18px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre dossier patient <strong>(${nom} ${prenom})</strong> a été créé avec succès dans notre système.
        Pour accéder au portail patient et consulter votre dossier, activez votre compte en cliquant ci-dessous.
      </p>
      <div style="background:#EEF4FF;border-radius:10px;padding:18px;margin:22px 0;border-left:4px solid #1B4F9E;">
        <div style="font-size:12px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
          Vos identifiants temporaires
        </div>
        <div style="font-size:15px;color:#0B1E3B;font-weight:700;font-family:monospace;letter-spacing:1px;">
          Mot de passe : ${motDePasse}
        </div>
        <div style="color:#6B7A99;font-size:11px;margin-top:6px;">
          ⚠ Vous devrez changer ce mot de passe lors de votre première connexion.
        </div>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${lien}"
          style="display:inline-block;background:#0EA5A0;color:#fff;text-decoration:none;
                 padding:15px 36px;border-radius:10px;font-weight:700;font-size:15px;
                 letter-spacing:.3px;">
          ✅ Activer mon compte
        </a>
      </div>
      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-bottom:0;">
        Ce lien expire dans <strong>24 heures</strong>.<br/>
        Si vous n'êtes pas à l'origine de ce message, ignorez cet email.
      </p>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: 'Activation de votre compte patient — Clinique Canadienne',
    html,
  });
};

const sendPasswordResetEmail = async ({ email, prenom, nom, token }) => {
  const lien = `${process.env.CLIENT_URL}/reset-password/${token}`;
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <h2 style="color:#0B1E3B;font-size:18px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Vous avez demandé la réinitialisation de votre mot de passe.
        Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${lien}"
          style="display:inline-block;background:#1B4F9E;color:#fff;text-decoration:none;
                 padding:15px 36px;border-radius:10px;font-weight:700;font-size:15px;">
          🔑 Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-bottom:0;">
        Ce lien expire dans <strong>1 heure</strong>.<br/>
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      </p>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe — Clinique Canadienne',
    html,
  });
};

/**
 * Envoie l'ordonnance au patient par email.
 * @param {{ email, prenom, nom, numero_rx, date, medecin, lignes, diagnostic, lienPortail }} opts
 */
const sendPrescriptionEmail = async ({ email, prenom, nom, numero_rx, date, medecin, lignes = [], diagnostic, lienPortail }) => {
  const lignesHtml = lignes.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:13px;color:#0B1E3B;font-weight:600;">${l.medicament_nom || l.medicament || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:12px;color:#6B7A99;">${l.posologie || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:12px;color:#6B7A99;">${l.duree || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:12px;color:#059669;font-weight:600;">${l.quantite ? `${l.quantite} unité(s)` : '—'}</td>
    </tr>
  `).join('');

  const html = `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">MediSync HIS · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#EFF6FF;border-left:4px solid #1B4F9E;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
        <div style="font-size:11px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Ordonnance médicale</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">${numero_rx}</div>
        <div style="font-size:12px;color:#6B7A99;margin-top:4px;">Émise le ${new Date(date).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>

      <h2 style="color:#0B1E3B;font-size:16px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre médecin <strong>${medecin}</strong> a émis et publié une ordonnance médicale vous concernant.
        ${diagnostic ? `<br/>Diagnostic : <strong>${diagnostic}</strong>` : ''}
      </p>

      <div style="margin:20px 0;">
        <div style="font-size:12px;font-weight:700;color:#0B1E3B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Médicaments prescrits</div>
        <table style="width:100%;border-collapse:collapse;background:#F8FAFD;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#EEF4FF;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7A99;font-weight:700;">Médicament</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7A99;font-weight:700;">Posologie</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7A99;font-weight:700;">Durée</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7A99;font-weight:700;">Quantité</th>
            </tr>
          </thead>
          <tbody>${lignesHtml}</tbody>
        </table>
      </div>

      ${lienPortail ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${lienPortail}"
          style="display:inline-block;background:#0EA5A0;color:#fff;text-decoration:none;
                 padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;">
          📋 Voir mon ordonnance sur le portail
        </a>
      </div>
      <p style="color:#9CA3AF;font-size:12px;text-align:center;">
        Connectez-vous au portail patient pour consulter et télécharger votre ordonnance complète.
      </p>` : ''}

      <div style="background:#ECFDF5;border-radius:8px;padding:12px 16px;margin-top:16px;">
        <p style="color:#065F46;font-size:12px;margin:0;">
          ⚠️ Présentez cette ordonnance à votre pharmacien. Valable 30 jours à compter de la date d'émission.
        </p>
      </div>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Votre ordonnance ${numero_rx} — Clinique Canadienne`,
    html,
  });
};

module.exports = { sendEmail, sendActivationEmail, sendPasswordResetEmail, sendPrescriptionEmail };
