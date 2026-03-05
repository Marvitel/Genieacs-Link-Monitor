import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeviceStatusBadge, DeviceTypeBadge } from "@/components/device-status-badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Router,
  Signal,
  Thermometer,
  Clock,
  Wifi,
  Globe,
  User,
  Settings,
  RefreshCw,
  Power,
  Activity,
  Zap,
  RotateCcw,
  Loader2,
  Check,
  AlertTriangle,
  Network,
  Key,
  Save,
  Monitor,
  Phone,
  Cable,
  Laptop,
  Plug,
  AlertCircle,
  ArrowUpDown,
  Radio,
} from "lucide-react";
import type { Device, Client, DeviceLog } from "@shared/schema";

interface ConnectedHost {
  hostName: string;
  ipAddress: string;
  macAddress: string;
  interfaceType?: string;
  active?: boolean;
}

interface EthernetPort {
  index: number;
  status: string;
  macAddress: string;
  speed: string;
  duplex: string;
}

interface WanConnection {
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
}

interface VoipLine {
  index: number;
  enabled: boolean;
  directoryNumber: string;
  status: string;
  sipUri: string;
  sipRegistrar: string;
  sipAuthUser: string;
}

interface LiveInfo {
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

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | number | null | undefined; icon?: typeof Signal }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      <span className="text-sm font-medium" data-testid={`text-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (!seconds) return "";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function normalizeRxPower(val: number | null): number | null {
  if (val === null) return null;
  if (val > 1000) return val / 10000;
  return val;
}

export default function DeviceDetail() {
  const [, params] = useRoute("/devices/:id");
  const { toast } = useToast();
  const [pingHost, setPingHost] = useState("8.8.8.8");
  const [traceHost, setTraceHost] = useState("8.8.8.8");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSsid5g, setWifiSsid5g] = useState("");
  const [wifiPassword5g, setWifiPassword5g] = useState("");
  const [pppoeUser, setPppoeUser] = useState("");
  const [pppoePass, setPppoePass] = useState("");

  const { data: device, isLoading } = useQuery<Device>({
    queryKey: ["/api/devices", params?.id],
    enabled: !!params?.id,
  });

  const { data: liveInfo, isLoading: liveLoading, refetch: refetchLive } = useQuery<LiveInfo>({
    queryKey: ["/api/devices", params?.id, "live"],
    enabled: !!device?.genieId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (liveInfo) {
      setWifiSsid(liveInfo.ssid || "");
      setWifiPassword(liveInfo.wifiPassword || "");
      setWifiSsid5g(liveInfo.ssid5g || "");
      setWifiPassword5g(liveInfo.wifiPassword5g || "");
      setPppoeUser(liveInfo.pppoeUser || "");
    } else if (device) {
      setWifiSsid(device.ssid || "");
      setWifiPassword(device.wifiPassword || "");
      setWifiSsid5g(device.ssid5g || "");
      setWifiPassword5g(device.wifiPassword5g || "");
      setPppoeUser(device.pppoeUser || "");
    }
  }, [liveInfo?.genieId, device?.id]);

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", device?.clientId],
    enabled: !!device?.clientId,
  });

  const { data: logs } = useQuery<DeviceLog[]>({
    queryKey: ["/api/device-logs", `?deviceId=${params?.id}`],
    enabled: !!params?.id,
  });

  const rebootMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/devices/${params?.id}/reboot`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reboot enviado", description: "O dispositivo será reiniciado em instantes." });
      queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar reboot", description: error.message, variant: "destructive" });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/devices/${params?.id}/refresh`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Atualização solicitada" });
      setTimeout(() => {
        refetchLive();
        queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
      }, 5000);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const factoryResetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/devices/${params?.id}/factory-reset`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Factory reset enviado" });
      queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar factory reset", description: error.message, variant: "destructive" });
    },
  });

  const diagnosticMutation = useMutation({
    mutationFn: async ({ type, host }: { type: string; host: string }) => {
      const res = await apiRequest("POST", `/api/devices/${params?.id}/diagnostic`, { type, host });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: `${variables.type.charAt(0).toUpperCase() + variables.type.slice(1)} iniciado`, description: `Teste para ${variables.host}` });
      queryClient.invalidateQueries({ queryKey: ["/api/device-logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro no diagnóstico", description: error.message, variant: "destructive" });
    },
  });

  const wifiConfigMutation = useMutation({
    mutationFn: async (data: { ssid?: string; password?: string; ssid5g?: string; password5g?: string }) => {
      const res = await apiRequest("POST", `/api/devices/${params?.id}/wifi-config`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração WiFi enviada" });
      queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao configurar WiFi", description: error.message, variant: "destructive" });
    },
  });

  const pppoeConfigMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", `/api/devices/${params?.id}/pppoe-config`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração PPPoE enviada" });
      queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao configurar PPPoE", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-[400px] col-span-2 rounded-md" />
            <Skeleton className="h-[400px] rounded-md" />
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Router className="w-12 h-12 mb-3 opacity-20" />
        <span className="text-sm">Dispositivo não encontrado</span>
        <Link href="/devices">
          <Button variant="ghost" size="sm" className="mt-3" data-testid="button-back-devices">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const rxPower = normalizeRxPower(liveInfo?.rxPower ?? device.rxPower ?? null);
  const txPower = normalizeRxPower(liveInfo?.txPower ?? device.txPower ?? null);
  const temperature = liveInfo?.temperature ?? device.temperature ?? null;
  const voltage = liveInfo?.voltage ?? null;
  const uptime = liveInfo?.uptime ?? 0;
  const connectedHosts = liveInfo?.connectedHosts ?? [];
  const ethernetPorts = liveInfo?.ethernetPorts ?? [];
  const wanConnections = liveInfo?.wanConnections ?? [];
  const voipLines = liveInfo?.voipLines ?? [];

  const rxPowerStatus = rxPower !== null
    ? rxPower > -25 ? "Bom" : rxPower > -28 ? "Aceitável" : "Crítico"
    : null;
  const rxPowerColor = rxPower !== null
    ? rxPower > -25 ? "text-emerald-500" : rxPower > -28 ? "text-amber-500" : "text-red-500"
    : "";

  const isAnyPending = rebootMutation.isPending || refreshMutation.isPending || factoryResetMutation.isPending;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/devices">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-device-title">
                  {device.manufacturer} {device.model}
                </h1>
                <DeviceStatusBadge status={device.status} />
                <DeviceTypeBadge type={device.deviceType} />
              </div>
              <p className="text-sm text-muted-foreground">SN: {device.serialNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { refreshMutation.mutate(); refetchLive(); }}
              disabled={isAnyPending}
              data-testid="button-refresh"
            >
              {refreshMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Atualizar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => rebootMutation.mutate()}
              disabled={isAnyPending}
              data-testid="button-reboot"
            >
              {rebootMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1" />}
              Reboot
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isAnyPending} data-testid="button-factory-reset">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Factory Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Factory Reset</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja restaurar {device.manufacturer} {device.model} ({device.serialNumber}) às configurações de fábrica?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-reset">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => factoryResetMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-reset">
                    Confirmar Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Signal className={`w-6 h-6 mx-auto mb-1 ${rxPowerColor || "text-muted-foreground"}`} />
              <p className="text-lg font-bold" data-testid="text-rx-power">{rxPower !== null ? `${rxPower.toFixed(2)} dBm` : "N/A"}</p>
              <p className="text-[10px] text-muted-foreground">RX Power</p>
              {rxPowerStatus && <Badge variant={rxPowerStatus === "Bom" ? "default" : rxPowerStatus === "Aceitável" ? "secondary" : "destructive"} className="mt-1 text-[10px]" data-testid="badge-rx-status">{rxPowerStatus}</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Zap className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold" data-testid="text-tx-power">{txPower !== null ? `${txPower.toFixed(2)} dBm` : "N/A"}</p>
              <p className="text-[10px] text-muted-foreground">TX Power</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Thermometer className={`w-6 h-6 mx-auto mb-1 ${temperature && temperature > 70 ? "text-red-500" : temperature && temperature > 55 ? "text-amber-500" : "text-emerald-500"}`} />
              <p className="text-lg font-bold" data-testid="text-temperature">{temperature !== null ? `${temperature.toFixed(1)}°C` : "N/A"}</p>
              <p className="text-[10px] text-muted-foreground">Temperatura</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold" data-testid="text-uptime">{uptime > 0 ? formatUptime(uptime) : (device.uptime || "N/A")}</p>
              <p className="text-[10px] text-muted-foreground">Uptime</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2 space-y-4">
            <Tabs defaultValue="info">
              <TabsList className="flex-wrap h-auto gap-1" data-testid="tabs-device-detail">
                <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
                <TabsTrigger value="signal" data-testid="tab-signal">Sinal</TabsTrigger>
                <TabsTrigger value="wan" data-testid="tab-wan">WAN</TabsTrigger>
                <TabsTrigger value="lan" data-testid="tab-lan">LAN</TabsTrigger>
                <TabsTrigger value="wifi-tab" data-testid="tab-wifi">WiFi</TabsTrigger>
                <TabsTrigger value="hosts" data-testid="tab-hosts">
                  Hosts {connectedHosts.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{connectedHosts.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="voip" data-testid="tab-voip">VoIP</TabsTrigger>
                <TabsTrigger value="diag" data-testid="tab-diagnostics">Diag</TabsTrigger>
                <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Router className="w-4 h-4 text-primary" /> Dados do Dispositivo</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <InfoRow label="Fabricante" value={device.manufacturer} icon={Router} />
                    <InfoRow label="Modelo" value={device.model} icon={Settings} />
                    <InfoRow label="Serial" value={device.serialNumber} />
                    <InfoRow label="MAC Address" value={liveInfo?.macAddress || device.macAddress} />
                    <InfoRow label="IP Externo" value={liveInfo?.ipAddress || device.ipAddress} icon={Globe} />
                    <InfoRow label="Firmware" value={liveInfo?.firmwareVersion || device.firmwareVersion} />
                    <InfoRow label="Hardware" value={liveInfo?.hardwareVersion || device.hardwareVersion} />
                    <InfoRow label="Uptime" value={uptime > 0 ? formatUptime(uptime) : device.uptime} icon={Clock} />
                    <InfoRow label="Último Inform" value={liveInfo?.lastInform ? new Date(liveInfo.lastInform).toLocaleString("pt-BR") : device.lastSeen ? new Date(device.lastSeen).toLocaleString("pt-BR") : null} />
                    <InfoRow label="Último Boot" value={liveInfo?.lastBoot ? new Date(liveInfo.lastBoot).toLocaleString("pt-BR") : null} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="signal" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Signal className="w-4 h-4 text-primary" /> Sinal Óptico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground mb-1">RX Power</p>
                        <p className={`text-2xl font-bold ${rxPowerColor}`}>{rxPower !== null ? `${rxPower.toFixed(2)}` : "N/A"}</p>
                        <p className="text-xs text-muted-foreground">dBm</p>
                        {rxPowerStatus && <Badge variant={rxPowerStatus === "Bom" ? "default" : rxPowerStatus === "Aceitável" ? "secondary" : "destructive"} className="mt-2">{rxPowerStatus}</Badge>}
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground mb-1">TX Power</p>
                        <p className="text-2xl font-bold text-primary">{txPower !== null ? `${txPower.toFixed(2)}` : "N/A"}</p>
                        <p className="text-xs text-muted-foreground">dBm</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Temperatura</p>
                        <p className={`text-2xl font-bold ${temperature && temperature > 70 ? "text-red-500" : temperature && temperature > 55 ? "text-amber-500" : "text-emerald-500"}`}>
                          {temperature !== null ? `${temperature.toFixed(1)}` : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">°C</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Tensão</p>
                        <p className="text-2xl font-bold text-primary">{voltage !== null ? `${(typeof voltage === 'number' && voltage > 100 ? voltage / 1000 : voltage).toFixed(2)}` : "N/A"}</p>
                        <p className="text-xs text-muted-foreground">V</p>
                      </div>
                    </div>
                    {liveLoading && (
                      <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-xs">Carregando dados em tempo real...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {ethernetPorts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-1"><Cable className="w-4 h-4 text-primary" /> Portas Ethernet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {ethernetPorts.map((port) => (
                          <div key={port.index} className={`p-3 rounded-lg text-center border ${port.status === "Up" || port.status === "1" ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20" : "border-border bg-muted/30"}`} data-testid={`eth-port-${port.index}`}>
                            <Plug className={`w-5 h-5 mx-auto mb-1 ${port.status === "Up" || port.status === "1" ? "text-emerald-500" : "text-muted-foreground"}`} />
                            <p className="text-xs font-medium">ETH {port.index}</p>
                            <p className="text-[10px] text-muted-foreground">{port.status === "Up" || port.status === "1" ? "Conectada" : "Desconectada"}</p>
                            {port.speed && <p className="text-[10px] text-muted-foreground">{port.speed} Mbps</p>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="wan" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Globe className="w-4 h-4 text-primary" /> Conexões WAN</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {wanConnections.length > 0 ? (
                      <div className="space-y-3">
                        {wanConnections.map((wan) => (
                          <div key={wan.index} className="p-3 rounded-lg border bg-muted/30 space-y-2" data-testid={`wan-conn-${wan.index}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Network className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">{wan.name}</span>
                                <Badge variant="outline" className="text-[10px]">{wan.type}</Badge>
                              </div>
                              <Badge variant={wan.status === "Connected" || wan.status === "Up" ? "default" : "secondary"} className="text-[10px]">
                                {wan.status || "N/A"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {wan.ipAddress && <div><span className="text-muted-foreground">IP: </span><span className="font-medium">{wan.ipAddress}</span></div>}
                              {wan.macAddress && <div><span className="text-muted-foreground">MAC: </span><span className="font-medium">{wan.macAddress}</span></div>}
                              {wan.subnetMask && <div><span className="text-muted-foreground">Máscara: </span><span className="font-medium">{wan.subnetMask}</span></div>}
                              {wan.defaultGateway && <div><span className="text-muted-foreground">Gateway: </span><span className="font-medium">{wan.defaultGateway}</span></div>}
                              {wan.dnsServers && <div className="col-span-2"><span className="text-muted-foreground">DNS: </span><span className="font-medium">{wan.dnsServers}</span></div>}
                              {wan.username && <div><span className="text-muted-foreground">PPPoE: </span><span className="font-medium">{wan.username}</span></div>}
                              {wan.vlanId && <div><span className="text-muted-foreground">VLAN: </span><span className="font-medium">{wan.vlanId}</span></div>}
                              {wan.natEnabled && <div><span className="text-muted-foreground">NAT: </span><span className="font-medium">Ativo</span></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{liveLoading ? "Carregando..." : "Nenhuma conexão WAN encontrada"}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Key className="w-4 h-4 text-primary" /> Configurar PPPoE</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Usuário</Label>
                        <Input value={pppoeUser} onChange={(e) => setPppoeUser(e.target.value)} placeholder="usuario@provedor" data-testid="input-pppoe-user" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Senha</Label>
                        <Input type="password" value={pppoePass} onChange={(e) => setPppoePass(e.target.value)} placeholder="Senha" data-testid="input-pppoe-password" />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!pppoeUser || !pppoePass) { toast({ title: "Campos obrigatórios", variant: "destructive" }); return; }
                        pppoeConfigMutation.mutate({ username: pppoeUser, password: pppoePass });
                      }}
                      disabled={pppoeConfigMutation.isPending || !device.genieId}
                      className="w-full"
                      data-testid="button-save-pppoe"
                    >
                      {pppoeConfigMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Salvar PPPoE
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lan" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Network className="w-4 h-4 text-primary" /> Rede Local</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <InfoRow label="IP do Gateway" value={liveInfo?.lanIp} icon={Router} />
                    <InfoRow label="Máscara" value={liveInfo?.lanSubnet} />
                    <InfoRow label="DHCP" value={liveInfo?.dhcpEnabled ? "Habilitado" : "Desabilitado"} />
                    <InfoRow label="Range DHCP" value={liveInfo?.dhcpStart && liveInfo?.dhcpEnd ? `${liveInfo.dhcpStart} - ${liveInfo.dhcpEnd}` : null} />
                  </CardContent>
                </Card>

                {ethernetPorts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-1"><Cable className="w-4 h-4 text-primary" /> Portas Ethernet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Porta</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Velocidade</TableHead>
                            <TableHead className="text-xs">MAC</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ethernetPorts.map((port) => (
                            <TableRow key={port.index}>
                              <TableCell className="text-xs font-medium">ETH {port.index}</TableCell>
                              <TableCell>
                                <Badge variant={port.status === "Up" || port.status === "1" ? "default" : "secondary"} className="text-[10px]">
                                  {port.status === "Up" || port.status === "1" ? "Conectada" : "Desconectada"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{port.speed || "-"}</TableCell>
                              <TableCell className="text-xs font-mono">{port.macAddress || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="wifi-tab" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Wifi className="w-4 h-4 text-primary" /> Configuração Wi-Fi</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3 p-3 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">2.4 GHz</p>
                          <Badge variant={liveInfo?.wifiEnabled ? "default" : "secondary"} className="text-[10px]">{liveInfo?.wifiEnabled ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SSID</Label>
                          <Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="Nome da rede" data-testid="input-wifi-ssid" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Senha</Label>
                          <Input type="password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="Senha" data-testid="input-wifi-password" />
                        </div>
                        <InfoRow label="Canal" value={liveInfo?.wifiChannel || device.wifiChannel} />
                      </div>
                      <div className="space-y-3 p-3 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">5 GHz</p>
                          <Badge variant={liveInfo?.wifiEnabled5g ? "default" : "secondary"} className="text-[10px]">{liveInfo?.wifiEnabled5g ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SSID</Label>
                          <Input value={wifiSsid5g} onChange={(e) => setWifiSsid5g(e.target.value)} placeholder="Nome da rede 5G" data-testid="input-wifi-ssid-5g" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Senha</Label>
                          <Input type="password" value={wifiPassword5g} onChange={(e) => setWifiPassword5g(e.target.value)} placeholder="Senha" data-testid="input-wifi-password-5g" />
                        </div>
                        <InfoRow label="Canal" value={liveInfo?.wifiChannel5g || device.wifiChannel5g} />
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const data: Record<string, string> = {};
                        if (wifiSsid && wifiSsid !== (liveInfo?.ssid || device.ssid)) data.ssid = wifiSsid;
                        if (wifiPassword) data.password = wifiPassword;
                        if (wifiSsid5g && wifiSsid5g !== (liveInfo?.ssid5g || device.ssid5g)) data.ssid5g = wifiSsid5g;
                        if (wifiPassword5g) data.password5g = wifiPassword5g;
                        if (Object.keys(data).length === 0) { toast({ title: "Nenhuma alteração", variant: "destructive" }); return; }
                        wifiConfigMutation.mutate(data);
                      }}
                      disabled={wifiConfigMutation.isPending || !device.genieId}
                      className="w-full"
                      data-testid="button-save-wifi"
                    >
                      {wifiConfigMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Salvar WiFi
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hosts" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <Laptop className="w-4 h-4 text-primary" />
                      Dispositivos Conectados
                      {connectedHosts.length > 0 && <Badge variant="secondary" className="ml-1">{connectedHosts.length}</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {connectedHosts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Nome</TableHead>
                              <TableHead className="text-xs">IP</TableHead>
                              <TableHead className="text-xs">MAC</TableHead>
                              <TableHead className="text-xs">Interface</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {connectedHosts.map((host, i) => (
                              <TableRow key={i} data-testid={`host-row-${i}`}>
                                <TableCell className="text-xs font-medium">{host.hostName === "*" ? "-" : host.hostName}</TableCell>
                                <TableCell className="text-xs font-mono">{host.ipAddress}</TableCell>
                                <TableCell className="text-xs font-mono">{host.macAddress}</TableCell>
                                <TableCell className="text-xs">{host.interfaceType || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Laptop className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{liveLoading ? "Carregando..." : "Nenhum dispositivo conectado encontrado"}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="voip" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Phone className="w-4 h-4 text-primary" /> Linhas VoIP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {voipLines.length > 0 ? (
                      <div className="space-y-3">
                        {voipLines.map((line) => (
                          <div key={line.index} className="p-3 rounded-lg border bg-muted/30 space-y-2" data-testid={`voip-line-${line.index}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Linha {line.index}</span>
                              </div>
                              <Badge variant={line.enabled ? "default" : "secondary"} className="text-[10px]">{line.enabled ? "Habilitada" : "Desabilitada"}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {line.directoryNumber && <div><span className="text-muted-foreground">Número: </span><span className="font-medium">{line.directoryNumber}</span></div>}
                              {line.status && <div><span className="text-muted-foreground">Status: </span><span className="font-medium">{line.status}</span></div>}
                              {line.sipUri && <div><span className="text-muted-foreground">SIP URI: </span><span className="font-medium">{line.sipUri}</span></div>}
                              {line.sipRegistrar && <div><span className="text-muted-foreground">Registrar: </span><span className="font-medium">{line.sipRegistrar}</span></div>}
                              {line.sipAuthUser && <div><span className="text-muted-foreground">Auth User: </span><span className="font-medium">{line.sipAuthUser}</span></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{liveLoading ? "Carregando..." : "Nenhuma linha VoIP configurada"}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diag" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Activity className="w-4 h-4 text-primary" /> Diagnóstico</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Ping</Label>
                        <div className="flex gap-2">
                          <Input value={pingHost} onChange={(e) => setPingHost(e.target.value)} placeholder="8.8.8.8" className="flex-1" data-testid="input-ping-host" />
                          <Button size="sm" onClick={() => diagnosticMutation.mutate({ type: "ping", host: pingHost })} disabled={diagnosticMutation.isPending || !device.genieId} data-testid="button-test-ping">
                            {diagnosticMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Traceroute</Label>
                        <div className="flex gap-2">
                          <Input value={traceHost} onChange={(e) => setTraceHost(e.target.value)} placeholder="8.8.8.8" className="flex-1" data-testid="input-trace-host" />
                          <Button size="sm" onClick={() => diagnosticMutation.mutate({ type: "traceroute", host: traceHost })} disabled={diagnosticMutation.isPending || !device.genieId} data-testid="button-test-traceroute">
                            {diagnosticMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {!device.genieId && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs">Dispositivo não vinculado ao GenieACS.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4 text-primary" /> Últimos Eventos / Alarmes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {logs && logs.length > 0 ? logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/50" data-testid={`log-entry-${log.id}`}>
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            log.severity === "error" ? "bg-red-500" :
                            log.severity === "warning" ? "bg-amber-500" :
                            "bg-blue-500"
                          }`} />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{log.eventType}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {log.createdAt ? new Date(log.createdAt).toLocaleString("pt-BR") : ""}
                              </span>
                            </div>
                            <span className="text-sm">{log.message}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <Activity className="w-8 h-8 mb-2 opacity-30" />
                          <span className="text-sm">Nenhum evento registrado</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            {client && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1"><User className="w-4 h-4 text-primary" /> Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link href={`/clients/${client.id}`}>
                    <div className="space-y-2 cursor-pointer" data-testid="link-client-info">
                      <p className="text-sm font-semibold">{client.name}</p>
                      {client.document && <p className="text-xs text-muted-foreground">{client.document}</p>}
                      {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                      {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                      {client.plan && <Badge variant="secondary">{client.plan}</Badge>}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status Rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <DeviceStatusBadge status={device.status} />
                </div>
                {rxPower !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">RX</span>
                    <span className={`text-sm font-medium ${rxPowerColor}`}>{rxPower.toFixed(2)} dBm</span>
                  </div>
                )}
                {txPower !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">TX</span>
                    <span className="text-sm font-medium">{txPower.toFixed(2)} dBm</span>
                  </div>
                )}
                {temperature !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Temp</span>
                    <span className="text-sm font-medium">{temperature.toFixed(1)}°C</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Uptime</span>
                  <span className="text-sm font-medium">{uptime > 0 ? formatUptime(uptime) : (device.uptime || "-")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Hosts</span>
                  <span className="text-sm font-medium">{connectedHosts.length || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">WAN</span>
                  <span className="text-sm font-medium">{wanConnections.length > 0 ? wanConnections.map(w => w.type).join(", ") : "-"}</span>
                </div>
                {device.genieId && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">GenieACS</span>
                    <Badge variant="outline" className="text-[10px]"><Check className="w-3 h-3 mr-1 text-emerald-500" /> Vinculado</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {(liveInfo?.ssid || device.ssid) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1"><Wifi className="w-4 h-4 text-primary" /> Wi-Fi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">2.4G</span>
                    <span className="text-sm font-medium">{liveInfo?.ssid || device.ssid || "-"}</span>
                  </div>
                  {(liveInfo?.ssid5g || device.ssid5g) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">5G</span>
                      <span className="text-sm font-medium">{liveInfo?.ssid5g || device.ssid5g}</span>
                    </div>
                  )}
                  {(liveInfo?.wifiChannel || device.wifiChannel) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Canal</span>
                      <span className="text-sm font-medium">{liveInfo?.wifiChannel || device.wifiChannel}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
