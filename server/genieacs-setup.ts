import { GenieACSError } from "./genieacs";

const GENIEACS_NBI_URL = process.env.GENIEACS_NBI_URL || "http://localhost:7557";
const GENIEACS_TIMEOUT = 15000;

async function geniePut(path: string, body: string, contentType = "application/json"): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENIEACS_TIMEOUT);
  try {
    const res = await fetch(`${GENIEACS_NBI_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GenieACSError("GenieACS não respondeu (timeout)");
    }
    throw new GenieACSError("Não foi possível conectar ao GenieACS");
  } finally {
    clearTimeout(timeout);
  }
}

async function genieGet(path: string): Promise<unknown[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENIEACS_TIMEOUT);
  try {
    const res = await fetch(`${GENIEACS_NBI_URL}${path}`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const PROVISIONS: Record<string, string> = {
  "default": `
// Substituído: provision default otimizada para evitar too_many_commits
// Não usar {path: now} com wildcards aqui - causa loop em sessões grandes
const hourly = Date.now(3600000);

declare("InternetGatewayDevice.DeviceInfo.HardwareVersion", {value: hourly});
declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: hourly});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress", {value: hourly});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress", {value: hourly});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID", {value: hourly});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.KeyPassphrase", {value: 1});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.HostName", {value: hourly});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.IPAddress", {value: hourly});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.MACAddress", {value: hourly});

// Device:2 (TR-181)
declare("Device.DeviceInfo.HardwareVersion", {value: hourly});
declare("Device.DeviceInfo.SoftwareVersion", {value: hourly});
declare("Device.WiFi.SSID.*.SSID", {value: hourly});
declare("Device.Hosts.Host.*.HostName", {value: hourly});
declare("Device.Hosts.Host.*.IPAddress", {value: hourly});
declare("Device.Hosts.Host.*.MACAddress", {value: hourly});
`,

  "inform": `
// Configuração de autenticação e inform interval
const username = declare("DeviceID.ID", {value: 1}).value[0];
const password = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
const informInterval = 300;

// Detectar data model do device
const oui = declare("DeviceID.OUI", {value: 1}).value[0];
const pc = declare("DeviceID.ProductClass", {value: 1}).value[0] || "";
const mfg = declare("DeviceID.Manufacturer", {value: 1}).value[0] || "";

// TR-098 (InternetGatewayDevice) - maioria dos CPEs
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestUsername", {value: 1}, {value: username});
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestPassword", {value: 1}, {value: password});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: 1}, {value: true});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: 1}, {value: informInterval});

// TR-181 (Device) - apenas para devices que usam Device.* e NÃO são TP-Link (XX530v rejeita com 9006)
if (pc.indexOf("XX530") < 0 && pc.indexOf("EX520") < 0 && pc.indexOf("EX141") < 0) {
  declare("Device.ManagementServer.ConnectionRequestUsername", {value: 1}, {value: username});
  declare("Device.ManagementServer.ConnectionRequestPassword", {value: 1}, {value: password});
  declare("Device.ManagementServer.PeriodicInformEnable", {value: 1}, {value: true});
  declare("Device.ManagementServer.PeriodicInformInterval", {value: 1}, {value: informInterval});
}
`,

  "netcontrol-inform": `
const now = Date.now();

// Coleta informações básicas do dispositivo a cada inform
declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});
declare("InternetGatewayDevice.DeviceInfo.HardwareVersion", {value: now});
declare("InternetGatewayDevice.DeviceInfo.UpTime", {value: now});
declare("InternetGatewayDevice.DeviceInfo.Manufacturer", {value: now});
declare("InternetGatewayDevice.DeviceInfo.ModelName", {value: now});
declare("InternetGatewayDevice.DeviceInfo.SerialNumber", {value: now});
declare("InternetGatewayDevice.DeviceInfo.Description", {value: now});
declare("InternetGatewayDevice.DeviceInfo.MemoryStatus.Free", {value: now});
declare("InternetGatewayDevice.DeviceInfo.ProcessStatus.CPUUsage", {value: now});

// TR-181 (Device:2)
declare("Device.DeviceInfo.SoftwareVersion", {value: now});
declare("Device.DeviceInfo.HardwareVersion", {value: now});
declare("Device.DeviceInfo.UpTime", {value: now});
declare("Device.DeviceInfo.Manufacturer", {value: now});
declare("Device.DeviceInfo.ModelName", {value: now});
declare("Device.DeviceInfo.SerialNumber", {value: now});
declare("Device.DeviceInfo.MemoryStatus.Free", {value: now});
declare("Device.DeviceInfo.ProcessStatus.CPUUsage", {value: now});
`,

  "netcontrol-wan": `
const now = Date.now();
const hourly = Date.now(3600000);

// WAN IP Connection (TR-098) - descobrir sub-objetos 1x por hora
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*", {path: hourly, value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.MACAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ConnectionStatus", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.SubnetMask", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.DefaultGateway", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.DNSServers", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Name", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Uptime", {value: now});

// WAN PPP Connection (TR-098)
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*", {path: hourly, value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionStatus", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.MACAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DNSServers", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Name", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Uptime", {value: now});

// TR-181 (Device:2) IP interface - descobrir 1x por hora
declare("Device.IP.Interface.*", {path: hourly, value: now});
declare("Device.PPP.Interface.*", {path: hourly, value: now});
`,

  "netcontrol-wifi": `
const now = Date.now();
const hourly = Date.now(3600000);

// Wi-Fi (TR-098)
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Channel", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Enable", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Standard", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.BeaconType", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.KeyPassphrase", {value: 1});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.PreSharedKey.1.KeyPassphrase", {value: 1});

// Wi-Fi (TR-181 Device:2)
declare("Device.WiFi.Radio.*.Channel", {value: now});
declare("Device.WiFi.Radio.*.Enable", {value: now});
declare("Device.WiFi.SSID.*.SSID", {value: now});
declare("Device.WiFi.SSID.*.Enable", {value: now});
declare("Device.WiFi.AccessPoint.*.Security.KeyPassphrase", {value: 1});
`,

  "netcontrol-pon": `
const now = Date.now();
const hourly = Date.now(3600000);

// === TR-098 (InternetGatewayDevice) ===
// Intelbras
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.Temperature", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.Voltage", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.RXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.TXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.Temperature", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.Voltage", {value: now});
// Intelbras typo
declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.Temperature", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.Voltage", {value: now});
// ZTE (WANDevice.1)
declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.RXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.TXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.Temperature", {value: now});
declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.Voltage", {value: now});

// ZTE WANDevice.2
declare("InternetGatewayDevice.WANDevice.2.X_ZTE-COM_GponInterfaceConfig.*", {path: hourly, value: hourly});
declare("InternetGatewayDevice.WANDevice.2.X_ZTE-COM_WANPONInterfaceConfig.*", {path: hourly, value: hourly});

// Hourly discovery
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.*", {path: hourly, value: hourly});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.*", {path: hourly, value: hourly});
declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.*", {path: hourly, value: hourly});

// === TR-181 (Device) - TP-Link ===
// Standard TR-181 Optical Interface
declare("Device.Optical.Interface.1.OpticalSignalLevel", {value: now});
declare("Device.Optical.Interface.1.TransmitOpticalLevel", {value: now});
declare("Device.Optical.Interface.1.Status", {value: now});

// TP-Link proprietary GPON paths under Optical
declare("Device.Optical.Interface.1.X_TP_GPON_Config.*", {path: hourly, value: hourly});
declare("Device.Optical.Interface.1.X_TP_OMCIStats.*", {path: hourly, value: hourly});
declare("Device.Optical.Interface.1.Stats.*", {path: hourly, value: hourly});

// TP-Link X_TP_GPON top level
declare("Device.X_TP_GPON.*", {path: hourly, value: hourly});
declare("Device.Optical.*", {path: hourly, value: hourly});

// Temperature
declare("InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.1.Value", {value: now});

// Ethernet ports
declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.Status", {value: now});
declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.2.Status", {value: now});
declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.3.Status", {value: now});
declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.4.Status", {value: now});
`,

  "netcontrol-lan": `
const now = Date.now();

// LAN Hosts (TR-098) - dispositivos conectados
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*", {value: now});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.IPAddress", {value: now});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.HostName", {value: now});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.MACAddress", {value: now});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.Active", {value: now});
declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.InterfaceType", {value: now});

// LAN IP
declare("InternetGatewayDevice.LANDevice.*.LANHostConfigManagement.IPInterface.*", {value: now});
declare("InternetGatewayDevice.LANDevice.*.LANHostConfigManagement.DHCPServerEnable", {value: now});
declare("InternetGatewayDevice.LANDevice.*.LANHostConfigManagement.MinAddress", {value: now});
declare("InternetGatewayDevice.LANDevice.*.LANHostConfigManagement.MaxAddress", {value: now});

// TR-181 (Device:2)
declare("Device.Hosts.Host.*", {value: now});
declare("Device.DHCPv4.Server.Pool.*", {value: now});
`,

  "netcontrol-voip": `
const now = Date.now();
const hourly = Date.now(3600000);

// === TR-098 VoiceService ===
// Discover VoiceService branches
declare("InternetGatewayDevice.Services.VoiceService.*", {path: hourly});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.*", {path: hourly});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.*", {path: hourly});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.*", {path: hourly});

// VoiceProfile SIP settings
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServer", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServerPort", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.OutboundProxy", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.OutboundProxyPort", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.UserAgentDomain", {value: now});

// VoiceProfile 2
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.SIP.ProxyServer", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.SIP.RegistrarServer", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.SIP.RegistrarServerPort", {value: now});

// Line 1 settings (Profile 1)
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.Enable", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.DirectoryNumber", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.Status", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.SIP.AuthUserName", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.SIP.AuthPassword", {value: 1});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.SIP.URI", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.CallingFeatures.CallWaitingEnable", {value: now});

// Line 2 settings (Profile 1)
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.Enable", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.DirectoryNumber", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.Status", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.SIP.AuthUserName", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.SIP.AuthPassword", {value: 1});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.SIP.URI", {value: now});

// Line 1 settings (Profile 2)
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.1.Enable", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.1.DirectoryNumber", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.1.Status", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.1.SIP.AuthUserName", {value: now});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.1.SIP.AuthPassword", {value: 1});
declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.2.Line.1.SIP.URI", {value: now});

// PhyInterface (FXS ports)
declare("InternetGatewayDevice.Services.VoiceService.1.PhyInterface.*", {path: hourly});
`,

  "netcontrol-diagnostics": `
const now = Date.now();

// Diagnósticos IP Ping
declare("InternetGatewayDevice.IPPingDiagnostics.*", {value: now});

// Diagnósticos Traceroute
declare("InternetGatewayDevice.TraceRouteDiagnostics.*", {value: now});

// Download/Upload speed diagnostics
declare("InternetGatewayDevice.DownloadDiagnostics.*", {value: now});
declare("InternetGatewayDevice.UploadDiagnostics.*", {value: now});

// TR-181
declare("Device.IP.Diagnostics.*", {value: now});
`,

  "netcontrol-set-inform": `
const now = Date.now();

// Define intervalo de inform para 300 segundos (5 minutos)
const INFORM_INTERVAL = args[0] || "300";

// TR-098
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: now}, {value: parseInt(INFORM_INTERVAL)});

// TR-181
declare("Device.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: parseInt(INFORM_INTERVAL)});
`,
};

interface GeniePreset {
  weight: number;
  channel: string;
  events?: Record<string, boolean>;
  precondition?: string;
  configurations: Array<{
    type: string;
    name: string;
    args?: unknown;
  }>;
}

const PRESETS: Record<string, GeniePreset> = {
  "netcontrol-bootstrap": {
    weight: 0,
    channel: "netcontrol",
    events: { "0 BOOTSTRAP": true },
    configurations: [
      { type: "provision", name: "inform" },
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-wifi" },
      { type: "provision", name: "netcontrol-pon" },
      { type: "provision", name: "netcontrol-lan" },
      { type: "provision", name: "netcontrol-voip" },
      { type: "provision", name: "netcontrol-diagnostics" },
    ],
  },
  "netcontrol-periodic": {
    weight: 0,
    channel: "netcontrol",
    events: { "2 PERIODIC": true },
    configurations: [
      { type: "provision", name: "inform" },
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-pon" },
      { type: "provision", name: "netcontrol-voip" },
    ],
  },
  "netcontrol-boot": {
    weight: 0,
    channel: "netcontrol",
    events: { "1 BOOT": true },
    configurations: [
      { type: "provision", name: "inform" },
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-wifi" },
      { type: "provision", name: "netcontrol-pon" },
      { type: "provision", name: "netcontrol-lan" },
      { type: "provision", name: "netcontrol-voip" },
      { type: "provision", name: "netcontrol-diagnostics" },
    ],
  },
};

const PRESETS_TO_REMOVE = ["default", "inform", "bootstrap", "netcontrol-value-change"];

export interface SetupResult {
  provisions: { name: string; success: boolean; error?: string }[];
  presets: { name: string; success: boolean; error?: string }[];
  summary: string;
}

export async function setupGenieACS(informInterval: number = 300): Promise<SetupResult> {
  const result: SetupResult = {
    provisions: [],
    presets: [],
    summary: "",
  };

  const updatedProvisions = { ...PROVISIONS };
  if (updatedProvisions["netcontrol-set-inform"]) {
    updatedProvisions["netcontrol-set-inform"] = updatedProvisions["netcontrol-set-inform"]
      .replace('args[0] || "300"', `args[0] || "${informInterval}"`);
  }

  for (const [name, script] of Object.entries(updatedProvisions)) {
    try {
      const res = await geniePut(`/provisions/${name}`, script, "application/javascript");
      result.provisions.push({ name, success: res.ok });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      result.provisions.push({ name, success: false, error: message });
    }
  }

  for (const name of PRESETS_TO_REMOVE) {
    try {
      await fetch(`${GENIEACS_NBI_URL}/presets/${name}`, { method: "DELETE" });
    } catch (_) {}
  }

  const updatedPresets = JSON.parse(JSON.stringify(PRESETS));

  for (const [name, preset] of Object.entries(updatedPresets)) {
    try {
      const res = await geniePut(`/presets/${name}`, JSON.stringify(preset));
      result.presets.push({ name, success: res.ok });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      result.presets.push({ name, success: false, error: message });
    }
  }

  const provOk = result.provisions.filter((p) => p.success).length;
  const provTotal = result.provisions.length;
  const preOk = result.presets.filter((p) => p.success).length;
  const preTotal = result.presets.length;

  result.summary = `Provisions: ${provOk}/${provTotal} criadas. Presets: ${preOk}/${preTotal} criados.`;

  return result;
}

export async function getGenieACSSetupStatus(): Promise<{
  provisionsInstalled: string[];
  presetsInstalled: string[];
  totalProvisions: number;
  totalPresets: number;
  isFullyConfigured: boolean;
}> {
  const expectedProvisions = Object.keys(PROVISIONS);
  const expectedPresets = Object.keys(PRESETS);

  const existingProvisions = (await genieGet("/provisions")) as Array<{ _id: string }>;
  const existingPresets = (await genieGet("/presets")) as Array<{ _id: string }>;

  const provisionIds = existingProvisions.map((p) => p._id);
  const presetIds = existingPresets.map((p) => p._id);

  const installedProvisions = expectedProvisions.filter((p) => provisionIds.includes(p));
  const installedPresets = expectedPresets.filter((p) => presetIds.includes(p));

  return {
    provisionsInstalled: installedProvisions,
    presetsInstalled: installedPresets,
    totalProvisions: expectedProvisions.length,
    totalPresets: expectedPresets.length,
    isFullyConfigured:
      installedProvisions.length === expectedProvisions.length &&
      installedPresets.length === expectedPresets.length,
  };
}
