process.env.TZ = "America/Sao_Paulo";

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { ensureAdminExists } from "./auth";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: false,
  errorLog: (err: Error) => {
    console.error("PgStore error:", err.message);
  },
});
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "netcontrol-default-secret",
    resave: true,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  if (process.env.NODE_ENV !== "production") {
    await seedDatabase().catch(console.error);
  }
  await ensureAdminExists().catch(console.error);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  const recordNetworkSnapshot = async () => {
    try {
      const { storage } = await import("./storage");
      const allDevices = await storage.getDevices();
      const online = allDevices.filter(d => d.status === "online").length;
      const offline = allDevices.filter(d => d.status === "offline").length;
      const warning = allDevices.filter(d => d.status === "warning").length;
      await storage.createNetworkSnapshot({
        onlineCount: online,
        offlineCount: offline,
        warningCount: warning,
        totalCount: allDevices.length,
      });
    } catch (e) {
      console.error("[Snapshot] Error recording network snapshot:", e);
    }
  };

  const autoSyncGenieDevices = async () => {
    try {
      const { storage } = await import("./storage");
      const { genieGetDevices, extractDeviceInfo, calculateGponSerial } = await import("./genieacs");

      const genieDevices = await genieGetDevices();
      const allDevices = await storage.getDevices();
      let synced = 0;

      for (const gDevice of genieDevices) {
        const info = extractDeviceInfo(gDevice);
        if (!info.serialNumber) continue;

        const existing = allDevices.find(d => d.serialNumber === info.serialNumber);
        const isOnline = info.lastInform && (Date.now() - new Date(info.lastInform).getTime()) < 600000;
        const uptimeStr = info.uptime ? `${Math.floor(Number(info.uptime) / 86400)}d ${Math.floor((Number(info.uptime) % 86400) / 3600)}h` : null;

        if (existing) {
          const updates: Record<string, unknown> = {
            genieId: info.genieId,
            status: isOnline ? "online" : "offline",
            firmwareVersion: info.firmwareVersion || existing.firmwareVersion,
            hardwareVersion: info.hardwareVersion || existing.hardwareVersion,
            ipAddress: info.ipAddress || existing.ipAddress,
            macAddress: info.macAddress || existing.macAddress,
            rxPower: info.rxPower !== null ? info.rxPower : existing.rxPower,
            txPower: info.txPower !== null ? info.txPower : existing.txPower,
            temperature: info.temperature !== null ? info.temperature : existing.temperature,
            voltage: info.voltage !== null ? info.voltage : existing.voltage,
            ssid: info.ssid || existing.ssid,
            ssid5g: info.ssid5g || existing.ssid5g,
            wifiChannel: info.wifiChannel || existing.wifiChannel,
            wifiChannel5g: info.wifiChannel5g || existing.wifiChannel5g,
            pppoeUser: info.pppoeUser || existing.pppoeUser,
            connectionType: info.connectionType || existing.connectionType,
            lastSeen: info.lastInform ? new Date(info.lastInform) : existing.lastSeen,
            uptime: uptimeStr || existing.uptime,
          };

          if (!existing.gponSerial && info.wanMacAddress) {
            const calculatedGpon = calculateGponSerial(info.manufacturer, info.wanMacAddress);
            if (calculatedGpon) updates.gponSerial = calculatedGpon;
          }

          await storage.updateDevice(existing.id, updates);
        } else {
          let deviceType: string = "ont";
          const mfr = info.manufacturer.toLowerCase();
          if (mfr.includes("mikrotik")) deviceType = "router";
          else if (mfr.includes("ruijie")) deviceType = "mesh";

          const newDeviceData: Record<string, unknown> = {
            genieId: info.genieId,
            serialNumber: info.serialNumber,
            model: info.model || "Unknown",
            manufacturer: info.manufacturer || "Unknown",
            deviceType,
            macAddress: info.macAddress || null,
            ipAddress: info.ipAddress || null,
            status: isOnline ? "online" : "offline",
            firmwareVersion: info.firmwareVersion || null,
            hardwareVersion: info.hardwareVersion || null,
            ssid: info.ssid || null,
            ssid5g: info.ssid5g || null,
            wifiChannel: info.wifiChannel || null,
            wifiChannel5g: info.wifiChannel5g || null,
            pppoeUser: info.pppoeUser || null,
            connectionType: info.connectionType || null,
            rxPower: info.rxPower,
            txPower: info.txPower,
            temperature: info.temperature,
            voltage: info.voltage,
            lastSeen: info.lastInform ? new Date(info.lastInform) : null,
            uptime: uptimeStr,
          };

          if (info.wanMacAddress) {
            const calculatedGpon = calculateGponSerial(info.manufacturer, info.wanMacAddress);
            if (calculatedGpon) newDeviceData.gponSerial = calculatedGpon;
          }

          await storage.createDevice(newDeviceData as Parameters<typeof storage.createDevice>[0]);
        }
        synced++;
      }

      const updatedDevices = await storage.getDevices();
      const snapOnline = updatedDevices.filter(d => d.status === "online").length;
      const snapOffline = updatedDevices.filter(d => d.status === "offline").length;
      const snapWarning = updatedDevices.filter(d => d.status === "warning").length;
      await storage.createNetworkSnapshot({
        onlineCount: snapOnline,
        offlineCount: snapOffline,
        warningCount: snapWarning,
        totalCount: updatedDevices.length,
      }).catch(() => {});

      console.log(`[AutoSync] ${synced} dispositivos sincronizados, total: ${updatedDevices.length}`);
    } catch (e) {
      console.error("[AutoSync] Error syncing GenieACS devices:", e);
    }
  };

  setTimeout(recordNetworkSnapshot, 10000);
  setTimeout(autoSyncGenieDevices, 15000);
  setInterval(recordNetworkSnapshot, 15 * 60 * 1000);
  setInterval(autoSyncGenieDevices, 15 * 60 * 1000);
})();
