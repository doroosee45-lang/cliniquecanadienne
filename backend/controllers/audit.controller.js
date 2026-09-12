const AuditLog = require('../models/AuditLog');
const AuditAlert = require('../models/AuditAlert');
const User = require('../models/User');
const { paginate, escapeRegex, createNotification } = require('../utils/helpers');
const ADMIN_ROLES = ['superadmin', 'adminclinique'];

// ── Risk mapping ────────────────────────────────────────────────
const RISK_MAP = {
  connexion: 'faible', deconnexion: 'faible', consultation: 'faible',
  creation: 'moyen', modification: 'moyen', validation: 'moyen', impression: 'moyen', annulation: 'moyen',
  suppression: 'eleve', exportation: 'eleve', changement_mdp: 'eleve', changement_perms: 'eleve',
  echec_connexion: 'critique', acces_refuse: 'critique',
};

function normalizeAction(raw) {
  if (!raw) return 'autre';
  const a = raw.toLowerCase();
  if (a === 'login' || a === 'connexion' || a === 'login_success') return 'connexion';
  if (a === 'logout' || a === 'deconnexion') return 'deconnexion';
  if (a === 'login_echec' || a === 'login_fail' || a.includes('echec_connexion')) return 'echec_connexion';
  if (a.includes('acces_refuse') || a.includes('access_denied') || a.includes('forbidden')) return 'acces_refuse';
  if (a === 'create' || a.startsWith('create_') || a === 'creation' || a === 'vente' || a === 'dispense') return 'creation';
  if (a === 'update' || a.startsWith('update_') || a === 'modification' || a === 'payment' || a === 'discharge' || a === 'stock_mouvement') return 'modification';
  if (a === 'delete' || a.startsWith('delete_') || a === 'suppression') return 'suppression';
  if (a.includes('export') || a === 'exportation') return 'exportation';
  if (a.includes('print') || a.includes('impress') || a === 'impression') return 'impression';
  if (a === 'cancel' || a === 'annulation') return 'annulation';
  if (a.includes('perm') || a.includes('role_change') || a === 'changement_perms') return 'changement_perms';
  if (a.includes('password') || a.includes('mdp') || a === 'changement_mdp' || a === 'forgot_password' || a === 'reset_password' || a === 'update_password') return 'changement_mdp';
  if (a === 'validate' || a.startsWith('valid') || a === 'validation') return 'validation';
  if (a.startsWith('view_') || a === 'consultation') return 'consultation';
  return a.replace(/_/g, ' ');
}

function computeRisque(action, statut) {
  if (statut === 'echec' && action !== 'deconnexion') {
    return (action === 'echec_connexion' || action === 'acces_refuse') ? 'critique' : 'eleve';
  }
  return RISK_MAP[action] || 'faible';
}

function formatLog(log) {
  const u = log.utilisateur || {};
  const nom = u.prenom ? `${u.prenom} ${u.nom}` : (u.nom || 'Système');
  const action = normalizeAction(log.action);
  const risque = computeRisque(action, log.statut);
  return {
    _id: log._id,
    utilisateur: nom,
    role: u.role || '—',
    email: u.email || '—',
    action,
    module: log.module || 'systeme',
    description: log.message || `${action} dans ${log.module || 'système'}`,
    ip: log.ip_address || '—',
    device: log.user_agent ? log.user_agent.substring(0, 80) : '—',
    date: log.createdAt,
    risque,
    resultat: log.statut === 'succes' ? 'Succès' : 'Échec',
    ancienne_val: log.donnees_avant ? JSON.stringify(log.donnees_avant).substring(0, 300) : null,
    nouvelle_val: log.donnees_apres ? JSON.stringify(log.donnees_apres).substring(0, 300) : null,
  };
}

// GET /audit
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, module, action, utilisateur, risque, q, date_deb, date_fin, ip } = req.query;
    const filter = {};
    // AUDIT-ELEVE-3 — construits jusqu'ici depuis req.query sans échapper les
    // métacaractères regex (escapeRegex, utils/helpers.js, déjà importé et
    // utilisé pour cette même raison ailleurs — ex. archive.controller.js,
    // blocoperatoireController.js) : une entrée pathologique (ex. répétition
    // de quantificateurs imbriqués) sur une collection qui ne fait que
    // croître pouvait provoquer un scan catastrophique. `action` avait le
    // même défaut que module/q/ip, corrigé au passage pour la même raison.
    if (module) filter.module = new RegExp(escapeRegex(module), 'i');
    if (action) filter.action = new RegExp(escapeRegex(action), 'i');
    if (q) filter.$or = [{ message: new RegExp(escapeRegex(q), 'i') }, { module: new RegExp(escapeRegex(q), 'i') }];
    if (ip) filter.ip_address = new RegExp(escapeRegex(ip), 'i');
    if (date_deb || date_fin) {
      filter.createdAt = {};
      if (date_deb) filter.createdAt.$gte = new Date(date_deb);
      if (date_fin) {
        const fin = new Date(date_fin);
        fin.setDate(fin.getDate() + 1);
        filter.createdAt.$lt = fin;
      }
    }

    // AUDIT-FAIBLE-F1 — .lean() : formatLog() ci-dessous n'accède qu'à des
    // propriétés brutes (aucune méthode d'instance/virtual Mongoose),
    // vérifié exhaustivement — compatible tel quel.
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, raw] = await Promise.all([
      AuditLog.countDocuments(filter),
      paginate(
        AuditLog.find(filter).populate('utilisateur', 'nom prenom role email').sort('-createdAt').lean(),
        page, limit
      ),
    ]);

    let events = raw.map(formatLog);
    if (utilisateur) events = events.filter(e => e.utilisateur.toLowerCase().includes(utilisateur.toLowerCase()));
    if (risque) events = events.filter(e => e.risque === risque);

    res.json({ success: true, total, events });
  } catch (err) { next(err); }
};

// GET /audit/connexions — sessions des dernières 48h
exports.getConnexions = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 48 * 3600 * 1000);
    const loginActions = ['LOGIN', 'LOGOUT', 'login', 'logout', 'connexion', 'deconnexion', 'login_success', 'LOGIN_SUCCESS'];
    const logs = await AuditLog.find({ action: { $in: loginActions }, createdAt: { $gte: since } })
      .populate('utilisateur', 'nom prenom role email')
      .sort('createdAt')
      .lean();

    const sessions = {};
    logs.forEach(log => {
      const uid = log.utilisateur?._id?.toString() || `ip_${log.ip_address}`;
      if (!sessions[uid]) {
        const u = log.utilisateur || {};
        sessions[uid] = {
          _id: String(log._id),
          // FORCE-LOGOUT-001 (rapport de clôture du 11 sept. 2026) — _id
          // ci-dessus est l'ID de l'entrée AuditLog (utile comme clé React),
          // jamais celui de l'utilisateur : Audit.jsx n'avait donc aucun
          // identifiant réel à transmettre à un appel de révocation de
          // session. utilisateur_id expose la vraie référence User (absente
          // pour les entrées sans compte résolu, ex. IP seule).
          utilisateur_id: u._id ? String(u._id) : null,
          utilisateur: u.prenom ? `${u.prenom} ${u.nom}` : (u.nom || 'Inconnu'),
          email: u.email || '—',
          role: u.role || '—',
          ip: log.ip_address || '—',
          device: log.user_agent ? log.user_agent.substring(0, 60) : 'Navigateur web',
          localisation: 'Réseau local',
          heure_connexion: null,
          heure_deconnexion: null,
          statut: 'deconnecte',
        };
      }
      const action = normalizeAction(log.action);
      if (action === 'connexion') {
        sessions[uid].heure_connexion = log.createdAt;
        sessions[uid].statut = 'actif';
      }
      if (action === 'deconnexion') {
        sessions[uid].heure_deconnexion = log.createdAt;
        sessions[uid].statut = 'deconnecte';
      }
    });

    const connexions = Object.values(sessions).filter(s => s.heure_connexion);
    res.json({ success: true, connexions });
  } catch (err) { next(err); }
};

// GET /audit/suspects — activités suspectes 7 derniers jours
//
// R-09 — limites de conception connues, documentées mais volontairement non
// corrigées dans cette passe (décisions de durcissement plus substantielles,
// à trancher séparément si la détection anti-force-brute doit être musclée) :
//  1) Comptage par IP sans `app.set('trust proxy', ...)` dans server.js — si
//     l'appli tourne derrière un reverse proxy/load balancer, req.ip peut
//     retourner la même adresse pour tous les utilisateurs, invalidant le
//     comptage (faux négatifs en masse, ou amalgame d'utilisateurs innocents).
//  2) Seuil (≥3 échecs) sans dégressivité temporelle sur une fenêtre de 7
//     jours : 3 mots de passe mal tapés étalés sur une semaine (comportement
//     légitime plausible) déclenche la même alerte qu'une rafale en 10s.
//  3) Détection uniquement par IP, jamais par compte : une attaque distribuée
//     lente (IPs tournantes) contre un seul compte n'atteint jamais le seuil
//     par IP et reste invisible ici (le verrouillage de compte, R-16, la
//     rattrape à 5 échecs — mais c'est un filet différent, pas cette règle).
//
// T9.2 — règle « accès refusé » revue. Elle transformait auparavant CHAQUE
// entrée ACCESS_DENIED en suspect individuel, sans seuil : un unique refus
// isolé (ex. clic sur un lien de menu resté affiché juste après un
// changement de rôle) apparaissait avec la même sévérité qu'un vrai
// balayage de permissions — et en pratique, la base réelle avait accumulé
// 3537 entrées de ce type sur 7 jours (bruit de test), rendant la liste des
// suspects inutilisable pour une vraie investigation.
// Testé empiriquement (3 scénarios suspects / 3 scénarios normaux) avant de
// choisir le correctif : seuil ≥5 refus sur 7 jours, agrégé PAR UTILISATEUR
// SEUL (pas par paire utilisateur+module comme envisagé initialement) —
// une agrégation par (utilisateur, module) se serait révélée aveugle à la
// forme d'attaque la plus évidente trouvée dans le bruit réel lui-même : un
// même compte touchant 5 modules différents en moins d'une seconde n'aurait
// jamais dépassé un compte de 1 par paire. Seuil 5 (pas 3) choisi car il
// élimine le seul faux positif plausible construit pendant les tests (un
// compte qui explore 4 modules différents sans intention malveillante) sans
// retarder significativement la détection d'un vrai balayage (la plupart
// des attaques réelles dépasseront 5 très vite, la base compte >15 modules
// protégés). Compromis accepté : un martelage répété sur un SEUL module
// n'est détecté qu'à la 5e tentative au lieu de la 3e — partiellement
// couvert par ailleurs par le verrouillage de compte (R-16) et le
// rate-limit sur les routes d'auth, indépendants de cette règle.
// Simplification non traitée : toutes les entrées ACCESS_DENIED comptent
// pareil quel que soit le module visé — 5 refus sur des modules peu
// sensibles pèse autant que 5 refus sur finance/settings. Pas pondéré ici.
exports.getSuspects = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [failedLogins, deniedAccess] = await Promise.all([
      AuditLog.find({ $or: [{ action: { $in: ['LOGIN_ECHEC', 'LOGIN_FAIL', 'login_echec', 'login_fail'] } }, { statut: 'echec', action: { $in: ['LOGIN', 'login', 'connexion'] } }], createdAt: { $gte: since } })
        .populate('utilisateur', 'nom prenom role').sort('-createdAt').lean(),
      AuditLog.find({ action: { $in: ['ACCESS_DENIED', 'acces_refuse', 'FORBIDDEN'] }, createdAt: { $gte: since } })
        .populate('utilisateur', 'nom prenom role').sort('-createdAt').lean(),
    ]);

    const ipCounts = {};
    failedLogins.forEach(l => { const ip = l.ip_address || 'unknown'; ipCounts[ip] = (ipCounts[ip] || 0) + 1; });

    const suspects = [];

    Object.entries(ipCounts).forEach(([ip, count]) => {
      if (count >= 3) {
        suspects.push({
          _id: `brute_${ip.replace(/\./g, '_')}`,
          type: `Tentatives de force brute`,
          utilisateur: `IP: ${ip}`,
          description: `${count} tentative(s) de connexion échouée(s) depuis l'adresse IP ${ip} en moins de 7 jours.`,
          date: new Date().toISOString(),
          severite: count >= 5 ? 'critique' : 'eleve',
          risque: count >= 5 ? 'critique' : 'eleve',
          statut: 'ouvert',
        });
      }
    });

    const DENIED_THRESHOLD = 5;
    const deniedByUser = {};
    deniedAccess.forEach(log => {
      const uid = log.utilisateur?._id ? String(log.utilisateur._id) : 'inconnu';
      if (!deniedByUser[uid]) {
        deniedByUser[uid] = { count: 0, user: log.utilisateur, modules: new Set(), lastLog: log };
      }
      deniedByUser[uid].count += 1;
      if (log.module) deniedByUser[uid].modules.add(log.module);
      if (new Date(log.createdAt) > new Date(deniedByUser[uid].lastLog.createdAt)) deniedByUser[uid].lastLog = log;
    });

    Object.entries(deniedByUser).forEach(([uid, info]) => {
      if (info.count < DENIED_THRESHOLD) return;
      const u = info.user || {};
      suspects.push({
        _id: `denied_${uid}`,
        type: 'Accès refusé répété',
        utilisateur: u.prenom ? `${u.prenom} ${u.nom}` : (u.nom || 'Inconnu'),
        description: `${info.count} tentative(s) d'accès refusé sur ${info.modules.size} module(s) différent(s) en moins de 7 jours (dernière : ${info.lastLog.message || `module ${info.lastLog.module || 'inconnu'}`}).`,
        date: info.lastLog.createdAt,
        severite: 'eleve',
        risque: 'eleve',
        statut: 'ouvert',
      });
    });

    // Sous-phase 5.7 — "Enquêter"/"Clôturer" ne persistaient jamais rien :
    // les suspects ci-dessus sont recalculés à zéro à chaque appel
    // (_id synthétique), muter leur statut côté client était donc sans
    // effet réel. Un vrai statut est maintenant stocké (AuditAlert,
    // alert_id = l'_id synthétique) et réappliqué ici sur le calcul frais.
    const alertIds = suspects.map(s => s._id);
    const overlays = await AuditAlert.find({ alert_id: { $in: alertIds } }).lean();
    const overlayByAlertId = Object.fromEntries(overlays.map(o => [o.alert_id, o]));
    suspects.forEach(s => { if (overlayByAlertId[s._id]) s.statut = overlayByAlertId[s._id].statut; });

    // "Créer alerte" (Audit.jsx) ne persistait jamais rien non plus : les
    // alertes créées manuellement (source:'manuel', pas d'alert_id) sont
    // de vrais documents, ajoutées ici au tableau calculé.
    const manuelles = await AuditAlert.find({ source: 'manuel' }).sort('-createdAt').lean();
    manuelles.forEach(m => suspects.push({
      _id: String(m._id), type: m.type, utilisateur: m.utilisateur, description: m.description,
      date: m.date_evenement || m.createdAt, severite: m.severite, risque: m.severite, statut: m.statut,
    }));

    res.json({ success: true, suspects });
  } catch (err) { next(err); }
};

// PUT /audit/suspects/:id/statut — Sous-phase 5.7, cf. commentaire ci-dessus.
exports.updateSuspectStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!['ouvert', 'en_enquete', 'cloture'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    const id = req.params.id;
    // Une alerte manuelle (créée via createAlert) a un vrai _id Mongo ;
    // une alerte calculée (brute_x/denied_x) n'existe qu'en tant
    // qu'alert_id synthétique — jamais les deux pour le même document.
    const isManuelle = /^[0-9a-fA-F]{24}$/.test(id) && await AuditAlert.exists({ _id: id, source: 'manuel' });
    const alert = isManuelle
      ? await AuditAlert.findByIdAndUpdate(id, { statut, cree_par: req.user._id }, { new: true })
      : await AuditAlert.findOneAndUpdate(
          { alert_id: id },
          { alert_id: id, statut, source: 'auto', cree_par: req.user._id },
          { new: true, upsert: true }
        );
    res.json({ success: true, alert });
  } catch (err) { next(err); }
};

// POST /audit/suspects/:id/notifier — Sous-phase 5.7 — "Notifier admin"
// affichait un faux succès sans le moindre envoi. Crée une vraie
// Notification (utils/helpers.js::createNotification, déjà réelle et déjà
// utilisée ailleurs — ex. portal.controller.js) pour chaque administrateur
// réel (superadmin/adminclinique), jamais une simulation.
exports.notifySuspect = async (req, res, next) => {
  try {
    const { type, utilisateur, description } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Description requise.' });
    const admins = await User.find({ role: { $in: ADMIN_ROLES }, statut: 'actif' }).select('_id');
    await Promise.all(admins.map(a => createNotification({
      destinataire: a._id, type: 'critical', priorite: 'critique',
      titre: `🚨 Alerte sécurité : ${type || 'Activité suspecte'}`,
      message: `${utilisateur ? `Utilisateur : ${utilisateur}. ` : ''}${description}`,
      lien: '/audit',
    })));
    res.json({ success: true, notifies: admins.length });
  } catch (err) { next(err); }
};

// POST /audit/alertes — Sous-phase 5.7 — "Créer alerte" (Audit.jsx, depuis
// le détail d'un événement critique) poussait un objet local jamais
// persisté. Crée une vraie AuditAlert manuelle, réapparaît réellement dans
// getSuspects() ci-dessus au prochain chargement.
exports.createAlert = async (req, res, next) => {
  try {
    const { type, utilisateur, description, severite, date_evenement } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Description requise.' });
    const alert = await AuditAlert.create({
      type: type || 'Activité critique signalée', utilisateur, description,
      severite: severite === 'critique' ? 'critique' : 'eleve', source: 'manuel',
      cree_par: req.user._id, date_evenement: date_evenement || new Date(),
    });
    res.status(201).json({ success: true, alert });
  } catch (err) { next(err); }
};

// POST /audit/archive — AUDIT-3.5 (ADM-05) : ce endpoint ne fait qu'un
// COMPTAGE des entrées plus anciennes que le seuil ; il ne déplace, n'exporte
// ni ne supprime jamais rien (aucune politique de rétention n'est validée à
// ce jour — voir Audit.jsx, section "Estimer le volume", qui affiche déjà
// cette limite explicitement à l'utilisateur). Le nom historique
// "archiveLogs" et l'ancien message pouvaient laisser croire à une action
// réelle ; message clarifié pour ne jamais l'affirmer.
exports.archiveLogs = async (req, res, next) => {
  try {
    const { duree = '1an' } = req.body;
    const monthsMap = { '1an': 12, '3ans': 36, '5ans': 60, 'illimite': 0 };
    const months = monthsMap[duree] ?? 12;
    if (months === 0) return res.json({ success: true, count: 0, message: 'Conservation illimitée — aucune entrée estimée.' });
    const cutoff = new Date(Date.now() - months * 30 * 24 * 3600 * 1000);
    const count = await AuditLog.countDocuments({ createdAt: { $lt: cutoff } });
    res.json({ success: true, count, cutoff, message: `${count} entrée(s) plus ancienne(s) que le ${cutoff.toLocaleDateString('fr-FR')} — estimation seule, aucune suppression ni déplacement effectué.` });
  } catch (err) { next(err); }
};

// GET /audit/stats — statistiques agrégées
exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const day7  = new Date(now.getTime() - 7  * 24 * 3600 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalLogs, activity7Raw, activity30Raw, byHourRaw, topUsersRaw] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: day7 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: day30 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: day30 }, utilisateur: { $ne: null } } },
        { $group: { _id: '$utilisateur', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    // 7-day array (last 7 calendar days)
    const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const labels7 = [], data7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      labels7.push(JOURS[d.getDay()]);
      const found = activity7Raw.find(a => a._id === key);
      data7.push(found ? found.count : 0);
    }

    // 30-day array
    const labels30 = [], data30 = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      labels30.push(`J${30 - i}`);
      const found = activity30Raw.find(a => a._id === key);
      data30.push(found ? found.count : 0);
    }

    // By hour (7h-18h)
    const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const dataHours = HOURS.map(h => { const f = byHourRaw.find(a => a._id === h); return f ? f.count : 0; });

    // Top users
    const top_utilisateurs = topUsersRaw.map(u => ({
      nom: u.user?.prenom ? `${u.user.prenom} ${u.user.nom}` : (u.user?.nom || 'Inconnu'),
      role: u.user?.role || '—',
      count: u.count,
    }));

    res.json({
      success: true,
      total_logs: totalLogs,
      activite_7j:       { labels: labels7,                 data: data7 },
      activite_30j:      { labels: labels30,                data: data30 },
      connexions_heure:  { labels: HOURS.map(h => `${h}h`), data: dataHours },
      top_utilisateurs,
    });
  } catch (err) { next(err); }
};
