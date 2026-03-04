import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeviceStatusBadge } from "@/components/device-status-badge";
import { Link } from "wouter";
import {
  Network,
  Router,
  Wifi,
  Server,
  Monitor,
} from "lucide-react";
import type { Device, Client } from "@shared/schema";

export default function Topology() {
  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const clientMap = new Map(clients?.map((c) => [c.id, c]) || []);

  const olts = devices?.filter((d) => d.deviceType === "olt") || [];
  const onts = devices?.filter((d) => d.deviceType === "ont") || [];
  const routers = devices?.filter((d) => d.deviceType === "router") || [];
  const meshes = devices?.filter((d) => d.deviceType === "mesh") || [];

  const deviceIcon = (type: string) => {
    switch (type) {
      case "olt": return <Server className="w-5 h-5" />;
      case "ont": return <Router className="w-5 h-5" />;
      case "router": return <Monitor className="w-5 h-5" />;
      case "mesh": return <Wifi className="w-5 h-5" />;
      default: return <Router className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[500px] rounded-md" />
        </div>
      </ScrollArea>
    );
  }

  const groupByOlt = (devices: Device[]) => {
    const grouped = new Map<string, Device[]>();
    devices.forEach((d) => {
      const key = d.oltId || "sem-olt";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(d);
    });
    return grouped;
  };

  const ontsByOlt = groupByOlt(onts);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-topology-title">Topologia de Rede</h1>
          <p className="text-sm text-muted-foreground">Visualização hierárquica dos dispositivos</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{olts.length}</p>
                <p className="text-xs text-muted-foreground">OLTs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <Router className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{onts.length}</p>
                <p className="text-xs text-muted-foreground">ONTs/ONUs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Monitor className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{routers.length}</p>
                <p className="text-xs text-muted-foreground">Roteadores</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-violet-500/10">
                <Wifi className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{meshes.length}</p>
                <p className="text-xs text-muted-foreground">Mesh</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {Array.from(ontsByOlt.entries()).map(([oltId, ontDevices]) => {
            const olt = olts.find((o) => o.id === oltId || o.serialNumber === oltId);
            return (
              <Card key={oltId} data-testid={`card-olt-group-${oltId}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    {olt ? `${olt.manufacturer} ${olt.model}` : oltId === "sem-olt" ? "Sem OLT Vinculada" : `OLT: ${oltId}`}
                    <Badge variant="secondary" className="text-[10px]">{ontDevices.length} dispositivos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 pl-6 border-l-2 border-border">
                    {ontDevices.map((device) => {
                      const client = device.clientId ? clientMap.get(device.clientId) : null;
                      const childRouters = routers.filter((r) => r.clientId && r.clientId === device.clientId);
                      const childMeshes = meshes.filter((m) => m.clientId && m.clientId === device.clientId);

                      return (
                        <div key={device.id}>
                          <Link href={`/devices/${device.id}`}>
                            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate" data-testid={`card-topo-device-${device.id}`}>
                              <div className="flex items-center gap-3">
                                {deviceIcon(device.deviceType)}
                                <div>
                                  <p className="text-sm font-medium">{device.manufacturer} {device.model}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {device.serialNumber}
                                    {device.ponPort && ` | PON: ${device.ponPort}`}
                                    {client && ` | ${client.name}`}
                                  </p>
                                </div>
                              </div>
                              <DeviceStatusBadge status={device.status} />
                            </div>
                          </Link>
                          {(childRouters.length > 0 || childMeshes.length > 0) && (
                            <div className="space-y-1 pl-8 mt-1 border-l border-border/50 ml-4">
                              {[...childRouters, ...childMeshes].map((child) => (
                                <Link key={child.id} href={`/devices/${child.id}`}>
                                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 cursor-pointer hover-elevate text-xs" data-testid={`card-topo-child-${child.id}`}>
                                    <div className="flex items-center gap-2">
                                      {deviceIcon(child.deviceType)}
                                      <span>{child.manufacturer} {child.model}</span>
                                    </div>
                                    <DeviceStatusBadge status={child.status} />
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {routers.filter((r) => !onts.some((o) => o.clientId && o.clientId === r.clientId)).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  Roteadores Independentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {routers.filter((r) => !onts.some((o) => o.clientId && o.clientId === r.clientId)).map((device) => (
                    <Link key={device.id} href={`/devices/${device.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate" data-testid={`card-topo-router-${device.id}`}>
                        <div className="flex items-center gap-3">
                          {deviceIcon(device.deviceType)}
                          <div>
                            <p className="text-sm font-medium">{device.manufacturer} {device.model}</p>
                            <p className="text-xs text-muted-foreground">{device.serialNumber}</p>
                          </div>
                        </div>
                        <DeviceStatusBadge status={device.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!devices || devices.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Network className="w-12 h-12 mb-3 opacity-20" />
              <span className="text-sm font-medium">Nenhum dispositivo na rede</span>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
