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

const IS_TR181_CHECK = `
const pc = declare("DeviceID.ProductClass", {value: 1}).value[0] || "";
const isTR181 = (pc === "Device2" || pc.indexOf("XX530") >= 0 || pc.indexOf("XX230") >= 0 || pc.indexOf("EX520") >= 0 || pc.indexOf("EX141") >= 0 || pc.indexOf("XC220") >= 0);
`;

const PROVISIONS: Record<string, string> = {
  "default": `
const hourly = Date.now(3600000);
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.DeviceInfo.HardwareVersion", {value: hourly});
  declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: hourly});
} else {
  declare("Device.DeviceInfo.HardwareVersion", {value: hourly});
  declare("Device.DeviceInfo.SoftwareVersion", {value: hourly});
}
`,

  "inform": `
const username = declare("DeviceID.ID", {value: 1}).value[0];
const password = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
const informInterval = 300;

${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.ManagementServer.ConnectionRequestUsername", {value: 1}, {value: username});
  declare("InternetGatewayDevice.ManagementServer.ConnectionRequestPassword", {value: 1}, {value: password});
  declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: 1}, {value: true});
  declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: 1}, {value: informInterval});
} else {
  declare("Device.ManagementServer.ConnectionRequestUsername", {value: 1}, {value: username});
  declare("Device.ManagementServer.ConnectionRequestPassword", {value: 1}, {value: password});
  declare("Device.ManagementServer.PeriodicInformEnable", {value: 1}, {value: true});
  declare("Device.ManagementServer.PeriodicInformInterval", {value: 1}, {value: informInterval});
}
`,

  "netcontrol-inform": `
const now = Date.now();
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});
  declare("InternetGatewayDevice.DeviceInfo.HardwareVersion", {value: now});
  declare("InternetGatewayDevice.DeviceInfo.UpTime", {value: now});
  declare("InternetGatewayDevice.DeviceInfo.ModelName", {value: now});
  declare("InternetGatewayDevice.DeviceInfo.SerialNumber", {value: now});
} else {
  declare("Device.DeviceInfo.SoftwareVersion", {value: now});
  declare("Device.DeviceInfo.HardwareVersion", {value: now});
  declare("Device.DeviceInfo.UpTime", {value: now});
  declare("Device.DeviceInfo.Manufacturer", {value: now});
  declare("Device.DeviceInfo.ModelName", {value: now});
  declare("Device.DeviceInfo.SerialNumber", {value: now});
}
`,

  "netcontrol-wan": `
const now = Date.now();
const hourly = Date.now(3600000);
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress", {value: now});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ConnectionStatus", {value: now});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Name", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.MACAddress", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.DefaultGateway", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.DNSServers", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress", {value: now});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionStatus", {value: now});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.MACAddress", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DefaultGateway", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DNSServers", {value: hourly});
} else {
  declare("Device.IP.Interface.*.IPv4Address.*.IPAddress", {value: now});
  declare("Device.IP.Interface.*.Status", {value: now});
  declare("Device.IP.Interface.*.Name", {value: hourly});
  declare("Device.PPP.Interface.*.IPCP.LocalIPAddress", {value: now});
  declare("Device.PPP.Interface.*.Status", {value: now});
  declare("Device.PPP.Interface.*.Username", {value: hourly});
  declare("Device.PPP.Interface.*.Name", {value: hourly});
}
`,

  "netcontrol-wifi": `
const hourly = Date.now(3600000);
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Channel", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Enable", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.KeyPassphrase", {value: 1});
  declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.PreSharedKey.1.KeyPassphrase", {value: 1});
} else {
  declare("Device.WiFi.SSID.*.SSID", {value: hourly});
  declare("Device.WiFi.SSID.*.Enable", {value: hourly});
  declare("Device.WiFi.SSID.*.LowerLayers", {value: hourly});
  declare("Device.WiFi.Radio.*.Channel", {value: hourly});
  declare("Device.WiFi.Radio.*.Enable", {value: hourly});
  declare("Device.WiFi.Radio.*.OperatingFrequencyBand", {value: hourly});
  declare("Device.WiFi.AccessPoint.*.Security.KeyPassphrase", {value: 1});
}
`,

  "netcontrol-pon": `
const hourly = Date.now(3600000);
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TXPower", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.Temperature", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.Voltage", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.RXPower", {value: hourly});
  declare("InternetGatewayDevice.WANDevice.1.GponInterfaceConfig.TXPower", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.Status", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.2.Status", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.3.Status", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.4.Status", {value: hourly});
} else {
  declare("Device.Optical.Interface.1.OpticalSignalLevel", {value: hourly});
  declare("Device.Optical.Interface.1.TransmitOpticalLevel", {value: hourly});
}
`,

  "netcontrol-lan": `
const hourly = Date.now(3600000);
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.IPAddress", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.HostName", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.MACAddress", {value: hourly});
  declare("InternetGatewayDevice.LANDevice.*.Hosts.Host.*.Active", {value: hourly});
} else {
  declare("Device.Hosts.Host.*.HostName", {value: hourly});
  declare("Device.Hosts.Host.*.IPAddress", {value: hourly});
  declare("Device.Hosts.Host.*.PhysAddress", {value: hourly});
  declare("Device.Hosts.Host.*.Active", {value: hourly});
}
`,

  "netcontrol-voip": `
const hourly = Date.now(3600000);
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServer", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.Enable", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.DirectoryNumber", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.Status", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.SIP.AuthUserName", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.1.SIP.URI", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.Enable", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.DirectoryNumber", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.Status", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.SIP.AuthUserName", {value: hourly});
  declare("InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.2.SIP.URI", {value: hourly});
}
`,

  "netcontrol-diagnostics": `
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.IPPingDiagnostics.*", {value: 1});
  declare("InternetGatewayDevice.TraceRouteDiagnostics.*", {value: 1});
} else {
  declare("Device.IP.Diagnostics.*", {value: 1});
}
`,

  "netcontrol-set-inform": `
const now = Date.now();
const INFORM_INTERVAL = args[0] || "300";
${IS_TR181_CHECK}

if (!isTR181) {
  declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
  declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: now}, {value: parseInt(INFORM_INTERVAL)});
} else {
  declare("Device.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
  declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: parseInt(INFORM_INTERVAL)});
}
`,

  "netcontrol-restore": `
${IS_TR181_CHECK}
const sn = declare("DeviceID.SerialNumber", {value: 1}).value[0];
if (!sn) { log("netcontrol-restore: no serial number"); return; }

let configJson;
try {
  configJson = ext("netcontrol", "getConfig", sn);
} catch(e) {
  return;
}
if (!configJson) return;

let config;
try {
  config = JSON.parse(configJson);
} catch(e) {
  return;
}

if (config.wifi) {
  if (!isTR181) {
    if (config.wifi.ssid) {
      declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", {value: 1}, {value: config.wifi.ssid});
    }
    if (config.wifi.password) {
      declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", {value: 1}, {value: config.wifi.password});
    }
    if (config.wifi.ssid5g) {
      declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID", {value: 1}, {value: config.wifi.ssid5g});
    }
    if (config.wifi.password5g) {
      declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", {value: 1}, {value: config.wifi.password5g});
    }
  } else {
    if (config.wifi.ssid) {
      declare("Device.WiFi.SSID.2.SSID", {value: 1}, {value: config.wifi.ssid});
    }
    if (config.wifi.password) {
      declare("Device.WiFi.AccessPoint.2.Security.KeyPassphrase", {value: 1}, {value: config.wifi.password});
    }
    if (config.wifi.ssid5g) {
      declare("Device.WiFi.SSID.3.SSID", {value: 1}, {value: config.wifi.ssid5g});
    }
    if (config.wifi.password5g) {
      declare("Device.WiFi.AccessPoint.3.Security.KeyPassphrase", {value: 1}, {value: config.wifi.password5g});
    }
  }
}

if (config.pppoe && config.pppoe.username) {
  if (!isTR181) {
    var wd = config.pppoe.wanDeviceIndex || 1;
    var wcd = config.pppoe.wcdIndex || 1;
    var ci = config.pppoe.connIndex || 1;
    declare("InternetGatewayDevice.WANDevice." + wd + ".WANConnectionDevice." + wcd + ".WANPPPConnection." + ci + ".Username", {value: 1}, {value: config.pppoe.username});
    if (config.pppoe.password) {
      declare("InternetGatewayDevice.WANDevice." + wd + ".WANConnectionDevice." + wcd + ".WANPPPConnection." + ci + ".Password", {value: 1}, {value: config.pppoe.password});
    }
  } else {
    var pci = config.pppoe.connIndex || 1;
    declare("Device.PPP.Interface." + pci + ".Username", {value: 1}, {value: config.pppoe.username});
    if (config.pppoe.password) {
      declare("Device.PPP.Interface." + pci + ".Password", {value: 1}, {value: config.pppoe.password});
    }
  }
}

if (config.lan && !isTR181) {
  var igd = "InternetGatewayDevice";
  if (config.lan.lanIp) {
    declare(igd + ".LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress", {value: 1}, {value: config.lan.lanIp});
  }
  if (config.lan.lanSubnet) {
    declare(igd + ".LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask", {value: 1}, {value: config.lan.lanSubnet});
  }
  if (config.lan.dhcpEnabled !== undefined) {
    declare(igd + ".LANDevice.1.LANHostConfigManagement.DHCPServerEnable", {value: 1}, {value: config.lan.dhcpEnabled});
  }
  if (config.lan.dhcpStart) {
    declare(igd + ".LANDevice.1.LANHostConfigManagement.MinAddress", {value: 1}, {value: config.lan.dhcpStart});
  }
  if (config.lan.dhcpEnd) {
    declare(igd + ".LANDevice.1.LANHostConfigManagement.MaxAddress", {value: 1}, {value: config.lan.dhcpEnd});
  }
}

log("netcontrol-restore: config applied for " + sn);
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
    events: { "0 BOOTSTRAP": true, "1 BOOT": true },
    configurations: [
      { type: "provision", name: "default" },
      { type: "provision", name: "inform" },
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-wifi" },
      { type: "provision", name: "netcontrol-pon" },
      { type: "provision", name: "netcontrol-lan" },
      { type: "provision", name: "netcontrol-voip" },
      { type: "provision", name: "netcontrol-diagnostics" },
      { type: "provision", name: "netcontrol-restore" },
    ],
  },
  "netcontrol-periodic": {
    weight: 0,
    channel: "netcontrol",
    events: { "2 PERIODIC": true },
    configurations: [
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
      { type: "provision", name: "netcontrol-pon" },
    ],
  },
  "netcontrol-value-change": {
    weight: 0,
    channel: "netcontrol",
    events: { "4 VALUE CHANGE": true },
    configurations: [
      { type: "provision", name: "netcontrol-inform" },
      { type: "provision", name: "netcontrol-wan" },
    ],
  },
};

export async function setupGenieACS(informInterval: number = 300): Promise<{
  provisions: { created: number; failed: number; errors: string[] };
  presets: { created: number; failed: number; errors: string[] };
  summary: string;
}> {
  const provisionResults = { created: 0, failed: 0, errors: [] as string[] };
  const presetResults = { created: 0, failed: 0, errors: [] as string[] };

  for (const [name, script] of Object.entries(PROVISIONS)) {
    const finalScript = script.replace(/300/g, informInterval.toString());
    try {
      const result = await geniePut(
        `/provisions/${encodeURIComponent(name)}`,
        finalScript,
        "text/plain"
      );
      if (result.ok) {
        provisionResults.created++;
      } else {
        provisionResults.failed++;
        provisionResults.errors.push(`${name}: status ${result.status}`);
      }
    } catch (err: unknown) {
      provisionResults.failed++;
      provisionResults.errors.push(`${name}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }

  for (const [name, preset] of Object.entries(PRESETS)) {
    try {
      const result = await geniePut(
        `/presets/${encodeURIComponent(name)}`,
        JSON.stringify(preset)
      );
      if (result.ok) {
        presetResults.created++;
      } else {
        presetResults.failed++;
        presetResults.errors.push(`${name}: status ${result.status}`);
      }
    } catch (err: unknown) {
      presetResults.failed++;
      presetResults.errors.push(`${name}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }

  const summary = `Provisions: ${provisionResults.created}/${Object.keys(PROVISIONS).length} criadas. Presets: ${presetResults.created}/${Object.keys(PRESETS).length} criados.`;

  return {
    provisions: provisionResults,
    presets: presetResults,
    summary,
  };
}

export async function getGenieACSSetupStatus(): Promise<{
  provisions: string[];
  presets: string[];
  missingProvisions: string[];
  missingPresets: string[];
}> {
  const existingProvisions = (await genieGet("/provisions/")) as Array<{ _id: string }>;
  const existingPresets = (await genieGet("/presets/")) as Array<{ _id: string }>;

  const provisionNames = existingProvisions.map((p) => p._id);
  const presetNames = existingPresets.map((p) => p._id);

  const requiredProvisions = Object.keys(PROVISIONS);
  const requiredPresets = Object.keys(PRESETS);

  return {
    provisions: provisionNames,
    presets: presetNames,
    missingProvisions: requiredProvisions.filter((p) => !provisionNames.includes(p)),
    missingPresets: requiredPresets.filter((p) => !presetNames.includes(p)),
  };
}
