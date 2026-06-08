const AuditLog = require('../models/AuditLog');
const { paginate } = require('../utils/helpers');

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
    if (module) filter.module = new RegExp(module, 'i');
    if (action) filter.action = new RegExp(action, 'i');
    if (q) filter.$or = [{ message: new RegExp(q, 'i') }, { module: new RegExp(q, 'i') }];
    if (ip) filter.ip_address = new RegExp(ip, 'i');
    if (date_deb || date_fin) {
      filter.createdAt = {};
      if (date_deb) filter.createdAt.$gte = new Date(date_deb);
      if (date_fin) {
        const fin = new Date(date_fin);
        fin.setDate(fin.getDate() + 1);
        filter.createdAt.$lt = fin;
      }
    }

    const total = await AuditLog.countDocuments(filter);
    const raw = await paginate(
      AuditLog.find(filter).populate('utilisateur', 'nom prenom role email').sort('-createdAt'),
      page, limit
    );

    let events = raw.map(formatLog);
    if (utilisateur) events = events.filter(e => e.utilisateur.toLowerCase().includes(utilisateur.toLowerCase()));
    if (risque) events = events.filter(e => e.risque === risque);

    res.json({ success: true, total, events, data: events });
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

    deniedAccess.forEach(log => {
      const u = log.utilisateur || {};
      suspects.push({
        _id: String(log._id),
        type: 'Accès refusé',
        utilisateur: u.prenom ? `${u.prenom} ${u.nom}` : (u.nom || log.ip_address || 'Inconnu'),
        description: log.message || `Tentative d'accès non autorisé au module ${log.module || 'inconnu'}`,
        date: log.createdAt,
        severite: 'eleve',
        risque: 'eleve',
        statut: 'ouvert',
      });
    });

    res.json({ success: true, suspects });
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
