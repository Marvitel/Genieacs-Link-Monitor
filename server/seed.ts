import { storage } from "./storage";
import { db } from "./db";
import { clients, devices, deviceLogs, configPresets } from "@shared/schema";

export async function seedDatabase() {
  const existingClients = await storage.getClients();
  if (existingClients.length > 0) return;

  console.log("Seeding database...");

  const c1 = await storage.createClient({
    name: "João Silva Pereira",
    document: "123.456.789-01",
    email: "joao.silva@email.com",
    phone: "(11) 98765-4321",
    address: "Rua das Flores, 123 - Centro, São Paulo/SP",
    plan: "200 Mbps",
    clientType: "residential",
    status: "active",
    notes: "Cliente desde 2021",
  });

  const c2 = await storage.createClient({
    name: "TechCorp Soluções LTDA",
    document: "12.345.678/0001-90",
    email: "contato@techcorp.com.br",
    phone: "(11) 3456-7890",
    address: "Av. Paulista, 1500 - Sala 1201, São Paulo/SP",
    plan: "500 Mbps Dedicado",
    clientType: "corporate",
    status: "active",
    notes: "Contrato corporativo - SLA 99.5%",
  });

  const c3 = await storage.createClient({
    name: "Maria Oliveira Santos",
    document: "987.654.321-00",
    email: "maria.oliveira@email.com",
    phone: "(21) 99876-5432",
    address: "Rua Copacabana, 456 - Apt 302, Rio de Janeiro/RJ",
    plan: "100 Mbps",
    clientType: "residential",
    status: "active",
  });

  const c4 = await storage.createClient({
    name: "Clínica Saúde Mais",
    document: "45.678.901/0001-23",
    email: "admin@saudemais.com.br",
    phone: "(31) 3333-4444",
    address: "Rua da Saúde, 789 - Belo Horizonte/MG",
    plan: "300 Mbps Dedicado",
    clientType: "corporate",
    status: "active",
    notes: "2 pontos de acesso + mesh",
  });

  const c5 = await storage.createClient({
    name: "Pedro Costa Lima",
    document: "456.789.012-34",
    email: "pedro.lima@email.com",
    phone: "(41) 98888-7777",
    address: "Rua Paraná, 321 - Curitiba/PR",
    plan: "50 Mbps",
    clientType: "residential",
    status: "suspended",
    notes: "Pagamento pendente",
  });

  const d1 = await storage.createDevice({
    clientId: c1.id,
    serialNumber: "HWTC12345678",
    model: "HG8245Q2",
    manufacturer: "Huawei",
    deviceType: "ont",
    macAddress: "AA:BB:CC:11:22:33",
    ipAddress: "192.168.1.1",
    status: "online",
    firmwareVersion: "V3R017C10S100",
    uptime: "15d 6h 32m",
    pppoeUser: "joao.silva@provedor",
    connectionType: "GPON",
    ponPort: "1/1/3",
    oltId: "OLT-SP-01",
    rxPower: -22.5,
    txPower: 2.1,
    temperature: 48,
    ssid: "SILVA_WIFI",
    wifiChannel: "6",
    wifiBand: "2.4 GHz + 5 GHz",
  });

  const d2 = await storage.createDevice({
    clientId: c2.id,
    serialNumber: "ZTEG87654321",
    model: "F670L",
    manufacturer: "ZTE",
    deviceType: "ont",
    macAddress: "DD:EE:FF:44:55:66",
    ipAddress: "10.0.1.1",
    status: "online",
    firmwareVersion: "V9.0.10P2N2",
    uptime: "45d 12h 5m",
    pppoeUser: "techcorp@provedor",
    connectionType: "GPON",
    ponPort: "1/1/5",
    oltId: "OLT-SP-01",
    rxPower: -18.3,
    txPower: 2.4,
    temperature: 42,
    ssid: "TECHCORP_CORP",
    wifiChannel: "36",
    wifiBand: "5 GHz",
  });

  const d3 = await storage.createDevice({
    clientId: c2.id,
    serialNumber: "MT-RB750GR3-001",
    model: "RB750Gr3",
    manufacturer: "MikroTik",
    deviceType: "router",
    macAddress: "11:22:33:AA:BB:CC",
    ipAddress: "10.0.1.2",
    status: "online",
    firmwareVersion: "RouterOS 7.14.1",
    uptime: "45d 11h 58m",
    connectionType: "Ethernet",
  });

  const d4 = await storage.createDevice({
    clientId: c3.id,
    serialNumber: "FH-AN5506-04F2A-001",
    model: "AN5506-04-F2A",
    manufacturer: "Fiberhome",
    deviceType: "ont",
    macAddress: "77:88:99:AA:BB:CC",
    ipAddress: "192.168.0.1",
    status: "warning",
    firmwareVersion: "RP2631",
    uptime: "3d 2h 15m",
    pppoeUser: "maria.oliveira@provedor",
    connectionType: "GPON",
    ponPort: "1/2/1",
    oltId: "OLT-RJ-01",
    rxPower: -27.8,
    txPower: 1.9,
    temperature: 62,
    ssid: "MARIA_NET",
    wifiChannel: "11",
    wifiBand: "2.4 GHz",
  });

  const d5 = await storage.createDevice({
    clientId: c4.id,
    serialNumber: "INT-R1200-001",
    model: "AX 1800",
    manufacturer: "Intelbras",
    deviceType: "ont",
    macAddress: "CC:DD:EE:11:22:33",
    ipAddress: "192.168.2.1",
    status: "online",
    firmwareVersion: "1.18.8",
    uptime: "22d 8h 45m",
    pppoeUser: "saudemais@provedor",
    connectionType: "GPON",
    ponPort: "1/1/8",
    oltId: "OLT-SP-01",
    rxPower: -20.1,
    txPower: 2.3,
    temperature: 45,
    ssid: "CLINICA_WIFI",
    wifiChannel: "1",
    wifiBand: "2.4 GHz + 5 GHz",
  });

  const d6 = await storage.createDevice({
    clientId: c4.id,
    serialNumber: "RJ-AP820-001",
    model: "AP820-I(V2)",
    manufacturer: "Ruijie",
    deviceType: "mesh",
    macAddress: "FF:EE:DD:CC:BB:AA",
    ipAddress: "192.168.2.10",
    status: "online",
    firmwareVersion: "11.9(3)B1P1",
    uptime: "22d 8h 40m",
    connectionType: "Ethernet",
    ssid: "CLINICA_WIFI",
    wifiChannel: "44",
    wifiBand: "5 GHz",
  });

  const d7 = await storage.createDevice({
    clientId: c4.id,
    serialNumber: "RJ-AP820-002",
    model: "AP820-I(V2)",
    manufacturer: "Ruijie",
    deviceType: "mesh",
    macAddress: "AA:BB:CC:DD:EE:11",
    ipAddress: "192.168.2.11",
    status: "online",
    firmwareVersion: "11.9(3)B1P1",
    uptime: "22d 8h 38m",
    connectionType: "Ethernet",
    ssid: "CLINICA_WIFI",
    wifiChannel: "149",
    wifiBand: "5 GHz",
  });

  const d8 = await storage.createDevice({
    clientId: c5.id,
    serialNumber: "PKS-2404G-001",
    model: "2404G",
    manufacturer: "Parks",
    deviceType: "ont",
    macAddress: "22:33:44:55:66:77",
    ipAddress: "192.168.1.1",
    status: "offline",
    firmwareVersion: "3.2.1",
    pppoeUser: "pedro.lima@provedor",
    connectionType: "GPON",
    ponPort: "1/3/2",
    oltId: "OLT-PR-01",
    rxPower: -30.5,
    txPower: 1.5,
    temperature: 55,
    ssid: "PEDRO_NET",
    wifiChannel: "6",
    wifiBand: "2.4 GHz",
  });

  await storage.createDeviceLog({
    deviceId: d1.id,
    eventType: "connect",
    message: "Dispositivo conectou à rede GPON",
    severity: "success",
  });

  await storage.createDeviceLog({
    deviceId: d4.id,
    eventType: "signal_low",
    message: "Sinal RX abaixo do limiar aceitável (-27.8 dBm)",
    severity: "warning",
  });

  await storage.createDeviceLog({
    deviceId: d8.id,
    eventType: "disconnect",
    message: "Dispositivo perdeu conexão com a OLT",
    severity: "error",
  });

  await storage.createDeviceLog({
    deviceId: d2.id,
    eventType: "config_update",
    message: "Configuração de SSID atualizada via TR-069",
    severity: "info",
  });

  await storage.createDeviceLog({
    deviceId: d4.id,
    eventType: "temperature_high",
    message: "Temperatura do dispositivo acima de 60°C (62°C)",
    severity: "warning",
  });

  await storage.createDeviceLog({
    deviceId: d3.id,
    eventType: "firmware_update",
    message: "Firmware atualizado para RouterOS 7.14.1",
    severity: "success",
  });

  await storage.createDeviceLog({
    deviceId: d5.id,
    eventType: "connect",
    message: "Reconexão PPPoE realizada com sucesso",
    severity: "info",
  });

  await storage.createDeviceLog({
    deviceId: d8.id,
    eventType: "signal_low",
    message: "Sinal RX em nível crítico (-30.5 dBm) antes da desconexão",
    severity: "error",
  });

  await storage.createConfigPreset({
    name: "Flashman - ONT Residencial Padrão",
    deviceType: "ont",
    manufacturer: "Huawei",
    description: "Configuração padrão Flashman para ONTs Huawei residenciais. Wi-Fi dual band, firewall básico, QoS habilitado.",
    configData: {
      wifi_2g: { enabled: true, channel: "auto", bandwidth: "20/40MHz", security: "WPA2-PSK" },
      wifi_5g: { enabled: true, channel: "auto", bandwidth: "80MHz", security: "WPA2-PSK" },
      firewall: { enabled: true, level: "medium" },
      qos: { enabled: true, priority: "gaming" },
      tr069: { enabled: true, interval: 300 },
    },
  });

  await storage.createConfigPreset({
    name: "Corporativo - MikroTik",
    deviceType: "router",
    manufacturer: "MikroTik",
    description: "Configuração para roteadores MikroTik em ambientes corporativos. VLANs, firewall avançado, OSPF.",
    configData: {
      firewall: { enabled: true, level: "high", rules: ["drop invalid", "accept established"] },
      routing: { protocol: "OSPF", area: "0.0.0.0" },
      vlans: [{ id: 10, name: "Management" }, { id: 20, name: "Users" }, { id: 30, name: "Guests" }],
    },
  });

  await storage.createConfigPreset({
    name: "Mesh - Ruijie Clínica",
    deviceType: "mesh",
    manufacturer: "Ruijie",
    description: "Preset para access points Ruijie em ambientes de saúde com roaming seamless.",
    configData: {
      wifi_5g: { enabled: true, channel: "auto", bandwidth: "80MHz", security: "WPA3-SAE" },
      roaming: { enabled: true, protocol: "802.11r", ft_over_ds: true },
      band_steering: { enabled: true },
      airtime_fairness: { enabled: true },
    },
  });

  console.log("Database seeded successfully!");
}
