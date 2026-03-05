import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DeviceStatusBadge, DeviceTypeBadge } from "@/components/device-status-badge";
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  MapPin,
  Router,
  Eye,
  Building2,
  Home,
  FileText,
  Signal,
  Network,
  Cable,
  Wifi,
  Laptop,
  AlertTriangle,
} from "lucide-react";
import type { Client, Device } from "@shared/schema";

interface LiveInfo {
  genieId: string;
  manufacturer: string;
  model: string;
  lanIp: string;
  lanSubnet: string;
  ssid: string;
  ssid5g: string;
  wifiEnabled: boolean;
  wifiEnabled5g: boolean;
  connectedHosts: Array<{ hostName: string; ipAddress: string; macAddress: string; interfaceType?: string; active?: boolean }>;
  ethernetPorts: Array<{ index: number; status: string; speed: string; duplex: string; txErrors: number; rxErrors: number; txBytes: number; rxBytes: number }>;
  wanConnections: Array<{ type: string; ipAddress: string; status: string; vlanId: string }>;
  rxPower: number | null;
  txPower: number | null;
}

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", params?.id],
    enabled: !!params?.id,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const clientDevices = devices?.filter((d) => d.clientId === params?.id) || [];

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-[300px] rounded-md" />
            <Skeleton className="h-[300px] col-span-2 rounded-md" />
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Users className="w-12 h-12 mb-3 opacity-20" />
        <span className="text-sm">Cliente não encontrado</span>
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="mt-3" data-testid="button-back-clients">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-emerald-600 text-white border-emerald-700",
    inactive: "",
    suspended: "border-amber-500 text-amber-500",
  };

  const statusLabels: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    suspended: "Suspenso",
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/clients">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-client-title">{client.name}</h1>
              <Badge variant={client.status === "active" ? "default" : "outline"} className={statusColors[client.status]}>
                {statusLabels[client.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {client.clientType === "corporate" ? "Cliente Corporativo" : "Cliente Residencial"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                {client.clientType === "corporate" ? (
                  <Building2 className="w-4 h-4 text-primary" />
                ) : (
                  <Home className="w-4 h-4 text-primary" />
                )}
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.document && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                    <p className="text-sm">{client.document}</p>
                  </div>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm">{client.email}</p>
                  </div>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm">{client.phone}</p>
                  </div>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p className="text-sm">{client.address}</p>
                  </div>
                </div>
              )}
              {client.plan && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Plano</p>
                  <Badge variant="secondary">{client.plan}</Badge>
                </div>
              )}
              {client.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-1 lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Router className="w-4 h-4 text-primary" />
                  Dispositivos ({clientDevices.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {clientDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate" data-testid={`card-client-device-${device.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Router className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{device.manufacturer} {device.model}</span>
                            <DeviceTypeBadge type={device.deviceType} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span>SN: {device.serialNumber}</span>
                            {device.ipAddress && <span>IP: {device.ipAddress}</span>}
                            {device.rxPower !== null && device.rxPower !== undefined && (
                              <span className="flex items-center gap-0.5">
                                <Signal className="w-3 h-3" /> {device.rxPower}dBm
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeviceStatusBadge status={device.status} />
                        <Link href={`/devices/${device.id}`}>
                          <Button size="icon" variant="ghost" data-testid={`button-view-device-${device.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {clientDevices.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Router className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-sm">Nenhum dispositivo vinculado</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {clientDevices.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <Network className="w-4 h-4 text-primary" />
                    Topologia da Rede
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <NetworkTopology devices={clientDevices} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function DeviceNodeWrapper({ device, isMain }: { device: Device; isMain: boolean }) {
  const { data: live } = useQuery<LiveInfo>({
    queryKey: ["/api/devices", device.id, "live"],
    enabled: !!device.genieId,
    staleTime: 60000,
  });

  const hostsCount = live?.connectedHosts?.length || 0;
  const wifiHosts = (live?.connectedHosts || []).filter(h => {
    const t = (h.interfaceType || "").toLowerCase();
    return t.includes("wifi") || t.includes("wlan") || t.includes("wireless");
  }).length;
  const ethHosts = (live?.connectedHosts || []).filter(h => {
    const t = (h.interfaceType || "").toLowerCase();
    return t.includes("ethernet") || t.includes("eth");
  }).length;
  const totalPorts = (live?.ethernetPorts || []).length;
  const portsUp = (live?.ethernetPorts || []).filter(p => p.status === "Up" || p.status === "1").length;
  const hasPortErrors = (live?.ethernetPorts || []).some(p => (p.txErrors + p.rxErrors) > 100);
  const hasSlowPort = (live?.ethernetPorts || []).some(p => {
    const isUp = p.status === "Up" || p.status === "1";
    const speedNum = parseInt(p.speed);
    return isUp && speedNum > 0 && speedNum <= 100;
  });
  const wanIp = live?.wanConnections?.find(w => w.ipAddress && w.ipAddress !== "0.0.0.0" && w.type === "PPPoE")?.ipAddress || device.ipAddress || "";

  return (
    <div
      className={`p-4 rounded-xl border-2 ${
        isMain ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/20"
      } ${hasPortErrors ? "ring-2 ring-red-500/30" : ""}`}
      data-testid={`topology-node-${device.id}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Router className={`w-5 h-5 ${isMain ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold truncate">{device.manufacturer} {device.model}</span>
            {isMain && <Badge variant="default" className="text-[9px] px-1.5 py-0">Principal</Badge>}
            {!isMain && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Extensor</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <DeviceStatusBadge status={device.status} />
            {live?.lanIp && <span className="text-[10px] text-muted-foreground font-mono">{live.lanIp}</span>}
          </div>
        </div>
        <Link href={`/devices/${device.id}`}>
          <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`topology-view-${device.id}`}>
            <Eye className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-background text-center">
          <div className="flex items-center justify-center gap-1">
            <Laptop className="w-3 h-3 text-muted-foreground" />
            <span className="text-lg font-bold">{hostsCount}</span>
          </div>
          <p className="text-[9px] text-muted-foreground">Clientes</p>
        </div>
        <div className="p-2 rounded-lg bg-background text-center">
          <div className="flex items-center justify-center gap-1">
            <Wifi className="w-3 h-3 text-blue-400" />
            <span className="text-lg font-bold text-blue-400">{live ? wifiHosts : "–"}</span>
          </div>
          <p className="text-[9px] text-muted-foreground">WiFi</p>
        </div>
        <div className="p-2 rounded-lg bg-background text-center">
          <div className="flex items-center justify-center gap-1">
            <Cable className="w-3 h-3 text-green-400" />
            <span className="text-lg font-bold text-green-400">{live ? ethHosts : "–"}</span>
          </div>
          <p className="text-[9px] text-muted-foreground">Ethernet</p>
        </div>
      </div>

      {totalPorts > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] text-muted-foreground">Portas:</span>
          {(live?.ethernetPorts || []).map(p => {
            const isUp = p.status === "Up" || p.status === "1";
            const speedNum = parseInt(p.speed);
            const slowPort = isUp && speedNum > 0 && speedNum <= 100;
            const errPort = (p.txErrors + p.rxErrors) > 100;
            return (
              <div
                key={p.index}
                className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center ${
                  isUp
                    ? errPort ? "bg-red-500/20 text-red-400 border border-red-500/50" : slowPort ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50" : "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-muted text-muted-foreground/40"
                }`}
                title={`ETH ${p.index}: ${isUp ? "Up" : "NoLink"}${speedNum > 0 ? ` ${speedNum}Mbps` : ""}${errPort ? " ERROS!" : ""}`}
              >
                {p.index}
              </div>
            );
          })}
          <span className="text-[10px] text-muted-foreground ml-1">{portsUp}/{totalPorts}</span>
        </div>
      )}

      {live?.ssid && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Wifi className="w-3 h-3" />
          <span>{live.ssid}</span>
          {live.ssid5g && <span className="text-muted-foreground/50">| {live.ssid5g}</span>}
        </div>
      )}

      {wanIp && isMain && (
        <div className="text-[10px] text-muted-foreground mt-1">
          WAN: <span className="font-mono">{wanIp}</span>
        </div>
      )}

      {(hasPortErrors || hasSlowPort) && (
        <div className={`mt-2 p-1.5 rounded text-[10px] ${hasPortErrors ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          {hasPortErrors ? "Erros de porta detectados - possível looping" : "Porta com velocidade baixa"}
        </div>
      )}
    </div>
  );
}

function NetworkTopology({ devices }: { devices: Device[] }) {
  const mainDevice = devices.find(d => d.deviceType === "ont" || d.deviceType === "router") || devices[0];
  const extenderDevices = devices.filter(d => d !== mainDevice);

  return (
    <div className="space-y-4">
      {mainDevice && (
        <div>
          <DeviceNodeWrapper device={mainDevice} isMain={true} />
          {extenderDevices.length > 0 && (
            <div className="ml-6 mt-1">
              <div className="border-l-2 border-dashed border-muted-foreground/30 pl-4 space-y-2 mt-2">
                {extenderDevices.map((ext) => (
                  <div key={ext.id}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-4 h-0.5 bg-muted-foreground/30" />
                      <Cable className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                    <DeviceNodeWrapper device={ext} isMain={false} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {devices.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum dispositivo para exibir topologia</p>
        </div>
      )}
    </div>
  );
}
