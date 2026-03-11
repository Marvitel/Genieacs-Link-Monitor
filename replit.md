# NetControl ACS - Network Management System

## Overview
NetControl ACS is a web-based network management system designed to replace Flashman, built on GenieACS. It provides comprehensive device management, diagnostics, monitoring, and configuration capabilities for various ISP customer devices, including ONT/ONU, MikroTik, Mesh routers, and Ruijie. The project aims to streamline network operations, enhance customer service, and support a wide range of network hardware.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. Do not make changes to files outside the `client/`, `server/`, `shared/`, and `deploy/` directories.

## System Architecture
NetControl ACS utilizes a modern web stack.
- **Frontend**: Developed with React, TypeScript, Vite, Shadcn UI, and TailwindCSS for a responsive and intuitive user interface.
- **Backend**: Built using Express.js and TypeScript, providing a robust API layer.
- **Database**: PostgreSQL is used for data persistence, managed with Drizzle ORM.
- **ACS Engine**: GenieACS serves as the core CWMP/TR-069 engine for device communication.
- **Deployment**: The entire system is containerized using Docker Compose for simplified deployment in production datacenters.
- **UI/UX**: The application employs Shadcn UI and TailwindCSS for a consistent and modern design aesthetic, focusing on clarity and ease of use.
- **Authentication & Authorization**: Session-based authentication with `express-session` and `PgStore` is implemented. It supports role-based access control (admin, operator, viewer), API key token authentication (x-api-key header), and Basic Auth credentials (username/password) for external integrations like Voalle. Both token and Basic Auth credentials are managed via Settings > API Keys UI.
- **GenieACS Integration**: The system includes extensive auto-setup capabilities for GenieACS, creating provisions and presets to manage various device parameters efficiently while critically avoiding `too_many_commits` issues by careful channel and value declaration strategies. All provisions detect TR-181 devices via `DeviceID.ProductClass` (TP-Link models) AND `DeviceID.Manufacturer` (MikroTik). MikroTik devices skip WiFi, GPON, VoIP provisions. Diagnostics (ping/traceroute/speedtest) use `Device.IP.Diagnostics.*` for TR-181 and `InternetGatewayDevice.*Diagnostics` for TR-098. GenieACS NBI provision PUT API expects raw script body (not JSON).
- **Device Configuration Management**: Features include config backup, restore, and auto-restore after factory reset. This is achieved by storing device configurations and applying them via TR-069 setParameterValues tasks.
- **ONT Migration/Replacement**: The system supports migrating configurations from an old ONT to a new one, streamlining device replacements.
- **Supported Devices**: The system is designed to support a wide array of devices including ONT/ONU, Router, Mesh, Switch, and OLT from manufacturers like Huawei, ZTE, Fiberhome, MikroTik, Ruijie, TP-Link, Intelbras, Parks, and Datacom.
- **GPON Serial**: Auto-calculated from the WAN PPPoE MAC address during sync. For TP-Link: `TPLG` (54504C47 hex) + MAC bytes [2][3][4][0]. Example: WAN MAC `E0:D3:62:62:E3:E3` → GPON SN `54504C476262E3E0`. The WAN MAC is read from `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{1-10}.WANPPPConnection.1.MACAddress`. Field is editable manually if auto-calculation doesn't match. Only calculated if `gponSerial` is empty (preserves manual entries).
- **ONT↔Mesh Auto-Linking**: Devices are auto-linked by SSID matching (mesh extensor models like EX520/EX141 linked to parent ONTs like XX530v). Known mesh models (EX520, EX141, EX220, AP820, AX1800, AX1800V, 121AC) are auto-reclassified from `ont` to `mesh` during auto-link.

## Deployment

### Production Server (191.52.255.46)
- GenieACS already running on the server (mongo:4.4, no AVX CPU)
- SSL cert at `/etc/letsencrypt/live/flashman.marvitel.com.br/`
- ONUs connect via `https://flashman.marvitel.com.br:7547`

### Deploy NetControl to Production
NetControl is deployed alongside existing GenieACS using `deploy/netcontrol/`:
```bash
# On the production server:
git clone <repo> /opt/netcontrol
cd /opt/netcontrol/deploy/netcontrol
sudo bash instalar.sh    # First install
sudo bash atualizar.sh   # Updates
```

### Deploy Directory Structure
- `deploy/netcontrol/` - **NetControl only** (adds to existing GenieACS server)
  - `docker-compose.yml` - PostgreSQL + NetControl app + Nginx
  - `instalar.sh` - Installation script (checks GenieACS, ports, SSL, builds)
  - `atualizar.sh` - Update script (git pull + rebuild)
  - `nginx/netcontrol.conf` - Nginx reverse proxy with SSL
- `deploy/` - Full stack (GenieACS + NetControl together, for new servers)
- `deploy/genieacs/` - GenieACS only (standalone)

### Environment Variables (Production)
- `DATABASE_URL` - PostgreSQL connection (auto-configured by docker-compose)
- `SESSION_SECRET` - Session signing key (auto-generated on install)
- `GENIEACS_NBI_URL` - Points to `http://host.docker.internal:7557` (existing GenieACS)
- `CWMP_URL` - ACS URL for devices (`https://flashman.marvitel.com.br:7547`)

## External Dependencies
- **GenieACS**: The primary external system for CWMP/TR-069 device management.
- **PostgreSQL**: Used as the main database for the NetControl application.
- **MongoDB**: Used by GenieACS for its data storage.
- **Nginx**: Serves as a reverse proxy for both the NetControl panel and GenieACS, handling SSL termination.
- **Certbot**: Utilized for automatic management and renewal of Let's Encrypt SSL certificates for secure communication.