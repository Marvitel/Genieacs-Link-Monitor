import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DeviceStatusBadge, DeviceTypeBadge } from "@/components/device-status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Plus,
  Search,
  Router,
  Signal,
  Thermometer,
  Eye,
  Filter,
  Cable,
} from "lucide-react";
import type { Device, Client } from "@shared/schema";
import { DEVICE_TYPES, MANUFACTURERS } from "@shared/schema";

export default function Devices() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  usePageTitle("Dispositivos");

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/devices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setDialogOpen(false);
      toast({ title: "Dispositivo adicionado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const clientMap = new Map(clients?.map((c) => [c.id, c]) || []);

  const filtered = devices?.filter((d) => {
    const s = search.toLowerCase();
    const clientName = d.clientId ? clientMap.get(d.clientId)?.name?.toLowerCase() || "" : "";
    const matchesSearch = !s ||
      d.model.toLowerCase().includes(s) ||
      d.serialNumber.toLowerCase().includes(s) ||
      d.manufacturer.toLowerCase().includes(s) ||
      (d.macAddress && d.macAddress.toLowerCase().includes(s)) ||
      (d.macAddress && d.macAddress.replace(/:/g, "").toLowerCase().includes(s.replace(/[:\-]/g, ""))) ||
      (d.pppoeUser && d.pppoeUser.toLowerCase().includes(s)) ||
      (d.ipAddress && d.ipAddress.toLowerCase().includes(s)) ||
      (d.ssid && d.ssid.toLowerCase().includes(s)) ||
      (d.ssid5g && d.ssid5g?.toLowerCase().includes(s)) ||
      (d.notes && d.notes.toLowerCase().includes(s)) ||
      clientName.includes(s);
    const matchesType = filterType === "all" || d.deviceType === filterType;
    const matchesStatus = filterStatus === "all" || d.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (value) data[key] = value;
    });
    createMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-32" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-devices-title">Dispositivos</h1>
            <p className="text-sm text-muted-foreground">{devices?.length || 0} dispositivos cadastrados</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-device">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Dispositivo</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serialNumber">Número de Série</Label>
                    <Input id="serialNumber" name="serialNumber" required data-testid="input-serial" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input id="model" name="model" required data-testid="input-model" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Fabricante</Label>
                    <Select name="manufacturer" required>
                      <SelectTrigger data-testid="select-manufacturer">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUFACTURERS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Tipo</Label>
                    <Select name="deviceType" required>
                      <SelectTrigger data-testid="select-device-type">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t === "ont" ? "ONT/ONU" : t === "router" ? "Roteador" : t === "mesh" ? "Mesh" : t === "switch" ? "Switch" : "OLT"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="macAddress">MAC Address</Label>
                    <Input id="macAddress" name="macAddress" placeholder="AA:BB:CC:DD:EE:FF" data-testid="input-mac" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ipAddress">IP Address</Label>
                    <Input id="ipAddress" name="ipAddress" placeholder="192.168.1.1" data-testid="input-ip" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="clientId">Cliente</Label>
                    <Select name="clientId">
                      <SelectTrigger data-testid="select-client">
                        <SelectValue placeholder="Selecionar cliente (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pppoeUser">PPPoE User</Label>
                    <Input id="pppoeUser" name="pppoeUser" data-testid="input-pppoe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ssid">SSID</Label>
                    <Input id="ssid" name="ssid" data-testid="input-ssid" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-device">
                  {createMutation.isPending ? "Salvando..." : "Salvar Dispositivo"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por modelo, serial, MAC, IP, PPPoE, SSID, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-devices"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="ont">ONT/ONU</SelectItem>
              <SelectItem value="router">Roteador</SelectItem>
              <SelectItem value="mesh">Mesh</SelectItem>
              <SelectItem value="switch">Switch</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="warning">Alerta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {filtered?.map((device) => {
            const client = device.clientId ? clientMap.get(device.clientId) : null;
            return (
              <Card key={device.id} className="hover-elevate" data-testid={`card-device-${device.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Router className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{device.manufacturer} {device.model}</span>
                          <DeviceTypeBadge type={device.deviceType} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>SN: {device.serialNumber}</span>
                          {device.macAddress && <span>MAC: {device.macAddress}</span>}
                          {device.ipAddress && <span>IP: {device.ipAddress}</span>}
                          {client && <span>Cliente: {client.name}</span>}
                          {device.parentDeviceId && (() => {
                            const parent = devices?.find(d => d.id === device.parentDeviceId);
                            return parent ? <span className="flex items-center gap-0.5"><Cable className="w-3 h-3" /> {parent.manufacturer} {parent.model}</span> : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {device.rxPower !== null && device.rxPower !== undefined && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Signal className="w-3 h-3" /> {device.rxPower}dBm
                        </span>
                      )}
                      {device.temperature !== null && device.temperature !== undefined && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Thermometer className="w-3 h-3" /> {device.temperature}°C
                        </span>
                      )}
                      <DeviceStatusBadge status={device.status} />
                      <Link href={`/devices/${device.id}`}>
                        <Button size="icon" variant="ghost" data-testid={`button-view-device-${device.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Router className="w-12 h-12 mb-3 opacity-20" />
              <span className="text-sm font-medium">Nenhum dispositivo encontrado</span>
              <span className="text-xs mt-1">Tente ajustar os filtros ou adicione um novo dispositivo</span>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
