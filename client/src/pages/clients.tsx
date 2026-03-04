import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Plus,
  Search,
  Users,
  Building2,
  Home,
  Eye,
  Mail,
  Phone,
  MapPin,
  Router,
} from "lucide-react";
import type { Client, Device } from "@shared/schema";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDialogOpen(false);
      toast({ title: "Cliente adicionado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar cliente", description: error.message, variant: "destructive" });
    },
  });

  const filtered = clients?.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.document && c.document.toLowerCase().includes(search.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search));
    const matchesType = filterType === "all" || c.clientType === filterType;
    return matchesSearch && matchesType;
  });

  const devicesByClient = new Map<string, number>();
  devices?.forEach((d) => {
    if (d.clientId) {
      devicesByClient.set(d.clientId, (devicesByClient.get(d.clientId) || 0) + 1);
    }
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

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-32" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
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
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-clients-title">Clientes</h1>
            <p className="text-sm text-muted-foreground">{clients?.length || 0} clientes cadastrados</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-client">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" name="name" required data-testid="input-client-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document">CPF/CNPJ</Label>
                    <Input id="document" name="document" data-testid="input-document" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientType">Tipo</Label>
                    <Select name="clientType" defaultValue="residential">
                      <SelectTrigger data-testid="select-client-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residencial</SelectItem>
                        <SelectItem value="corporate">Corporativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" data-testid="input-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" data-testid="input-phone" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input id="address" name="address" data-testid="input-address" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plano</Label>
                    <Input id="plan" name="plan" placeholder="Ex: 100 Mbps" data-testid="input-plan" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue="active">
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                        <SelectItem value="suspended">Suspenso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" name="notes" data-testid="input-notes" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-client">
                  {createMutation.isPending ? "Salvando..." : "Salvar Cliente"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-clients"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]" data-testid="select-filter-client-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="residential">Residencial</SelectItem>
              <SelectItem value="corporate">Corporativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {filtered?.map((client) => {
            const devCount = devicesByClient.get(client.id) || 0;
            return (
              <Card key={client.id} className="hover-elevate" data-testid={`card-client-${client.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        {client.clientType === "corporate" ? (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Home className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{client.name}</span>
                          <Badge variant={client.status === "active" ? "default" : "outline"} className={statusColors[client.status]}>
                            {statusLabels[client.status]}
                          </Badge>
                          <Badge variant="outline">
                            {client.clientType === "corporate" ? "Corporativo" : "Residencial"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {client.document && <span>{client.document}</span>}
                          {client.email && (
                            <span className="flex items-center gap-0.5">
                              <Mail className="w-3 h-3" /> {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-3 h-3" /> {client.phone}
                            </span>
                          )}
                          {client.plan && <span>Plano: {client.plan}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Router className="w-3 h-3" /> {devCount} dispositivo{devCount !== 1 ? "s" : ""}
                      </span>
                      <Link href={`/clients/${client.id}`}>
                        <Button size="icon" variant="ghost" data-testid={`button-view-client-${client.id}`}>
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
              <Users className="w-12 h-12 mb-3 opacity-20" />
              <span className="text-sm font-medium">Nenhum cliente encontrado</span>
              <span className="text-xs mt-1">Tente ajustar os filtros ou adicione um novo cliente</span>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
