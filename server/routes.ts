import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertClientSchema, insertDeviceSchema, insertDeviceLogSchema, insertConfigPresetSchema } from "@shared/schema";
import {
  genieGetDevices,
  genieGetDevice,
  genieRebootDevice,
  genieRefreshDevice,
  genieFactoryReset,
  genieSetDeviceParameter,
  genieGetTasks,
  genieDeleteDevice,
  genieGetPresets,
  genieGetFiles,
  extractDeviceInfo,
  isGenieACSConfigured,
  genieCheckConnectivity,
  GenieACSError,
} from "./genieacs";
import { setupGenieACS, getGenieACSSetupStatus } from "./genieacs-setup";

function handleGenieError(error: unknown, res: import("express").Response) {
  if (error instanceof GenieACSError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return res.status(502).json({ message: `Erro ao comunicar com GenieACS: ${message}` });
}

const setParameterSchema = z.object({
  parameterPath: z.string().min(1, "parameterPath é obrigatório"),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const refreshSchema = z.object({
  objectPath: z.string().optional().default(""),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const client = await storage.createClient(parsed.data);
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const parsed = insertClientSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateClient(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(updated);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    await storage.deleteClient(req.params.id);
    res.status(204).end();
  });

  app.get("/api/devices", async (_req, res) => {
    const devices = await storage.getDevices();
    res.json(devices);
  });

  app.get("/api/devices/:id", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    res.json(device);
  });

  app.post("/api/devices", async (req, res) => {
    const parsed = insertDeviceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const device = await storage.createDevice(parsed.data);
    res.status(201).json(device);
  });

  app.patch("/api/devices/:id", async (req, res) => {
    const parsed = insertDeviceSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateDevice(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Dispositivo não encontrado" });
    res.json(updated);
  });

  app.delete("/api/devices/:id", async (req, res) => {
    await storage.deleteDevice(req.params.id);
    res.status(204).end();
  });

  app.post("/api/devices/:id/reboot", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    await storage.createDeviceLog({
      deviceId: device.id,
      eventType: "reboot",
      message: `Comando de reboot enviado para ${device.manufacturer} ${device.model} (${device.serialNumber})`,
      severity: "info",
    });
    res.json({ message: "Reboot command sent" });
  });

  app.get("/api/device-logs", async (req, res) => {
    const deviceId = req.query.deviceId as string | undefined;
    const logs = await storage.getDeviceLogs(deviceId);
    res.json(logs);
  });

  app.post("/api/device-logs", async (req, res) => {
    const parsed = insertDeviceLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const log = await storage.createDeviceLog(parsed.data);
    res.status(201).json(log);
  });

  app.get("/api/config-presets", async (_req, res) => {
    const presets = await storage.getConfigPresets();
    res.json(presets);
  });

  app.get("/api/config-presets/:id", async (req, res) => {
    const preset = await storage.getConfigPreset(req.params.id);
    if (!preset) return res.status(404).json({ message: "Preset não encontrado" });
    res.json(preset);
  });

  app.post("/api/config-presets", async (req, res) => {
    const parsed = insertConfigPresetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const preset = await storage.createConfigPreset(parsed.data);
    res.status(201).json(preset);
  });

  app.patch("/api/config-presets/:id", async (req, res) => {
    const parsed = insertConfigPresetSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateConfigPreset(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Preset não encontrado" });
    res.json(updated);
  });

  app.delete("/api/config-presets/:id", async (req, res) => {
    await storage.deleteConfigPreset(req.params.id);
    res.status(204).end();
  });

  app.get("/api/genieacs/status", async (_req, res) => {
    const configured = isGenieACSConfigured();
    let connected = false;
    let setup = null;
    if (configured) {
      connected = await genieCheckConnectivity();
      if (connected) {
        try {
          setup = await getGenieACSSetupStatus();
        } catch {
          setup = null;
        }
      }
    }
    res.json({
      configured,
      connected,
      url: process.env.GENIEACS_NBI_URL || null,
      setup,
    });
  });

  app.post("/api/genieacs/setup", async (req, res) => {
    try {
      const informInterval = (req.body as { informInterval?: number })?.informInterval || 300;
      const result = await setupGenieACS(informInterval);
      res.json(result);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/setup-status", async (_req, res) => {
    try {
      const status = await getGenieACSSetupStatus();
      res.json(status);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/devices", async (_req, res) => {
    try {
      const devices = await genieGetDevices();
      const mapped = devices.map((d) => extractDeviceInfo(d));
      res.json(mapped);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/devices/:id", async (req, res) => {
    try {
      const device = await genieGetDevice(req.params.id);
      if (!device) return res.status(404).json({ message: "Dispositivo não encontrado no GenieACS" });
      res.json(extractDeviceInfo(device));
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/genieacs/devices/:id/reboot", async (req, res) => {
    try {
      await genieRebootDevice(req.params.id);
      res.json({ message: "Reboot enviado" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/genieacs/devices/:id/refresh", async (req, res) => {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      await genieRefreshDevice(req.params.id, parsed.data.objectPath);
      res.json({ message: "Refresh enviado" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/genieacs/devices/:id/factory-reset", async (req, res) => {
    try {
      await genieFactoryReset(req.params.id);
      res.json({ message: "Factory reset enviado" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/genieacs/devices/:id/set-parameter", async (req, res) => {
    try {
      const parsed = setParameterSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      await genieSetDeviceParameter(req.params.id, parsed.data.parameterPath, parsed.data.value);
      res.json({ message: "Parâmetro definido" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/devices/:id/tasks", async (req, res) => {
    try {
      const tasks = await genieGetTasks(req.params.id);
      res.json(tasks);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.delete("/api/genieacs/devices/:id", async (req, res) => {
    try {
      await genieDeleteDevice(req.params.id);
      res.status(204).end();
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/presets", async (_req, res) => {
    try {
      const presets = await genieGetPresets();
      res.json(presets);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/files", async (_req, res) => {
    try {
      const files = await genieGetFiles();
      res.json(files);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/genieacs/sync", async (_req, res) => {
    try {
      const genieDevices = await genieGetDevices();
      let synced = 0;
      for (const gDevice of genieDevices) {
        const info = extractDeviceInfo(gDevice);
        if (!info.serialNumber) continue;

        const existing = (await storage.getDevices()).find(
          (d) => d.serialNumber === info.serialNumber
        );

        if (existing) {
          await storage.updateDevice(existing.id, {
            status: info.lastInform && (Date.now() - new Date(info.lastInform).getTime()) < 600000 ? "online" : "offline",
            firmwareVersion: info.firmwareVersion || existing.firmwareVersion,
            ipAddress: info.ipAddress || existing.ipAddress,
            macAddress: info.macAddress || existing.macAddress,
            rxPower: info.rxPower !== null ? info.rxPower : existing.rxPower,
            txPower: info.txPower !== null ? info.txPower : existing.txPower,
            temperature: info.temperature !== null ? info.temperature : existing.temperature,
            ssid: info.ssid || existing.ssid,
            pppoeUser: info.pppoeUser || existing.pppoeUser,
            lastSeen: info.lastInform ? new Date(info.lastInform) : existing.lastSeen,
            uptime: info.uptime ? `${Math.floor(Number(info.uptime) / 86400)}d ${Math.floor((Number(info.uptime) % 86400) / 3600)}h` : existing.uptime,
          });
        } else {
          let deviceType: string = "ont";
          const mfr = info.manufacturer.toLowerCase();
          if (mfr.includes("mikrotik")) deviceType = "router";
          else if (mfr.includes("ruijie")) deviceType = "mesh";

          await storage.createDevice({
            serialNumber: info.serialNumber,
            model: info.model || "Unknown",
            manufacturer: info.manufacturer || "Unknown",
            deviceType,
            macAddress: info.macAddress || null,
            ipAddress: info.ipAddress || null,
            status: info.lastInform && (Date.now() - new Date(info.lastInform).getTime()) < 600000 ? "online" : "offline",
            firmwareVersion: info.firmwareVersion || null,
            ssid: info.ssid || null,
            pppoeUser: info.pppoeUser || null,
            rxPower: info.rxPower,
            txPower: info.txPower,
            temperature: info.temperature,
            lastSeen: info.lastInform ? new Date(info.lastInform) : null,
            uptime: info.uptime ? `${Math.floor(Number(info.uptime) / 86400)}d ${Math.floor((Number(info.uptime) % 86400) / 3600)}h` : null,
          });
        }
        synced++;
      }
      res.json({ message: `Sincronização concluída: ${synced} dispositivos processados`, synced });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  return httpServer;
}
