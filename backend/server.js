require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http    = require('http');
const express = require('express');
const { Server } = require('socket.io');
const helmet  = require('helmet');
const cors    = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss     = require('xss-clean');
const hpp     = require('hpp');
const rateLimit = require('express-rate-limit');
const morgan  = require('morgan');
const cookieParser = require('cookie-parser');
const cookie  = require('cookie');
const path    = require('path');
const jwt     = require('jsonwebtoken');

const connectDB      = require('./config/db');
const errorHandler   = require('./middleware/errorHandler');
const routes         = require('./routes');
const { setIO }      = require('./utils/socket');
const { startReminderJob } = require('./utils/appointmentReminders');
const { logger, captureException } = require('./utils/logger');

connectDB().catch(err => {
  logger.error('Connexion MongoDB échouée au démarrage', { error: err.message });
  process.exit(1);
});

const app        = express();
const httpServer = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  // Authoriser polling + websocket pour la compatibilité proxy Vite
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware d'authentification Socket.IO (JWT)
// Le token n'est jamais exposé au JS client (cookie httpOnly) : on le lit
// directement depuis l'en-tête Cookie transmis lors du handshake, comme le
// fait déjà `protect` côté REST. Les en-têtes auth/Authorization restent
// acceptés en repli pour des clients non-navigateur (scripts, tests).
io.use((socket, next) => {
  try {
    let token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token && socket.handshake.headers?.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      token = cookies.token;
    }

    if (!token || token === 'none') return next(new Error('Non authentifié'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId   = decoded.id;
    socket.userRole = decoded.role || 'inconnu';
    next();
  } catch {
    next(new Error('Token invalide'));
  }
});

io.on('connection', (socket) => {
  // Chaque utilisateur rejoint sa room privée (notifications, messages)
  socket.join(`user:${socket.userId}`);
  // Tous les utilisateurs connectés reçoivent les mises à jour du dashboard
  socket.join('dashboard');

  socket.on('join:conversation', (convId) => {
    socket.join(`conversation:${convId}`);
  });

  socket.on('leave:conversation', (convId) => {
    socket.leave(`conversation:${convId}`);
  });

  socket.on('disconnect', () => {
    // Nettoyage automatique des rooms par Socket.IO
  });
});

// Enregistrer l'instance globale pour usage dans les contrôleurs
setIO(io);

// ── Express middleware ────────────────────────────────────────────────────────

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://accounts.google.com", "https://apis.google.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:     ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com", "ws://localhost:5000", "wss://localhost:5000"],
      frameSrc:   ["https://accounts.google.com"],
      workerSrc:  ["'self'", "blob:"],
    },
  },
}));

// CORS
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 2000,
  message: { success: false, message: 'Trop de requêtes. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/auth/me',
});
app.use('/api/', limiter);

// Limit strict sur le login (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Couvre aussi Google OAuth (abus/énumération), mot de passe oublié (spam
// d'emails) et réinitialisation (brute-force du token) — pas seulement /login.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Logging
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Static uploads — AUDIT-S-1 : express.static protégé seulement par
// l'authentification (protect) laissait n'importe quel compte accéder à
// n'importe quel fichier ; uploads.controller.js réapplique un contrôle de
// rôle par sous-répertoire, cohérent avec les CAN_READ des routes qui
// produisent ces fichiers.
const { protect: protectUploads } = require('./middleware/auth');
const uploadsController = require('./controllers/uploads.controller');
app.get('/uploads/*', protectUploads, uploadsController.serveUpload);

// Health check
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    db: mongoose.connection.db?.databaseName || 'non connecté',
    dbState: ['déconnecté','connecté','connexion...','déconnexion...'][mongoose.connection.readyState] || 'inconnu',
    uptime: Math.round(process.uptime()) + 's',
    socketConnected: io.engine.clientsCount,
  });
});

// API routes
app.use('/api', routes);

// Serve React — production only
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../frontend/dist/index.html'))
  );
}

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info('Serveur démarré', { port: PORT, env: process.env.NODE_ENV });
  startReminderJob();
});

// ── Filet de sécurité process ────────────────────────────────────────────────
// Sans ces gestionnaires, une exception non interceptée en dehors du cycle
// requête/réponse Express (timer, callback Socket.IO, promesse orpheline)
// fait planter tout le processus pour TOUS les utilisateurs, sans trace
// exploitable. La pratique recommandée par Node.js n'est pas d'ignorer
// l'erreur et de continuer (l'état du process peut être corrompu), mais de
// la journaliser puis de quitter proprement pour qu'un gestionnaire de
// process (pm2, systemd, service Windows — voir ecosystem.config.js)
// relance automatiquement le serveur. Sans un tel gestionnaire en amont, le
// process ne redémarre pas seul : voir le rapport d'audit, section Reprise
// après incident.
process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] Promesse rejetée non gérée', { reason: reason instanceof Error ? reason.message : reason, stack: reason instanceof Error ? reason.stack : undefined });
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Exception non interceptée', { error: err.message, stack: err.stack });
  captureException(err);
  process.exit(1);
});
