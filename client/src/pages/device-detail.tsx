import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useState } from "react";
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
} from "lucide-react";
import type { Device, Client, DeviceLog } from "@shared/schema";

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | number | null | undefined; icon?: typeof Signal }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      <span className="text-sm font-medium" data-testid={`text-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</span>
    </div>
  );
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
  const [wifiFormInitialized, setWifiFormInitialized] = useState(false);

  const { data: device, isLoading } = useQuery<Device>({
    queryKey: ["/api/devices", params?.id],
    enabled: !!params?.id,
  });

  if (device && !wifiFormInitialized) {
    setWifiSsid(device.ssid || "");
    setWifiPassword(device.wifiPassword || "");
    setWifiSsid5g(device.ssid5g || "");
    setWifiPassword5g(device.wifiPassword5g || "");
    setPppoeUser(device.pppoeUser || "");
    setWifiFormInitialized(true);
  }

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
      toast({ title: "Atualização solicitada", description: "Os dados serão atualizados no próximo inform." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
      }, 3000);
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
      toast({ title: "Factory reset enviado", description: "O dispositivo será restaurado às configurações de fábrica." });
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
      toast({ title: "Configuração WiFi enviada", description: "As mudanças serão aplicadas no dispositivo." });
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
      toast({ title: "Configuração PPPoE enviada", description: "As credenciais serão aplicadas no dispositivo." });
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

  const rxPowerStatus = device.rxPower !== null && device.rxPower !== undefined
    ? device.rxPower > -25 ? "Bom" : device.rxPower > -28 ? "Aceitável" : "Crítico"
    : null;

  const rxPowerColor = device.rxPower !== null && device.rxPower !== undefined
    ? device.rxPower > -25 ? "text-emerald-500" : device.rxPower > -28 ? "text-amber-500" : "text-red-500"
    : "";

  const isAnyMutationPending = rebootMutation.isPending || refreshMutation.isPending || factoryResetMutation.isPending;

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
              onClick={() => refreshMutation.mutate()}
              disabled={isAnyMutationPending}
              data-testid="button-refresh"
            >
              {refreshMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Atualizar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => rebootMutation.mutate()}
              disabled={isAnyMutationPending}
              data-testid="button-reboot"
            >
              {rebootMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1" />}
              Reboot
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isAnyMutationPending}
                  data-testid="button-factory-reset"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Factory Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Factory Reset</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja restaurar {device.manufacturer} {device.model} ({device.serialNumber}) às configurações de fábrica?
                    Isso irá apagar todas as configurações do dispositivo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-reset">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => factoryResetMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-reset"
                  >
                    Confirmar Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2 space-y-4">
            <Tabs defaultValue="info">
              <TabsList data-testid="tabs-device-detail">
                <TabsTrigger value="info" data-testid="tab-info">Informações</TabsTrigger>
                <TabsTrigger value="diagnostics" data-testid="tab-diagnostics">Diagnóstico</TabsTrigger>
                <TabsTrigger value="config" data-testid="tab-config">Configuração</TabsTrigger>
                <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Dados do Dispositivo</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <InfoRow label="Fabricante" value={device.manufacturer} icon={Router} />
                    <InfoRow label="Modelo" value={device.model} icon={Settings} />
                    <InfoRow label="Serial" value={device.serialNumber} />
                    <InfoRow label="MAC Address" value={device.macAddress} />
                    <InfoRow label="IP Address" value={device.ipAddress} icon={Globe} />
                    <InfoRow label="Firmware" value={device.firmwareVersion} />
                    <InfoRow label="Hardware" value={device.hardwareVersion} />
                    <InfoRow label="Uptime" value={device.uptime} icon={Clock} />
                    <InfoRow label="Última Conexão" value={device.lastSeen ? new Date(device.lastSeen).toLocaleString("pt-BR") : null} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Conexão</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <InfoRow label="Tipo de Conexão" value={device.connectionType} icon={Network} />
                    <InfoRow label="PPPoE User" value={device.pppoeUser} icon={User} />
                    <InfoRow label="Porta PON" value={device.ponPort} />
                    <InfoRow label="OLT" value={device.oltId} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Wi-Fi</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <InfoRow label="SSID 2.4GHz" value={device.ssid} icon={Wifi} />
                    <InfoRow label="SSID 5GHz" value={device.ssid5g} icon={Wifi} />
                    <InfoRow label="Canal 2.4GHz" value={device.wifiChannel} />
                    <InfoRow label="Canal 5GHz" value={device.wifiChannel5g} />
                    <InfoRow label="Banda" value={device.wifiBand} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnostics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Signal className={`w-8 h-8 mx-auto mb-2 ${rxPowerColor || "text-muted-foreground"}`} />
                      <p className="text-2xl font-bold" data-testid="text-rx-power">
                        {device.rxPower !== null && device.rxPower !== undefined ? `${device.rxPower.toFixed(2)} dBm` : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">Potência RX</p>
                      {rxPowerStatus && (
                        <Badge variant={rxPowerStatus === "Bom" ? "default" : rxPowerStatus === "Aceitável" ? "secondary" : "destructive"} className="mt-2" data-testid="badge-rx-status">
                          {rxPowerStatus}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold" data-testid="text-tx-power">
                        {device.txPower !== null && device.txPower !== undefined ? `${device.txPower.toFixed(2)} dBm` : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">Potência TX</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Thermometer className={`w-8 h-8 mx-auto mb-2 ${
                        device.temperature && device.temperature > 70 ? "text-red-500" :
                        device.temperature && device.temperature > 55 ? "text-amber-500" :
                        "text-emerald-500"
                      }`} />
                      <p className="text-2xl font-bold" data-testid="text-temperature">
                        {device.temperature !== null && device.temperature !== undefined ? `${device.temperature.toFixed(1)}°C` : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">Temperatura</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <Activity className="w-4 h-4 text-primary" />
                      Testes de Diagnóstico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Ping</Label>
                        <div className="flex gap-2">
                          <Input
                            value={pingHost}
                            onChange={(e) => setPingHost(e.target.value)}
                            placeholder="8.8.8.8"
                            className="flex-1"
                            data-testid="input-ping-host"
                          />
                          <Button
                            size="sm"
                            onClick={() => diagnosticMutation.mutate({ type: "ping", host: pingHost })}
                            disabled={diagnosticMutation.isPending || !device.genieId}
                            data-testid="button-test-ping"
                          >
                            {diagnosticMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Traceroute</Label>
                        <div className="flex gap-2">
                          <Input
                            value={traceHost}
                            onChange={(e) => setTraceHost(e.target.value)}
                            placeholder="8.8.8.8"
                            className="flex-1"
                            data-testid="input-trace-host"
                          />
                          <Button
                            size="sm"
                            onClick={() => diagnosticMutation.mutate({ type: "traceroute", host: traceHost })}
                            disabled={diagnosticMutation.isPending || !device.genieId}
                            data-testid="button-test-traceroute"
                          >
                            {diagnosticMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {!device.genieId && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs">Dispositivo não vinculado ao GenieACS. Execute uma sincronização.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <Wifi className="w-4 h-4 text-primary" />
                      Configuração Wi-Fi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">2.4 GHz</p>
                        <div className="space-y-2">
                          <Label className="text-xs">SSID</Label>
                          <Input
                            value={wifiSsid}
                            onChange={(e) => setWifiSsid(e.target.value)}
                            placeholder="Nome da rede 2.4GHz"
                            data-testid="input-wifi-ssid"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Senha</Label>
                          <Input
                            type="password"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            placeholder="Senha WiFi 2.4GHz"
                            data-testid="input-wifi-password"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">5 GHz</p>
                        <div className="space-y-2">
                          <Label className="text-xs">SSID</Label>
                          <Input
                            value={wifiSsid5g}
                            onChange={(e) => setWifiSsid5g(e.target.value)}
                            placeholder="Nome da rede 5GHz"
                            data-testid="input-wifi-ssid-5g"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Senha</Label>
                          <Input
                            type="password"
                            value={wifiPassword5g}
                            onChange={(e) => setWifiPassword5g(e.target.value)}
                            placeholder="Senha WiFi 5GHz"
                            data-testid="input-wifi-password-5g"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const data: Record<string, string> = {};
                        if (wifiSsid && wifiSsid !== device.ssid) data.ssid = wifiSsid;
                        if (wifiPassword) data.password = wifiPassword;
                        if (wifiSsid5g && wifiSsid5g !== device.ssid5g) data.ssid5g = wifiSsid5g;
                        if (wifiPassword5g) data.password5g = wifiPassword5g;
                        if (Object.keys(data).length === 0) {
                          toast({ title: "Nenhuma alteração", description: "Altere pelo menos um campo.", variant: "destructive" });
                          return;
                        }
                        wifiConfigMutation.mutate(data);
                      }}
                      disabled={wifiConfigMutation.isPending || !device.genieId}
                      className="w-full"
                      data-testid="button-save-wifi"
                    >
                      {wifiConfigMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Salvar Configuração WiFi
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <Key className="w-4 h-4 text-primary" />
                      Configuração PPPoE
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Usuário PPPoE</Label>
                        <Input
                          value={pppoeUser}
                          onChange={(e) => setPppoeUser(e.target.value)}
                          placeholder="usuario@provedor"
                          data-testid="input-pppoe-user"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Senha PPPoE</Label>
                        <Input
                          type="password"
                          value={pppoePass}
                          onChange={(e) => setPppoePass(e.target.value)}
                          placeholder="Senha PPPoE"
                          data-testid="input-pppoe-password"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        if (!pppoeUser || !pppoePass) {
                          toast({ title: "Campos obrigatórios", description: "Informe usuário e senha PPPoE.", variant: "destructive" });
                          return;
                        }
                        pppoeConfigMutation.mutate({ username: pppoeUser, password: pppoePass });
                      }}
                      disabled={pppoeConfigMutation.isPending || !device.genieId}
                      className="w-full"
                      data-testid="button-save-pppoe"
                    >
                      {pppoeConfigMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Salvar Configuração PPPoE
                    </Button>
                  </CardContent>
                </Card>

                {!device.genieId && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">Dispositivo não vinculado ao GenieACS. Execute uma sincronização para habilitar edição.</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Histórico de Eventos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {logs && logs.length > 0 ? logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/50" data-testid={`log-entry-${log.id}`}>
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            log.severity === "error" ? "bg-red-500" :
                            log.severity === "warning" ? "bg-amber-500" :
                            log.severity === "success" ? "bg-emerald-500" :
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
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <User className="w-4 h-4 text-primary" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link href={`/clients/${client.id}`}>
                    <div className="space-y-2 cursor-pointer" data-testid="link-client-info">
                      <p className="text-sm font-semibold">{client.name}</p>
                      {client.document && <p className="text-xs text-muted-foreground">{client.document}</p>}
                      {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                      {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                      {client.plan && (
                        <Badge variant="secondary">{client.plan}</Badge>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status Rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <DeviceStatusBadge status={device.status} />
                </div>
                {device.rxPower !== null && device.rxPower !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sinal RX</span>
                    <span className={`text-sm font-medium ${rxPowerColor}`}>{device.rxPower.toFixed(2)} dBm</span>
                  </div>
                )}
                {device.txPower !== null && device.txPower !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sinal TX</span>
                    <span className="text-sm font-medium">{device.txPower.toFixed(2)} dBm</span>
                  </div>
                )}
                {device.temperature !== null && device.temperature !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Temperatura</span>
                    <span className="text-sm font-medium">{device.temperature.toFixed(1)}°C</span>
                  </div>
                )}
                {device.uptime && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Uptime</span>
                    <span className="text-sm font-medium">{device.uptime}</span>
                  </div>
                )}
                {device.genieId && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">GenieACS</span>
                    <Badge variant="outline" className="text-[10px]">
                      <Check className="w-3 h-3 mr-1 text-emerald-500" /> Vinculado
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {device.ssid && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <Wifi className="w-4 h-4 text-primary" />
                    Wi-Fi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SSID 2.4G</span>
                    <span className="text-sm font-medium">{device.ssid}</span>
                  </div>
                  {device.ssid5g && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">SSID 5G</span>
                      <span className="text-sm font-medium">{device.ssid5g}</span>
                    </div>
                  )}
                  {device.wifiChannel && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Canal</span>
                      <span className="text-sm font-medium">{device.wifiChannel}</span>
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
