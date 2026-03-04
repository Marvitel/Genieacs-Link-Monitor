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
    settings.tsx          - System settings + GenieACS sync
  hooks/
    use-page-title.ts     - SEO page title management
server/
  db.ts                   - Database connection
  storage.ts              - Data access layer (IStorage interface)
  routes.ts               - API endpoints (local + GenieACS proxy)
  genieacs.ts             - GenieACS NBI API integration
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

### GenieACS Integration
- `/api/genieacs/status` - Connection status
- `/api/genieacs/devices` - List GenieACS devices
- `/api/genieacs/devices/:id/reboot` - Reboot via TR-069
- `/api/genieacs/devices/:id/refresh` - Refresh parameters
- `/api/genieacs/devices/:id/factory-reset` - Factory reset
- `/api/genieacs/devices/:id/set-parameter` - Set TR-069 parameter
- `/api/genieacs/sync` - Sync GenieACS devices to local DB

## Deployment
Production deployment uses Docker Compose with:
- MongoDB (GenieACS database)
- GenieACS CWMP (port 7547)
- GenieACS NBI (port 7557)
- GenieACS FS (port 7567)
- PostgreSQL (NetControl database)
- NetControl Panel (port 3000)
- Nginx (reverse proxy, ports 80/443)

## Device Types Supported
ONT/ONU, Router, Mesh, Switch, OLT

## Manufacturers Supported
Huawei, ZTE, Fiberhome, MikroTik, Ruijie, TP-Link, Intelbras, Parks, Datacom
