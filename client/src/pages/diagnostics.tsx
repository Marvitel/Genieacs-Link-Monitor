import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRT } from "@/lib/date";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Filter,
  Wifi,
  WifiOff,
  Clock,
  Skull,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Code2,
  Unplug,
  Zap,
} from "lucide-react";
import type { DeviceLog } from "@shared/schema";

interface AcsFault {
  id: string;
  genieDeviceId: string;
  channel: string;
  timestamp: string;
  code: string;
  retries: number;
  label: string;
  description: string;
  severity: string;
  device: {
    id: string;
    serial: string;
    model: string;
    manufacturer: string;
    pppoeUser: string | null;
    status: string;
    ipAddress: string | null;
  } | null;
}

interface AcsFaultsResponse {
  total: number;
  faults: AcsFault[];
}

interface OfflineDevice {
  id: string;
  serial: string;
  model: string;
  manufacturer: string;
  deviceType: string;
  pppoeUser: string | null;
  ipAddress: string | null;
  status: string;
  lastSeen: string | null;
  genieId: string | null;
  hasFault: boolean;
}

interface OfflineResponse {
  summary: {
    total: number;
    online: number;
    stale: number;
    offline: number;
    dead: number;
    neverSeen: number;
  };
  stale: OfflineDevice[];
  offline: OfflineDevice[];
  dead: OfflineDevice[];
  neverSeen: OfflineDevice[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

function faultIcon(code: string) {
  if (code.startsWith("cwmp.9806")) return <ShieldAlert className="w-4 h-4 text-amber-500" />;
  if (code.startsWith("cwmp.9805")) return <Info className="w-4 h-4 text-blue-500" />;
  if (code.startsWith("cwmp.")) return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (code === "ext.Error" || code === "script.Error") return <Code2 className="w-4 h-4 text-red-500" />;
  if (code === "session_terminated") return <Unplug className="w-4 h-4 text-amber-500" />;
  if (code === "too_many_commits") return <Zap className="w-4 h-4 text-amber-500" />;
  return <AlertCircle className="w-4 h-4 text-red-500" />;
}

function FaultCard({ fault, onClear }: { fault: AcsFault; onClear: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card data-testid={`card-fault-${fault.id}`} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{faultIcon(fault.code)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                variant={fault.severity === "error" ? "destructive" : fault.severity === "warning" ? "outline" : "secondary"}
                className="text-[10px]"
              >
                {fault.label}
              </Badge>
              <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{fault.code}</code>
              <span className="text-[10px] text-muted-foreground ml-auto">{formatBRT(fault.timestamp)}</span>
            </div>

            {fault.device ? (
              <div className="flex items-center gap-2 text-sm mb-1">
                <Link href={`/devices/${fault.device.id}`} className="font-medium text-primary hover:underline flex items-center gap-1" data-testid={`link-fault-device-${fault.device.serial}`}>
                  {fault.device.manufacturer} {fault.device.model}
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground font-mono">{fault.device.serial}</span>
                {fault.device.pppoeUser && (
                  <>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-muted-foreground">{fault.device.pppoeUser}</span>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-1 font-mono">{fault.genieDeviceId}</p>
            )}

            <p className="text-xs text-muted-foreground">{fault.description}</p>

            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-muted-foreground">
                {fault.retries} tentativa{fault.retries !== 1 ? "s" : ""} · canal: {fault.channel}
              </span>
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-fault-${fault.id}`}
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "menos" : "detalhes"}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-red-500 hover:text-red-600 px-2"
                onClick={() => onClear(fault.id)}
                data-testid={`button-clear-fault-${fault.id}`}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            </div>

            {expanded && (
              <div className="mt-2 p-2 bg-muted rounded text-[11px] font-mono break-all text-muted-foreground">
                ID: {fault.id}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  ont: "ONT",
  router: "Roteador",
  mesh: "Mesh",
  switch: "Switch",
};

function OfflineTable({ devices, label, icon, color, typeFilter }: {
  devices: OfflineDevice[];
  label: string;
  icon: React.ReactNode;
  color: string;
  typeFilter: string;
}) {
  const filtered = typeFilter === "all" ? devices : devices.filter(d => d.deviceType === typeFilter);
  if (filtered.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-sm font-semibold ${color}`}>
        {icon}
        {label} ({filtered.length}{typeFilter !== "all" ? ` de ${devices.length}` : ""})
      </div>
      <div className="space-y-1">
        {filtered.map(d => (
          <Card key={d.id} data-testid={`card-offline-${d.serial}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                    {DEVICE_TYPE_LABELS[d.deviceType] ?? d.deviceType}
                  </Badge>
                  <Link href={`/devices/${d.id}`} className="text-sm font-medium text-primary hover:underline flex items-center gap-1" data-testid={`link-offline-device-${d.serial}`}>
                    {d.manufacturer} {d.model}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{d.serial}</code>
                  {d.pppoeUser && <span className="text-xs text-muted-foreground">{d.pppoeUser}</span>}
                  {d.ipAddress && <span className="text-xs text-muted-foreground font-mono">{d.ipAddress}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.hasFault && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5 flex items-center gap-0.5">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Fault
                  </Badge>
                )}
                {!d.genieId && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">Sem ACS</Badge>
                )}
                <span className="text-xs text-muted-foreground">{timeAgo(d.lastSeen)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Diagnostics() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [faultSearch, setFaultSearch] = useState("");
  const [faultCode, setFaultCode] = useState<string>("all");
  const [offlineTypeFilter, setOfflineTypeFilter] = useState<string>("all");

  const { data: logs, isLoading: logsLoading } = useQuery<DeviceLog[]>({
    queryKey: ["/api/device-logs"],
  });

  const { data: faultsData, isLoading: faultsLoading, refetch: refetchFaults } = useQuery<AcsFaultsResponse>({
    queryKey: ["/api/acs/faults"],
  });

  const { data: offlineData, isLoading: offlineLoading, refetch: refetchOffline } = useQuery<OfflineResponse>({
    queryKey: ["/api/acs/offline"],
  });

  const clearFault = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/acs/faults/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acs/faults"] });
      toast({ title: "Fault removido com sucesso" });
    },
    onError: () => toast({ title: "Erro ao remover fault", variant: "destructive" }),
  });

  const clearAllFaults = useMutation({
    mutationFn: (code?: string) => apiRequest("DELETE", `/api/acs/faults${code ? `?code=${encodeURIComponent(code)}` : ""}`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/acs/faults"] });
      toast({ title: `${data.deleted ?? 0} fault(s) removidos` });
    },
    onError: () => toast({ title: "Erro ao limpar faults", variant: "destructive" }),
  });

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "info": return <Info className="w-4 h-4 text-blue-500" />;
      default: return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    }
  };

  const severityLabel: Record<string, string> = { error: "Erro", warning: "Alerta", info: "Info", success: "Sucesso" };

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(search.toLowerCase()) || log.eventType.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = filterSeverity === "all" || log.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const filteredFaults = faultsData?.faults.filter(f => {
    const matchesCode = faultCode === "all" || f.code === faultCode;
    const q = faultSearch.toLowerCase();
    const matchesSearch = !q || f.genieDeviceId.toLowerCase().includes(q)
      || (f.device?.serial ?? "").toLowerCase().includes(q)
      || (f.device?.model ?? "").toLowerCase().includes(q)
      || (f.device?.pppoeUser ?? "").toLowerCase().includes(q)
      || f.label.toLowerCase().includes(q);
    return matchesCode && matchesSearch;
  });

  const faultCodes = Array.from(new Set(faultsData?.faults.map(f => f.code) ?? [])).sort();
  const faultCodeCounts = faultCodes.reduce((acc, code) => {
    acc[code] = faultsData?.faults.filter(f => f.code === code).length ?? 0;
    return acc;
  }, {} as Record<string, number>);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-diagnostics-title">Diagnósticos</h1>
          <p className="text-sm text-muted-foreground">Logs do sistema, falhas ACS e análise de dispositivos offline</p>
        </div>

        <Tabs defaultValue="faults">
          <TabsList data-testid="tabs-diagnostics">
            <TabsTrigger value="logs" data-testid="tab-logs">
              <Activity className="w-3.5 h-3.5 mr-1.5" />
              Logs do Sistema
            </TabsTrigger>
            <TabsTrigger value="faults" data-testid="tab-faults">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
              Falhas ACS
              {(faultsData?.total ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[9px] h-4 px-1">{faultsData?.total}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="offline" data-testid="tab-offline">
              <WifiOff className="w-3.5 h-3.5 mr-1.5" />
              Dispositivos Offline
              {((offlineData?.summary.stale ?? 0) + (offlineData?.summary.offline ?? 0) + (offlineData?.summary.dead ?? 0)) > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[9px] h-4 px-1">
                  {(offlineData?.summary.stale ?? 0) + (offlineData?.summary.offline ?? 0) + (offlineData?.summary.dead ?? 0)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── LOGS ── */}
          <TabsContent value="logs" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(["error","warning","info","success"] as const).map(s => (
                <Card key={s}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-md ${s==="error"?"bg-red-500/10":s==="warning"?"bg-amber-500/10":s==="info"?"bg-blue-500/10":"bg-emerald-500/10"}`}>
                      {severityIcon(s)}
                    </div>
                    <div>
                      <p className="text-lg font-bold">{logs?.filter(l => l.severity === s).length ?? 0}</p>
                      <p className="text-xs text-muted-foreground">{severityLabel[s]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar nos logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-logs" />
              </div>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-severity">
                  <Filter className="w-3 h-3 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                  <SelectItem value="warning">Alertas</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {logsLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)
            ) : (
              <div className="space-y-2">
                {filteredLogs?.map(log => (
                  <Card key={log.id} data-testid={`card-log-${log.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {severityIcon(log.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-[10px]">{log.eventType}</Badge>
                            <Badge variant={log.severity === "error" ? "destructive" : "secondary"} className="text-[10px]">{severityLabel[log.severity] || log.severity}</Badge>
                          </div>
                          <p className="text-sm">{log.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatBRT(log.createdAt)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredLogs?.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Activity className="w-12 h-12 mb-3 opacity-20" />
                    <span className="text-sm font-medium">Nenhum log encontrado</span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── FALHAS ACS ── */}
          <TabsContent value="faults" className="space-y-4 mt-4">
            {faultsLoading ? (
              [1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-md" />)
            ) : (
              <>
                {/* Summary cards */}
                {faultCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {faultCodes.map(code => (
                      <button
                        key={code}
                        onClick={() => setFaultCode(faultCode === code ? "all" : code)}
                        data-testid={`button-fault-code-${code}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${faultCode === code ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
                      >
                        {faultIcon(code)}
                        <span className="font-mono">{code}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{faultCodeCounts[code]}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar por serial, modelo, usuário PPPoE..." value={faultSearch} onChange={e => setFaultSearch(e.target.value)} className="pl-9" data-testid="input-search-faults" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchFaults()} data-testid="button-refresh-faults">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar
                  </Button>
                  {(faultsData?.total ?? 0) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                      onClick={() => clearAllFaults.mutate(faultCode !== "all" ? faultCode : undefined)}
                      disabled={clearAllFaults.isPending}
                      data-testid="button-clear-all-faults"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      {faultCode !== "all" ? `Limpar ${faultCode}` : "Limpar Todos"}
                    </Button>
                  )}
                </div>

                {(filteredFaults?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mb-3 opacity-20 text-emerald-500" />
                    <span className="text-sm font-medium">Nenhuma falha encontrada</span>
                    <span className="text-xs mt-1">Todos os dispositivos estão se comunicando normalmente com o ACS</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFaults?.map(fault => (
                      <FaultCard key={fault.id} fault={fault} onClear={id => clearFault.mutate(id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── OFFLINE ── */}
          <TabsContent value="offline" className="space-y-4 mt-4">
            {offlineLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Online", value: offlineData?.summary.online ?? 0, icon: <Wifi className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-500/10" },
                    { label: "Instável (2-24h)", value: offlineData?.summary.stale ?? 0, icon: <Clock className="w-4 h-4 text-amber-500" />, bg: "bg-amber-500/10" },
                    { label: "Offline (1-7d)", value: offlineData?.summary.offline ?? 0, icon: <WifiOff className="w-4 h-4 text-orange-500" />, bg: "bg-orange-500/10" },
                    { label: "Morto (>7d)", value: offlineData?.summary.dead ?? 0, icon: <Skull className="w-4 h-4 text-red-500" />, bg: "bg-red-500/10" },
                    { label: "Sem retorno ACS", value: offlineData?.summary.neverSeen ?? 0, icon: <AlertCircle className="w-4 h-4 text-muted-foreground" />, bg: "bg-muted" },
                  ].map(item => (
                    <Card key={item.label}>
                      <CardContent className="p-3 flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${item.bg}`}>{item.icon}</div>
                        <div>
                          <p className="text-lg font-bold leading-none">{item.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {(["all", "ont", "router", "mesh"] as const).map(t => {
                    const allItems = [
                      ...(offlineData?.stale ?? []),
                      ...(offlineData?.offline ?? []),
                      ...(offlineData?.dead ?? []),
                      ...(offlineData?.neverSeen ?? []),
                    ];
                    const count = t === "all" ? allItems.length : allItems.filter(d => d.deviceType === t).length;
                    if (t !== "all" && count === 0) return null;
                    return (
                      <button
                        key={t}
                        onClick={() => setOfflineTypeFilter(t)}
                        data-testid={`button-offline-type-${t}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${offlineTypeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
                      >
                        {t === "all" ? "Todos" : DEVICE_TYPE_LABELS[t] ?? t}
                        <Badge variant={offlineTypeFilter === t ? "secondary" : "outline"} className="text-[9px] h-4 px-1">{count}</Badge>
                      </button>
                    );
                  })}
                  <div className="ml-auto">
                    <Button variant="outline" size="sm" onClick={() => refetchOffline()} data-testid="button-refresh-offline">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  <OfflineTable
                    devices={offlineData?.stale ?? []}
                    label="Instáveis (sem contato há 2-24h)"
                    icon={<Clock className="w-4 h-4" />}
                    color="text-amber-500"
                    typeFilter={offlineTypeFilter}
                  />
                  <OfflineTable
                    devices={offlineData?.offline ?? []}
                    label="Offline (sem contato há 1-7 dias)"
                    icon={<WifiOff className="w-4 h-4" />}
                    color="text-orange-500"
                    typeFilter={offlineTypeFilter}
                  />
                  <OfflineTable
                    devices={offlineData?.dead ?? []}
                    label="Inativos (sem contato há mais de 7 dias)"
                    icon={<Skull className="w-4 h-4" />}
                    color="text-red-500"
                    typeFilter={offlineTypeFilter}
                  />
                  <OfflineTable
                    devices={offlineData?.neverSeen ?? []}
                    label="Nunca responderam ao ACS"
                    icon={<AlertCircle className="w-4 h-4" />}
                    color="text-muted-foreground"
                    typeFilter={offlineTypeFilter}
                  />
                  {(offlineData?.summary.stale ?? 0) === 0 &&
                   (offlineData?.summary.offline ?? 0) === 0 &&
                   (offlineData?.summary.dead ?? 0) === 0 &&
                   (offlineData?.summary.neverSeen ?? 0) === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Wifi className="w-12 h-12 mb-3 opacity-20 text-emerald-500" />
                      <span className="text-sm font-medium">Todos os dispositivos estão online</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
