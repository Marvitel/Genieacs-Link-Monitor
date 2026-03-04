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
  const task = {
    name: "setParameterValues",
    parameterValues: [[parameterPath, value, "xsd:string"]],
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

export function extractDeviceInfo(device: GenieACSDevice) {
  const get = (path: string): string | number | null => {
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
  };

  const manufacturer = device._deviceId?._Manufacturer ?? "";
  const serialNumber = device._deviceId?._SerialNumber ?? "";
  const productClass = device._deviceId?._ProductClass ?? "";

  return {
    genieId: device._id,
    manufacturer,
    serialNumber,
    model: productClass,
    lastInform: device._lastInform,
    lastBoot: device._lastBoot,
    firmwareVersion: (get("InternetGatewayDevice.DeviceInfo.SoftwareVersion") ?? get("Device.DeviceInfo.SoftwareVersion") ?? "") as string,
    macAddress: (get("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.MACAddress") ?? "") as string,
    ipAddress: (get("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress") ?? "") as string,
    uptime: (get("InternetGatewayDevice.DeviceInfo.UpTime") ?? get("Device.DeviceInfo.UpTime") ?? 0) as number,
    ssid: (get("InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID") ?? get("Device.WiFi.SSID.1.SSID") ?? "") as string,
    pppoeUser: (get("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username") ?? "") as string,
    rxPower: get("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower") as number | null,
    txPower: get("InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower") as number | null,
    temperature: get("InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.1.Value") as number | null,
  };
}

export function isGenieACSConfigured(): boolean {
  return !!process.env.GENIEACS_NBI_URL;
}
