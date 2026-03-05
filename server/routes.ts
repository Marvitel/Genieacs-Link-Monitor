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
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const igd = "InternetGatewayDevice";
    const parameters: Array<[string, string | number | boolean]> = [
      [`${igd}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username`, parsed.data.username],
      [`${igd}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password`, parsed.data.password],
    ];

    try {
      await genieSetMultipleParameters(device.genieId, parameters);
      await storage.updateDevice(device.id, { pppoeUser: parsed.data.username });
      await storage.createDeviceLog({
        deviceId: device.id,
        eventType: "config-change",
        message: `PPPoE atualizado: ${parsed.data.username}`,
        severity: "info",
      });
      res.json({ message: "Configuração PPPoE enviada" });
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

        const isOnline = info.lastInform && (Date.now() - new Date(info.lastInform).getTime()) < 600000;
        const uptimeStr = info.uptime ? `${Math.floor(Number(info.uptime) / 86400)}d ${Math.floor((Number(info.uptime) % 86400) / 3600)}h` : null;

        if (existing) {
          await storage.updateDevice(existing.id, {
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
          });
        } else {
          let deviceType: string = "ont";
          const mfr = info.manufacturer.toLowerCase();
          if (mfr.includes("mikrotik")) deviceType = "router";
          else if (mfr.includes("ruijie")) deviceType = "mesh";

          await storage.createDevice({
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
