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
const path    = require('path');
const jwt     = require('jsonwebtoken');

const connectDB      = require('./config/db');
const errorHandler   = require('./middleware/errorHandler');
const routes         = require('./routes');
const { setIO }      = require('./utils/socket');

connectDB();

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
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Non authentifié'));
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
app.use('/api/auth/login', authLimiter);

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

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
httpServer.listen(PORT, () =>
  console.log(`Serveur démarré sur le port ${PORT} [${process.env.NODE_ENV}] — Socket.IO actif`)
);
