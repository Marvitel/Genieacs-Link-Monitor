import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import type { DeviceLog, Device } from "@shared/schema";

export default function Diagnostics() {
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<DeviceLog[]>({
    queryKey: ["/api/device-logs"],
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const deviceMap = new Map(devices?.map((d) => [d.id, d]) || []);

  const filtered = logs?.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.eventType.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = filterSeverity === "all" || log.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "info": return <Info className="w-4 h-4 text-blue-500" />;
      default: return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    }
  };

  const severityLabel: Record<string, string> = {
    error: "Erro",
    warning: "Alerta",
    info: "Info",
    success: "Sucesso",
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-diagnostics-title">Diagnósticos</h1>
          <p className="text-sm text-muted-foreground">Logs e eventos dos dispositivos da rede</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{logs?.filter((l) => l.severity === "error").length || 0}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{logs?.filter((l) => l.severity === "warning").length || 0}</p>
                <p className="text-xs text-muted-foreground">Alertas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Info className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{logs?.filter((l) => l.severity === "info").length || 0}</p>
                <p className="text-xs text-muted-foreground">Informativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{logs?.filter((l) => l.severity === "success").length || 0}</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-logs"
            />
          </div>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-severity">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
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

        <div className="space-y-2">
          {filtered?.map((log) => {
            const device = deviceMap.get(log.deviceId);
            return (
              <Card key={log.id} data-testid={`card-log-${log.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {severityIcon(log.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px]">{log.eventType}</Badge>
                        <Badge variant={log.severity === "error" ? "destructive" : "secondary"} className="text-[10px]">
                          {severityLabel[log.severity] || log.severity}
                        </Badge>
                        {device && (
                          <span className="text-xs text-muted-foreground">
                            {device.manufacturer} {device.model} ({device.serialNumber})
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{log.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString("pt-BR") : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Activity className="w-12 h-12 mb-3 opacity-20" />
              <span className="text-sm font-medium">Nenhum log encontrado</span>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
