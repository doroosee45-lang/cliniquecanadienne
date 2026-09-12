const nodemailer = require('nodemailer');
const { logger } = require('./logger');
const env = require('../config/env');
const { escapeHtml } = require('./helpers');

// NEW-001 (rapport de correction du 11 sept. 2026) — Settings.jsx persiste
// réellement 4 paramètres SMTP applicatifs (notif_smtp_host/port/user/pwd,
// via POST /settings, Setting générique) mais ce module ne lisait jusqu'ici
// que des variables d'environnement serveur : la configuration saisie dans
// l'UI n'avait jamais d'effet réel sur l'envoi. Source de vérité désormais
// claire, une seule architecture (pas de second système SMTP parallèle) :
// getSmtpConfig() lit d'abord les 4 Setting applicatifs, et ne les utilise
// QUE si les trois champs requis (host/user/pass) sont tous les trois
// présents — jamais une configuration partielle utilisée à moitié. Sinon,
// repli intégral sur les variables d'environnement historiques (comportement
// strictement inchangé pour toute installation n'utilisant pas l'UI).
const SMTP_SETTING_KEYS = ['notif_smtp_host', 'notif_smtp_port', 'notif_smtp_user', 'notif_smtp_pwd'];

async function getSmtpConfig() {
  try {
    const Setting = require('../models/Setting');
    const docs = await Setting.find({ cle: { $in: SMTP_SETTING_KEYS } }).lean();
    const map = {};
    docs.forEach(d => { map[d.cle] = d.valeur; });
    if (map.notif_smtp_host && map.notif_smtp_user && map.notif_smtp_pwd) {
      return { host: map.notif_smtp_host, port: map.notif_smtp_port || '587', user: map.notif_smtp_user, pass: map.notif_smtp_pwd, source: 'settings' };
    }
  } catch (err) {
    logger.error('[MAIL] Échec de lecture de la configuration SMTP applicative (Setting) — repli sur les variables d\'environnement', { error: err.message });
  }
  return { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS, source: 'env' };
}

const getTransporter = (cfg) =>
  nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port),
    secure: String(cfg.port) === '465',
    auth: { user: cfg.user, pass: cfg.pass },
  });

// NEW-001 / SET-002 — le bouton "Tester la connexion SMTP" de Settings.jsx
// était désactivé (aucune route backend, et la config saisie ne pilotait de
// toute façon aucun envoi réel — voir commentaire ci-dessus). Désormais que
// getSmtpConfig() est réellement utilisé par sendEmail(), un vrai test est
// possible : transporter.verify() (API standard nodemailer) vérifie
// réellement la connexion réseau ET l'authentification SMTP auprès du
// serveur, sans jamais envoyer le moindre email — jamais un setTimeout, un
// message fictif, ni un succès simulé. Un succès ou un échec ici reflète
// exactement ce que sendEmail() ferait pour un vrai envoi.
async function testSmtpConnection() {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return { ok: false, message: 'Aucune configuration SMTP disponible (ni dans Paramètres, ni dans les variables d\'environnement du serveur).', source: null };
  }
  try {
    await getTransporter(cfg).verify();
    return { ok: true, message: `Connexion SMTP vérifiée avec succès (${cfg.host}).`, source: cfg.source };
  } catch (err) {
    logger.error('[MAIL] Échec du test de connexion SMTP', { host: cfg.host, error: err.message });
    return { ok: false, message: err.message || 'Échec de la connexion SMTP.', source: cfg.source };
  }
}

// AUDIT-RECU-PDF-PARTAGE — attachments optionnel (forme nodemailer standard :
// [{filename, content:Buffer}]), réutilisable par tout futur module — pas
// propre à la facturation. Absent par défaut : n'affecte aucun appelant
// existant (activation, rappels, ordonnances, messagerie patient texte seul).
const sendEmail = async ({ to, subject, html, attachments }) => {
  const cfg = await getSmtpConfig();
  // Validation conjointe des 3 champs requis (host+user+pass), jamais un
  // sous-ensemble partiel envoyé à nodemailer (échec d'auth opaque sinon).
  if (!cfg.host || !cfg.user || !cfg.pass) {
    logger.warn('[MAIL] SMTP non configuré (ni Settings applicatifs, ni variables d\'environnement) — email simulé', { to, subject });
    return { simulated: true };
  }
  const info = await getTransporter(cfg).sendMail({
    from: env.SMTP_FROM || cfg.user,
    to,
    subject,
    html,
    ...(attachments && attachments.length ? { attachments } : {}),
  });
  return info;
};

// R-08b — plus de mot de passe temporaire généré côté serveur : le patient
// choisit lui-même son mot de passe en suivant le lien (une seule étape,
// pas d'identifiant à transmettre en clair par email).
const sendActivationEmail = async ({ email, prenom, nom, token }) => {
  const lien = `${env.CLIENT_URL}/activate/${token}`;
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
        Pour accéder au portail patient, activez votre compte et choisissez votre mot de passe en cliquant ci-dessous.
      </p>
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
  const lien = `${env.CLIENT_URL}/reset-password/${token}`;
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
  // AUDIT-11-7 — medicament_nom/posologie/duree sont des champs texte libre
  // saisis par le personnel (Prescription.js), pas une valeur d'énumération
  // fermée : échappés avant insertion HTML, même principe que sendPatientEmail.
  const lignesHtml = lignes.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:13px;color:#0B1E3B;font-weight:600;">${escapeHtml(l.medicament_nom || l.medicament || '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:12px;color:#6B7A99;">${escapeHtml(l.posologie || '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:12px;color:#6B7A99;">${escapeHtml(l.duree || '—')}</td>
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
        ${diagnostic ? `<br/>Diagnostic : <strong>${escapeHtml(diagnostic)}</strong>` : ''}
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

// AUDIT-11-7 — motif est un champ texte libre saisi par le personnel/patient
// (Appointment.js), pas une valeur d'énumération fermée : échappé avant
// insertion HTML (ici et dans les 3 autres templates de rendez-vous
// ci-dessous), même principe que sendPatientEmail/sendPrescriptionEmail.
/**
 * Envoie la confirmation de rendez-vous au patient par email.
 * @param {{ email, prenom, nom, date_heure, medecin, type, motif, duree_minutes, service }} opts
 */
const sendAppointmentEmail = async ({ email, prenom, nom, date_heure, medecin, type, motif, duree_minutes, service }) => {
  const dateObj   = new Date(date_heure);
  const dateStr   = dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const heureStr  = dateObj.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

  const typeLabel = {
    consultation: 'Consultation',
    suivi:        'Suivi médical',
    urgence:      'Urgence',
    bilan:        'Bilan de santé',
    vaccination:  'Vaccination',
    prevention:   'Prévention',
  }[type] || type || 'Rendez-vous';

  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>

    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#EFF6FF;border-left:4px solid #1B4F9E;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Confirmation de rendez-vous</div>
        <div style="font-size:20px;font-weight:800;color:#0B1E3B;margin-top:4px;">✅ Rendez-vous confirmé</div>
      </div>

      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre rendez-vous a été enregistré avec succès dans notre système.
        Veuillez trouver ci-dessous le récapitulatif de votre consultation.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;width:40%;">📅 Date</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;text-transform:capitalize;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🕐 Heure</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;">${heureStr} (durée : ${duree_minutes || 30} min)</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">👨‍⚕️ Médecin</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:600;">${medecin || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🩺 Type</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;">${typeLabel}</td>
        </tr>
        ${service ? `
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🏥 Service</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;">${service}</td>
        </tr>` : ''}
        ${motif ? `
        <tr>
          <td style="padding:10px 14px;background:#fff;border-radius:0 0 8px 8px;font-size:12px;color:#6B7A99;font-weight:700;">📝 Motif</td>
          <td style="padding:10px 14px;background:#fff;border-radius:0 0 8px 8px;font-size:13px;color:#374151;">${escapeHtml(motif)}</td>
        </tr>` : ''}
      </table>

      <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:8px;padding:14px 18px;margin-top:8px;">
        <p style="color:#92400E;font-size:13px;margin:0;line-height:1.6;">
          ⚠️ <strong>Rappel important :</strong> Merci de vous présenter <strong>15 minutes avant</strong> l'heure prévue,
          muni de votre carte patient et de vos ordonnances en cours.
          En cas d'empêchement, contactez-nous le plus tôt possible au <strong>+242 22 295 0000</strong>.
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
    subject: `Confirmation rendez-vous du ${dateStr} — Clinique Canadienne`,
    html,
  });
};

const APPT_TYPE_LABELS = {
  consultation: 'Consultation', suivi: 'Suivi médical', urgence: 'Urgence',
  bilan: 'Bilan de santé', vaccination: 'Vaccination', prevention: 'Prévention',
};

/**
 * Envoie la confirmation explicite d'un rendez-vous déjà existant (transition
 * de statut vers "confirmé", distincte de l'email d'enregistrement envoyé à
 * la création — cf. appointments.controller.js::update).
 * @param {{ email, prenom, nom, date_heure, medecin, type, service, motif, duree_minutes }} opts
 */
const sendAppointmentConfirmedEmail = async ({ email, prenom, nom, date_heure, medecin, type, service, motif, duree_minutes }) => {
  const dateObj  = new Date(date_heure);
  const dateStr  = dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const heureStr = dateObj.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  const typeLabel = APPT_TYPE_LABELS[type] || type || 'Rendez-vous';

  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#ECFDF5;border-left:4px solid #059669;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#065F46;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Rendez-vous confirmé</div>
        <div style="font-size:20px;font-weight:800;color:#0B1E3B;margin-top:4px;">✅ Votre rendez-vous a été confirmé</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre rendez-vous a été confirmé. Voici le récapitulatif :
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;width:40%;">📅 Date</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;text-transform:capitalize;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🕐 Heure</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;">${heureStr} (durée : ${duree_minutes || 30} min)</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">👨‍⚕️ Médecin</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:600;">${medecin || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🩺 Type</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;">${typeLabel}</td>
        </tr>
        ${service ? `
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🏥 Service</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;">${service}</td>
        </tr>` : ''}
        ${motif ? `
        <tr>
          <td style="padding:10px 14px;background:#fff;border-radius:0 0 8px 8px;font-size:12px;color:#6B7A99;font-weight:700;">📝 Motif</td>
          <td style="padding:10px 14px;background:#fff;border-radius:0 0 8px 8px;font-size:13px;color:#374151;">${escapeHtml(motif)}</td>
        </tr>` : ''}
      </table>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Rendez-vous confirmé — ${dateStr} — Clinique Canadienne`,
    html,
  });
};

/**
 * Envoie une notification de modification (date/heure) d'un rendez-vous
 * existant. cf. appointments.controller.js::update.
 * @param {{ email, prenom, nom, date_heure, medecin, type, service, motif, duree_minutes }} opts
 */
const sendAppointmentRescheduledEmail = async ({ email, prenom, nom, date_heure, medecin, type, service, motif, duree_minutes }) => {
  const dateObj  = new Date(date_heure);
  const dateStr  = dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const heureStr = dateObj.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  const typeLabel = APPT_TYPE_LABELS[type] || type || 'Rendez-vous';

  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#FFF7ED;border-left:4px solid #D97706;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#92400E;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Rendez-vous modifié</div>
        <div style="font-size:20px;font-weight:800;color:#0B1E3B;margin-top:4px;">🔄 Votre rendez-vous a été modifié</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre rendez-vous a été modifié. La nouvelle date de votre rendez-vous est le
        <strong style="text-transform:capitalize;">${dateStr}</strong> à <strong>${heureStr}</strong>
        ${medecin ? `avec le <strong>${medecin}</strong>` : ''}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;width:40%;">📅 Nouvelle date</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;text-transform:capitalize;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🕐 Nouvelle heure</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;">${heureStr} (durée : ${duree_minutes || 30} min)</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">👨‍⚕️ Médecin</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:600;">${medecin || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🩺 Type</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;">${typeLabel}</td>
        </tr>
        ${service ? `
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🏥 Service</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;">${service}</td>
        </tr>` : ''}
        ${motif ? `
        <tr>
          <td style="padding:10px 14px;background:#fff;border-radius:0 0 8px 8px;font-size:12px;color:#6B7A99;font-weight:700;">📝 Motif</td>
          <td style="padding:10px 14px;background:#fff;border-radius:0 0 8px 8px;font-size:13px;color:#374151;">${escapeHtml(motif)}</td>
        </tr>` : ''}
      </table>
      <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:8px;padding:14px 18px;margin-top:8px;">
        <p style="color:#92400E;font-size:13px;margin:0;line-height:1.6;">
          ⚠️ La date précédente n'est plus valable. Merci de noter la nouvelle date ci-dessus.
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
    subject: `Rendez-vous modifié — nouvelle date ${dateStr} — Clinique Canadienne`,
    html,
  });
};

/**
 * Envoie un rappel de rendez-vous au patient par email (R-10a).
 * @param {{ email, prenom, nom, date_heure, medecin, type, motif }} opts
 */
const sendReminderEmail = async ({ email, prenom, nom, date_heure, medecin, type, motif }) => {
  const dateObj  = new Date(date_heure);
  const dateStr  = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const heureStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const typeLabel = {
    consultation: 'Consultation', suivi: 'Suivi médical', urgence: 'Urgence',
    bilan: 'Bilan de santé', vaccination: 'Vaccination', prevention: 'Prévention',
  }[type] || type || 'Rendez-vous';

  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>

    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#FFF7ED;border-left:4px solid #D97706;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#92400E;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Rappel de rendez-vous</div>
        <div style="font-size:20px;font-weight:800;color:#0B1E3B;margin-top:4px;">⏰ Votre rendez-vous approche</div>
      </div>

      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Nous vous rappelons votre rendez-vous prévu prochainement à la Clinique Canadienne de Souanké.
      </p>

      <div style="background:#F8FAFD;border-radius:10px;padding:18px 20px;margin:20px 0;">
        <div style="font-size:13px;color:#374151;margin-bottom:6px;"><strong>Type :</strong> ${typeLabel}</div>
        <div style="font-size:13px;color:#374151;margin-bottom:6px;"><strong>Date :</strong> ${dateStr}</div>
        <div style="font-size:13px;color:#374151;margin-bottom:6px;"><strong>Heure :</strong> ${heureStr}</div>
        ${medecin ? `<div style="font-size:13px;color:#374151;margin-bottom:6px;"><strong>Médecin :</strong> ${medecin}</div>` : ''}
        ${motif ? `<div style="font-size:13px;color:#374151;"><strong>Motif :</strong> ${escapeHtml(motif)}</div>` : ''}
      </div>

      <p style="color:#374151;font-size:13px;line-height:1.6;">
        Merci de vous présenter 15 minutes avant l'heure prévue, muni de votre carte patient.
        En cas d'empêchement, contactez-nous au <strong>+242 22 295 0000</strong>.
      </p>
    </div>

    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Rappel — rendez-vous du ${dateStr} — Clinique Canadienne`,
    html,
  });
};

/**
 * Notifie un membre du personnel que son compte vient d'être suspendu
 * (settings.controller.js::updateUser, AUDIT-A-4). Le seul canal fiable
 * dans ce cas : une fois suspendu, l'intéressé ne peut plus se connecter
 * pour voir la notification in-app.
 * @param {{ email, prenom, nom }} opts
 */
const sendAccountSuspendedEmail = async ({ email, prenom, nom }) => {
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#991B1B;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Compte suspendu</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">⛔ Votre accès a été suspendu</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre compte sur le système MediSync de la Clinique Canadienne de Souanké a été suspendu par un administrateur.
        Vous ne pouvez plus vous connecter tant que cette suspension n'est pas levée.
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Si vous pensez qu'il s'agit d'une erreur, contactez l'administration de la clinique.
      </p>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: 'Votre compte a été suspendu — Clinique Canadienne',
    html,
  });
};

/**
 * CODE-004 (audit indépendant du 6 sept. 2026) — deactivateUser() envoyait
 * jusqu'ici sendAccountSuspendedEmail() (texte "suspendu... tant que cette
 * suspension n'est pas levée") alors qu'il fixe réellement statut:'inactif',
 * une notion distincte dans l'enum (User.statut: actif/inactif/suspendu) —
 * un message inexact envoyé à l'utilisateur. Même structure visuelle que
 * sendAccountSuspendedEmail ci-dessus, texte corrigé pour ne décrire que ce
 * qui est réellement vrai : l'accès est désactivé, sans laisser entendre
 * qu'une "levée" de suspension suffira à le rétablir.
 * @param {{ email, prenom, nom }} opts
 */
const sendAccountDeactivatedEmail = async ({ email, prenom, nom }) => {
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#991B1B;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Compte désactivé</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">⛔ Votre accès a été désactivé</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Votre compte sur le système MediSync de la Clinique Canadienne de Souanké a été désactivé par un administrateur.
        Vous ne pouvez plus vous connecter.
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Si vous pensez qu'il s'agit d'une erreur, contactez l'administration de la clinique.
      </p>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: 'Votre compte a été désactivé — Clinique Canadienne',
    html,
  });
};

// AUDIT-RH-PLANNING-NOTIF — un email par créneau publié (pas de
// consolidation — décision explicite) : hr.controller.js::publishSchedules
// appelle cette fonction une fois par créneau brouillon.
// @param {{ email, prenom, nom, poste, date, heure_debut, heure_fin, type }} opts
const sendPlanningPublishedEmail = async ({ email, prenom, nom, poste, date, heure_debut, heure_fin, type }) => {
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#EFF6FF;border-left:4px solid #1B4F9E;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
        <div style="font-size:11px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Planning</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">📅 Un créneau a été publié</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:16px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Un créneau vient d'être publié à votre planning${poste ? ` (${poste})` : ''}. Récapitulatif :
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;width:40%;">📅 Date</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;text-transform:capitalize;">${date}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🕐 Horaire</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;">${heure_debut || '—'} – ${heure_fin || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:0 0 8px 8px;font-size:12px;color:#6B7A99;font-weight:700;">🩺 Type</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:0 0 8px 8px;font-size:14px;color:#0B1E3B;">${type}</td>
        </tr>
      </table>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Planning publié — ${date}`,
    html,
  });
};

// AUDIT-RH-PLANNING-RAPPEL — un email par créneau (même principe de
// non-consolidation que sendPlanningPublishedEmail) ; utils/planningReminders.js
// appelle cette fonction pour chaque créneau détecté dans la fenêtre "2h avant".
// @param {{ email, prenom, nom, poste, date, heure_debut, heure_fin, type }} opts
const sendPlanningReminderEmail = async ({ email, prenom, nom, poste, date, heure_debut, heure_fin, type }) => {
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#FFF7ED;border-left:4px solid #D97706;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:11px;color:#92400E;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Rappel de planning</div>
        <div style="font-size:20px;font-weight:800;color:#0B1E3B;margin-top:4px;">⏰ Votre créneau commence dans 2 heures</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:17px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Rappel de votre prochain créneau${poste ? ` (${poste})` : ''} :
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;width:40%;">📅 Date</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:8px 8px 0 0;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;text-transform:capitalize;">${date}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:12px;color:#6B7A99;font-weight:700;">🕐 Horaire</td>
          <td style="padding:10px 14px;background:#fff;border-bottom:1px solid #E2EAF4;font-size:14px;color:#0B1E3B;font-weight:700;">${heure_debut || '—'} – ${heure_fin || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:0 0 8px 8px;font-size:12px;color:#6B7A99;font-weight:700;">🩺 Type</td>
          <td style="padding:10px 14px;background:#F8FAFD;border-radius:0 0 8px 8px;font-size:14px;color:#0B1E3B;">${type}</td>
        </tr>
      </table>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Rappel — votre créneau commence dans 2h (${heure_debut || ''})`,
    html,
  });
};

// AUDIT-ANALYTICS-P1 — un email par destinataire (analytics.controller.js::
// sendReportEmail boucle sur chaque membre du personnel du rôle choisi),
// jamais de consolidation. Le PDF réel (généré côté client, même contenu
// que le bouton "Export PDF") est joint tel quel.
// @param {{ email, prenom, nom, attachment: {filename, content:Buffer} }} opts
const sendAnalyticsReportEmail = async ({ email, prenom, nom, attachment }) => {
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#EFF6FF;border-left:4px solid #1B4F9E;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
        <div style="font-size:11px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Analytics</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">📊 Rapport Analytics</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:16px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Veuillez trouver ci-joint le rapport Analytics de la Clinique Canadienne de Souanké, généré le ${new Date().toLocaleDateString('fr-FR')}.
      </p>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Rapport Analytics — ${new Date().toLocaleDateString('fr-FR')}`,
    html,
    attachments: [attachment],
  });
};

// AUDIT-ANALYTICS-P8 — rapport hebdomadaire IA, distinct du rapport manuel
// sendAnalyticsReportEmail ci-dessus (PDF joint, déclenché par un clic) :
// celui-ci est un corps HTML généré à partir du Markdown produit par
// utils/openai.js (ou du message de repli en mode simulé), aucune pièce
// jointe. Les deux coexistent, aucun ne remplace l'autre.
const sendWeeklyAnalyticsReportEmail = async ({ email, prenom, nom, htmlContenu, simulated }) => {
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#EFF6FF;border-left:4px solid #1B4F9E;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
        <div style="font-size:11px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Analytics · Rapport hebdomadaire</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">🤖 Synthèse générée par IA</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:16px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      ${simulated ? `<p style="color:#D97706;font-size:13px;background:#FFFBEB;border-radius:8px;padding:10px 14px;"><strong>Mode simulé</strong> — OPENAI_API_KEY non configurée cette semaine, aucune synthèse IA réelle n'a été générée.</p>` : ''}
      <div style="color:#374151;font-size:14px;">${htmlContenu}</div>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Rapport hebdomadaire Analytics (IA) — ${new Date().toLocaleDateString('fr-FR')}`,
    html,
  });
};

// FACTURATION-CONSULTATION-001 (rapport de clôture du 11 sept. 2026) —
// envoie par email une facture RÉELLEMENT déjà générée (consultations.
// controller.js::envoyerFacture, réutilise Invoice existant, jamais un
// montant recalculé ici). libelle/lignes proviennent soit d'un texte
// construit par le contrôleur, soit du catalogue (ExamCatalogue.nom,
// administré) — échappés par prudence, même principe que
// sendPrescriptionEmail, au cas où une Invoice serait un jour créée
// manuellement avec un libellé texte libre.
const sendInvoiceEmail = async ({ email, prenom, nom, numero_facture, montant_ttc, lignes = [], date_facture }) => {
  const lignesHtml = lignes.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:13px;color:#0B1E3B;">${escapeHtml(l.libelle || '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F7FF;font-size:13px;color:#0B1E3B;font-weight:600;text-align:right;">${(l.montant || 0).toLocaleString('fr-FR')} CFA</td>
    </tr>
  `).join('');

  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafd;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:800;color:#0B1E3B;">🏥 Clinique Canadienne</div>
      <div style="color:#6B7A99;font-size:13px;margin-top:4px;">Système de santé MediSync · Souanké</div>
    </div>
    <div style="background:#fff;border-radius:14px;padding:30px;border:1.5px solid #E2EAF4;">
      <div style="background:#EFF6FF;border-left:4px solid #1B4F9E;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
        <div style="font-size:11px;color:#6B7A99;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Facture</div>
        <div style="font-size:18px;font-weight:800;color:#0B1E3B;margin-top:4px;">${numero_facture}</div>
        <div style="font-size:12px;color:#6B7A99;margin-top:4px;">Émise le ${new Date(date_facture).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
      <h2 style="color:#0B1E3B;font-size:16px;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;">Veuillez trouver ci-dessous le détail de votre facture.</p>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFD;border-radius:10px;overflow:hidden;margin:16px 0;">
        <thead><tr style="background:#EEF4FF;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7A99;font-weight:700;">Prestation</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6B7A99;font-weight:700;">Montant</th>
        </tr></thead>
        <tbody>${lignesHtml}</tbody>
        <tfoot><tr style="background:#EEF4FF;">
          <td style="padding:10px 12px;font-weight:800;color:#0B1E3B;">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:800;color:#0B1E3B;">${(montant_ttc || 0).toLocaleString('fr-FR')} CFA</td>
        </tr></tfoot>
      </table>
    </div>
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px;">
      Clinique Canadienne de Souanké · MediSync HIS<br/>
      Cet email est généré automatiquement, ne pas répondre.
    </p>
  </div>`;

  return sendEmail({
    to: email,
    subject: `Votre facture ${numero_facture} — Clinique Canadienne`,
    html,
  });
};

module.exports = { sendEmail, sendActivationEmail, sendPasswordResetEmail, sendPrescriptionEmail, sendAppointmentEmail, sendAppointmentConfirmedEmail, sendAppointmentRescheduledEmail, sendReminderEmail, sendAccountSuspendedEmail, sendAccountDeactivatedEmail, sendPlanningPublishedEmail, sendPlanningReminderEmail, sendAnalyticsReportEmail, sendWeeklyAnalyticsReportEmail, sendInvoiceEmail, testSmtpConnection };
