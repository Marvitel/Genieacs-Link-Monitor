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
} from "lucide-react";
import type { Client, Device } from "@shared/schema";

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

          <div className="col-span-1 lg:col-span-2">
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
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
