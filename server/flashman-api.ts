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

function safeNum(val: any, fallback: number = 0): number {
  if (val == null || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeStr(val: any, fallback: string = ""): string {
  if (val == null) return fallback;
  return String(val);
}

function deviceToFlashmanFormat(device: Device, liveData?: any): any {
  const cfg = device.savedConfig as SavedDeviceConfig | null;
  const lastContact = device.lastSeen ? new Date(device.lastSeen).toISOString() : new Date(0).toISOString();
  const isOnline = device.status === "online";

  const wifiChannel2g = safeNum(liveData?.wifiChannel || cfg?.wifi?.channel || device.wifiChannel, 0);
  const wifiChannel5g = safeNum(liveData?.wifiChannel5g || cfg?.wifi?.channel5g || device.wifiChannel5g, 0);

  const result: any = {
    _id: device.macAddress || device.serialNumber || "",
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
    uptime: safeNum(device.uptime, 0),
    sys_up_time: safeNum(device.uptime, 0),
    do_update: false,
    do_update_parameters: false,
    serial_tr069: device.serialNumber || "",
    alt_uid_tr069: device.genieId || "",
    acs_id: device.genieId || "",
    use_tr069: true,
    wifi_ssid: liveData?.wifiSSID || cfg?.wifi?.ssid || device.ssid || "",
    wifi_password: liveData?.wifiPassword || cfg?.wifi?.password || device.wifiPassword || "",
    wifi_channel: String(wifiChannel2g || "auto"),
    wifi_band: device.wifiBand || "auto",
    wifi_mode: "11bgn",
    wifi_state: 1,
    wifi_hidden: 0,
    wifi_is_5ghz_capable: true,
    wifi_ssid_5ghz: liveData?.wifiSSID5g || cfg?.wifi?.ssid5g || device.ssid5g || "",
    wifi_password_5ghz: liveData?.wifiPassword5g || cfg?.wifi?.password5g || device.wifiPassword5g || "",
    wifi_channel_5ghz: String(wifiChannel5g || "auto"),
    wifi_band_5ghz: "auto",
    wifi_mode_5ghz: "11ac",
    wifi_state_5ghz: 1,
    wifi_hidden_5ghz: 0,
    lan_subnet: liveData?.lanIp || cfg?.lan?.lanIp || "192.168.1.1",
    lan_netmask: liveData?.lanSubnet || cfg?.lan?.lanSubnet || "255.255.255.0",
    pon_rxpower: safeNum(liveData?.rxPower ?? device.rxPower, 0),
    pon_txpower: safeNum(liveData?.txPower ?? device.txPower, 0),
    pon_signal_measure: "dBm",
    mesh_mode: 0,
    mesh_master: "",
    mesh_slaves: [],
    bridge_mode_enabled: false,
    online_devices: liveData?.lanDevices?.map((d: any) => ({
      mac: d.macAddress || d.mac || "",
      hostname: d.hostName || d.hostname || "",
      ip: d.ipAddress || d.ip || "",
      conn_type: d.connectionType || "ethernet",
    })) || [],
    lan_devices: liveData?.lanDevices?.map((d: any) => ({
      mac: d.macAddress || d.mac || "",
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
      wan_vlan: safeNum(w.vlanId, 0),
      wan_vlan_id: safeNum(w.vlanId, 0),
      wan_status: w.status === "Connected" ? "up" : "down",
      pppoe_user: w.username || "",
    })) || [],
    is_license_active: true,
    blocklist_enabled: false,
    forward_index: 0,
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
  const device = await storage.getDeviceBySerial(serial);
  if (device) return device;
  return storage.getDeviceByGponSerial(serial);
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

  app.put("/api/v2/device/update/:mac", requireApiKey, requireWritePermission, async (req: Request, res: Response) => {
    try {
      const device = await findDeviceByMac(req.params.mac) || await findDeviceBySerial(req.params.mac);
      if (!device) return res.status(404).json({ success: false, error: "Device not found" });

      const content = req.body?.content || req.body || {};
      const dbUpdates: Record<string, any> = {};
      const tr069Params: Array<[string, string | number | boolean]> = [];

      const igd = "InternetGatewayDevice";
      const wlan1 = `${igd}.LANDevice.1.WLANConfiguration.1`;
      const wlan5 = `${igd}.LANDevice.1.WLANConfiguration.5`;
      const pppPrefix = `${igd}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1`;

      if (content.pppoe_user) {
        dbUpdates.pppoeUser = content.pppoe_user;
        tr069Params.push([`${pppPrefix}.Username`, content.pppoe_user]);
      }
      if (content.pppoe_password) {
        tr069Params.push([`${pppPrefix}.Password`, content.pppoe_password]);
      }
      if (content.wifi_ssid) {
        dbUpdates.ssid = content.wifi_ssid;
        tr069Params.push([`${wlan1}.SSID`, content.wifi_ssid]);
      }
      if (content.wifi_password) {
        dbUpdates.wifiPassword = content.wifi_password;
        tr069Params.push([`${wlan1}.KeyPassphrase`, content.wifi_password]);
        tr069Params.push([`${wlan1}.PreSharedKey.1.KeyPassphrase`, content.wifi_password]);
      }
      if (content.wifi_ssid_5ghz) {
        dbUpdates.ssid5g = content.wifi_ssid_5ghz;
        tr069Params.push([`${wlan5}.SSID`, content.wifi_ssid_5ghz]);
      }
      if (content.wifi_password_5ghz) {
        dbUpdates.wifiPassword5g = content.wifi_password_5ghz;
        tr069Params.push([`${wlan5}.KeyPassphrase`, content.wifi_password_5ghz]);
        tr069Params.push([`${wlan5}.PreSharedKey.1.KeyPassphrase`, content.wifi_password_5ghz]);
      }
      if (content.wifi_channel) {
        dbUpdates.wifiChannel = content.wifi_channel;
        tr069Params.push([`${wlan1}.Channel`, Number(content.wifi_channel)]);
      }
      if (content.wifi_channel_5ghz) {
        dbUpdates.wifiChannel5g = content.wifi_channel_5ghz;
        tr069Params.push([`${wlan5}.Channel`, Number(content.wifi_channel_5ghz)]);
      }
      if (content.connection_type) {
        dbUpdates.connectionType = content.connection_type;
      }

      if (Object.keys(dbUpdates).length > 0) {
        await storage.updateDevice(device.id, dbUpdates);
      }

      if (tr069Params.length > 0 && device.genieId) {
        try {
          await genieSetMultipleParameters(device.genieId, tr069Params);
        } catch (tr069Err: any) {
          console.log(`[Flashman API] TR-069 set failed for ${device.macAddress}: ${tr069Err.message}`);
        }
      }

      const updatedDevice = await findDeviceByMac(req.params.mac) || await findDeviceBySerial(req.params.mac);
      const liveData = await getLiveDataSafe(updatedDevice || device);
      res.json(deviceToFlashmanFormat(updatedDevice || device, liveData));
    } catch (error: any) {
      console.error(`[Flashman API] PUT update error: ${error.message}`);
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
            gpon_serial: device.gponSerial || "",
            mac_address: device.macAddress || "",
            firmware: device.firmwareVersion || liveData?.firmwareVersion || "",
            hardware: device.hardwareVersion || liveData?.hardwareVersion || "",
            uptime: safeNum(liveData?.uptime || device.uptime, 0),
            last_inform: liveData?.lastInform || "",
            last_boot: liveData?.lastBoot || "",
            product_class: liveData?.productClass || "",
            oui: liveData?.oui || "",
          },

          signal: {
            rx_power: safeNum(liveData?.rxPower ?? device.rxPower, 0),
            tx_power: safeNum(liveData?.txPower ?? device.txPower, 0),
            temperature: safeNum(liveData?.temperature, 0),
            voltage: safeNum(liveData?.voltage, 0),
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
            channel_2g: String(safeNum(liveData?.wifiChannel || cfg?.wifi?.channel || device.wifiChannel, 0) || "auto"),
            enabled_5g: liveData?.wifiEnabled5g ?? false,
            ssid_5g: liveData?.wifiSSID5g || cfg?.wifi?.ssid5g || device.ssid5g || "",
            password_5g: liveData?.wifiPassword5g || cfg?.wifi?.password5g || device.wifiPassword5g || "",
            channel_5g: String(safeNum(liveData?.wifiChannel5g || cfg?.wifi?.channel5g || device.wifiChannel5g, 0) || "auto"),
          },

          hosts: {
            connected: liveData?.connectedHosts || [],
            count: liveData?.connectedHosts?.length || 0,
          },

          voip: {
            lines: liveData?.voipLines || [],
          },

          resources: {
            memory_free: safeNum(liveData?.memoryUsage, 0),
            cpu_usage: safeNum(liveData?.cpuUsage, 0),
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

  const commandHandler = async (req: Request, res: Response) => {
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
        case "onlinedevs":
          res.json({ success: true, message: "Online devices refresh triggered" });
          break;
        default:
          res.status(400).json({ error: `Unknown command: ${command}` });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  app.put("/api/v2/device/command/:mac/:command", requireApiKey, requireWritePermission, commandHandler);
  app.post("/api/v2/device/command/:mac/:command", requireApiKey, requireWritePermission, commandHandler);

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

  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.path.startsWith("/api/v2/") || req.path.startsWith("/api/v3/")) && !res.headersSent) {
      console.log(`[Flashman API] Unhandled route: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.path}` });
      return;
    }
    next();
  });
}
