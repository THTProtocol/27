# HTP API Reference

Base URL: `https://hightable.duckdns.org`

## Health
GET /health → `{"engine":"rust","status":"ok","version":"0.1.0"}`

## Config
GET /api/config → `{"network":"tn12","version":"rust-1.0","wsUrl":"wss://..."}`

## Games
GET /api/games → `{"count":N,"games":[...]}`
GET /api/games/:id → single game JSON
POST /api/games/:id/propose → `{"status":"attested","attestation_hash":"..."}`
POST /api/games/:id/challenge → challenge outcome
POST /api/games/:id/settle → settle game

## Balance
GET /api/balance/:address → `{"balance_kas":X.XX,"balance_sompi":N}`

## Covenants
GET /api/covenants/deployed → deployed contract metadata

## Admin
GET /api/admin/stats → `{"games_total":N,"games_open":N,"games_settled":N}`
