import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertClientSchema, insertDeviceSchema, insertDeviceLogSchema, insertConfigPresetSchema, type SavedDeviceConfig } from "@shared/schema";
import { requireAuth, requireAdmin, requireApiKey, generateApiKey, hashApiKey } from "./auth";
import {
  genieGetDevices,
  genieGetDevice,
  genieRebootDevice,
  genieRefreshDevice,
  genieRefreshFullDevice,
  genieFactoryReset,
  genieSetDeviceParameter,
  genieSetMultipleParameters,
  genieRunDiagnostic,
  genieGetDiagnosticResult,
  genieGetTasks,
  genieDeleteDevice,
  genieGetPresets,
  genieGetFiles,
  genieDeleteFile,
  genieDownloadFirmware,
  genieGetDeviceParameters,
  extractDeviceInfo,
  extractLiveDeviceInfo,
  isGenieACSConfigured,
  genieCheckConnectivity,
  genieClearDeviceFaults,
  genieClearAllFaults,
  GenieACSError,
} from "./genieacs";
import { setupGenieACS, getGenieACSSetupStatus } from "./genieacs-setup";
import { registerFlashmanAPI } from "./flashman-api";

function handleGenieError(error: unknown, res: import("express").Response) {
  if (error instanceof GenieACSError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return res.status(502).json({ message: `Erro ao comunicar com GenieACS: ${message}` });
}

function countConfigSections(config: SavedDeviceConfig | null | undefined): number {
  if (!config) return 0;
  let count = 0;
  if (config.wifi && (config.wifi.ssid || config.wifi.ssid5g)) count++;
  if (config.pppoe && config.pppoe.username) count++;
  if (config.lan && (config.lan.lanIp || config.lan.dhcpStart)) count++;
  if (config.voip && config.voip.length > 0) count++;
  return count;
}

function buildBackupFromBasicInfo(info: { ssid?: string; ssid5g?: string; wifiPassword?: string; wifiPassword5g?: string; wifiChannel?: string; wifiChannel5g?: string; pppoeUser?: string; connectionType?: string }): SavedDeviceConfig {
  const config: SavedDeviceConfig = {};
  if (info.ssid || info.ssid5g) {
    config.wifi = {};
    if (info.ssid) config.wifi.ssid = info.ssid;
    if (info.wifiPassword) config.wifi.password = info.wifiPassword;
    if (info.ssid5g) config.wifi.ssid5g = info.ssid5g;
    if (info.wifiPassword5g) config.wifi.password5g = info.wifiPassword5g;
    if (info.wifiChannel) config.wifi.channel = parseInt(info.wifiChannel) || undefined;
    if (info.wifiChannel5g) config.wifi.channel5g = parseInt(info.wifiChannel5g) || undefined;
  }
  if (info.pppoeUser) {
    config.pppoe = { username: info.pppoeUser };
  }
  return config;
}

function shouldUpdateBackup(existingConfig: SavedDeviceConfig | null | undefined, newConfig: SavedDeviceConfig): boolean {
  const newSections = countConfigSections(newConfig);
  if (newSections === 0) return false;
  const existingSections = countConfigSections(existingConfig as SavedDeviceConfig);
  if (existingSections > newSections) return false;
  return true;
}

const setParameterSchema = z.object({
  parameterPath: z.string().min(1, "parameterPath é obrigatório"),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const setMultipleParametersSchema = z.object({
  parameters: z.array(z.tuple([z.string(), z.union([z.string(), z.number(), z.boolean()])])),
});

const refreshSchema = z.object({
  objectPath: z.string().optional().default(""),
});

const diagnosticSchema = z.object({
  type: z.enum(["ping", "traceroute", "download", "upload"]),
  host: z.string().min(1, "host é obrigatório"),
});

const wifiConfigSchema = z.object({
  ssid: z.string().optional(),
  password: z.string().optional(),
  ssid5g: z.string().optional(),
  password5g: z.string().optional(),
  channel: z.number().optional(),
  channel5g: z.number().optional(),
});

const firmwareSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
    const user = await storage.getUserByUsername(username);
    if (!user || !user.active) {
      console.log(`[Auth] Login failed: user '${username}' ${!user ? 'not found' : 'inactive'}`);
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log(`[Auth] Login failed: invalid password for user '${username}'`);
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    console.log(`[Auth] Login successful: user '${username}'`);
    res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ message: "Logout realizado" });
  });

  app.post("/api/auth/reset-admin", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "";
    const isLocal = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1" || clientIp.includes("172.") || clientIp.includes("192.168.");
    if (!isLocal) return res.status(403).json({ message: "Apenas acesso local" });
    const adminUser = await storage.getUserByUsername("admin");
    const hashedPassword = await bcrypt.hash("admin", 10);
    if (adminUser) {
      await storage.updateUser(adminUser.id, { password: hashedPassword, active: true } as any);
      console.log("[Auth] Admin password reset via local endpoint");
      return res.json({ message: "Senha do admin resetada para 'admin'" });
    }
    await storage.createUser({ username: "admin", password: hashedPassword, displayName: "Administrador", role: "admin", active: true });
    console.log("[Auth] Admin user recreated via local endpoint");
    res.json({ message: "Usuário admin recriado com senha 'admin'" });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.active) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Sessão inválida" });
    }
    res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(4) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias (mínimo 4 caracteres)" });
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: "Senha atual incorreta" });
    await storage.updateUser(user.id, { password: await bcrypt.hash(parsed.data.newPassword, 10) });
    res.json({ message: "Senha alterada com sucesso" });
  });

  app.get("/api/users", requireAdmin, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    const safe = allUsers.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt }));
    res.json(safe);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    const schema = z.object({ username: z.string().min(3), password: z.string().min(4), displayName: z.string().optional(), role: z.enum(["admin", "operator", "viewer"]).default("operator") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getUserByUsername(parsed.data.username);
    if (existing) return res.status(409).json({ message: "Usuário já existe" });
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const user = await storage.createUser({ username: parsed.data.username, password: hashedPassword, displayName: parsed.data.displayName || parsed.data.username, role: parsed.data.role, active: true });
    res.status(201).json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    const schema = z.object({ displayName: z.string().optional(), role: z.enum(["admin", "operator", "viewer"]).optional(), active: z.boolean().optional(), password: z.string().min(4).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updates: any = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;
    if (parsed.data.password) updates.password = await bcrypt.hash(parsed.data.password, 10);
    const updated = await storage.updateUser(req.params.id, updates);
    if (!updated) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json({ id: updated.id, username: updated.username, displayName: updated.displayName, role: updated.role, active: updated.active });
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    if (req.session.userId === req.params.id) return res.status(400).json({ message: "Não é possível excluir seu próprio usuário" });
    await storage.deleteUser(req.params.id);
    res.status(204).end();
  });

  app.get("/api/api-keys", requireAdmin, async (_req, res) => {
    const keys = await storage.getApiKeys();
    const safe = keys.map(k => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, permissions: k.permissions, active: k.active, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt }));
    res.json(safe);
  });

  app.post("/api/api-keys", requireAdmin, async (req, res) => {
    const schema = z.object({ name: z.string().min(1), permissions: z.enum(["read", "read_write", "full"]).default("read") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10) + "...";
    const apiKey = await storage.createApiKey({ name: parsed.data.name, keyHash, keyPrefix, permissions: parsed.data.permissions, createdBy: req.session.userId });
    res.status(201).json({ id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix, permissions: apiKey.permissions });
  });

  app.delete("/api/api-keys/:id", requireAdmin, async (req, res) => {
    await storage.deleteApiKey(req.params.id);
    res.status(204).end();
  });

  app.get("/api/settings", requireAuth, async (_req, res) => {
    const settings = await storage.getSettings();
    const obj: Record<string, string> = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json(obj);
  });

  app.post("/api/settings", requireAdmin, async (req, res) => {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      if (typeof value === "string") await storage.setSetting(key, value);
      else if (typeof value === "boolean" || typeof value === "number") await storage.setSetting(key, String(value));
    }
    res.json({ message: "Configurações salvas" });
  });

  app.post("/api/linkmonitor/test", requireAuth, async (req, res) => {
    const { url, username, password } = req.body;
    if (!url || !username || !password) return res.status(400).json({ success: false, message: "URL, usuário e senha são obrigatórios" });
    try {
      let baseUrl = url.trim();
      if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
      const token = Buffer.from(`${username}:${password}`).toString("base64");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${baseUrl}/api/v3/config`, {
          headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
          res.json({ success: true, message: `Conectado com sucesso (${response.status})` });
        } else if (response.status === 401) {
          res.json({ success: false, message: "Falha na autenticação: usuário ou senha incorretos" });
        } else {
          res.json({ success: false, message: `Erro ${response.status}: ${response.statusText}` });
        }
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === "AbortError") {
          res.json({ success: false, message: "Timeout: servidor não respondeu em 10 segundos" });
        } else {
          res.json({ success: false, message: `Erro de conexão: ${fetchErr.message}` });
        }
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  registerFlashmanAPI(app);

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

  app.get("/api/devices/:id/live", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    try {
      const genieDevice = await genieGetDevice(device.genieId);
      if (!genieDevice) return res.status(404).json({ message: "Dispositivo não encontrado no GenieACS" });
      const liveInfo = extractLiveDeviceInfo(genieDevice);
      res.json(liveInfo);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/reboot", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS. Execute uma sincronização." });

    try {
      await genieRebootDevice(device.genieId);
    } catch (error) {
      return handleGenieError(error, res);
    }

    await storage.createDeviceLog({
      deviceId: device.id,
      eventType: "reboot",
      message: `Comando de reboot enviado para ${device.manufacturer} ${device.model} (${device.serialNumber})`,
      severity: "info",
    });
    res.json({ message: "Reboot enviado" });
  });

  app.post("/api/devices/:id/factory-reset", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS. Execute uma sincronização." });

    try {
      await genieFactoryReset(device.genieId);
    } catch (error) {
      return handleGenieError(error, res);
    }

    await storage.createDeviceLog({
      deviceId: device.id,
      eventType: "factory-reset",
      message: `Factory reset enviado para ${device.manufacturer} ${device.model} (${device.serialNumber})`,
      severity: "warning",
    });
    res.json({ message: "Factory reset enviado" });
  });

  app.post("/api/devices/:id/refresh", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS. Execute uma sincronização." });

    try {
      const result = await genieRefreshFullDevice(device.genieId);
      res.json({
        message: `Atualização completa solicitada: ${result.tasks.length} grupos de parâmetros`,
        tasks: result.tasks,
        errors: result.errors,
      });
      return;
    } catch (error) {
      return handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/diagnostic", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const parsed = diagnosticSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    try {
      await genieRunDiagnostic(device.genieId, parsed.data.type, parsed.data.host);
      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "diagnostic",
        message: `Diagnóstico ${parsed.data.type} iniciado para ${parsed.data.host}`,
        severity: "info",
      });
      res.json({ message: `Diagnóstico ${parsed.data.type} iniciado` });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/devices/:id/diagnostic/:type", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const type = req.params.type as "ping" | "traceroute";
    try {
      const result = await genieGetDiagnosticResult(device.genieId, type);
      res.json(result);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/wifi-config", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const parsed = wifiConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const parameters: Array<[string, string | number | boolean]> = [];
    const updates: Record<string, string | number> = {};
    const igd = "InternetGatewayDevice";

    if (parsed.data.ssid) {
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.1.SSID`, parsed.data.ssid]);
      updates.ssid = parsed.data.ssid;
    }
    if (parsed.data.password) {
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.1.KeyPassphrase`, parsed.data.password]);
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase`, parsed.data.password]);
      updates.wifiPassword = parsed.data.password;
    }
    if (parsed.data.ssid5g) {
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.5.SSID`, parsed.data.ssid5g]);
      updates.ssid5g = parsed.data.ssid5g;
    }
    if (parsed.data.password5g) {
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.5.KeyPassphrase`, parsed.data.password5g]);
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase`, parsed.data.password5g]);
      updates.wifiPassword5g = parsed.data.password5g;
    }
    if (parsed.data.channel !== undefined) {
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.1.Channel`, parsed.data.channel]);
      updates.wifiChannel = String(parsed.data.channel);
    }
    if (parsed.data.channel5g !== undefined) {
      parameters.push([`${igd}.LANDevice.1.WLANConfiguration.5.Channel`, parsed.data.channel5g]);
      updates.wifiChannel5g = String(parsed.data.channel5g);
    }

    if (parameters.length === 0) {
      return res.status(400).json({ message: "Nenhuma configuração informada" });
    }

    try {
      await genieSetMultipleParameters(device.genieId, parameters);

      const currentConfig = (device.savedConfig || {}) as SavedDeviceConfig;
      currentConfig.wifi = {
        ...currentConfig.wifi,
        ...(parsed.data.ssid && { ssid: parsed.data.ssid }),
        ...(parsed.data.password && { password: parsed.data.password }),
        ...(parsed.data.ssid5g && { ssid5g: parsed.data.ssid5g }),
        ...(parsed.data.password5g && { password5g: parsed.data.password5g }),
        ...(parsed.data.channel !== undefined && { channel: parsed.data.channel }),
        ...(parsed.data.channel5g !== undefined && { channel5g: parsed.data.channel5g }),
      };
      updates.savedConfig = currentConfig as unknown as string;
      updates.savedConfigAt = new Date() as unknown as string;

      await storage.updateDevice(device.id, updates);

      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-change",
        message: `Configuração WiFi atualizada: ${Object.keys(parsed.data).filter(k => (parsed.data as Record<string, unknown>)[k]).join(", ")}`,
        severity: "info",
      });

      res.json({ message: "Configuração WiFi enviada" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/pppoe-config", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const schema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      wanDeviceIndex: z.number().min(1).default(1),
      wcdIndex: z.number().min(1).default(1),
      connIndex: z.number().min(1).default(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const { username, password, wanDeviceIndex, wcdIndex, connIndex } = parsed.data;
    const igd = "InternetGatewayDevice";
    const pppBase = `${igd}.WANDevice.${wanDeviceIndex}.WANConnectionDevice.${wcdIndex}.WANPPPConnection.${connIndex}`;
    const parameters: Array<[string, string | number | boolean]> = [
      [`${pppBase}.Username`, username],
      [`${pppBase}.Password`, password],
    ];

    try {
      await genieSetMultipleParameters(device.genieId, parameters);

      const currentConfig = (device.savedConfig || {}) as SavedDeviceConfig;
      currentConfig.pppoe = { username, password, wanDeviceIndex, wcdIndex, connIndex };

      await storage.updateDevice(device.id, {
        pppoeUser: username,
        savedConfig: currentConfig as unknown as Record<string, unknown>,
        savedConfigAt: new Date(),
      } as Record<string, unknown>);
      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-change",
        message: `PPPoE atualizado: ${username} (WD${wanDeviceIndex}.WCD${wcdIndex}.PPP${connIndex})`,
        severity: "info",
      });
      res.json({ message: "Configuração PPPoE enviada" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/lan-config", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const lanSchema = z.object({
      lanIp: z.string().optional(),
      lanSubnet: z.string().optional(),
      dhcpEnabled: z.boolean().optional(),
      dhcpStart: z.string().optional(),
      dhcpEnd: z.string().optional(),
    });
    const parsed = lanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const igd = "InternetGatewayDevice";
    const parameters: Array<[string, string | number | boolean]> = [];
    const changes: string[] = [];

    if (parsed.data.lanIp) {
      parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress`, parsed.data.lanIp]);
      changes.push(`IP: ${parsed.data.lanIp}`);
    }
    if (parsed.data.lanSubnet) {
      parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask`, parsed.data.lanSubnet]);
      parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.SubnetMask`, parsed.data.lanSubnet]);
      changes.push(`Máscara: ${parsed.data.lanSubnet}`);
    }
    if (parsed.data.dhcpEnabled !== undefined) {
      parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.DHCPServerEnable`, parsed.data.dhcpEnabled]);
      changes.push(`DHCP: ${parsed.data.dhcpEnabled ? "Habilitado" : "Desabilitado"}`);
    }
    if (parsed.data.dhcpStart) {
      parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.MinAddress`, parsed.data.dhcpStart]);
      changes.push(`DHCP início: ${parsed.data.dhcpStart}`);
    }
    if (parsed.data.dhcpEnd) {
      parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.MaxAddress`, parsed.data.dhcpEnd]);
      changes.push(`DHCP fim: ${parsed.data.dhcpEnd}`);
    }

    if (parameters.length === 0) return res.status(400).json({ message: "Nenhum parâmetro informado" });

    try {
      await genieSetMultipleParameters(device.genieId, parameters);
      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-change",
        message: `LAN atualizado: ${changes.join(", ")}`,
        severity: "info",
      });
      res.json({ message: "Configuração LAN enviada" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/voip-config", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const voipSchema = z.object({
      profileIndex: z.number().min(1).max(2),
      lineIndex: z.number().min(1).max(2),
      enabled: z.boolean().optional(),
      directoryNumber: z.string().optional(),
      sipAuthUser: z.string().optional(),
      sipAuthPassword: z.string().optional(),
      sipUri: z.string().optional(),
      sipRegistrar: z.string().optional(),
      sipRegistrarPort: z.number().optional(),
      sipProxyServer: z.string().optional(),
      sipProxyPort: z.number().optional(),
      sipOutboundProxy: z.string().optional(),
      sipOutboundProxyPort: z.number().optional(),
      sipDomain: z.string().optional(),
    });
    const parsed = voipSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const { profileIndex: pi, lineIndex: li, ...data } = parsed.data;
    const igd = "InternetGatewayDevice";
    const lineBase = `${igd}.Services.VoiceService.1.VoiceProfile.${pi}.Line.${li}`;
    const sipBase = `${igd}.Services.VoiceService.1.VoiceProfile.${pi}.SIP`;
    const parameters: Array<[string, string | number | boolean]> = [];
    const changes: string[] = [];

    if (data.enabled !== undefined) {
      parameters.push([`${lineBase}.Enable`, data.enabled ? "Enabled" : "Disabled"]);
      changes.push(`Linha ${pi}.${li} ${data.enabled ? "habilitada" : "desabilitada"}`);
    }
    if (data.directoryNumber !== undefined) {
      parameters.push([`${lineBase}.DirectoryNumber`, data.directoryNumber]);
      changes.push(`Número: ${data.directoryNumber}`);
    }
    if (data.sipAuthUser !== undefined) {
      parameters.push([`${lineBase}.SIP.AuthUserName`, data.sipAuthUser]);
      changes.push(`Auth User: ${data.sipAuthUser}`);
    }
    if (data.sipAuthPassword !== undefined) {
      parameters.push([`${lineBase}.SIP.AuthPassword`, data.sipAuthPassword]);
      changes.push(`Auth Password alterado`);
    }
    if (data.sipUri !== undefined) {
      parameters.push([`${lineBase}.SIP.URI`, data.sipUri]);
    }
    if (data.sipRegistrar !== undefined) {
      parameters.push([`${sipBase}.RegistrarServer`, data.sipRegistrar]);
      changes.push(`Registrar: ${data.sipRegistrar}`);
    }
    if (data.sipRegistrarPort !== undefined) {
      parameters.push([`${sipBase}.RegistrarServerPort`, data.sipRegistrarPort]);
    }
    if (data.sipProxyServer !== undefined) {
      parameters.push([`${sipBase}.ProxyServer`, data.sipProxyServer]);
      changes.push(`Proxy: ${data.sipProxyServer}`);
    }
    if (data.sipProxyPort !== undefined) {
      parameters.push([`${sipBase}.ProxyServerPort`, data.sipProxyPort]);
    }
    if (data.sipOutboundProxy !== undefined) {
      parameters.push([`${sipBase}.OutboundProxy`, data.sipOutboundProxy]);
    }
    if (data.sipOutboundProxyPort !== undefined) {
      parameters.push([`${sipBase}.OutboundProxyPort`, data.sipOutboundProxyPort]);
    }
    if (data.sipDomain !== undefined) {
      parameters.push([`${sipBase}.UserAgentDomain`, data.sipDomain]);
    }

    if (parameters.length === 0) {
      return res.status(400).json({ message: "Nenhum parâmetro VoIP informado" });
    }

    try {
      await genieSetMultipleParameters(device.genieId, parameters);
      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-change",
        message: `VoIP atualizado: ${changes.join(", ") || "parâmetros alterados"}`,
        severity: "info",
      });
      res.json({ message: "Configuração VoIP enviada" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/firmware-update", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const parsed = firmwareSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    try {
      await genieDownloadFirmware(device.genieId, parsed.data.fileId, parsed.data.fileName);
      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "firmware-update",
        message: `Atualização de firmware iniciada: ${parsed.data.fileName}`,
        severity: "info",
      });
      res.json({ message: "Atualização de firmware enviada" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/backup-config", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    try {
      const genieDevice = await genieGetDevice(device.genieId);
      if (!genieDevice) return res.status(404).json({ message: "Dispositivo não encontrado no GenieACS" });
      const liveData = extractLiveDeviceInfo(genieDevice);
      const savedConfig: SavedDeviceConfig = {};

      if (liveData.ssid || liveData.ssid5g || liveData.wifiPassword || liveData.wifiPassword5g) {
        savedConfig.wifi = {};
        if (liveData.ssid) savedConfig.wifi.ssid = liveData.ssid;
        if (liveData.wifiPassword) savedConfig.wifi.password = liveData.wifiPassword;
        if (liveData.ssid5g) savedConfig.wifi.ssid5g = liveData.ssid5g;
        if (liveData.wifiPassword5g) savedConfig.wifi.password5g = liveData.wifiPassword5g;
        if (liveData.wifiChannel) savedConfig.wifi.channel = parseInt(liveData.wifiChannel) || undefined;
        if (liveData.wifiChannel5g) savedConfig.wifi.channel5g = parseInt(liveData.wifiChannel5g) || undefined;
      }

      const pppoeConn = liveData.wanConnections?.find((w: { type: string; username?: string }) => w.type === "PPPoE" && w.username);
      if (pppoeConn) {
        savedConfig.pppoe = {
          username: pppoeConn.username,
          vlanId: pppoeConn.vlanId ? parseInt(pppoeConn.vlanId) || undefined : undefined,
          wanDeviceIndex: pppoeConn.wanDeviceIndex,
          wcdIndex: pppoeConn.wcdIndex,
          connIndex: pppoeConn.connIndex,
        };
      } else if (device.pppoeUser) {
        savedConfig.pppoe = { username: device.pppoeUser };
      }

      if (liveData.lanIp || liveData.dhcpStart) {
        savedConfig.lan = {};
        if (liveData.lanIp) savedConfig.lan.lanIp = liveData.lanIp;
        if (liveData.lanSubnet) savedConfig.lan.lanSubnet = liveData.lanSubnet;
        if (liveData.dhcpEnabled !== undefined) savedConfig.lan.dhcpEnabled = liveData.dhcpEnabled;
        if (liveData.dhcpStart) savedConfig.lan.dhcpStart = liveData.dhcpStart;
        if (liveData.dhcpEnd) savedConfig.lan.dhcpEnd = liveData.dhcpEnd;
      }

      if (liveData.voipLines?.length > 0) {
        savedConfig.voip = liveData.voipLines
          .filter((l: { enabled?: boolean; directoryNumber?: string; sipAuthUser?: string }) => l.enabled || l.directoryNumber || l.sipAuthUser)
          .map((l: Record<string, unknown>) => ({
            profileIndex: l.profileIndex as number,
            lineIndex: l.lineIndex as number,
            enabled: l.enabled as boolean,
            directoryNumber: l.directoryNumber as string,
            sipAuthUser: l.sipAuthUser as string,
            sipAuthPassword: l.sipAuthPassword as string,
            sipUri: l.sipUri as string,
            sipRegistrar: l.sipRegistrar as string,
            sipRegistrarPort: l.sipRegistrarPort as number,
            sipProxyServer: l.sipProxyServer as string,
            sipProxyPort: l.sipProxyPort as number,
            sipOutboundProxy: l.sipOutboundProxy as string,
            sipOutboundProxyPort: l.sipOutboundProxyPort as number,
            sipDomain: l.sipDomain as string,
          }));
      }

      await storage.updateDevice(device.id, {
        savedConfig: savedConfig as unknown as Record<string, unknown>,
        savedConfigAt: new Date(),
      } as Record<string, unknown>);

      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-backup",
        message: `Backup de configuração salvo: ${Object.keys(savedConfig).filter(k => (savedConfig as Record<string, unknown>)[k]).join(", ")}`,
        severity: "info",
      });

      res.json({ message: "Configuração salva com sucesso", savedConfig, savedAt: new Date() });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/restore-config", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const config = (req.body.config || device.savedConfig) as SavedDeviceConfig | null;
    if (!config) return res.status(400).json({ message: "Nenhuma configuração salva encontrada" });

    try {
      const parameters: Array<[string, string | number | boolean]> = [];
      const isTR181 = device.model === "Device2" || device.model?.includes("XX530") || device.model?.includes("XX230") || device.model?.includes("EX520") || device.model?.includes("EX141") || device.model?.includes("XC220");

      if (config.wifi) {
        if (isTR181) {
          if (config.wifi.ssid) parameters.push(["Device.WiFi.SSID.2.SSID", config.wifi.ssid]);
          if (config.wifi.password) parameters.push(["Device.WiFi.AccessPoint.2.Security.KeyPassphrase", config.wifi.password]);
          if (config.wifi.ssid5g) parameters.push(["Device.WiFi.SSID.3.SSID", config.wifi.ssid5g]);
          if (config.wifi.password5g) parameters.push(["Device.WiFi.AccessPoint.3.Security.KeyPassphrase", config.wifi.password5g]);
        } else {
          if (config.wifi.ssid) parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", config.wifi.ssid]);
          if (config.wifi.password) {
            parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", config.wifi.password]);
            parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", config.wifi.password]);
          }
          if (config.wifi.ssid5g) parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID", config.wifi.ssid5g]);
          if (config.wifi.password5g) {
            parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", config.wifi.password5g]);
            parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase", config.wifi.password5g]);
          }
        }
      }

      if (config.pppoe?.username) {
        if (isTR181) {
          const connIdx = config.pppoe.connIndex || 1;
          parameters.push([`Device.PPP.Interface.${connIdx}.Username`, config.pppoe.username]);
          if (config.pppoe.password) parameters.push([`Device.PPP.Interface.${connIdx}.Password`, config.pppoe.password]);
        } else {
          const wd = config.pppoe.wanDeviceIndex || 1;
          const wcd = config.pppoe.wcdIndex || 1;
          const ci = config.pppoe.connIndex || 1;
          parameters.push([`InternetGatewayDevice.WANDevice.${wd}.WANConnectionDevice.${wcd}.WANPPPConnection.${ci}.Username`, config.pppoe.username]);
          if (config.pppoe.password) parameters.push([`InternetGatewayDevice.WANDevice.${wd}.WANConnectionDevice.${wcd}.WANPPPConnection.${ci}.Password`, config.pppoe.password]);
        }
      }

      if (config.lan && !isTR181) {
        const igd = "InternetGatewayDevice";
        if (config.lan.lanIp) parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress`, config.lan.lanIp]);
        if (config.lan.lanSubnet) {
          parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask`, config.lan.lanSubnet]);
          parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.SubnetMask`, config.lan.lanSubnet]);
        }
        if (config.lan.dhcpEnabled !== undefined) parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.DHCPServerEnable`, config.lan.dhcpEnabled]);
        if (config.lan.dhcpStart) parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.MinAddress`, config.lan.dhcpStart]);
        if (config.lan.dhcpEnd) parameters.push([`${igd}.LANDevice.1.LANHostConfigManagement.MaxAddress`, config.lan.dhcpEnd]);
      }

      if (config.voip && !isTR181) {
        for (const line of config.voip) {
          const lineBase = `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.${line.profileIndex}.Line.${line.lineIndex}`;
          const sipBase = `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.${line.profileIndex}.SIP`;
          if (line.enabled !== undefined) parameters.push([`${lineBase}.Enable`, line.enabled ? "Enabled" : "Disabled"]);
          if (line.directoryNumber) parameters.push([`${lineBase}.DirectoryNumber`, line.directoryNumber]);
          if (line.sipAuthUser) parameters.push([`${lineBase}.SIP.AuthUserName`, line.sipAuthUser]);
          if (line.sipAuthPassword) parameters.push([`${lineBase}.SIP.AuthPassword`, line.sipAuthPassword]);
          if (line.sipRegistrar) parameters.push([`${sipBase}.RegistrarServer`, line.sipRegistrar]);
          if (line.sipRegistrarPort) parameters.push([`${sipBase}.RegistrarServerPort`, line.sipRegistrarPort]);
          if (line.sipProxyServer) parameters.push([`${sipBase}.ProxyServer`, line.sipProxyServer]);
          if (line.sipProxyPort) parameters.push([`${sipBase}.ProxyServerPort`, line.sipProxyPort]);
          if (line.sipDomain) parameters.push([`${sipBase}.UserAgentDomain`, line.sipDomain]);
        }
      }

      if (parameters.length === 0) return res.status(400).json({ message: "Nenhum parâmetro para restaurar" });

      await genieSetMultipleParameters(device.genieId, parameters);

      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-restore",
        message: `Configuração restaurada: ${parameters.length} parâmetros enviados`,
        severity: "info",
      });

      res.json({ message: `Configuração restaurada com sucesso (${parameters.length} parâmetros)`, parametersSet: parameters.length });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/genieacs/device-config/:serialNumber", async (req, res) => {
    const token = req.query.token || req.headers["x-netcontrol-token"];
    const expectedToken = process.env.SESSION_SECRET || "netcontrol-ext-token";
    if (token !== expectedToken) return res.status(403).json({ error: "Unauthorized" });

    const device = await storage.getDeviceBySerial(req.params.serialNumber);
    if (!device || !device.savedConfig) return res.status(404).json({ config: null });
    res.json({ config: device.savedConfig, savedAt: device.savedConfigAt });
  });

  app.post("/api/devices/:id/migrate", async (req, res) => {
    const schema = z.object({ newDeviceId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const oldDevice = await storage.getDevice(req.params.id);
    if (!oldDevice) return res.status(404).json({ message: "Dispositivo antigo não encontrado" });

    const newDevice = await storage.getDevice(parsed.data.newDeviceId);
    if (!newDevice) return res.status(404).json({ message: "Dispositivo novo não encontrado" });
    if (!newDevice.genieId) return res.status(400).json({ message: "Dispositivo novo não vinculado ao GenieACS" });

    try {
      let config = oldDevice.savedConfig as SavedDeviceConfig | null;
      if (!config && oldDevice.genieId) {
        const genieOldDevice = await genieGetDevice(oldDevice.genieId);
        const liveData = genieOldDevice ? extractLiveDeviceInfo(genieOldDevice) : null;
        config = {} as SavedDeviceConfig;

        if (liveData) {
          if (liveData.ssid || liveData.ssid5g) {
            config.wifi = {
              ssid: liveData.ssid || undefined,
              password: liveData.wifiPassword || undefined,
              ssid5g: liveData.ssid5g || undefined,
              password5g: liveData.wifiPassword5g || undefined,
            };
          }
          const pppoeConn = liveData.wanConnections?.find((w: { type: string; username?: string }) => w.type === "PPPoE" && w.username);
          if (pppoeConn) {
            config.pppoe = {
              username: pppoeConn.username,
              wanDeviceIndex: pppoeConn.wanDeviceIndex,
              wcdIndex: pppoeConn.wcdIndex,
              connIndex: pppoeConn.connIndex,
            };
          } else if (oldDevice.pppoeUser) {
            config.pppoe = { username: oldDevice.pppoeUser };
          }
          if (liveData.lanIp) {
            config.lan = { lanIp: liveData.lanIp, lanSubnet: liveData.lanSubnet, dhcpEnabled: liveData.dhcpEnabled, dhcpStart: liveData.dhcpStart, dhcpEnd: liveData.dhcpEnd };
          }
          if (liveData.voipLines?.length > 0) {
            config.voip = liveData.voipLines.filter((l: { enabled?: boolean; directoryNumber?: string }) => l.enabled || l.directoryNumber).map((l: Record<string, unknown>) => ({
              profileIndex: l.profileIndex as number, lineIndex: l.lineIndex as number, enabled: l.enabled as boolean,
              directoryNumber: l.directoryNumber as string, sipAuthUser: l.sipAuthUser as string, sipAuthPassword: l.sipAuthPassword as string,
              sipUri: l.sipUri as string, sipRegistrar: l.sipRegistrar as string, sipRegistrarPort: l.sipRegistrarPort as number,
              sipProxyServer: l.sipProxyServer as string, sipProxyPort: l.sipProxyPort as number, sipDomain: l.sipDomain as string,
            }));
          }
        } else if (oldDevice.pppoeUser) {
          config.pppoe = { username: oldDevice.pppoeUser };
        }
      }

      await storage.updateDevice(newDevice.id, {
        clientId: oldDevice.clientId,
        pppoeUser: oldDevice.pppoeUser,
        ssid: oldDevice.ssid,
        ssid5g: oldDevice.ssid5g,
        wifiPassword: oldDevice.wifiPassword,
        wifiPassword5g: oldDevice.wifiPassword5g,
        savedConfig: config as unknown as Record<string, unknown>,
        savedConfigAt: new Date(),
        notes: `Migrado de ${oldDevice.model} (SN: ${oldDevice.serialNumber})${newDevice.notes ? ` | ${newDevice.notes}` : ""}`,
      } as Record<string, unknown>);

      await storage.updateDevice(oldDevice.id, {
        status: "offline",
        clientId: null,
        replacedByDeviceId: newDevice.id,
        replacedAt: new Date(),
        notes: `Substituído por ${newDevice.model} (SN: ${newDevice.serialNumber})${oldDevice.notes ? ` | ${oldDevice.notes}` : ""}`,
      } as Record<string, unknown>);

      let parametersSet = 0;
      if (config && Object.keys(config).length > 0 && newDevice.genieId) {
        try {
          const parameters: Array<[string, string | number | boolean]> = [];
          const isTR181 = newDevice.model === "Device2" || newDevice.model?.includes("XX530") || newDevice.model?.includes("XX230") || newDevice.model?.includes("EX520") || newDevice.model?.includes("EX141") || newDevice.model?.includes("XC220");

          if (config.wifi) {
            if (isTR181) {
              if (config.wifi.ssid) parameters.push(["Device.WiFi.SSID.2.SSID", config.wifi.ssid]);
              if (config.wifi.password) parameters.push(["Device.WiFi.AccessPoint.2.Security.KeyPassphrase", config.wifi.password]);
              if (config.wifi.ssid5g) parameters.push(["Device.WiFi.SSID.3.SSID", config.wifi.ssid5g]);
              if (config.wifi.password5g) parameters.push(["Device.WiFi.AccessPoint.3.Security.KeyPassphrase", config.wifi.password5g]);
            } else {
              if (config.wifi.ssid) parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", config.wifi.ssid]);
              if (config.wifi.password) {
                parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", config.wifi.password]);
                parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", config.wifi.password]);
              }
              if (config.wifi.ssid5g) parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID", config.wifi.ssid5g]);
              if (config.wifi.password5g) {
                parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", config.wifi.password5g]);
                parameters.push(["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase", config.wifi.password5g]);
              }
            }
          }
          if (config.pppoe?.username) {
            if (isTR181) {
              const connIdx = config.pppoe.connIndex || 1;
              parameters.push([`Device.PPP.Interface.${connIdx}.Username`, config.pppoe.username]);
              if (config.pppoe.password) parameters.push([`Device.PPP.Interface.${connIdx}.Password`, config.pppoe.password]);
            } else {
              const wd = config.pppoe.wanDeviceIndex || 1;
              const wcd = config.pppoe.wcdIndex || 1;
              const ci = config.pppoe.connIndex || 1;
              parameters.push([`InternetGatewayDevice.WANDevice.${wd}.WANConnectionDevice.${wcd}.WANPPPConnection.${ci}.Username`, config.pppoe.username]);
              if (config.pppoe.password) parameters.push([`InternetGatewayDevice.WANDevice.${wd}.WANConnectionDevice.${wcd}.WANPPPConnection.${ci}.Password`, config.pppoe.password]);
            }
          }

          if (parameters.length > 0) {
            await genieSetMultipleParameters(newDevice.genieId, parameters);
            parametersSet = parameters.length;
          }
        } catch (migrateError) {
          console.error("Migration restore error:", migrateError);
        }
      }

      await storage.createDeviceLog({
        deviceId: oldDevice.id,
        eventType: "device-replaced",
        message: `Dispositivo substituído por ${newDevice.model} (SN: ${newDevice.serialNumber})`,
        severity: "warning",
      });
      await storage.createDeviceLog({
        deviceId: newDevice.id,
        eventType: "device-migration",
        message: `Configuração migrada de ${oldDevice.model} (SN: ${oldDevice.serialNumber}). ${parametersSet} parâmetros aplicados.`,
        severity: "info",
      });

      res.json({
        message: "Migração realizada com sucesso",
        parametersSet,
        config: config || null,
        oldDevice: { id: oldDevice.id, serialNumber: oldDevice.serialNumber, model: oldDevice.model },
        newDevice: { id: newDevice.id, serialNumber: newDevice.serialNumber, model: newDevice.model },
      });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/:id/set-parameter", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const parsed = setParameterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    try {
      await genieSetDeviceParameter(device.genieId, parsed.data.parameterPath, parsed.data.value);
      res.json({ message: "Parâmetro definido" });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/devices/:id/parameters", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.status(400).json({ message: "Dispositivo não vinculado ao GenieACS" });

    const path = req.query.path as string || "InternetGatewayDevice";
    try {
      const result = await genieGetDeviceParameters(device.genieId, path);
      res.json(result);
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.get("/api/devices/:id/tasks", async (req, res) => {
    const device = await storage.getDevice(req.params.id);
    if (!device) return res.status(404).json({ message: "Dispositivo não encontrado" });
    if (!device.genieId) return res.json([]);

    try {
      const tasks = await genieGetTasks(device.genieId);
      res.json(tasks);
    } catch (error) {
      handleGenieError(error, res);
    }
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

  app.delete("/api/genieacs/devices/:id/faults", async (req, res) => {
    try {
      const deleted = await genieClearDeviceFaults(req.params.id);
      res.json({ message: `${deleted} faults removidos`, deleted });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.delete("/api/genieacs/faults", async (req, res) => {
    try {
      const code = req.query.code as string | undefined;
      const deleted = await genieClearAllFaults(code);
      res.json({ message: `${deleted} faults removidos`, deleted });
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

  app.delete("/api/genieacs/files/:id", async (req, res) => {
    try {
      await genieDeleteFile(req.params.id);
      res.status(204).end();
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/genieacs/clear-seed-data", requireAdmin, async (_req, res) => {
    try {
      const allDevices = await storage.getDevices();
      const seedDevices = allDevices.filter(d => !d.genieId);
      for (const d of seedDevices) {
        await storage.deleteDevice(d.id);
      }
      const allClients = await storage.getClients();
      for (const c of allClients) {
        const clientDevices = allDevices.filter(d => d.clientId === c.id);
        const hasRealDevices = clientDevices.some(d => d.genieId);
        if (!hasRealDevices && clientDevices.length > 0 && clientDevices.every(d => !d.genieId)) {
          await storage.deleteClient(c.id);
        }
      }
      res.json({ message: `Dados fictícios removidos: ${seedDevices.length} dispositivos`, removed: seedDevices.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/genieacs/sync", async (_req, res) => {
    try {
      const genieDevices = await genieGetDevices();
      let synced = 0;
      let autoBackups = 0;
      const allDevices = await storage.getDevices();
      for (const gDevice of genieDevices) {
        const info = extractDeviceInfo(gDevice);
        if (!info.serialNumber) continue;

        const existing = allDevices.find(
          (d) => d.serialNumber === info.serialNumber
        );

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
            wifiPassword: info.wifiPassword || existing.wifiPassword,
            wifiPassword5g: info.wifiPassword5g || existing.wifiPassword5g,
            pppoeUser: info.pppoeUser || existing.pppoeUser,
            connectionType: info.connectionType || existing.connectionType,
            lastSeen: info.lastInform ? new Date(info.lastInform) : existing.lastSeen,
            uptime: uptimeStr || existing.uptime,
          };

          if (isOnline) {
            const mergedInfo = {
              ssid: (info.ssid || existing.ssid) ?? undefined,
              ssid5g: (info.ssid5g || existing.ssid5g) ?? undefined,
              wifiPassword: (info.wifiPassword || existing.wifiPassword) ?? undefined,
              wifiPassword5g: (info.wifiPassword5g || existing.wifiPassword5g) ?? undefined,
              wifiChannel: (info.wifiChannel || existing.wifiChannel) ?? undefined,
              wifiChannel5g: (info.wifiChannel5g || existing.wifiChannel5g) ?? undefined,
              pppoeUser: (info.pppoeUser || existing.pppoeUser) ?? undefined,
            };
            const newBackup = buildBackupFromBasicInfo(mergedInfo);
            if (shouldUpdateBackup(existing.savedConfig as SavedDeviceConfig, newBackup)) {
              const existingCfg = (existing.savedConfig || {}) as SavedDeviceConfig;
              if (existingCfg.lan) newBackup.lan = existingCfg.lan;
              if (existingCfg.voip && (!newBackup.voip || newBackup.voip.length === 0)) newBackup.voip = existingCfg.voip;
              if (existingCfg.pppoe?.wanDeviceIndex && newBackup.pppoe && !newBackup.pppoe.wanDeviceIndex) {
                newBackup.pppoe.wanDeviceIndex = existingCfg.pppoe.wanDeviceIndex;
                newBackup.pppoe.wcdIndex = existingCfg.pppoe.wcdIndex;
                newBackup.pppoe.connIndex = existingCfg.pppoe.connIndex;
              }
              updates.savedConfig = newBackup as unknown as Record<string, unknown>;
              updates.savedConfigAt = new Date();
              autoBackups++;
            }
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
            wifiPassword: info.wifiPassword || null,
            wifiPassword5g: info.wifiPassword5g || null,
            pppoeUser: info.pppoeUser || null,
            connectionType: info.connectionType || null,
            rxPower: info.rxPower,
            txPower: info.txPower,
            temperature: info.temperature,
            voltage: info.voltage,
            lastSeen: info.lastInform ? new Date(info.lastInform) : null,
            uptime: uptimeStr,
          };

          if (isOnline) {
            const initialBackup = buildBackupFromBasicInfo({
              ssid: info.ssid || undefined,
              ssid5g: info.ssid5g || undefined,
              wifiPassword: info.wifiPassword || undefined,
              wifiPassword5g: info.wifiPassword5g || undefined,
              wifiChannel: info.wifiChannel || undefined,
              wifiChannel5g: info.wifiChannel5g || undefined,
              pppoeUser: info.pppoeUser || undefined,
            });
            if (countConfigSections(initialBackup) > 0) {
              newDeviceData.savedConfig = initialBackup as unknown as Record<string, unknown>;
              newDeviceData.savedConfigAt = new Date();
              autoBackups++;
            }
          }

          await storage.createDevice(newDeviceData as Parameters<typeof storage.createDevice>[0]);
        }
        synced++;
      }
      res.json({
        message: `Sincronização concluída: ${synced} dispositivos processados, ${autoBackups} backups automáticos`,
        synced,
        autoBackups,
      });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  app.post("/api/devices/bulk-backup", async (_req, res) => {
    try {
      const devices = await storage.getDevices();
      const genieDevices = devices.filter(d => d.genieId && d.status === "online");
      let backed = 0;
      let skipped = 0;
      let failed = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < genieDevices.length; i += BATCH_SIZE) {
        const batch = genieDevices.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (device) => {
            try {
              const genieDevice = await genieGetDevice(device.genieId!);
              if (!genieDevice) { skipped++; return; }
              const liveData = extractLiveDeviceInfo(genieDevice);

              const savedConfig: SavedDeviceConfig = {};
              if (liveData.ssid || liveData.ssid5g || liveData.wifiPassword || liveData.wifiPassword5g) {
                savedConfig.wifi = {};
                if (liveData.ssid) savedConfig.wifi.ssid = liveData.ssid;
                if (liveData.wifiPassword) savedConfig.wifi.password = liveData.wifiPassword;
                if (liveData.ssid5g) savedConfig.wifi.ssid5g = liveData.ssid5g;
                if (liveData.wifiPassword5g) savedConfig.wifi.password5g = liveData.wifiPassword5g;
                if (liveData.wifiChannel) savedConfig.wifi.channel = parseInt(liveData.wifiChannel) || undefined;
                if (liveData.wifiChannel5g) savedConfig.wifi.channel5g = parseInt(liveData.wifiChannel5g) || undefined;
              }
              const pppoeConn = liveData.wanConnections?.find((w: { type: string; username?: string }) => w.type === "PPPoE" && w.username);
              if (pppoeConn) {
                savedConfig.pppoe = { username: pppoeConn.username, vlanId: pppoeConn.vlanId ? parseInt(pppoeConn.vlanId) || undefined : undefined, wanDeviceIndex: pppoeConn.wanDeviceIndex, wcdIndex: pppoeConn.wcdIndex, connIndex: pppoeConn.connIndex };
              } else if (device.pppoeUser) {
                savedConfig.pppoe = { username: device.pppoeUser };
              }
              if (liveData.lanIp || liveData.dhcpStart) {
                savedConfig.lan = {};
                if (liveData.lanIp) savedConfig.lan.lanIp = liveData.lanIp;
                if (liveData.lanSubnet) savedConfig.lan.lanSubnet = liveData.lanSubnet;
                if (liveData.dhcpEnabled !== undefined) savedConfig.lan.dhcpEnabled = liveData.dhcpEnabled;
                if (liveData.dhcpStart) savedConfig.lan.dhcpStart = liveData.dhcpStart;
                if (liveData.dhcpEnd) savedConfig.lan.dhcpEnd = liveData.dhcpEnd;
              }
              if (liveData.voipLines?.length > 0) {
                savedConfig.voip = liveData.voipLines
                  .filter((l: { enabled?: boolean; directoryNumber?: string; sipAuthUser?: string }) => l.enabled || l.directoryNumber || l.sipAuthUser)
                  .map((l: Record<string, unknown>) => ({
                    profileIndex: l.profileIndex as number, lineIndex: l.lineIndex as number, enabled: l.enabled as boolean,
                    directoryNumber: l.directoryNumber as string, sipAuthUser: l.sipAuthUser as string, sipAuthPassword: l.sipAuthPassword as string,
                    sipUri: l.sipUri as string, sipRegistrar: l.sipRegistrar as string, sipRegistrarPort: l.sipRegistrarPort as number,
                    sipProxyServer: l.sipProxyServer as string, sipProxyPort: l.sipProxyPort as number,
                    sipOutboundProxy: l.sipOutboundProxy as string, sipOutboundProxyPort: l.sipOutboundProxyPort as number,
                    sipDomain: l.sipDomain as string,
                  }));
              }

              if (!shouldUpdateBackup(device.savedConfig as SavedDeviceConfig, savedConfig)) {
                skipped++;
                return;
              }

              const existingCfg = (device.savedConfig || {}) as SavedDeviceConfig;
              if (existingCfg.lan && !savedConfig.lan) savedConfig.lan = existingCfg.lan;
              if (existingCfg.voip && (!savedConfig.voip || savedConfig.voip.length === 0)) savedConfig.voip = existingCfg.voip;
              if (existingCfg.pppoe?.wanDeviceIndex && savedConfig.pppoe && !savedConfig.pppoe.wanDeviceIndex) {
                savedConfig.pppoe.wanDeviceIndex = existingCfg.pppoe.wanDeviceIndex;
                savedConfig.pppoe.wcdIndex = existingCfg.pppoe.wcdIndex;
                savedConfig.pppoe.connIndex = existingCfg.pppoe.connIndex;
              }

              await storage.updateDevice(device.id, {
                savedConfig: savedConfig as unknown as Record<string, unknown>,
                savedConfigAt: new Date(),
              } as Record<string, unknown>);
              backed++;
            } catch {
              failed++;
            }
          })
        );
      }

      res.json({
        message: `Backup em massa: ${backed} salvos, ${skipped} ignorados, ${failed} falhas`,
        backed,
        skipped,
        failed,
        total: genieDevices.length,
      });
    } catch (error) {
      handleGenieError(error, res);
    }
  });

  return httpServer;
}
