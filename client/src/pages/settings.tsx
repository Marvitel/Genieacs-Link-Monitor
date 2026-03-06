import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Download,
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
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

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string | null;
}

const permLabels: Record<string, string> = { read: "Leitura", read_write: "Leitura/Escrita", full: "Acesso Total" };

export default function Settings() {
  const { toast } = useToast();

  const [acsUrl, setAcsUrl] = useState("");
  const [nbiUrl, setNbiUrl] = useState("");
  const [informInterval, setInformInterval] = useState("300");
  const [lmUrl, setLmUrl] = useState("");
  const [lmUser, setLmUser] = useState("");
  const [lmPassword, setLmPassword] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [autoDiscover, setAutoDiscover] = useState(false);
  const [notifyOffline, setNotifyOffline] = useState(true);
  const [notifySignal, setNotifySignal] = useState(true);
  const [notifyTemp, setNotifyTemp] = useState(true);
  const [flashmanCompat, setFlashmanCompat] = useState(true);

  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState("read");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);

  const { data: genieStatus } = useQuery<GenieStatus>({
    queryKey: ["/api/genieacs/status"],
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKeyItem[]>({
    queryKey: ["/api/api-keys"],
  });

  useEffect(() => {
    if (settings) {
      if (settings.acs_url) setAcsUrl(settings.acs_url);
      if (settings.nbi_url) setNbiUrl(settings.nbi_url);
      if (settings.inform_interval) setInformInterval(settings.inform_interval);
      if (settings.linkmonitor_url) setLmUrl(settings.linkmonitor_url);
      if (settings.linkmonitor_user) setLmUser(settings.linkmonitor_user);
      if (settings.linkmonitor_password) setLmPassword(settings.linkmonitor_password);
      setAutoSync(settings.auto_sync === "true");
      setAutoDiscover(settings.auto_discover === "true");
      setNotifyOffline(settings.notify_offline !== "false");
      setNotifySignal(settings.notify_signal !== "false");
      setNotifyTemp(settings.notify_temp !== "false");
      setFlashmanCompat(settings.flashman_compat !== "false");
    }
  }, [settings]);

  useEffect(() => {
    if (genieStatus?.url && !nbiUrl) {
      setNbiUrl(genieStatus.url);
    }
  }, [genieStatus]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Configurações salvas" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/genieacs/sync");
      return res.json();
    },
    onSuccess: (data: { message: string; synced: number; autoBackups?: number }) => {
      const desc = data.autoBackups
        ? `${data.message} (${data.autoBackups} backups automáticos)`
        : data.message;
      toast({ title: "Sincronização concluída", description: desc });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    },
  });

  const bulkBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/devices/bulk-backup");
      return res.json();
    },
    onSuccess: (data: { message: string; backed: number; skipped: number; failed: number; total: number }) => {
      toast({ title: "Backup em massa concluído", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro no backup em massa", description: error.message, variant: "destructive" });
    },
  });

  const clearSeedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/genieacs/clear-seed-data");
      return res.json();
    },
    onSuccess: (data: { message: string; removed: number }) => {
      toast({ title: "Dados fictícios removidos", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/genieacs/setup", { informInterval: parseInt(informInterval) || 300 });
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

  const createKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/api-keys", { name: newKeyName, permissions: newKeyPerms });
      return res.json();
    },
    onSuccess: (data: { key: string }) => {
      setCreatedKey(data.key);
      setShowCreatedKey(true);
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Chave API criada" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Chave revogada" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const saveAcs = () => {
    saveSettingsMutation.mutate({
      acs_url: acsUrl,
      nbi_url: nbiUrl,
      inform_interval: informInterval,
    });
  };

  const saveLinkMonitor = () => {
    saveSettingsMutation.mutate({
      linkmonitor_url: lmUrl,
      linkmonitor_user: lmUser,
      linkmonitor_password: lmPassword,
      auto_sync: String(autoSync),
      auto_discover: String(autoDiscover),
    });
  };

  const testLinkMonitorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/linkmonitor/test", { url: lmUrl, username: lmUser, password: lmPassword });
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      if (data.success) {
        toast({ title: "Conexão OK", description: data.message });
      } else {
        toast({ title: "Falha na conexão", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const saveNotifications = () => {
    saveSettingsMutation.mutate({
      notify_offline: String(notifyOffline),
      notify_signal: String(notifySignal),
      notify_temp: String(notifyTemp),
    });
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    toast({ title: "Copiado!" });
  };

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
                <Input value={acsUrl} onChange={(e) => setAcsUrl(e.target.value)} placeholder="https://acs.seudominio.com.br:7547" data-testid="input-acs-url" />
                <p className="text-xs text-muted-foreground">Endereço que os CPEs usam para conectar (porta 7547)</p>
              </div>
              <div className="space-y-2">
                <Label>URL da NBI API</Label>
                <Input value={nbiUrl} onChange={(e) => setNbiUrl(e.target.value)} placeholder="http://localhost:7557" data-testid="input-nbi-url" />
                <p className="text-xs text-muted-foreground">API interna do GenieACS (porta 7557)</p>
              </div>
              <div className="space-y-2">
                <Label>Intervalo de Inform (segundos)</Label>
                <Input value={informInterval} onChange={(e) => setInformInterval(e.target.value)} type="number" data-testid="input-inform-interval" />
                <p className="text-xs text-muted-foreground">Frequência com que os CPEs reportam status (padrão: 300s = 5min)</p>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={saveAcs}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-acs"
                >
                  {saveSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Salvar
                </Button>
                <Button
                  variant="default"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || bulkBackupMutation.isPending || !isConnected}
                  data-testid="button-sync-genieacs"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
                </Button>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => bulkBackupMutation.mutate()}
                  disabled={bulkBackupMutation.isPending || syncMutation.isPending || !isConnected}
                  data-testid="button-bulk-backup"
                >
                  <Download className={`w-4 h-4 mr-1 ${bulkBackupMutation.isPending ? "animate-spin" : ""}`} />
                  {bulkBackupMutation.isPending ? "Fazendo backup..." : "Backup em Massa (todos os CPEs)"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Salva WiFi, PPPoE, LAN e VoIP de todos os dispositivos online.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (confirm("Remover todos os dispositivos e clientes fictícios (sem vínculo ao GenieACS)?")) {
                      clearSeedMutation.mutate();
                    }
                  }}
                  disabled={clearSeedMutation.isPending}
                  data-testid="button-clear-seed"
                >
                  <Trash2 className={`w-4 h-4 mr-1 ${clearSeedMutation.isPending ? "animate-spin" : ""}`} />
                  {clearSeedMutation.isPending ? "Removendo..." : "Limpar Dados Fictícios"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Remove dispositivos e clientes de exemplo que não vieram do GenieACS.
                </p>
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
                      O setup cria automaticamente as provisions e presets necessários no GenieACS.
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

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Key className="w-4 h-4 text-primary" />
                Chaves de API
              </CardTitle>
              <CardDescription className="text-xs">
                Chaves para acesso externo (Voalle, Link-Watcher-Pro, integrações)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{apiKeys.length} chave(s) ativa(s)</p>
                <Button size="sm" onClick={() => { setNewKeyName(""); setNewKeyPerms("read"); setCreatedKey(null); setKeyDialogOpen(true); }} data-testid="button-create-api-key">
                  <Plus className="w-4 h-4 mr-1" />
                  Nova Chave
                </Button>
              </div>
              {keysLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : apiKeys.length === 0 ? (
                <div className="p-4 rounded-md bg-muted/50 text-center">
                  <Key className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma chave de API criada</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie uma chave para integrações externas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50" data-testid={`api-key-${k.id}`}>
                      <div className="flex items-center gap-3">
                        <Key className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{k.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{permLabels[k.permissions] || k.permissions}</Badge>
                        {k.lastUsedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Usado: {new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => { if (confirm("Revogar esta chave de API?")) deleteKeyMutation.mutate(k.id); }}
                          data-testid={`button-revoke-key-${k.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-md bg-muted/30 space-y-1">
                <p className="text-xs font-medium">Como usar</p>
                <p className="text-xs text-muted-foreground">
                  Header: <code className="bg-muted px-1 rounded">x-api-key: nc_sua_chave</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Query: <code className="bg-muted px-1 rounded">?apikey=nc_sua_chave</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Endpoints: <code className="bg-muted px-1 rounded">/api/v2/device/update/:mac</code>, <code className="bg-muted px-1 rounded">/api/v3/device/pppoe-username/:user/</code>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Link2 className="w-4 h-4 text-primary" />
                Link Monitor / Link-Watcher-Pro
              </CardTitle>
              <CardDescription className="text-xs">
                Conexão com o Link-Watcher-Pro via Basic Auth (usuário e senha)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Link Monitor</Label>
                <Input value={lmUrl} onChange={(e) => setLmUrl(e.target.value)} placeholder="https://linkmonitor.seudominio.com.br" data-testid="input-linkmonitor-url" />
                <p className="text-xs text-muted-foreground">Endereço do Link-Watcher-Pro</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Usuário API</Label>
                  <Input value={lmUser} onChange={(e) => setLmUser(e.target.value)} placeholder="usuario" data-testid="input-linkmonitor-user" />
                </div>
                <div className="space-y-2">
                  <Label>Senha API</Label>
                  <Input type="password" value={lmPassword} onChange={(e) => setLmPassword(e.target.value)} placeholder="••••••" data-testid="input-linkmonitor-password" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sincronização Automática</p>
                  <p className="text-xs text-muted-foreground">Vincular dispositivos a clientes via PPPoE</p>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} data-testid="switch-auto-sync" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-descoberta de Clientes</p>
                  <p className="text-xs text-muted-foreground">Criar clientes a partir dos dados do Link Monitor</p>
                </div>
                <Switch checked={autoDiscover} onCheckedChange={setAutoDiscover} data-testid="switch-auto-discover" />
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={saveLinkMonitor} disabled={saveSettingsMutation.isPending} data-testid="button-save-linkmonitor">
                  {saveSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Salvar Configurações
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testLinkMonitorMutation.mutate()}
                  disabled={testLinkMonitorMutation.isPending || !lmUrl || !lmUser || !lmPassword}
                  data-testid="button-test-linkmonitor"
                >
                  {testLinkMonitorMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Testar Conexão
                </Button>
              </div>
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
                <Switch checked={notifyOffline} onCheckedChange={setNotifyOffline} data-testid="switch-notify-offline" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sinal Baixo</p>
                  <p className="text-xs text-muted-foreground">Notificar quando o sinal RX estiver abaixo de -28dBm</p>
                </div>
                <Switch checked={notifySignal} onCheckedChange={setNotifySignal} data-testid="switch-notify-signal" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Temperatura Alta</p>
                  <p className="text-xs text-muted-foreground">Notificar quando a temperatura exceder 70°C</p>
                </div>
                <Switch checked={notifyTemp} onCheckedChange={setNotifyTemp} data-testid="switch-notify-temp" />
              </div>
              <Separator />
              <Button variant="secondary" className="w-full" onClick={saveNotifications} disabled={saveSettingsMutation.isPending} data-testid="button-save-notifications">
                {saveSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar Notificações
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Globe className="w-4 h-4 text-primary" />
                Compatibilidade Flashman
              </CardTitle>
              <CardDescription className="text-xs">
                API compatível com Flashman para integrações existentes (Voalle, Link-Watcher-Pro)
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
                  <Switch checked={flashmanCompat} onCheckedChange={(v) => { setFlashmanCompat(v); saveSettingsMutation.mutate({ flashman_compat: String(v) }); }} data-testid="switch-flashman-compat" />
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Endpoints</p>
                  <p className="text-xs font-mono">/api/v2/*, /api/v3/*</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={keyDialogOpen} onOpenChange={(open) => { if (!open) { setKeyDialogOpen(false); setCreatedKey(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? "Chave Criada" : "Nova Chave de API"}</DialogTitle>
            <DialogDescription>{createdKey ? "Copie a chave abaixo. Ela não será exibida novamente." : "Crie uma chave para acesso externo"}</DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-600 font-medium mb-2">Esta chave será exibida apenas uma vez!</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={showCreatedKey ? createdKey : "••••••••••••••••••••"}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-created-key"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setShowCreatedKey(!showCreatedKey)} data-testid="button-toggle-key-visibility">
                    {showCreatedKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => copyKey(createdKey)} data-testid="button-copy-key">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setKeyDialogOpen(false); setCreatedKey(null); }}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Chave</Label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Ex: Voalle, Link-Watcher-Pro" data-testid="input-key-name" />
              </div>
              <div className="space-y-2">
                <Label>Permissões</Label>
                <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                  <SelectTrigger data-testid="select-key-permissions">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Leitura</SelectItem>
                    <SelectItem value="read_write">Leitura/Escrita</SelectItem>
                    <SelectItem value="full">Acesso Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setKeyDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => createKeyMutation.mutate()} disabled={!newKeyName || createKeyMutation.isPending} data-testid="button-confirm-create-key">
                  {createKeyMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Criar Chave
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
