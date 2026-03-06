import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { requireApiKey } from "./auth";
import {
  genieGetDevice,
  genieRebootDevice,
  genieRunDiagnostic,
  genieGetDiagnosticResult,
  extractLiveDeviceInfo,
  genieSetMultipleParameters,
  type GenieACSDevice,
} from "./genieacs";
import type { Device, SavedDeviceConfig } from "@shared/schema";

function requireWritePermission(req: Request, res: Response, next: NextFunction): void {
  const perms = (req as any).apiKeyPermissions;
  if (perms && perms === "read") {
    res.status(403).json({ error: "API key does not have write permission" });
    return;
  }
  next();
}

function deviceToFlashmanFormat(device: Device, liveData?: any): any {
  const cfg = device.savedConfig as SavedDeviceConfig | null;
  const lastContact = device.lastSeen ? new Date(device.lastSeen).toISOString() : "";
  const isOnline = device.status === "online";

  const result: any = {
    _id: device.macAddress || device.serialNumber,
    model: device.model || "",
    version: device.firmwareVersion || "",
    hw_version: device.hardwareVersion || "",
    installed_release: device.firmwareVersion || "",
    release: device.firmwareVersion || "",
    connection_type: device.connectionType || "pppoe",
    pppoe_user: device.pppoeUser || "",
    wan_ip: liveData?.wanConnections?.[0]?.ipAddress || device.ipAddress || "",
    ip: device.ipAddress || "",
    last_contact: lastContact,
    uptime: device.uptime || "",
    sys_up_time: device.uptime || "",
    serial_tr069: device.serialNumber,
    alt_uid_tr069: device.genieId || "",
    acs_id: device.genieId || "",
    wifi_ssid: liveData?.wifiSSID || cfg?.wifi?.ssid || device.ssid || "",
    wifi_password: liveData?.wifiPassword || cfg?.wifi?.password || device.wifiPassword || "",
    wifi_channel: liveData?.wifiChannel || String(cfg?.wifi?.channel || device.wifiChannel || ""),
    wifi_band: device.wifiBand || "auto",
    wifi_mode: "11bgn",
    wifi_state: 1,
    wifi_hidden: 0,
    wifi_ssid_5ghz: liveData?.wifiSSID5g || cfg?.wifi?.ssid5g || device.ssid5g || "",
    wifi_password_5ghz: liveData?.wifiPassword5g || cfg?.wifi?.password5g || device.wifiPassword5g || "",
    wifi_channel_5ghz: liveData?.wifiChannel5g || String(cfg?.wifi?.channel5g || device.wifiChannel5g || ""),
    wifi_band_5ghz: "auto",
    wifi_mode_5ghz: "11ac",
    wifi_state_5ghz: 1,
    wifi_hidden_5ghz: 0,
    lan_subnet: liveData?.lanIp || cfg?.lan?.lanIp || "192.168.1.1",
    lan_netmask: liveData?.lanSubnet || cfg?.lan?.lanSubnet || "255.255.255.0",
    pon_rxpower: device.rxPower != null ? String(device.rxPower) : "",
    pon_txpower: device.txPower != null ? String(device.txPower) : "",
    online_devices: liveData?.lanDevices?.map((d: any) => ({
      mac: d.macAddress || d.mac,
      hostname: d.hostName || d.hostname || "",
      ip: d.ipAddress || d.ip || "",
      conn_type: d.connectionType || "ethernet",
    })) || [],
    lan_devices: liveData?.lanDevices?.map((d: any) => ({
      mac: d.macAddress || d.mac,
      hostname: d.hostName || d.hostname || "",
      ip: d.ipAddress || d.ip || "",
    })) || [],
    vendor: device.manufacturer || "",
    vendor_tr069: device.manufacturer || "",
    wans: liveData?.wanConnections?.map((w: any) => ({
      wan_id: `${w.wanDeviceIndex || 1}.${w.wcdIndex || 1}.${w.connIndex || 1}`,
      wan_type: w.type === "PPPoE" ? "pppoe" : "dhcp",
      wan_ip: w.ipAddress || "",
      wan_mac: w.macAddress || "",
      wan_vlan: w.vlanId || "",
      wan_status: w.status === "Connected" ? "up" : "down",
      pppoe_user: w.username || "",
    })) || [],
    is_license_active: true,
  };

  return result;
}

async function findDeviceByMac(mac: string): Promise<Device | undefined> {
  const normalized = mac.toUpperCase().replace(/-/g, ":");
  return storage.getDeviceByMac(normalized);
}

async function findDeviceByPppoe(pppoeUser: string): Promise<Device | undefined> {
  return storage.getDeviceByPppoeUser(pppoeUser);
}

async function findDeviceBySerial(serial: string): Promise<Device | undefined> {
  return storage.getDeviceBySerial(serial);
}

async function getLiveDataSafe(device: Device): Promise<any> {
  if (!device.genieId) return null;
  try {
    const genieDevice = await genieGetDevice(device.genieId);
    if (!genieDevice) return null;
    return extractLiveDeviceInfo(genieDevice);
  } catch {
    return null;
  }
}

export function registerFlashmanAPI(app: Express): void {

  app.get("/api/v2/device/update/:mac", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac) || await findDeviceBySerial(req.params.mac);
      if (!device) return res.status(404).json({ error: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      res.json(deviceToFlashmanFormat(device, liveData));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v3/device/mac/:mac/", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      res.json({ success: true, device: deviceToFlashmanFormat(device, liveData) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/pppoe-username/:pppoeUser/", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByPppoe(req.params.pppoeUser);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      res.json({ success: true, device: deviceToFlashmanFormat(device, liveData) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/serial-tr069/:serial/", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceBySerial(req.params.serial);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      res.json({ success: true, device: deviceToFlashmanFormat(device, liveData) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/full/:identifier/", requireApiKey, async (req: Request, res: Response) => {
    try {
      const id = req.params.identifier;
      const device = await findDeviceBySerial(id) || await findDeviceByMac(id) || await findDeviceByPppoe(id);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });

      let liveData: any = null;
      if (device.genieId) {
        try {
          const genieDevice = await genieGetDevice(device.genieId);
          if (genieDevice) {
            liveData = extractLiveDeviceInfo(genieDevice);
          }
        } catch {}
      }

      const cfg = device.savedConfig as SavedDeviceConfig | null;
      const isOnline = device.status === "online";

      const result: any = {
        success: true,
        device: {
          _id: device.macAddress || device.serialNumber,
          serial_tr069: device.serialNumber,
          acs_id: device.genieId || "",
          status: isOnline ? "online" : "offline",

          info: {
            manufacturer: device.manufacturer || liveData?.manufacturer || "",
            model: device.model || liveData?.model || "",
            serial: device.serialNumber,
            mac_address: device.macAddress || "",
            firmware: device.firmwareVersion || liveData?.firmwareVersion || "",
            hardware: device.hardwareVersion || liveData?.hardwareVersion || "",
            uptime: liveData?.uptime || device.uptime || "",
            last_inform: liveData?.lastInform || "",
            last_boot: liveData?.lastBoot || "",
            product_class: liveData?.productClass || "",
            oui: liveData?.oui || "",
          },

          signal: {
            rx_power: liveData?.rxPower ?? (device.rxPower != null ? device.rxPower : null),
            tx_power: liveData?.txPower ?? (device.txPower != null ? device.txPower : null),
            temperature: liveData?.temperature ?? null,
            voltage: liveData?.voltage ?? null,
          },

          wan: {
            connections: liveData?.wanConnections || [],
            pppoe_user: device.pppoeUser || "",
            wan_ip: liveData?.wanConnections?.[0]?.ipAddress || device.ipAddress || "",
            connection_type: device.connectionType || "pppoe",
          },

          lan: {
            ip: liveData?.lanIp || cfg?.lan?.lanIp || "",
            subnet: liveData?.lanSubnet || cfg?.lan?.lanSubnet || "",
            dhcp_enabled: liveData?.dhcpEnabled ?? false,
            dhcp_start: liveData?.dhcpStart || "",
            dhcp_end: liveData?.dhcpEnd || "",
            ethernet_ports: liveData?.ethernetPorts || [],
          },

          wifi: {
            enabled_2g: liveData?.wifiEnabled ?? true,
            ssid_2g: liveData?.wifiSSID || cfg?.wifi?.ssid || device.ssid || "",
            password_2g: liveData?.wifiPassword || cfg?.wifi?.password || device.wifiPassword || "",
            channel_2g: liveData?.wifiChannel || cfg?.wifi?.channel || device.wifiChannel || "",
            enabled_5g: liveData?.wifiEnabled5g ?? false,
            ssid_5g: liveData?.wifiSSID5g || cfg?.wifi?.ssid5g || device.ssid5g || "",
            password_5g: liveData?.wifiPassword5g || cfg?.wifi?.password5g || device.wifiPassword5g || "",
            channel_5g: liveData?.wifiChannel5g || cfg?.wifi?.channel5g || device.wifiChannel5g || "",
          },

          hosts: {
            connected: liveData?.connectedHosts || [],
            count: liveData?.connectedHosts?.length || 0,
          },

          voip: {
            lines: liveData?.voipLines || [],
          },

          resources: {
            memory_free: liveData?.memoryUsage ?? null,
            cpu_usage: liveData?.cpuUsage ?? null,
          },

          backup: cfg ? {
            has_backup: true,
            wifi: cfg.wifi || null,
            wan: cfg.wan || null,
            lan: cfg.lan || null,
            voip: cfg.voip || null,
            last_backup: device.lastBackupAt || null,
          } : {
            has_backup: false,
          },
        },
      };

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/search/", requireApiKey, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageLimit = parseInt(req.query.pageLimit as string) || 10;
      const allDevices = await storage.getDevices();

      let filtered = allDevices;
      if (req.query.search) {
        const search = (req.query.search as string).toLowerCase();
        filtered = allDevices.filter(d =>
          d.serialNumber.toLowerCase().includes(search) ||
          (d.macAddress || "").toLowerCase().includes(search) ||
          (d.pppoeUser || "").toLowerCase().includes(search) ||
          (d.model || "").toLowerCase().includes(search) ||
          (d.manufacturer || "").toLowerCase().includes(search)
        );
      }
      if (req.query.model) {
        filtered = filtered.filter(d => d.model === req.query.model);
      }
      if (req.query.status) {
        filtered = filtered.filter(d => d.status === req.query.status);
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / pageLimit);
      const start = (page - 1) * pageLimit;
      const pageDevices = filtered.slice(start, start + pageLimit);

      res.json({
        success: true,
        devices: pageDevices.map(d => deviceToFlashmanFormat(d)),
        page,
        pageLimit,
        totalPages,
        total,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/v2/device/command/:mac/:command", requireApiKey, requireWritePermission, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac) || await findDeviceBySerial(req.params.mac);
      if (!device || !device.genieId) return res.status(404).json({ error: "Device not found or not linked" });

      const command = req.params.command;
      switch (command) {
        case "reboot":
          await genieRebootDevice(device.genieId);
          res.json({ success: true, message: "Reboot command sent" });
          break;
        case "ping": {
          const host = req.body?.host || req.body?.content?.host || "8.8.8.8";
          await genieRunDiagnostic(device.genieId, "ping", host);
          res.json({ success: true, message: "Ping diagnostic started" });
          break;
        }
        case "traceroute": {
          const host = req.body?.host || req.body?.content?.host || "8.8.8.8";
          await genieRunDiagnostic(device.genieId, "traceroute", host);
          res.json({ success: true, message: "Traceroute diagnostic started" });
          break;
        }
        case "onlinedevices":
          res.json({ success: true, message: "Online devices refresh triggered" });
          break;
        default:
          res.status(400).json({ error: `Unknown command: ${command}` });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v3/device/mac/:mac/wifi", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      const cfg = device.savedConfig as SavedDeviceConfig | null;
      res.json({
        success: true,
        wifi: {
          ssid: liveData?.wifiSSID || cfg?.wifi?.ssid || device.ssid || "",
          password: liveData?.wifiPassword || cfg?.wifi?.password || device.wifiPassword || "",
          channel: liveData?.wifiChannel || cfg?.wifi?.channel || device.wifiChannel || "",
          ssid_5ghz: liveData?.wifiSSID5g || cfg?.wifi?.ssid5g || device.ssid5g || "",
          password_5ghz: liveData?.wifiPassword5g || cfg?.wifi?.password5g || device.wifiPassword5g || "",
          channel_5ghz: liveData?.wifiChannel5g || cfg?.wifi?.channel5g || device.wifiChannel5g || "",
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/v3/device/mac/:mac/wans/:wanId", requireApiKey, requireWritePermission, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac);
      if (!device || !device.genieId) return res.status(404).json({ success: false, message: "Device not found" });
      const { pppoe_user, pppoe_password } = req.body;
      if (pppoe_user || pppoe_password) {
        const parts = req.params.wanId.split(".");
        const wd = parts[0] || "1";
        const wcd = parts[1] || "1";
        const ci = parts[2] || "1";
        const params: [string, string | number | boolean][] = [];
        const prefix = `InternetGatewayDevice.WANDevice.${wd}.WANConnectionDevice.${wcd}.WANPPPConnection.${ci}`;
        if (pppoe_user) params.push([`${prefix}.Username`, pppoe_user]);
        if (pppoe_password) params.push([`${prefix}.Password`, pppoe_password]);
        await genieSetMultipleParameters(device.genieId, params);
        if (pppoe_user) await storage.updateDevice(device.id, { pppoeUser: pppoe_user });
      }
      res.json({ success: true, message: "WAN updated" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/mac/:mac/voip/", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });
      const cfg = device.savedConfig as SavedDeviceConfig | null;
      res.json({ success: true, voip: cfg?.voip || [] });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/mac/:mac/lan", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac);
      if (!device) return res.status(404).json({ success: false, message: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      res.json({
        success: true,
        lan: {
          subnet: liveData?.lanIp || "192.168.1.1",
          netmask: liveData?.lanSubnet || "255.255.255.0",
        },
        devices: liveData?.lanDevices || [],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/device/mac/:mac/sync", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac);
      if (!device || !device.genieId) return res.status(404).json({ success: false, message: "Device not found" });
      const liveData = await getLiveDataSafe(device);
      res.json({ success: true, device: deviceToFlashmanFormat(device, liveData) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/v3/config", requireApiKey, async (_req: Request, res: Response) => {
    res.json({ success: true, tr069: { inform_interval: 300, acs_url: process.env.CWMP_URL || "" } });
  });

  app.get("/api/v2/device/pingdiagnostic/:mac", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac) || await findDeviceBySerial(req.params.mac);
      if (!device || !device.genieId) return res.status(404).json({ error: "Device not found" });
      const result = await genieGetDiagnosticResult(device.genieId, "ping");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v2/device/tracediagnostic/:mac", requireApiKey, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac) || await findDeviceBySerial(req.params.mac);
      if (!device || !device.genieId) return res.status(404).json({ error: "Device not found" });
      const result = await genieGetDiagnosticResult(device.genieId, "traceroute");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
