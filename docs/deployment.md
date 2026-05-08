# HTP Deployment Guide

## Production Stack

```
nginx (SSL termination, static files, proxy)
  ├── :443 → /root/htp/public  (static frontend)
  ├── /api/* → localhost:3000  (Rust htp-server)
  └── /api/orders → localhost:3001  (Node htp-orders)

PM2
  ├── htp-server   (Rust binary, id=5)
  └── htp-orders   (Node.js, id=3)

Vercel (CDN mirror)
  └── public-beige-eight.vercel.app → hightable.pro
```

## Server Requirements

- Ubuntu 22.04 LTS
- 2+ vCPU, 4GB RAM, 40GB SSD
- Ports: 22, 80, 443, 3000 (internal), 3001 (internal)

## Initial Setup

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install nginx + certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Install SQLite
apt-get install -y sqlite3
```

## Build & Deploy

```bash
cd /root/htp/crates
export PATH="$HOME/.cargo/bin:$PATH"
cargo build --release -p htp-server

# Deploy binary
cp target/release/htp-server /root/htp-server-bin

# Start via PM2
pm2 delete htp-server 2>/dev/null
pm2 start /root/htp-server-bin --name htp-server --cwd /root/htp
pm2 start /root/htp/orders-api.js --name htp-orders
pm2 save
```

## nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name hightable.pro;

    ssl_certificate     /etc/letsencrypt/live/hightable.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hightable.pro/privkey.pem;

    root /root/htp/public;
    index index.html;

    # API proxy → Rust server
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin "https://hightable.pro";
    }

    # Orders API proxy
    location /api/orders {
        proxy_pass http://127.0.0.1:3001;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Database Initialization

```bash
sqlite3 /root/htp/htp.db < scripts/init_schema.sql
```

## SSL Certificate

```bash
certbot --nginx -d hightable.pro -d www.hightable.pro
# Auto-renew is set up by certbot
```

## Vercel CDN Mirror

```bash
cd /root/htp/public
npx vercel --token $VERCEL_TOKEN --prod --yes
```

## Monitoring

```bash
# Check all services
pm2 list
curl -s https://hightable.pro/health
curl -s https://hightable.pro/api/oracle/network
curl -s https://hightable.pro/api/maximizer/stats
curl -s https://hightable.pro/api/settler/status

# Tail logs
pm2 logs htp-server --lines 50
pm2 logs htp-orders --lines 50
```

## Backup

```bash
# Backup database
cp /root/htp/htp.db /backups/htp-$(date +%Y%m%d-%H%M).db

# Backup public
tar -czf /backups/public-$(date +%Y%m%d).tar.gz /root/htp/public
```
