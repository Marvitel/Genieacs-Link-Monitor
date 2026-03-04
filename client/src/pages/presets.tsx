import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Plus,
  FileSliders,
  Copy,
  Settings,
} from "lucide-react";
import type { ConfigPreset } from "@shared/schema";
import { DEVICE_TYPES, MANUFACTURERS } from "@shared/schema";

export default function Presets() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: presets, isLoading } = useQuery<ConfigPreset[]>({
    queryKey: ["/api/config-presets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/config-presets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config-presets"] });
      setDialogOpen(false);
      toast({ title: "Preset criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar preset", description: error.message, variant: "destructive" });
    },
  });

  const typeLabels: Record<string, string> = {
    ont: "ONT/ONU",
    router: "Roteador",
    mesh: "Mesh",
    switch: "Switch",
    olt: "OLT",
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key === "configData") {
        try {
          data[key] = JSON.parse(value as string);
        } catch {
          data[key] = {};
        }
      } else if (value) {
        data[key] = value;
      }
    });
    createMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[160px] rounded-md" />
            ))}
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-presets-title">Presets de Configuração</h1>
            <p className="text-sm text-muted-foreground">Templates de configuração para aplicar em dispositivos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-preset">
                <Plus className="w-4 h-4 mr-1" /> Novo Preset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Preset de Configuração</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" required data-testid="input-preset-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Tipo de Dispositivo</Label>
                    <Select name="deviceType" required>
                      <SelectTrigger data-testid="select-preset-type">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{typeLabels[t] || t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Fabricante</Label>
                    <Select name="manufacturer">
                      <SelectTrigger data-testid="select-preset-manufacturer">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUFACTURERS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo (opcional)</Label>
                  <Input id="model" name="model" data-testid="input-preset-model" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" name="description" data-testid="input-preset-description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="configData">Configuração (JSON)</Label>
                  <Textarea
                    id="configData"
                    name="configData"
                    className="font-mono text-xs min-h-[120px]"
                    defaultValue="{}"
                    data-testid="input-preset-config"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-preset">
                  {createMutation.isPending ? "Salvando..." : "Salvar Preset"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets?.map((preset) => (
            <Card key={preset.id} className="hover-elevate" data-testid={`card-preset-${preset.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-1 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Settings className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{preset.name}</p>
                      {preset.manufacturer && (
                        <p className="text-xs text-muted-foreground">{preset.manufacturer} {preset.model || ""}</p>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" data-testid={`button-copy-preset-${preset.id}`}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="outline">{typeLabels[preset.deviceType] || preset.deviceType}</Badge>
                </div>
                {preset.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {(!presets || presets.length === 0) && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileSliders className="w-12 h-12 mb-3 opacity-20" />
              <span className="text-sm font-medium">Nenhum preset criado</span>
              <span className="text-xs mt-1">Crie presets para padronizar configurações</span>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
