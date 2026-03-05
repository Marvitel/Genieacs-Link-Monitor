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

### Provisions (9 scripts)
- **default** - Optimized hourly refresh of basic params (HW/SW version, WAN IP, WiFi SSID, hosts). Replaces original default to avoid too_many_commits. Uses {value: hourly} NOT {path: now}
- **inform** - Connection request auth (username=DeviceID, random password) + PeriodicInformEnable + PeriodicInformInterval=300s. No PeriodicInformTime (Datacom rejects it)
- **netcontrol-inform** - Device info (firmware, uptime, serial, manufacturer, memory, CPU)
- **netcontrol-wan** - WAN IP/PPP connections. Path discovery {path: hourly} to avoid loops. Values refreshed every inform
- **netcontrol-wifi** - Wi-Fi config (SSID, channel, KeyPassphrase with {value: 1})
- **netcontrol-pon** - GPON optical signal. Direct value requests for all known paths + hourly path discovery for 3 main prefixes only
- **netcontrol-lan** - LAN hosts and DHCP config
- **netcontrol-diagnostics** - Ping, traceroute, speed diagnostics
- **netcontrol-set-inform** - Sets periodic inform interval on CPE (legacy, functionality now in inform provision)

### Critical Design: Avoiding too_many_commits
- All presets use SAME channel "netcontrol" to prevent multi-channel loops
- Removed VALUE CHANGE preset (caused path discovery → value change → preset trigger → loop)
- Path discovery uses {path: hourly} not {path: now} to limit getParameterNames calls
- PON provision requests specific leaf values ({value: now}) for known paths instead of wildcard discovery
- Removed standalone "default", "inform", "bootstrap" presets that conflicted with netcontrol presets

### PON Data Discovery
The extractDeviceInfo uses a dual approach:
1. Static paths: 13+ paths per metric (RX/TX/Temp/Voltage) covering all known manufacturer prefixes
2. Dynamic scanner (findPonData): Recursively traverses the device tree looking for any key containing "gpon", "pon", or "optical" and extracts RXPower, TXPower, Temperature, Voltage values regardless of exact path

### Known PON Path Variants
- Intelbras: X_GponInterafceConfig (typo in firmware) - WANDevice.1. Values already in dBm
- ZTE: X_ZTE-COM_GponInterfaceConfig + X_ZTE-COM_WANPONInterfaceConfig - WANDevice.2
- TP-Link XX530v/Device2/EX520: Device.Optical.Interface.1.X_TP_GPON_Config (RXPower, TXPower, TransceiverTemperature, SupplyVottage with typo). Values in raw units: RX/TX = 10*log10(value/10000) for dBm, Temp = value/256 for °C, Volt = value/1000 for V
- Huawei: X_HW_GponInterfaceConfig or via InternetGatewayDevice paths
- Datacom DM985-424: WANDevice.1.X_CT-COM_GponInterfaceConfig (CT-COM namespace). RXPower/TXPower in raw µW*10 (same formula as TP-Link: 10*log10(v/10000) for dBm). TransceiverTemperature already in °C. SupplyVottage (typo) in raw /10000 for V
- Datacom DM986-414/416: WANDevice.1.X_GponInterafceConfig (same typo as Intelbras) + X_CT-COM_GponInterfaceConfig. Values already in dBm via X_GponInterafceConfig
- TP-Link: Both TR098 and TR181 trees enabled. OpticalSignalLevel/TransmitOpticalLevel always return 0 (firmware limitation). Real data only via X_TP_GPON_Config proprietary path

### Live Device Info (extractLiveDeviceInfo)
Full real-time device data from GenieACS:
- Connected hosts (up to 200, TR-098 + TR-181)
- Ethernet ports (up to 8, status/speed/duplex)
- WAN connections (PPPoE + IPoE, up to 10 WCDs x 4 connections each)
- VoIP lines (up to 4)
- LAN config (gateway IP, subnet, DHCP range)
- WiFi enabled status (2.4G + 5G)
- Memory/CPU usage

### Full Device Refresh (genieRefreshFullDevice)
Sends 4 groups of getParameterValues tasks to force full data refresh:
- DeviceInfo (IGD + Device)
- WANDevice + IP/PPP
- LANDevice + Hosts + Ethernet
- Services

### VoIP Support
- Provision `netcontrol-voip` collects VoiceService data from TR-098 devices
- Paths: `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.{1,2}.Line.{1,2}.*`
- SIP settings per profile: ProxyServer, RegistrarServer, OutboundProxy, UserAgentDomain (+ ports)
- Line settings: Enable, DirectoryNumber, SIP.AuthUserName, SIP.AuthPassword, SIP.URI
- Edit endpoint: POST `/api/devices/:id/voip-config` with profileIndex, lineIndex, and SIP fields
- Frontend: VoipLineCard component with view/edit toggle per line, enable/disable toggle

### Presets (3 rules - all channel "netcontrol")
- **netcontrol-bootstrap** - BOOTSTRAP event: inform + all provisions (full data collection)
- **netcontrol-periodic** - PERIODIC event: inform + netcontrol-inform + netcontrol-pon + netcontrol-voip
- **netcontrol-boot** - BOOT event: inform + all provisions (full data collection)

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
