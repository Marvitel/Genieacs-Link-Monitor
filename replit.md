# NetControl ACS - Network Management System

## Overview
NetControl ACS is a web-based network management system designed to replace Flashman. Built on top of GenieACS, it provides device management, diagnostics, monitoring, and configuration for ISP customers. Supports ONT/ONU, MikroTik, Mesh routers, Ruijie, and other network devices.

## Architecture
- **Frontend**: React + TypeScript + Vite + Shadcn UI + TailwindCSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **ACS Engine**: GenieACS (CWMP/TR-069)
- **Deployment**: Docker Compose (production datacenter)

## Project Structure
```
client/src/
  components/
    app-sidebar.tsx       - Main navigation sidebar
    theme-provider.tsx    - Dark/light theme
    stat-card.tsx         - Dashboard stat cards
    device-status-badge.tsx - Status/type badges
    ui/                   - Shadcn UI components
  pages/
    dashboard.tsx         - Main dashboard with stats and charts
    devices.tsx           - Device list with search/filters
    device-detail.tsx     - Device detail with diagnostics
    clients.tsx           - Client management
    client-detail.tsx     - Client detail with linked devices
    diagnostics.tsx       - Network event logs
    presets.tsx            - Configuration presets
    topology.tsx          - Network topology view
    settings.tsx          - System settings + GenieACS setup/sync
  hooks/
    use-page-title.ts     - SEO page title management
server/
  db.ts                   - Database connection
  storage.ts              - Data access layer (IStorage interface)
  routes.ts               - API endpoints (local + GenieACS proxy)
  genieacs.ts             - GenieACS NBI API client
  genieacs-setup.ts       - GenieACS auto-configuration (provisions + presets)
  seed.ts                 - Seed data
shared/
  schema.ts               - Drizzle schemas + types
deploy/
  docker-compose.yml      - Full stack deployment
  Dockerfile              - NetControl panel container
  nginx/nginx.conf        - Reverse proxy config
  scripts/install.sh      - Installation script
  scripts/update.sh       - Update script from GitHub
  .env.example            - Environment variables template
```

## Database Tables
- **users** - System users
- **clients** - ISP customers (residential/corporate)
- **devices** - Network devices (ONT, router, mesh, switch, OLT)
- **device_logs** - Device event logs
- **config_presets** - Configuration templates

## API Endpoints
### Local CRUD
- `/api/clients` - Client management
- `/api/devices` - Device management
- `/api/device-logs` - Event logs
- `/api/config-presets` - Config presets

### Device Actions (uses genieId from local DB)
- `/api/devices/:id/reboot` - Reboot via GenieACS
- `/api/devices/:id/refresh` - Refresh parameters via GenieACS
- `/api/devices/:id/factory-reset` - Factory reset via GenieACS
- `/api/devices/:id/diagnostic` - Run ping/traceroute via TR-069
- `/api/devices/:id/diagnostic/:type` - Get diagnostic results
- `/api/devices/:id/wifi-config` - Set WiFi SSID/password (2.4G + 5G)
- `/api/devices/:id/pppoe-config` - Set PPPoE credentials
- `/api/devices/:id/firmware-update` - Push firmware via TR-069
- `/api/devices/:id/set-parameter` - Set any TR-069 parameter
- `/api/devices/:id/parameters` - Read device parameters
- `/api/devices/:id/tasks` - List pending GenieACS tasks

### GenieACS Direct API
- `/api/genieacs/status` - Connection + setup status
- `/api/genieacs/setup` - Auto-configure GenieACS (provisions + presets)
- `/api/genieacs/devices` - List GenieACS devices
- `/api/genieacs/sync` - Sync GenieACS devices to local DB (sets genieId)

## GenieACS Auto-Setup
The system creates these provisions and presets automatically via NBI API:

### Provisions (7 scripts)
- **netcontrol-inform** - Device info (firmware, uptime, serial, manufacturer)
- **netcontrol-wan** - WAN IP/PPP connections (IP, MAC, PPPoE user, status)
- **netcontrol-wifi** - Wi-Fi config (SSID, channel, encryption, clients)
- **netcontrol-pon** - GPON optical signal (RX/TX power, temperature, voltage)
- **netcontrol-lan** - LAN hosts and DHCP config
- **netcontrol-diagnostics** - Ping, traceroute, speed diagnostics
- **netcontrol-set-inform** - Sets periodic inform interval on CPE

### Presets (4 rules)
- **netcontrol-bootstrap** - Runs all provisions on first connect + sets inform interval
- **netcontrol-periodic** - Runs core provisions on each periodic inform
- **netcontrol-boot** - Runs all provisions on device boot
- **netcontrol-value-change** - Runs WAN/PON on parameter changes

## GenieACS Deployment (deploy/genieacs/)
Runs on dedicated server 191.52.255.46 via Docker Compose:
- MongoDB 4.4 (no AVX required)
- GenieACS CWMP (internal, via Nginx)
- GenieACS NBI (port 7557)
- GenieACS FS (port 7567)
- GenieACS UI (port 3001)
- Nginx (SSL termination, port 7547 HTTPS + port 80)
- Certbot (Let's Encrypt auto-renewal)

### SSL/HTTPS Setup
ONUs connect via `https://flashman.marvitel.com.br:7547`
- Nginx terminates SSL and proxies to GenieACS CWMP
- Let's Encrypt certificate via `configurar-ssl.sh`
- Auto-renewal every 12h via Certbot container
- Supports TLS 1.0-1.3 for legacy ONUs
- Path `/tr069` works (GenieACS accepts any path)

### Files
- docker-compose.yml - All services including Nginx/Certbot
- instalar.sh - Initial server setup
- configurar-ssl.sh - SSL certificate setup
- nginx/cwmp.conf - Nginx config with SSL
- nginx/cwmp-inicial.conf - Temp config for cert generation

## NetControl Deployment
Production deployment uses Docker Compose with:
- PostgreSQL (NetControl database)
- NetControl Panel (port 3000)
- Nginx (reverse proxy, ports 80/443)

## Device Types Supported
ONT/ONU, Router, Mesh, Switch, OLT

## Manufacturers Supported
Huawei, ZTE, Fiberhome, MikroTik, Ruijie, TP-Link, Intelbras, Parks, Datacom
