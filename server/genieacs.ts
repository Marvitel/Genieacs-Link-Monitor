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

export async function genieRefreshFullDevice(deviceId: string): Promise<{ tasks: string[]; errors: string[] }> {
  const tasks: string[] = [];
  const errors: string[] = [];

  const pathGroups = [
    ["InternetGatewayDevice.DeviceInfo.", "Device.DeviceInfo."],
    ["InternetGatewayDevice.WANDevice.", "Device.IP.", "Device.PPP."],
    ["InternetGatewayDevice.LANDevice.", "Device.Hosts.", "Device.Ethernet."],
    ["InternetGatewayDevice.Services.", "Device.Services."],
  ];

  for (const group of pathGroups) {
    try {
      const task = {
        name: "getParameterValues",
        parameterNames: group,
      };
      const url = `${GENIEACS_NBI_URL}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
      const res = await genieFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (res.ok || res.status === 202) {
        tasks.push(group.join(", "));
      } else {
        errors.push(`${group.join(", ")}: status ${res.status}`);
      }
    } catch (err: unknown) {
      errors.push(`${group.join(", ")}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }

  return { tasks, errors };
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
    `${igd}.WANDevice.1.X_GponInterfaceConfig.RXPower`,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.RXPower`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.RXPower`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.RXPower`,
    `${igd}.WANDevice.1.GponInterfaceConfig.RXPower`,
    `${igd}.WANDevice.1.GponInterfaceConfig.1.RXPower`,
    `${igd}.WANDevice.1.X_HW_GponInterfaceConfig.RXPower`,
    `${igd}.WANDevice.1.X_DATACOM_GponInterfaceConfig.RXPower`,
    `${igd}.WANDevice.1.X_TP_GponInterfaceConfig.RXPower`,
    `${igd}.WANDevice.1.X_ALU_GponInterfaceConfig.RXPower`,
    `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower`,
    `${igd}.X_CT-COM_GponInterfaceConfig.RXPower`,
    `${igd}.X_GponInterfaceConfig.RXPower`,
    `${igd}.X_GponInterfaceConfig.1.RXPower`,
    `${igd}.WANDevice.2.X_ZTE-COM_GponInterfaceConfig.RXPower`
  ) as number | null;

  const txPower = firstOf(device,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.TXPower`,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.TXPower`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.TXPower`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.TXPower`,
    `${igd}.WANDevice.1.GponInterfaceConfig.TXPower`,
    `${igd}.WANDevice.1.GponInterfaceConfig.1.TXPower`,
    `${igd}.WANDevice.1.X_HW_GponInterfaceConfig.TXPower`,
    `${igd}.WANDevice.1.X_DATACOM_GponInterfaceConfig.TXPower`,
    `${igd}.WANDevice.1.X_TP_GponInterfaceConfig.TXPower`,
    `${igd}.WANDevice.1.X_ALU_GponInterfaceConfig.TXPower`,
    `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.TXPower`,
    `${igd}.X_CT-COM_GponInterfaceConfig.TXPower`,
    `${igd}.X_GponInterfaceConfig.TXPower`,
    `${igd}.X_GponInterfaceConfig.1.TXPower`,
    `${igd}.WANDevice.2.X_ZTE-COM_GponInterfaceConfig.TXPower`
  ) as number | null;

  const temperature = firstOf(device,
    `${igd}.DeviceInfo.TemperatureStatus.TemperatureSensor.1.Value`,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.Temperature`,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.Temperature`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.Temperature`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.Temperature`,
    `${igd}.WANDevice.1.GponInterfaceConfig.Temperature`,
    `${igd}.WANDevice.1.GponInterfaceConfig.1.Temperature`,
    `${igd}.WANDevice.1.X_HW_GponInterfaceConfig.Temperature`,
    `${igd}.WANDevice.1.X_DATACOM_GponInterfaceConfig.Temperature`,
    `${igd}.WANDevice.1.X_TP_GponInterfaceConfig.Temperature`,
    `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.TransceiverTemperature`,
    `${igd}.X_CT-COM_GponInterfaceConfig.Temperature`,
    `${igd}.X_GponInterfaceConfig.Temperature`,
    `${igd}.X_GponInterfaceConfig.1.Temperature`,
    `${igd}.WANDevice.2.X_ZTE-COM_GponInterfaceConfig.Temperature`
  ) as number | null;

  const voltage = firstOf(device,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.Voltage`,
    `${igd}.WANDevice.1.X_GponInterfaceConfig.1.Voltage`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.Voltage`,
    `${igd}.WANDevice.1.X_GponInterafceConfig.1.Voltage`,
    `${igd}.WANDevice.1.GponInterfaceConfig.Voltage`,
    `${igd}.WANDevice.1.GponInterfaceConfig.1.Voltage`,
    `${igd}.WANDevice.1.X_HW_GponInterfaceConfig.Voltage`,
    `${igd}.WANDevice.1.X_DATACOM_GponInterfaceConfig.Voltage`,
    `${igd}.WANDevice.1.X_TP_GponInterfaceConfig.Voltage`,
    `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.SupplyVottage`,
    `${igd}.X_CT-COM_GponInterfaceConfig.Voltage`,
    `${igd}.X_GponInterfaceConfig.Voltage`,
    `${igd}.X_GponInterfaceConfig.1.Voltage`,
    `${igd}.WANDevice.2.X_ZTE-COM_GponInterfaceConfig.Voltage`
  ) as number | null;

  const tpGponRx = getVal(device, `${dev}.Optical.Interface.1.X_TP_GPON_Config.RXPower`) as number | null;
  const tpGponTx = getVal(device, `${dev}.Optical.Interface.1.X_TP_GPON_Config.TXPower`) as number | null;
  const tpGponTemp = getVal(device, `${dev}.Optical.Interface.1.X_TP_GPON_Config.TransceiverTemperature`) as number | null;
  const tpGponVolt = getVal(device, `${dev}.Optical.Interface.1.X_TP_GPON_Config.SupplyVottage`) as number | null;

  const ctComRx = getVal(device, `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower`) as number | null;
  const ctComTx = getVal(device, `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.TXPower`) as number | null;
  const ctComTemp = getVal(device, `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.TransceiverTemperature`) as number | null;
  const ctComVolt = getVal(device, `${igd}.WANDevice.1.X_CT-COM_GponInterfaceConfig.SupplyVottage`) as number | null;

  let finalRx = rxPower;
  let finalTx = txPower;
  let finalTemp = temperature;
  let finalVolt = voltage;

  if (finalRx === null && tpGponRx !== null && tpGponRx > 0) {
    finalRx = Math.round((10 * Math.log10(tpGponRx / 10000)) * 100) / 100;
  }
  if (finalTx === null && tpGponTx !== null && tpGponTx > 0) {
    finalTx = Math.round((10 * Math.log10(tpGponTx / 10000)) * 100) / 100;
  }
  if (finalTemp === null && tpGponTemp !== null && tpGponTemp > 0) {
    finalTemp = Math.round((tpGponTemp / 256) * 10) / 10;
  }
  if (finalVolt === null && tpGponVolt !== null && tpGponVolt > 0) {
    finalVolt = Math.round((tpGponVolt / 1000) * 1000) / 1000;
  }

  if (finalRx === null && ctComRx !== null && ctComRx > 0) {
    finalRx = Math.round((10 * Math.log10(ctComRx / 10000)) * 100) / 100;
  }
  if (finalTx === null && ctComTx !== null && ctComTx > 0) {
    finalTx = Math.round((10 * Math.log10(ctComTx / 10000)) * 100) / 100;
  }
  if (finalTemp === null && ctComTemp !== null) {
    finalTemp = ctComTemp;
  }
  if (finalVolt === null && ctComVolt !== null && ctComVolt > 0) {
    finalVolt = Math.round((ctComVolt / 10000) * 10000) / 10000;
  }

  const connectionType = pppoeUser ? "PPPoE" : (ipAddress ? "DHCP" : "");

  function convertPonPower(val: number | null): number | null {
    if (val === null) return null;
    if (typeof val === 'number' && val > 10) {
      return Math.round((10 * Math.log10(val / 10000)) * 100) / 100;
    }
    return val;
  }

  function convertVoltage(val: number | null): number | null {
    if (val === null) return null;
    if (typeof val === 'number' && val > 1000) {
      return Math.round((val / 10000) * 10000) / 10000;
    }
    return val;
  }

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
    rxPower: convertPonPower(finalRx),
    txPower: convertPonPower(finalTx),
    temperature: finalTemp !== null ? (typeof finalTemp === 'number' && finalTemp > 1000 ? finalTemp / 256 : finalTemp) : null,
    voltage: convertVoltage(finalVolt),
  };
}

export interface ConnectedHost {
  hostName: string;
  ipAddress: string;
  macAddress: string;
  interfaceType?: string;
  active?: boolean;
  leaseTimeRemaining?: number;
}

export interface EthernetPort {
  index: number;
  status: string;
  macAddress: string;
  speed: string;
  duplex: string;
}

export interface WanConnection {
  index: number;
  name: string;
  type: string;
  ipAddress: string;
  macAddress: string;
  subnetMask: string;
  defaultGateway: string;
  dnsServers: string;
  status: string;
  username: string;
  uptime: number;
  natEnabled: boolean;
  vlanId: string;
  serviceList: string;
  connectionType: string;
  enabled: boolean;
  wanDeviceIndex: number;
  wcdIndex: number;
  connIndex: number;
}

export interface VoipLine {
  index: number;
  profileIndex: number;
  lineIndex: number;
  enabled: boolean;
  directoryNumber: string;
  status: string;
  sipUri: string;
  sipRegistrar: string;
  sipRegistrarPort: string;
  sipProxyServer: string;
  sipProxyPort: string;
  sipOutboundProxy: string;
  sipOutboundProxyPort: string;
  sipAuthUser: string;
  sipAuthPassword: string;
  sipDomain: string;
  callWaitingEnabled: boolean;
}

export interface DeviceLiveInfo {
  genieId: string;
  manufacturer: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  hardwareVersion: string;
  uptime: number;
  lastInform: string;
  lastBoot: string;
  macAddress: string;
  ipAddress: string;
  rxPower: number | null;
  txPower: number | null;
  temperature: number | null;
  voltage: number | null;
  ssid: string;
  ssid5g: string;
  wifiPassword: string;
  wifiPassword5g: string;
  wifiChannel: string;
  wifiChannel5g: string;
  wifiEnabled: boolean;
  wifiEnabled5g: boolean;
  pppoeUser: string;
  connectionType: string;
  connectedHosts: ConnectedHost[];
  ethernetPorts: EthernetPort[];
  wanConnections: WanConnection[];
  voipLines: VoipLine[];
  lanIp: string;
  lanSubnet: string;
  dhcpEnabled: boolean;
  dhcpStart: string;
  dhcpEnd: string;
  memoryUsage: number | null;
  cpuUsage: number | null;
}

function findPonData(device: GenieACSDevice): { rxPower: number | null; txPower: number | null; temperature: number | null; voltage: number | null } {
  const result = { rxPower: null as number | null, txPower: null as number | null, temperature: null as number | null, voltage: null as number | null };

  const igd = (device as Record<string, unknown>)["InternetGatewayDevice"] as Record<string, unknown> | undefined;
  if (igd) {
    const wanDevice1 = (igd["WANDevice"] as Record<string, unknown>)?.["1"] as Record<string, unknown> | undefined;
    const wanDevice2 = (igd["WANDevice"] as Record<string, unknown>)?.["2"] as Record<string, unknown> | undefined;
    const searchContainers = [wanDevice1, wanDevice2, igd];

    for (const container of searchContainers) {
      if (!container) continue;
      for (const [key, val] of Object.entries(container)) {
        if (key.startsWith("_")) continue;
        const keyLower = key.toLowerCase();
        if (!keyLower.includes("gpon") && !keyLower.includes("pon") && !keyLower.includes("optical")) continue;

        const branch = val as Record<string, unknown>;
        if (!branch || typeof branch !== "object") continue;

        const findInBranch = (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) {
            if (k.startsWith("_")) continue;
            const vObj = v as Record<string, unknown>;
            if (!vObj || typeof vObj !== "object") continue;

            if ("_value" in vObj) {
              const kl = k.toLowerCase();
              const numVal = Number(vObj._value);
              if (!isNaN(numVal)) {
                if (kl === "rxpower" && result.rxPower === null) result.rxPower = numVal;
                else if (kl === "txpower" && result.txPower === null) result.txPower = numVal;
                else if ((kl === "temperature" || kl === "transceivertemperature") && result.temperature === null) result.temperature = numVal;
                else if ((kl === "voltage" || kl === "supplyvottage" || kl === "supplyvoltage") && result.voltage === null) result.voltage = numVal;
              }
            } else {
              findInBranch(vObj);
            }
          }
        };
        findInBranch(branch);
      }
    }
  }

  const dev = (device as Record<string, unknown>)["Device"] as Record<string, unknown> | undefined;
  if (dev) {
    const tpGponCfg = (dev as any)?.Optical?.Interface?.["1"]?.X_TP_GPON_Config as Record<string, unknown> | undefined;
    if (tpGponCfg) {
      const rx = tpGponCfg.RXPower as Record<string, unknown> | undefined;
      const tx = tpGponCfg.TXPower as Record<string, unknown> | undefined;
      const temp = tpGponCfg.TransceiverTemperature as Record<string, unknown> | undefined;
      const volt = tpGponCfg.SupplyVottage as Record<string, unknown> | undefined;

      if (rx && "_value" in rx && result.rxPower === null) {
        const v = Number(rx._value);
        if (!isNaN(v) && v > 0) result.rxPower = Math.round((10 * Math.log10(v / 10000)) * 100) / 100;
      }
      if (tx && "_value" in tx && result.txPower === null) {
        const v = Number(tx._value);
        if (!isNaN(v) && v > 0) result.txPower = Math.round((10 * Math.log10(v / 10000)) * 100) / 100;
      }
      if (temp && "_value" in temp && result.temperature === null) {
        const v = Number(temp._value);
        if (!isNaN(v) && v > 0) result.temperature = Math.round((v / 256) * 10) / 10;
      }
      if (volt && "_value" in volt && result.voltage === null) {
        const v = Number(volt._value);
        if (!isNaN(v) && v > 0) result.voltage = Math.round((v / 1000) * 1000) / 1000;
      }
    }

    if (result.rxPower === null || result.txPower === null) {
      const ponBranches = ["Optical", "X_TP_GPON", "X_TP_DeviceComponent"];
      for (const branchName of ponBranches) {
        const branch = dev[branchName] as Record<string, unknown> | undefined;
        if (!branch) continue;
        const findInBranch = (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) {
            if (k.startsWith("_")) continue;
            const vObj = v as Record<string, unknown>;
            if (!vObj || typeof vObj !== "object") continue;
            if ("_value" in vObj) {
              const kl = k.toLowerCase();
              const numVal = Number(vObj._value);
              if (!isNaN(numVal)) {
                if ((kl === "rxpower" || kl === "receivepower" || kl === "opticalreceivepower" || kl === "opticalsignallevel") && result.rxPower === null) result.rxPower = numVal;
                else if ((kl === "txpower" || kl === "transmitpower" || kl === "opticaltransmitpower" || kl === "transmitopticallevel") && result.txPower === null) result.txPower = numVal;
                else if ((kl === "temperature" || kl === "transceivertemperature") && result.temperature === null) result.temperature = numVal;
                else if ((kl === "voltage" || kl === "supplyvottage" || kl === "supplyvoltage") && result.voltage === null) result.voltage = numVal;
              }
            } else {
              findInBranch(vObj);
            }
          }
        };
        findInBranch(branch);
      }
    }
  }

  return result;
}

function collectIndexed(device: GenieACSDevice, basePath: string, maxIndex: number = 20): Record<string, Record<string, string | number | null>> {
  const result: Record<string, Record<string, string | number | null>> = {};
  for (let i = 1; i <= maxIndex; i++) {
    const prefix = `${basePath}.${i}`;
    const testVal = getVal(device, prefix);
    const obj: Record<string, string | number | null> = {};
    const parts = basePath.split(".");
    let parent: unknown = device;
    for (const part of [...parts, String(i)]) {
      if (parent && typeof parent === "object" && part in parent) {
        parent = (parent as Record<string, unknown>)[part];
      } else {
        parent = null;
        break;
      }
    }
    if (!parent || typeof parent !== "object") continue;
    for (const [k, v] of Object.entries(parent as Record<string, unknown>)) {
      if (k.startsWith("_")) continue;
      if (v && typeof v === "object" && "_value" in (v as Record<string, unknown>)) {
        const val = (v as Record<string, unknown>)["_value"];
        if (typeof val === "string" || typeof val === "number") {
          obj[k] = val;
        }
      }
    }
    if (Object.keys(obj).length > 0) {
      result[String(i)] = obj;
    }
  }
  return result;
}

export function extractLiveDeviceInfo(device: GenieACSDevice): DeviceLiveInfo {
  const basic = extractDeviceInfo(device);
  const igd = "InternetGatewayDevice";
  const dev = "Device";

  const connectedHosts: ConnectedHost[] = [];
  for (let i = 1; i <= 200; i++) {
    const hostBase = `${igd}.LANDevice.1.Hosts.Host.${i}`;
    const mac = getVal(device, `${hostBase}.MACAddress`) as string | null;
    if (!mac) {
      const hostBase2 = `${dev}.Hosts.Host.${i}`;
      const mac2 = getVal(device, `${hostBase2}.MACAddress`) as string | null;
      if (!mac2) continue;
      connectedHosts.push({
        hostName: (getVal(device, `${hostBase2}.HostName`) as string) || "*",
        ipAddress: (getVal(device, `${hostBase2}.IPAddress`) as string) || "",
        macAddress: mac2,
        interfaceType: (getVal(device, `${hostBase2}.Layer1Interface`) as string) || "",
        active: getVal(device, `${hostBase2}.Active`) === true || getVal(device, `${hostBase2}.Active`) === 1,
      });
      continue;
    }
    connectedHosts.push({
      hostName: (getVal(device, `${hostBase}.HostName`) as string) || "*",
      ipAddress: (getVal(device, `${hostBase}.IPAddress`) as string) || "",
      macAddress: mac,
      interfaceType: (getVal(device, `${hostBase}.InterfaceType`) as string) || "",
      active: getVal(device, `${hostBase}.Active`) === true || getVal(device, `${hostBase}.Active`) === 1 || getVal(device, `${hostBase}.Active`) === "1",
      leaseTimeRemaining: getVal(device, `${hostBase}.LeaseTimeRemaining`) as number | undefined,
    });
  }

  const ethernetPorts: EthernetPort[] = [];
  for (let i = 1; i <= 8; i++) {
    const ethBase = `${igd}.LANDevice.1.LANEthernetInterfaceConfig.${i}`;
    const status = getVal(device, `${ethBase}.Status`) as string | null;
    const ethBase2 = `${dev}.Ethernet.Interface.${i}`;
    const status2 = getVal(device, `${ethBase2}.Status`) as string | null;
    if (status || status2) {
      const base = status ? ethBase : ethBase2;
      const s = (status || status2) as string;
      ethernetPorts.push({
        index: i,
        status: s,
        macAddress: (getVal(device, `${base}.MACAddress`) as string) || "",
        speed: String(getVal(device, `${base}.MaxBitRate`) || getVal(device, `${base}.CurrentBitRate`) || ""),
        duplex: (getVal(device, `${base}.DuplexMode`) as string) || "",
      });
    }
  }

  const wanConnections: WanConnection[] = [];
  for (let wd = 1; wd <= 4; wd++) {
    for (let wcd = 1; wcd <= 10; wcd++) {
      const wcdBase = `${igd}.WANDevice.${wd}.WANConnectionDevice.${wcd}`;
      for (const connType of ["WANPPPConnection", "WANIPConnection"]) {
        for (let ci = 1; ci <= 4; ci++) {
          const wanBase = `${wcdBase}.${connType}.${ci}`;
          const ip = getVal(device, `${wanBase}.ExternalIPAddress`) as string | null;
          const name = getVal(device, `${wanBase}.Name`) as string | null;
          const status = getVal(device, `${wanBase}.ConnectionStatus`) as string | null;
          const enable = getVal(device, `${wanBase}.Enable`);
          if (ip || name || status) {
            const vlan = getVal(device, `${wcdBase}.X_CT-COM_WANGponLinkConfig.VLANIDMark`)
              ?? getVal(device, `${wanBase}.X_VLAN_ID`)
              ?? getVal(device, `${wcdBase}.WANEthernetLinkConfig.X_VLAN_ID`);
            const serviceList = (getVal(device, `${wanBase}.X_CT-COM_ServiceList`) as string) || "";
            wanConnections.push({
              index: wanConnections.length + 1,
              name: (name || `WAN ${wd}.${wcd}`) as string,
              type: connType === "WANPPPConnection" ? "PPPoE" : "IPoE/DHCP",
              ipAddress: ip || "",
              macAddress: (getVal(device, `${wanBase}.MACAddress`) as string) || "",
              subnetMask: (getVal(device, `${wanBase}.SubnetMask`) as string) || "",
              defaultGateway: (getVal(device, `${wanBase}.DefaultGateway`) as string) || "",
              dnsServers: (getVal(device, `${wanBase}.DNSServers`) as string) || "",
              status: status || "",
              username: connType === "WANPPPConnection" ? ((getVal(device, `${wanBase}.Username`) as string) || "") : "",
              uptime: (getVal(device, `${wanBase}.Uptime`) as number) || 0,
              natEnabled: (() => { const nat = getVal(device, `${wanBase}.NATEnabled`); return nat === true || nat === 1 || nat === "1" || nat === "true"; })(),
              vlanId: vlan !== null && vlan !== undefined ? String(vlan) : "",
              serviceList,
              connectionType: (getVal(device, `${wanBase}.ConnectionType`) as string) || "",
              enabled: enable === true || enable === 1 || enable === "1" || enable === "Enabled",
              wanDeviceIndex: wd,
              wcdIndex: wcd,
              connIndex: ci,
            });
          }
        }
      }
    }
  }
  if (wanConnections.length === 0) {
    for (let i = 1; i <= 10; i++) {
      const ipBase = `${dev}.IP.Interface.${i}`;
      const ip = getVal(device, `${ipBase}.IPv4Address.1.IPAddress`) as string | null;
      if (ip) {
        wanConnections.push({
          index: wanConnections.length + 1,
          name: (getVal(device, `${ipBase}.Name`) as string) || `Interface ${i}`,
          type: "IPoE/DHCP",
          ipAddress: ip,
          macAddress: "",
          subnetMask: (getVal(device, `${ipBase}.IPv4Address.1.SubnetMask`) as string) || "",
          defaultGateway: "",
          dnsServers: "",
          status: (getVal(device, `${ipBase}.Status`) as string) || "",
          username: "",
          uptime: 0,
          natEnabled: false,
          vlanId: "",
          serviceList: "",
          connectionType: "",
          enabled: true,
          wanDeviceIndex: 0,
          wcdIndex: 0,
          connIndex: i,
        });
      }
    }
  }

  const voipLines: VoipLine[] = [];
  let voipIdx = 0;
  for (let pi = 1; pi <= 2; pi++) {
    for (let li = 1; li <= 2; li++) {
      const voipBase = `${igd}.Services.VoiceService.1.VoiceProfile.${pi}.Line.${li}`;
      const sipBase = `${igd}.Services.VoiceService.1.VoiceProfile.${pi}.SIP`;
      const dirNum = getVal(device, `${voipBase}.DirectoryNumber`) as string | null;
      const sipUri = getVal(device, `${voipBase}.SIP.URI`) as string | null;
      const enabled = getVal(device, `${voipBase}.Enable`);
      const authUser = getVal(device, `${voipBase}.SIP.AuthUserName`) as string | null;
      if (dirNum || sipUri || enabled !== null || authUser) {
        voipIdx++;
        voipLines.push({
          index: voipIdx,
          profileIndex: pi,
          lineIndex: li,
          enabled: enabled === true || enabled === 1 || enabled === "Enabled" || enabled === "1",
          directoryNumber: dirNum || "",
          status: (getVal(device, `${voipBase}.Status`) as string) || "",
          sipUri: sipUri || "",
          sipRegistrar: (getVal(device, `${sipBase}.RegistrarServer`) as string) || "",
          sipRegistrarPort: String(getVal(device, `${sipBase}.RegistrarServerPort`) || ""),
          sipProxyServer: (getVal(device, `${sipBase}.ProxyServer`) as string) || "",
          sipProxyPort: String(getVal(device, `${sipBase}.ProxyServerPort`) || ""),
          sipOutboundProxy: (getVal(device, `${sipBase}.OutboundProxy`) as string) || "",
          sipOutboundProxyPort: String(getVal(device, `${sipBase}.OutboundProxyPort`) || ""),
          sipAuthUser: authUser || "",
          sipAuthPassword: (getVal(device, `${voipBase}.SIP.AuthPassword`) as string) || "",
          sipDomain: (getVal(device, `${sipBase}.UserAgentDomain`) as string) || "",
          callWaitingEnabled: getVal(device, `${voipBase}.CallingFeatures.CallWaitingEnable`) === true ||
                              getVal(device, `${voipBase}.CallingFeatures.CallWaitingEnable`) === 1 ||
                              getVal(device, `${voipBase}.CallingFeatures.CallWaitingEnable`) === "1",
        });
      }
    }
  }

  const lanIp = (firstOf(device,
    `${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress`,
    `${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPAddress`,
    `${dev}.DHCPv4.Server.Pool.1.IPInterface`
  ) as string) || "";

  const lanSubnet = (firstOf(device,
    `${igd}.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask`,
    `${igd}.LANDevice.1.LANHostConfigManagement.SubnetMask`
  ) as string) || "";

  const dhcpEnabled = getVal(device, `${igd}.LANDevice.1.LANHostConfigManagement.DHCPServerEnable`);
  const dhcpStart = (getVal(device, `${igd}.LANDevice.1.LANHostConfigManagement.MinAddress`) as string) || "";
  const dhcpEnd = (getVal(device, `${igd}.LANDevice.1.LANHostConfigManagement.MaxAddress`) as string) || "";

  const wifiEnabled = getVal(device, `${igd}.LANDevice.1.WLANConfiguration.1.Enable`);
  const wifiEnabled5g = getVal(device, `${igd}.LANDevice.1.WLANConfiguration.5.Enable`) ??
                         getVal(device, `${igd}.LANDevice.1.WLANConfiguration.6.Enable`);

  const memUsage = firstOf(device,
    `${igd}.DeviceInfo.MemoryStatus.Free`,
    `${dev}.DeviceInfo.MemoryStatus.Free`
  ) as number | null;

  const cpuUsage = firstOf(device,
    `${igd}.DeviceInfo.ProcessStatus.CPUUsage`,
    `${dev}.DeviceInfo.ProcessStatus.CPUUsage`
  ) as number | null;

  const ponData = findPonData(device);
  const finalRxPower = basic.rxPower ?? ponData.rxPower;
  const finalTxPower = basic.txPower ?? ponData.txPower;
  const finalTemperature = basic.temperature ?? ponData.temperature;
  const finalVoltage = basic.voltage ?? ponData.voltage;

  return {
    ...basic,
    rxPower: finalRxPower !== null ? (typeof finalRxPower === 'number' && finalRxPower > 1000 ? finalRxPower / 10000 : finalRxPower) : null,
    txPower: finalTxPower !== null ? (typeof finalTxPower === 'number' && finalTxPower > 1000 ? finalTxPower / 10000 : finalTxPower) : null,
    temperature: finalTemperature !== null ? (typeof finalTemperature === 'number' && finalTemperature > 1000 ? finalTemperature / 256 : finalTemperature) : null,
    voltage: finalVoltage,
    uptime: basic.uptime,
    lastInform: basic.lastInform || "",
    lastBoot: basic.lastBoot || "",
    wifiEnabled: wifiEnabled === true || wifiEnabled === 1 || wifiEnabled === "1",
    wifiEnabled5g: wifiEnabled5g === true || wifiEnabled5g === 1 || wifiEnabled5g === "1",
    connectedHosts,
    ethernetPorts,
    wanConnections,
    voipLines,
    lanIp,
    lanSubnet,
    dhcpEnabled: dhcpEnabled === true || dhcpEnabled === 1 || dhcpEnabled === "1",
    dhcpStart,
    dhcpEnd,
    memoryUsage: memUsage,
    cpuUsage,
  };
}

export function isGenieACSConfigured(): boolean {
  return !!process.env.GENIEACS_NBI_URL;
}
