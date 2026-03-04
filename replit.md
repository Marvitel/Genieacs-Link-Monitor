# NetControl ACS - Network Management System

## Overview
NetControl ACS is a web-based network management system designed to replace Flashman. It provides device management, diagnostics, monitoring, and configuration for ISP customers, supporting ONT/ONU, MikroTik, Mesh routers, Ruijie, and other network devices.

## Architecture
- **Frontend**: React + TypeScript + Vite + Shadcn UI + TailwindCSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)
- **State**: TanStack React Query

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
    settings.tsx          - System settings
server/
  db.ts                   - Database connection
  storage.ts              - Data access layer (IStorage interface)
  routes.ts               - API endpoints
  seed.ts                 - Seed data
shared/
  schema.ts               - Drizzle schemas + types
```

## Database Tables
- **users** - System users
- **clients** - ISP customers (residential/corporate)
- **devices** - Network devices (ONT, router, mesh, switch, OLT)
- **device_logs** - Device event logs
- **config_presets** - Configuration templates

## Key Features
- Dashboard with network availability charts and device stats
- Device management with Flashman-compatible configs
- Client management (residential + corporate)
- Network diagnostics and event logging
- Configuration presets/templates
- Network topology visualization
- Link Monitor integration settings
- Dark/light theme support

## Device Types Supported
ONT/ONU, Router, Mesh, Switch, OLT

## Manufacturers Supported
Huawei, ZTE, Fiberhome, MikroTik, Ruijie, TP-Link, Intelbras, Parks, Datacom
