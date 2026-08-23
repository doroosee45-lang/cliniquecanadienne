// Phase 10.2 — vérification de configuration production, demandée en
// clôture de Phase 10.1 : NODE_ENV, JWT_SECRET unique, SMTP hors mode
// simulation, absence des comptes seed. Utilisable en CLI avant un
// déploiement réel (`node utils/checkProductionConfig.js`) ou importé pour
// être exercé par un test (paramètres injectables, jamais de dépendance
// cachée sur process.env pour rester testable).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Emails créés par utils/seed.js — jamais acceptables dans une base de
// production. Liste extraite directement du seed (recopiée, pas dérivée
// dynamiquement, pour que ce contrôle reste valide même si seed.js change de
// forme plus tard sans que quelqu'un pense à mettre ce fichier à jour en
// même temps — un écart entre les deux serait alors visible en CI/revue).
const KNOWN_SEED_EMAILS = [
  'oseedoro@gmail.com', 'admin@clinique-souanke.cg',
  'dr.nguema@clinique-souanke.cg', 'dr.obiang@clinique-souanke.cg', 'dr.moussavou@clinique-souanke.cg', 'dr.nze@clinique-souanke.cg',
  'inf.bekale@clinique-souanke.cg', 'inf.mba@clinique-souanke.cg', 'inf.eyeghe@clinique-souanke.cg',
  'lab.bongo@clinique-souanke.cg', 'lab.mbemba@clinique-souanke.cg',
  'ph.ndong@clinique-souanke.cg', 'cpt.ella@clinique-souanke.cg', 'rec.mouanda@clinique-souanke.cg', 'sf.ngoyi@clinique-souanke.cg',
  'patient@clinique-souanke.cg',
  'infos@cnss.cg', 'contact@cnamgs.ga', 'sante@axa.cg', 'sante@sanlam.cg',
  'jb.mboumba@gmail.com', 'fatou.ngoma@yahoo.fr', 'marc.essono@gmail.com', 'sophie.akana@hotmail.com',
  'd.moutombi@gmail.com', 'carine.nzinga@gmail.com', 'p.oyono@gmail.com', 'brigitte.meye@gmail.com',
];

// Marqueurs de valeur par défaut/placeholder connus (.env.example, et la
// valeur actuellement présente dans le .env de développement de ce dépôt) —
// un JWT_SECRET qui matche l'un de ces marqueurs n'a manifestement jamais
// été régénéré aléatoirement.
const JWT_PLACEHOLDER_MARKERS = [
  'change_this_to_a_very_long_random_secret_string_min_64_chars',
  'change_in_production',
  'secure_key_change',
];
const JWT_MIN_LENGTH = 64;

function checkNodeEnv(env, findings) {
  if (env.NODE_ENV !== 'production') {
    findings.push({ level: 'error', check: 'NODE_ENV', message: `NODE_ENV="${env.NODE_ENV || '(absent)'}" — doit être "production" en déploiement réel (active le rate-limiting strict et désactive les logs morgan verbeux, cf. server.js).` });
  }
}

function checkJwtSecret(env, findings) {
  const secret = env.JWT_SECRET;
  if (!secret) {
    findings.push({ level: 'error', check: 'JWT_SECRET', message: 'JWT_SECRET absent.' });
    return;
  }
  if (secret.length < JWT_MIN_LENGTH) {
    findings.push({ level: 'error', check: 'JWT_SECRET', message: `JWT_SECRET trop court (${secret.length} caractères, minimum recommandé ${JWT_MIN_LENGTH}).` });
  }
  if (JWT_PLACEHOLDER_MARKERS.some(marker => secret.includes(marker))) {
    findings.push({ level: 'error', check: 'JWT_SECRET', message: 'JWT_SECRET contient un marqueur de valeur par défaut/placeholder connu — doit être régénéré de façon aléatoire (ex. `openssl rand -hex 64`) avant la production, jamais réutilisé depuis le dépôt/l\'exemple.' });
  }
}

function checkSmtp(env, findings) {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    findings.push({ level: 'error', check: 'SMTP', message: 'SMTP non configuré (SMTP_HOST/SMTP_USER absent) — utils/mail.js retombera en mode simulé : aucun email réel (activation compte, rappel de rendez-vous, réinitialisation de mot de passe) ne sera envoyé.' });
  }
}

// AUDIT-ANALYTICS-P8 — même pattern que checkSmtp ci-dessus :
// vérifie uniquement la PRÉSENCE de la clé, jamais sa valeur.
function checkOpenAI(env, findings) {
  if (!env.OPENAI_API_KEY) {
    findings.push({ level: 'error', check: 'OPENAI', message: 'OPENAI_API_KEY non configurée — utils/openai.js retombera en mode simulé : le rapport hebdomadaire Analytics ne sera jamais réellement généré par IA.' });
  }
}

// checkSeedAccounts — nécessite une connexion Mongo (paramètre injecté,
// jamais géré en interne) pour rester testable sans dépendre d'une base
// précise ; utilise une connexion mongoose distincte de celle de l'appelant
// pour ne jamais présumer d'un état de connexion externe.
async function checkSeedAccounts(mongoUri, findings) {
  const mongoose = require('mongoose');
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  try {
    const User = conn.model('User', new mongoose.Schema({ email: String }, { strict: false }));
    const found = await User.find({ email: { $in: KNOWN_SEED_EMAILS } }, 'email').lean();
    if (found.length > 0) {
      findings.push({ level: 'error', check: 'SEED_ACCOUNTS', message: `${found.length} compte(s) seed présent(s) en base : ${found.map(u => u.email).join(', ')} — utils/seed.js ne doit jamais avoir été exécuté contre une base de production (mots de passe partagés/connus).` });
    }
  } finally {
    await conn.close();
  }
}

/**
 * @param {object} [opts]
 * @param {object} [opts.env] - source des variables (défaut process.env)
 * @param {string} [opts.mongoUri] - si fourni, active la vérification des comptes seed
 * @returns {Promise<Array<{level:string, check:string, message:string}>>}
 */
async function checkProductionConfig({ env = process.env, mongoUri } = {}) {
  const findings = [];
  checkNodeEnv(env, findings);
  checkJwtSecret(env, findings);
  checkSmtp(env, findings);
  checkOpenAI(env, findings);
  if (mongoUri) {
    await checkSeedAccounts(mongoUri, findings);
  }
  return findings;
}

if (require.main === module) {
  checkProductionConfig({ mongoUri: process.env.MONGO_URI }).then((findings) => {
    if (findings.length === 0) {
      console.log('✅ Vérification de configuration production : aucun écart détecté.');
      process.exit(0);
    }
    console.error(`❌ Vérification de configuration production : ${findings.length} écart(s) détecté(s).\n`);
    for (const f of findings) console.error(`  [${f.level.toUpperCase()}] ${f.check} — ${f.message}`);
    process.exit(1);
  }).catch((err) => {
    console.error('Erreur lors de la vérification :', err.message);
    process.exit(2);
  });
}

module.exports = { checkProductionConfig, KNOWN_SEED_EMAILS, JWT_PLACEHOLDER_MARKERS, JWT_MIN_LENGTH };
