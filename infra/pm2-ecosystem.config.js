// PM2 process definitions for hightable.pro (Hetzner)
// Usage: pm2 start infra/pm2-ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'htp-server',
      script: '/root/htp/crates/target/release/htp-server',
      cwd: '/root/htp',
      env: { HTP_NETWORK: 'tn12' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'htp-orders',
      script: 'orders-api.js',
      cwd: '/root/htp',
      env: { ORDERS_PORT: '3001', NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
