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

// WAN IP Connection (TR-098) - descobrir todos os sub-objetos
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*", {path: now, value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.MACAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ConnectionStatus", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.SubnetMask", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.DefaultGateway", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.DNSServers", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Name", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.NATEnabled", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Uptime", {value: now});

// WAN PPP Connection (TR-098)
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*", {path: now, value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionStatus", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.MACAddress", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.SubnetMask", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DefaultGateway", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DNSServers", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Name", {value: now});
declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Uptime", {value: now});

// TR-181 (Device:2) IP interface
declare("Device.IP.Interface.*", {path: now, value: now});
declare("Device.PPP.Interface.*", {path: now, value: now});
`,

  "netcontrol-wifi": `
const now = Date.now();

// Wi-Fi (TR-098)
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Channel", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Enable", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Standard", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.BeaconType", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.WPAEncryptionModes", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.TotalAssociations", {value: now});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.KeyPassphrase", {path: now, value: 1});
declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.PreSharedKey.1.KeyPassphrase", {path: now, value: 1});

// Wi-Fi (TR-181 Device:2)
declare("Device.WiFi.Radio.*", {value: now});
declare("Device.WiFi.SSID.*", {value: now});
declare("Device.WiFi.AccessPoint.*", {value: now});
declare("Device.WiFi.AccessPoint.*.Security.KeyPassphrase", {path: now, value: 1});
declare("Device.WiFi.AccessPoint.*.AssociatedDevice.*", {value: now});
`,

  "netcontrol-pon": `
const now = Date.now();

// Descobrir tree de dados PON/GPON - path discovery com {path: now}
// Isso força o GenieACS a fazer getParameterNames para cada path

// Intelbras (121AC, AX1800V, etc) - usa X_GponInterfaceConfig SEM índice
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.*", {path: now, value: now});

// Intelbras - typo comum em firmwares mais antigos
declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.*", {path: now, value: now});

// ZTE (F6600P, etc)
declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.*", {path: now, value: now});

// Huawei (EG8145V5, etc) - usa X_HW_
declare("InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.*", {path: now, value: now});

// Datacom (DM985, etc)
declare("InternetGatewayDevice.WANDevice.1.X_DATACOM_GponInterfaceConfig.*", {path: now, value: now});

// TP-Link (XX530v, etc) - pode usar Device.Optical ou IGD
declare("InternetGatewayDevice.WANDevice.1.X_TP_GponInterfaceConfig.*", {path: now, value: now});
declare("Device.Optical.*", {path: now, value: now});
declare("Device.Optical.Interface.*", {path: now, value: now});
declare("Device.Optical.Interface.1.Stats.*", {path: now, value: now});

// China Telecom paths
declare("InternetGatewayDevice.X_CT-COM_GponInterfaceConfig.*", {path: now, value: now});

// Nokia / Alcatel-Lucent
declare("InternetGatewayDevice.WANDevice.1.X_ALU_GponInterfaceConfig.*", {path: now, value: now});

// Paths genéricos sem prefixo de fabricante
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.*", {path: now, value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.RXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.TXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.Temperature", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.1.Voltage", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TXPower", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.Temperature", {value: now});
declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.Voltage", {value: now});

// Temperatura do dispositivo
declare("InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.*", {path: now, value: now});

// Ethernet Interface Config para status das portas
declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.*", {path: now, value: now});
declare("Device.Ethernet.Interface.*", {path: now, value: now});
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
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-wifi" },
      { type: "provision", name: "netcontrol-pon" },
      { type: "provision", name: "netcontrol-lan" },
      { type: "provision", name: "netcontrol-diagnostics" },
      { type: "provision", name: "netcontrol-set-inform", args: { "0": "300" } },
    ],
  },
  "netcontrol-periodic": {
    weight: 0,
    channel: "netcontrol",
    events: { "2 PERIODIC": true },
    configurations: [
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-wifi" },
      { type: "provision", name: "netcontrol-pon" },
    ],
  },
  "netcontrol-boot": {
    weight: 0,
    channel: "netcontrol",
    events: { "1 BOOT": true },
    configurations: [
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-wifi" },
      { type: "provision", name: "netcontrol-pon" },
      { type: "provision", name: "netcontrol-lan" },
      { type: "provision", name: "netcontrol-diagnostics" },
    ],
  },
  "netcontrol-value-change": {
    weight: 0,
    channel: "netcontrol",
    events: { "4 VALUE CHANGE": true },
    configurations: [
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-pon" },
    ],
  },
};

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
  updatedProvisions["netcontrol-set-inform"] = updatedProvisions["netcontrol-set-inform"]
    .replace('args[0] || "300"', `args[0] || "${informInterval}"`);

  for (const [name, script] of Object.entries(updatedProvisions)) {
    try {
      const res = await geniePut(`/provisions/${name}`, script, "application/javascript");
      result.provisions.push({ name, success: res.ok });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      result.provisions.push({ name, success: false, error: message });
    }
  }

  const updatedPresets = JSON.parse(JSON.stringify(PRESETS));
  const bootstrapSetInform = updatedPresets["netcontrol-bootstrap"].configurations.find(
    (c: { name: string }) => c.name === "netcontrol-set-inform"
  );
  if (bootstrapSetInform) {
    bootstrapSetInform.args = { "0": String(informInterval) };
  }

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
