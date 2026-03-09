import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { DeviceStatusBadge, DeviceTypeBadge } from "@/components/device-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Router,
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  ArrowRight,
  Signal,
  Thermometer,
  Clock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Device, Client, DeviceLog } from "@shared/schema";

type UptimePoint = { time: string; online: number; offline: number };

const COLORS = ["hsl(142, 76%, 36%)", "hsl(0, 84%, 60%)", "hsl(45, 93%, 47%)", "hsl(215, 20%, 65%)"];

export default function Dashboard() {
  const { data: devices, isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: logs, isLoading: logsLoading } = useQuery<DeviceLog[]>({
    queryKey: ["/api/device-logs"],
  });

  const { data: uptimeData } = useQuery<UptimePoint[]>({
    queryKey: ["/api/network-availability"],
    refetchInterval: 5 * 60 * 1000,
  });

  const onlineCount = devices?.filter((d) => d.status === "online").length || 0;
  const offlineCount = devices?.filter((d) => d.status === "offline").length || 0;
  const warningCount = devices?.filter((d) => d.status === "warning").length || 0;
  const totalDevices = devices?.length || 0;
  const totalClients = clients?.length || 0;

  const typeDistribution = devices
    ? [
        { name: "ONT/ONU", value: devices.filter((d) => d.deviceType === "ont").length },
        { name: "Roteador", value: devices.filter((d) => d.deviceType === "router").length },
        { name: "Mesh", value: devices.filter((d) => d.deviceType === "mesh").length },
        { name: "Switch", value: devices.filter((d) => d.deviceType === "switch").length },
      ].filter((d) => d.value > 0)
    : [];

  const isLoading = devicesLoading || clientsLoading;

  usePageTitle("Dashboard");

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[120px] rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-[300px] col-span-2 rounded-md" />
            <Skeleton className="h-[300px] rounded-md" />
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sua rede e dispositivos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Dispositivos"
            value={totalDevices}
            subtitle={`${onlineCount} online`}
            icon={Router}
            trend={{ value: 2.5, positive: true }}
          />
          <StatCard
            title="Online"
            value={onlineCount}
            subtitle={`${((onlineCount / Math.max(totalDevices, 1)) * 100).toFixed(1)}% do total`}
            icon={Wifi}
            color="text-emerald-500"
          />
          <StatCard
            title="Offline"
            value={offlineCount}
            subtitle={warningCount > 0 ? `${warningCount} em alerta` : "Nenhum alerta"}
            icon={WifiOff}
            color="text-red-500"
          />
          <StatCard
            title="Clientes"
            value={totalClients}
            subtitle={`${clients?.filter((c) => c.clientType === "corporate").length || 0} corporativos`}
            icon={Users}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Activity className="w-4 h-4 text-primary" />
                Disponibilidade de Rede (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={uptimeData || []}>
                  <defs>
                    <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="online" stroke="hsl(142, 76%, 36%)" fill="url(#onlineGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="offline" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%)" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Router className="w-4 h-4 text-primary" />
                Tipos de Dispositivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {typeDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={typeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {typeDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {typeDistribution.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-1">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Dispositivos com Problemas
                </CardTitle>
                <Link href="/devices?status=warning" data-testid="link-view-warnings">
                  <span className="text-xs text-primary flex items-center gap-0.5 cursor-pointer">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {devices
                  ?.filter((d) => d.status === "warning" || d.status === "offline")
                  .slice(0, 5)
                  .map((device) => (
                    <Link key={device.id} href={`/devices/${device.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate" data-testid={`card-problem-device-${device.id}`}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{device.model}</span>
                          <span className="text-xs text-muted-foreground">{device.serialNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {device.rxPower && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Signal className="w-3 h-3" /> {device.rxPower}dBm
                            </span>
                          )}
                          <DeviceStatusBadge status={device.status} />
                        </div>
                      </div>
                    </Link>
                  ))}
                {(!devices || devices.filter((d) => d.status === "warning" || d.status === "offline").length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Wifi className="w-8 h-8 mb-2 opacity-30" />
                    <span className="text-sm">Todos os dispositivos estão online</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-1">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Clock className="w-4 h-4 text-primary" />
                  Atividade Recente
                </CardTitle>
                <Link href="/diagnostics" data-testid="link-view-logs">
                  <span className="text-xs text-primary flex items-center gap-0.5 cursor-pointer">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs?.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/50" data-testid={`card-log-${log.id}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      log.severity === "error" ? "bg-red-500" :
                      log.severity === "warning" ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`} />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm truncate">{log.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString("pt-BR") : ""}
                      </span>
                    </div>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Activity className="w-8 h-8 mb-2 opacity-30" />
                    <span className="text-sm">Nenhuma atividade recente</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
