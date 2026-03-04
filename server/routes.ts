import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertDeviceSchema, insertDeviceLogSchema, insertConfigPresetSchema } from "@shared/schema";

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

  return httpServer;
}
