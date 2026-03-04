import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceStatusBadge, DeviceTypeBadge } from "@/components/device-status-badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function DeviceDetail() {
  const [, params] = useRoute("/devices/:id");
  const { toast } = useToast();

  const { data: device, isLoading } = useQuery<Device>({
    queryKey: ["/api/devices", params?.id],
    enabled: !!params?.id,
  });

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
      toast({ title: "Comando de reboot enviado" });
      queryClient.invalidateQueries({ queryKey: ["/api/devices", params?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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

  const rxPowerStatus = device.rxPower
    ? device.rxPower > -25 ? "Bom" : device.rxPower > -28 ? "Aceitável" : "Crítico"
    : null;

  const rxPowerColor = device.rxPower
    ? device.rxPower > -25 ? "text-emerald-500" : device.rxPower > -28 ? "text-amber-500" : "text-red-500"
    : "";

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
              onClick={() => rebootMutation.mutate()}
              disabled={rebootMutation.isPending}
              data-testid="button-reboot"
            >
              <Power className="w-3.5 h-3.5 mr-1" />
              Reboot
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-refresh">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Atualizar
            </Button>
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
                    <InfoRow label="Uptime" value={device.uptime} icon={Clock} />
                    <InfoRow label="Última Conexão" value={device.lastSeen ? new Date(device.lastSeen).toLocaleString("pt-BR") : null} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Conexão</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <InfoRow label="Tipo de Conexão" value={device.connectionType} />
                    <InfoRow label="PPPoE User" value={device.pppoeUser} icon={User} />
                    <InfoRow label="Porta PON" value={device.ponPort} />
                    <InfoRow label="OLT" value={device.oltId} />
                    <InfoRow label="SSID" value={device.ssid} icon={Wifi} />
                    <InfoRow label="Canal Wi-Fi" value={device.wifiChannel} />
                    <InfoRow label="Banda Wi-Fi" value={device.wifiBand} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnostics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Signal className={`w-8 h-8 mx-auto mb-2 ${rxPowerColor || "text-muted-foreground"}`} />
                      <p className="text-2xl font-bold">{device.rxPower !== null && device.rxPower !== undefined ? `${device.rxPower} dBm` : "N/A"}</p>
                      <p className="text-xs text-muted-foreground">Potência RX</p>
                      {rxPowerStatus && (
                        <Badge variant={rxPowerStatus === "Bom" ? "default" : rxPowerStatus === "Aceitável" ? "secondary" : "destructive"} className="mt-2">
                          {rxPowerStatus}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{device.txPower !== null && device.txPower !== undefined ? `${device.txPower} dBm` : "N/A"}</p>
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
                      <p className="text-2xl font-bold">{device.temperature !== null && device.temperature !== undefined ? `${device.temperature}°C` : "N/A"}</p>
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
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Button variant="secondary" className="h-auto flex-col py-4 gap-1" data-testid="button-test-ping">
                        <Globe className="w-5 h-5" />
                        <span className="text-xs">Ping</span>
                      </Button>
                      <Button variant="secondary" className="h-auto flex-col py-4 gap-1" data-testid="button-test-traceroute">
                        <Activity className="w-5 h-5" />
                        <span className="text-xs">Traceroute</span>
                      </Button>
                      <Button variant="secondary" className="h-auto flex-col py-4 gap-1" data-testid="button-test-speed">
                        <Zap className="w-5 h-5" />
                        <span className="text-xs">Speed Test</span>
                      </Button>
                      <Button variant="secondary" className="h-auto flex-col py-4 gap-1" data-testid="button-test-wifi">
                        <Wifi className="w-5 h-5" />
                        <span className="text-xs">WiFi Scan</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Configurações Atuais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">SSID</p>
                        <p className="text-sm font-medium">{device.ssid || "Não configurado"}</p>
                      </div>
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">PPPoE</p>
                        <p className="text-sm font-medium">{device.pppoeUser || "Não configurado"}</p>
                      </div>
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Preset de Configuração</p>
                        <p className="text-sm font-medium">{device.configPresetId || "Nenhum preset aplicado"}</p>
                      </div>
                      <Separator />
                      <Button variant="secondary" className="w-full" data-testid="button-apply-preset">
                        <Settings className="w-4 h-4 mr-1" />
                        Aplicar Preset de Configuração
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Histórico de Eventos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {logs && logs.length > 0 ? logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            log.severity === "error" ? "bg-red-500" :
                            log.severity === "warning" ? "bg-amber-500" :
                            "bg-emerald-500"
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
                    <div className="space-y-2 cursor-pointer">
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
                    <span className={`text-sm font-medium ${rxPowerColor}`}>{device.rxPower} dBm</span>
                  </div>
                )}
                {device.txPower !== null && device.txPower !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sinal TX</span>
                    <span className="text-sm font-medium">{device.txPower} dBm</span>
                  </div>
                )}
                {device.temperature !== null && device.temperature !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Temperatura</span>
                    <span className="text-sm font-medium">{device.temperature}°C</span>
                  </div>
                )}
                {device.uptime && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Uptime</span>
                    <span className="text-sm font-medium">{device.uptime}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
