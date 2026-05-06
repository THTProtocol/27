#!/bin/bash
# HTP Server crash monitor — runs as systemd oneshot on service failure
BOT_TOKEN="${HTP_TG_BOT_TOKEN:-}"
CHAT_ID="${HTP_TG_CHAT_ID:-}"
HOST=$(hostname)
MSG="⚠️ HTP Server CRASHED on ${HOST} at $(date). Attempting restart..."
if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
  curl -sk "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}&text=${MSG}" > /dev/null
fi
echo "[HTP Monitor] $(date) — crash detected" >> /var/log/htp-monitor.log
