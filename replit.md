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
- **Authentication & Authorization**: Session-based authentication with `express-session` and `PgStore` is implemented. It supports role-based access control (admin, operator, viewer) and API key authentication for external integrations.
- **GenieACS Integration**: The system includes extensive auto-setup capabilities for GenieACS, creating provisions and presets to manage various device parameters efficiently while critically avoiding `too_many_commits` issues by careful channel and value declaration strategies.
- **Device Configuration Management**: Features include config backup, restore, and auto-restore after factory reset. This is achieved by storing device configurations and applying them via TR-069 setParameterValues tasks.
- **ONT Migration/Replacement**: The system supports migrating configurations from an old ONT to a new one, streamlining device replacements.
- **Supported Devices**: The system is designed to support a wide array of devices including ONT/ONU, Router, Mesh, Switch, and OLT from manufacturers like Huawei, ZTE, Fiberhome, MikroTik, Ruijie, TP-Link, Intelbras, Parks, and Datacom.

## External Dependencies
- **GenieACS**: The primary external system for CWMP/TR-069 device management.
- **PostgreSQL**: Used as the main database for the NetControl application.
- **MongoDB**: Used by GenieACS for its data storage.
- **Nginx**: Serves as a reverse proxy for both the NetControl panel and GenieACS, handling SSL termination.
- **Certbot**: Utilized for automatic management and renewal of Let's Encrypt SSL certificates for secure communication.