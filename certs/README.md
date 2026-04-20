# TLS Certificates

Place your SSL certificates here for HTTPS:
- fullchain.pem
- privkey.pem

For Let's Encrypt:
  certbot certonly --standalone -d your-domain.com
  cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./certs/
  cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./certs/

Then uncomment the HTTPS server block in nginx.conf.
