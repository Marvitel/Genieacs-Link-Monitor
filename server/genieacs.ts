const GENIEACS_NBI_URL = process.env.GENIEACS_NBI_URL || "http://localhost:7557";
const GENIEACS_TIMEOUT = 10000;

export class GenieACSError extends Error {
  constructor(message: string, public statusCode: number = 502) {
    super(message);
    this.name = "GenieACSError";
  }
}

export interface GenieACSDevice {
  _id: string;
  _registered: string;
  _lastInform: string;
  _lastBoot: string;
  _lastBootstrap: string;
  _deviceId: {
    _Manufacturer: string;
    _OUI: string;
    _ProductClass: string;
    _SerialNumber: string;
  };
  [key: string]: unknown;
}

export interface GenieACSTask {
  _id: string;
  device: string;
  name: string;
  status?: string;
  fault?: unknown;
  timestamp: string;
}

function buildQuery(filter: Record<string, unknown>): string {
  return encodeURIComponent(JSON.stringify(filter));
}

async function genieFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENIEACS_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GenieACSError("GenieACS não respondeu (timeout)");
    }
    throw new GenieACSError("Não foi possível conectar ao GenieACS");
  } finally {
    clearTimeout(timeout);
  }
}

export async function genieCheckConnectivity(): Promise<boolean> {
  try {
    const res = await genieFetch(`${GENIEACS_NBI_URL}/devices?limit=1`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function genieGetDevices(filter?: Record<string, unknown>): Promise<GenieACSDevice[]> {
  let url = `${GENIEACS_NBI_URL}/devices`;
  if (filter) {
    url += `?query=${buildQuery(filter)}`;
  }
  const res = await genieFetch(url);
  if (!res.ok) throw new GenieACSError(`GenieACS retornou erro ${res.status}`, res.status);
  return await res.json();
}

export async function genieGetDevice(deviceId: string): Promise<GenieACSDevice | null> {
  const filter = { _id: deviceId };
  const url = `${GENIEACS_NBI_URL}/devices?query=${buildQuery(filter)}`;
  const res = await genieFetch(url);
  if (!res.ok) throw new GenieACSError(`GenieACS retornou erro ${res.status}`, res.status);
  const devices: GenieACSDevice[] = await res.json();
  return devices[0] || null;
}

export async function genieGetDeviceParameters(deviceId: string, parameterPath: string): Promise<unknown> {
  const filter = { _id: deviceId };
  const projection = parameterPath;
  const url = `${GENIEACS_NBI_URL}/devices?query=${buildQuery(filter)}&projection=${projection}`;
  const res = await genieFetch(url);
  if (!res.ok) throw new GenieACSError(`GenieACS retornou erro ${res.status}`, res.status);
  const devices = await res.json();
  return devices[0] || null;
}

export async function genieSetDeviceParameter(
  deviceId: string,
  parameterPath: string,
  value: string | number | boolean
): Promise<boolean> {
  const valueType = typeof value === "number" ? "xsd:unsignedInt" :
                    typeof value === "boolean" ? "xsd:boolean" : "xsd:string";
  const task = {
    name: "setParameterValues",
    parameterValues: [[parameterPath, value, valueType]],
  };
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
  const res = await genieFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok && res.status !== 202) {
    throw new GenieACSError(`Falha ao definir parâmetro: ${res.status}`);
  }
  return true;
}

export async function genieSetMultipleParameters(
  deviceId: string,
  parameters: Array<[string, string | number | boolean, string?]>
): Promise<boolean> {
  const parameterValues = parameters.map(([path, value, type]) => {
    const valueType = type || (typeof value === "number" ? "xsd:unsignedInt" :
                      typeof value === "boolean" ? "xsd:boolean" : "xsd:string");
    return [path, value, valueType];
  });
  const task = {
    name: "setParameterValues",
    parameterValues,
  };
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
  const res = await genieFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok && res.status !== 202) {
    throw new GenieACSError(`Falha ao definir parâmetros: ${res.status}`);
  }
  return true;
}

export async function genieRebootDevice(deviceId: string): Promise<boolean> {
  const task = { name: "reboot" };
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
  const res = await genieFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok && res.status !== 202) {
    throw new GenieACSError(`Falha ao enviar reboot: ${res.status}`);
  }
  return true;
}

export async function genieFactoryReset(deviceId: string): Promise<boolean> {
  const task = { name: "factoryReset" };
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
  const res = await genieFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok && res.status !== 202) {
    throw new GenieACSError(`Falha ao enviar factory reset: ${res.status}`);
  }
  return true;
}

export async function genieRefreshDevice(deviceId: string, objectPath: string = ""): Promise<boolean> {
  const task = {
    name: "getParameterValues",
    parameterNames: [objectPath || "InternetGatewayDevice"],
  };
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
  const res = await genieFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok && res.status !== 202) {
    throw new GenieACSError(`Falha ao atualizar parâmetros: ${res.status}`);
  }
  return true;
}

export async function genieRunDiagnostic(
  deviceId: string,
  diagnosticType: "ping" | "traceroute" | "download" | "upload",
  host: string
): Promise<boolean> {
  let parameterPath: string;
  const parameters: Array<[string, string | number | boolean]> = [];

  switch (diagnosticType) {
    case "ping":
      parameterPath = "InternetGatewayDevice.IPPingDiagnostics";
      parameters.push(
        [`${parameterPath}.Host`, host],
        [`${parameterPath}.NumberOfRepetitions`, 4],
        [`${parameterPath}.Timeout`, 5000],
        [`${parameterPath}.DataBlockSize`, 64],
        [`${parameterPath}.DiagnosticsState`, "Requested"]
      );
      break;
    case "traceroute":
      parameterPath = "InternetGatewayDevice.TraceRouteDiagnostics";
      parameters.push(
        [`${parameterPath}.Host`, host],
        [`${parameterPath}.MaxHopCount`, 30],
        [`${parameterPath}.Timeout`, 5000],
        [`${parameterPath}.DataBlockSize`, 38],
        [`${parameterPath}.DiagnosticsState`, "Requested"]
      );
      break;
    case "download":
      parameterPath = "InternetGatewayDevice.DownloadDiagnostics";
      parameters.push(
        [`${parameterPath}.DownloadURL`, host],
        [`${parameterPath}.DiagnosticsState`, "Requested"]
      );
      break;
    case "upload":
      parameterPath = "InternetGatewayDevice.UploadDiagnostics";
      parameters.push(
        [`${parameterPath}.UploadURL`, host],
        [`${parameterPath}.DiagnosticsState`, "Requested"]
      );
      break;
  }

  await genieSetMultipleParameters(
    deviceId,
    parameters.map(([p, v]) => [p, v])
  );
  return true;
}

export async function genieGetDiagnosticResult(
  deviceId: string,
  diagnosticType: "ping" | "traceroute"
): Promise<Record<string, unknown> | null> {
  let path: string;
  if (diagnosticType === "ping") {
    path = "InternetGatewayDevice.IPPingDiagnostics";
  } else {
    path = "InternetGatewayDevice.TraceRouteDiagnostics";
  }
  const result = await genieGetDeviceParameters(deviceId, path);
  if (!result) return null;
  return result as Record<string, unknown>;
}

export async function genieDownloadFirmware(
  deviceId: string,
  fileId: string,
  fileName: string
): Promise<boolean> {
  const task = {
    name: "download",
    file: fileId,
    fileName: fileName,
  };
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
  const res = await genieFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok && res.status !== 202) {
    throw new GenieACSError(`Falha ao enviar firmware: ${res.status}`);
  }
  return true;
}

export async function genieUploadFile(
  fileName: string,
  fileType: string,
  oui: string,
  productClass: string,
  version: string,
  fileData: Buffer
): Promise<boolean> {
  const url = `${GENIEACS_NBI_URL}/files/${encodeURIComponent(fileName)}`;
  const res = await genieFetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "fileType": fileType,
      "oui": oui,
      "productClass": productClass,
      "version": version,
    },
    body: fileData,
  });
  if (!res.ok) throw new GenieACSError(`Falha ao enviar arquivo: ${res.status}`);
  return true;
}

export async function genieGetTasks(deviceId: string): Promise<GenieACSTask[]> {
  const filter = { device: deviceId };
  const url = `${GENIEACS_NBI_URL}/tasks?query=${buildQuery(filter)}`;
  const res = await genieFetch(url);
  if (!res.ok) throw new GenieACSError(`GenieACS retornou erro ${res.status}`, res.status);
  return await res.json();
}

export async function genieDeleteDevice(deviceId: string): Promise<boolean> {
  const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}`;
  const res = await genieFetch(url, { method: "DELETE" });
  if (!res.ok) throw new GenieACSError(`Falha ao remover dispositivo: ${res.status}`);
  return true;
}

export async function genieGetPresets(): Promise<unknown[]> {
  const url = `${GENIEACS_NBI_URL}/presets`;
  const res = await genieFetch(url);
  if (!res.ok) throw new GenieACSError(`GenieACS retornou erro ${res.status}`, res.status);
  return await res.json();
}

export async function genieGetFiles(): Promise<unknown[]> {
  const url = `${GENIEACS_NBI_URL}/files`;
  const res = await genieFetch(url);
  if (!res.ok) throw new GenieACSError(`GenieACS retornou erro ${res.status}`, res.status);
  return await res.json();
}

export async function genieDeleteFile(fileId: string): Promise<boolean> {
  const url = `${GENIEACS_NBI_URL}/files/${encodeURIComponent(fileId)}`;
  const res = await genieFetch(url, { method: "DELETE" });
  if (!res.ok) throw new GenieACSError(`Falha ao remover arquivo: ${res.status}`);
  return true;
}

function getVal(device: GenieACSDevice, path: string): string | number | null {
  const parts = path.split(".");
  let current: unknown = device;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  if (current && typeof current === "object" && current !== null && "_value" in (current as Record<string, unknown>)) {
    const val = (current as Record<string, unknown>)["_value"];
    if (typeof val === "string" || typeof val === "number") return val;
    return null;
  }
  if (typeof current === "string" || typeof current === "number") return current;
  return null;
}

function firstOf(device: GenieACSDevice, ...paths: string[]): string | number | null {
  for (const path of paths) {
    const val = getVal(device, path);
    if (val !== null && val !== "" && val !== 0) return val;
  }
  return null;
}

export function extractDeviceInfo(device: GenieACSDevice) {
  const manufacturer = device._deviceId?._Manufacturer ?? "";
  const serialNumber = device._deviceId?._SerialNumber ?? "";
  const productClass = device._deviceId?._ProductClass ?? "";
  const igd = "InternetGatewayDevice";
  const dev = "Device";

  const firmwareVersion = firstOf(device,
    `${igd}.DeviceInfo.SoftwareVersion`,
    `${dev}.DeviceInfo.SoftwareVersion`
  ) as string || "";

  const hardwareVersion = firstOf(device,
    `${igd}.DeviceInfo.HardwareVersion`,
    `${dev}.DeviceInfo.HardwareVersion`
  ) as string || "";

  const uptime = firstOf(device,
    `${igd}.DeviceInfo.UpTime`,
    `${dev}.DeviceInfo.UpTime`
  );

  const macAddress = firstOf(device,
    `${igd}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.MACAddress`,
    `${igd}.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.MACAddress`,
    `${igd}.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress`,
    `${igd}.DeviceInfo.X_CMCC_MAC`,
    `${dev}.Ethernet.Interface.1.MACAddress`,
    `${dev}.DeviceInfo.SerialNumber`
  ) as string || "";

  const ipAddress = firstOf(device,
    `${igd}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress`,
    `${igd}.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress`,
    `${igd}.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.ExternalIPAddress`,
    `${dev}.IP.Interface.1.IPv4Address.1.IPAddress`
  ) as string || "";

  const pppoeUser = firstOf(device,
    `${igd}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username`,
    `${igd}.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Username`,
    `${dev}.PPP.Interface.1.Username`
  ) as string || "";

  const ssid = firstOf(device,
    `${igd}.LANDevice.1.WLANConfiguration.1.SSID`,
    `${dev}.WiFi.SSID.1.SSID`
  ) as string || "";

  const ssid5g = firstOf(device,
    `${igd}.LANDevice.1.WLANConfiguration.5.SSID`,
    `${igd}.LANDevice.1.WLANConfiguration.3.SSID`,
    `${igd}.LANDevice.1.WLANConfiguration.2.SSID`,
    `${dev}.WiFi.SSID.2.SSID`
  ) as string || "";

  const wifiChannel = firstOf(device,
    `${igd}.LANDevice.1.WLANConfiguration.1.Channel`,
    `${dev}.WiFi.Radio.1.Channel`
  ) as string || "";

  const wifiChannel5g = firstOf(device,
    `${igd}.LANDevice.1.WLANConfiguration.5.Channel`,
    `${igd}.LANDevice.1.WLANConfiguration.3.Channel`,
    `${igd}.LANDevice.1.WLANConfiguration.2.Channel`,
    `${dev}.WiFi.Radio.2.Channel`
  ) as string || "";

  const wifiPassword = firstOf(device,
    `${igd}.LANDevice.1.WLANConfiguration.1.KeyPassphrase`,
    `${igd}.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase`,
    `${dev}.WiFi.AccessPoint.1.Security.KeyPassphrase`
  ) as string || "";

  const wifiPassword5g = firstOf(device,
    `${igd}.LANDevice.1.WLANConfiguration.5.KeyPassphrase`,
    `${igd}.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase`,
    `${igd}.LANDevice.1.WLANConfiguration.3.KeyPassphrase`,
    `${igd}.LANDevice.1.WLANConfiguration.2.KeyPassphrase`,
    `${dev}.WiFi.AccessPoint.2.Security.KeyPassphrase`
  ) as string || "";

  const rxPower = firstOf(device,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.RXPower`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.RXPower`,
    `${igd}.X_GponInterfaceConfig.1.RXPower`,
    `${igd}.X_GponInterafceConfig.1.RXPower`,
    `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower`
  ) as number | null;

  const txPower = firstOf(device,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.TXPower`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.TXPower`,
    `${igd}.X_GponInterfaceConfig.1.TXPower`,
    `${igd}.X_GponInterafceConfig.1.TXPower`,
    `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.TXPower`
  ) as number | null;

  const temperature = firstOf(device,
    `${igd}.DeviceInfo.TemperatureStatus.TemperatureSensor.1.Value`,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.Temperature`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.Temperature`,
    `${igd}.X_GponInterfaceConfig.1.Temperature`,
    `${igd}.X_GponInterafceConfig.1.Temperature`
  ) as number | null;

  const voltage = firstOf(device,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.Voltage`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.Voltage`,
    `${igd}.X_GponInterfaceConfig.1.Voltage`,
    `${igd}.X_GponInterafceConfig.1.Voltage`
  ) as number | null;

  const connectionType = pppoeUser ? "PPPoE" : (ipAddress ? "DHCP" : "");

  return {
    genieId: device._id,
    manufacturer,
    serialNumber,
    model: productClass,
    lastInform: device._lastInform,
    lastBoot: device._lastBoot,
    firmwareVersion,
    hardwareVersion,
    macAddress,
    ipAddress,
    uptime: uptime !== null ? Number(uptime) : 0,
    ssid,
    ssid5g,
    wifiChannel: String(wifiChannel || ""),
    wifiChannel5g: String(wifiChannel5g || ""),
    wifiPassword,
    wifiPassword5g,
    pppoeUser,
    connectionType,
    rxPower: rxPower !== null ? (typeof rxPower === 'number' && rxPower > 1000 ? rxPower / 10000 : rxPower) : null,
    txPower: txPower !== null ? (typeof txPower === 'number' && txPower > 1000 ? txPower / 10000 : txPower) : null,
    temperature: temperature !== null ? (typeof temperature === 'number' && temperature > 1000 ? temperature / 256 : temperature) : null,
    voltage,
  };
}

export function isGenieACSConfigured(): boolean {
  return !!process.env.GENIEACS_NBI_URL;
}
