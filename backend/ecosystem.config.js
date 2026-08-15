// Configuration PM2 recommandée pour la production — absente du projet
// jusqu'ici (npm start lançait `node server.js` nu, sans redémarrage
// automatique en cas de crash). Usage : `pm2 start ecosystem.config.js --env production`
module.exports = {
  apps: [
    {
      name: 'medisync-api',
      script: 'server.js',
      cwd: __dirname,
      instances: 1, // rester à 1 tant que Socket.IO n'a pas d'adaptateur Redis (voir rapport)
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env_production: { NODE_ENV: 'production' },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
