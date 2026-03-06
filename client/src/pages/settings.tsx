import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Server,
  Bell,
  Link2,
  Globe,
  RefreshCw,
  CheckCircle,
  XCircle,
  Wrench,
  AlertTriangle,
  Zap,
  FileCode,
  Settings2,
} from "lucide-react";

interface SetupStatus {
  provisions: string[];
  presets: string[];
  missingProvisions: string[];
  missingPresets: string[];
}

interface GenieStatus {
  configured: boolean;
  connected: boolean;
  url: string | null;
  setup: SetupStatus | null;
}

interface SetupResult {
  provisions: { name: string; success: boolean; error?: string }[];
  presets: { name: string; success: boolean; error?: string }[];
  summary: string;
}

export default function Settings() {
  const { toast } = useToast();

  const { data: genieStatus } = useQuery<GenieStatus>({
    queryKey: ["/api/genieacs/status"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/genieacs/sync");
      return res.json();
    },
    onSuccess: (data: { message: string; synced: number }) => {
      toast({ title: "Sincronização concluída", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/genieacs/setup", { informInterval: 300 });
      return res.json();
    },
    onSuccess: (data: SetupResult) => {
      toast({ title: "Configuração concluída", description: data.summary });
      queryClient.invalidateQueries({ queryKey: ["/api/genieacs/status"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na configuração", description: error.message, variant: "destructive" });
    },
  });

  const setupStatus = genieStatus?.setup;
  const isConnected = genieStatus?.connected;
  const needsSetup = isConnected && setupStatus && (setupStatus.missingProvisions.length > 0 || setupStatus.missingPresets.length > 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Configurações</h1>
          <p className="text-sm text-muted-foreground">Configurações do sistema NetControl ACS</p>
        </div>

        {needsSetup && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">GenieACS precisa ser configurado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O GenieACS está conectado mas faltam {setupStatus.missingProvisions.length} provisions
                    e {setupStatus.missingPresets.length} presets para funcionar corretamente.
                    Clique no botão abaixo para configurar automaticamente.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => setupMutation.mutate()}
                    disabled={setupMutation.isPending}
                    data-testid="button-quick-setup"
                  >
                    <Zap className={`w-4 h-4 mr-1 ${setupMutation.isPending ? "animate-spin" : ""}`} />
                    {setupMutation.isPending ? "Configurando..." : "Configurar GenieACS Agora"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Server className="w-4 h-4 text-primary" />
                GenieACS - Servidor ACS
              </CardTitle>
              <CardDescription className="text-xs">
                Configuração da conexão com o GenieACS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status da Conexão</p>
                  {genieStatus?.connected ? (
                    <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">
                      <CheckCircle className="w-3 h-3 mr-1" /> Conectado
                    </Badge>
                  ) : genieStatus?.configured ? (
                    <Badge variant="outline" className="border-red-500 text-red-500">
                      <XCircle className="w-3 h-3 mr-1" /> Sem conexão
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500 text-amber-500">
                      <XCircle className="w-3 h-3 mr-1" /> Não configurado
                    </Badge>
                  )}
                </div>
                {genieStatus?.url && (
                  <span className="text-xs text-muted-foreground font-mono">{genieStatus.url}</span>
                )}
              </div>
              <div className="space-y-2">
                <Label>URL do Servidor ACS (CWMP)</Label>
                <Input defaultValue="https://acs.seudominio.com.br:7547" data-testid="input-acs-url" />
                <p className="text-xs text-muted-foreground">Endereço que os CPEs usam para conectar (porta 7547)</p>
              </div>
              <div className="space-y-2">
                <Label>URL da NBI API</Label>
                <Input defaultValue={genieStatus?.url || "http://localhost:7557"} data-testid="input-nbi-url" />
                <p className="text-xs text-muted-foreground">API interna do GenieACS (porta 7557)</p>
              </div>
              <div className="space-y-2">
                <Label>Intervalo de Inform (segundos)</Label>
                <Input defaultValue="300" type="number" data-testid="input-inform-interval" />
                <p className="text-xs text-muted-foreground">Frequência com que os CPEs reportam status (padrão: 300s = 5min)</p>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" data-testid="button-save-acs">
                  Salvar
                </Button>
                <Button
                  variant="default"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || !isConnected}
                  data-testid="button-sync-genieacs"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Wrench className="w-4 h-4 text-primary" />
                Configuração do GenieACS
              </CardTitle>
              <CardDescription className="text-xs">
                Provisions e presets que coletam dados dos dispositivos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isConnected ? (
                <div className="p-4 rounded-md bg-muted/50 text-center">
                  <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Conecte ao GenieACS para configurar</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Provisions</span>
                      </div>
                      <Badge variant={setupStatus?.missingProvisions.length === 0 ? "default" : "outline"}>
                        {setupStatus?.provisions.length ?? 0}
                      </Badge>
                    </div>
                    {setupStatus && setupStatus.provisions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {setupStatus.provisions.map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs font-mono" data-testid={`badge-provision-${p}`}>
                            {p.replace("netcontrol-", "")}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {setupStatus && setupStatus.missingProvisions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {setupStatus.missingProvisions.map((p) => (
                          <Badge key={p} variant="destructive" className="text-xs font-mono" data-testid={`badge-missing-provision-${p}`}>
                            {p.replace("netcontrol-", "")} (faltando)
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Presets</span>
                      </div>
                      <Badge variant={setupStatus?.missingPresets.length === 0 ? "default" : "outline"}>
                        {setupStatus?.presets.length ?? 0}
                      </Badge>
                    </div>
                    {setupStatus && setupStatus.presets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {setupStatus.presets.map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs font-mono" data-testid={`badge-preset-${p}`}>
                            {p.replace("netcontrol-", "")}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {setupStatus && setupStatus.missingPresets.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {setupStatus.missingPresets.map((p) => (
                          <Badge key={p} variant="destructive" className="text-xs font-mono" data-testid={`badge-missing-preset-${p}`}>
                            {p.replace("netcontrol-", "")} (faltando)
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      O setup cria automaticamente as provisions e presets necessários no GenieACS para coletar:
                      informações do dispositivo, WAN/PPPoE, Wi-Fi, sinal GPON, LAN/hosts e diagnósticos.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => setupMutation.mutate()}
                      disabled={setupMutation.isPending}
                      data-testid="button-setup-genieacs"
                    >
                      <Wrench className={`w-4 h-4 mr-1 ${setupMutation.isPending ? "animate-spin" : ""}`} />
                      {setupMutation.isPending
                        ? "Configurando..."
                        : setupStatus?.missingProvisions.length === 0 && setupStatus?.missingPresets.length === 0
                          ? "Reconfigurar GenieACS"
                          : "Configurar GenieACS"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Link2 className="w-4 h-4 text-primary" />
                Integração Link Monitor
              </CardTitle>
              <CardDescription className="text-xs">
                Vincular dispositivos a clientes via sistema de monitoramento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Link Monitor</Label>
                <Input placeholder="https://linkmonitor.seudominio.com.br" data-testid="input-linkmonitor-url" />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" placeholder="Sua API key" data-testid="input-linkmonitor-key" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sincronização Automática</p>
                  <p className="text-xs text-muted-foreground">Vincular dispositivos a clientes via PPPoE</p>
                </div>
                <Switch data-testid="switch-auto-sync" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-descoberta de Clientes</p>
                  <p className="text-xs text-muted-foreground">Criar clientes a partir dos dados do Link Monitor</p>
                </div>
                <Switch data-testid="switch-auto-discover" />
              </div>
              <Separator />
              <Button variant="secondary" className="w-full" data-testid="button-save-linkmonitor">
                Salvar Integração
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Bell className="w-4 h-4 text-primary" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Dispositivo Offline</p>
                  <p className="text-xs text-muted-foreground">Notificar quando um dispositivo ficar offline</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-offline" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sinal Baixo</p>
                  <p className="text-xs text-muted-foreground">Notificar quando o sinal RX estiver abaixo de -28dBm</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-signal" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Temperatura Alta</p>
                  <p className="text-xs text-muted-foreground">Notificar quando a temperatura exceder 70°C</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-temp" />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Globe className="w-4 h-4 text-primary" />
                Compatibilidade Flashman
              </CardTitle>
              <CardDescription className="text-xs">
                Migração e compatibilidade com o Flashman
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">Compatível</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Preservar Configs</p>
                    <p className="text-xs text-muted-foreground">Manter configurações existentes</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-flashman-compat" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Importar Dados</p>
                    <p className="text-xs text-muted-foreground">Importar do Flashman</p>
                  </div>
                  <Button variant="secondary" size="sm" data-testid="button-import-flashman">
                    Importar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
