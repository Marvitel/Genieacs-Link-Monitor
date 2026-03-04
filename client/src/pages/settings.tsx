import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon,
  Server,
  Bell,
  Shield,
  Link2,
  Globe,
} from "lucide-react";

export default function Settings() {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Configurações</h1>
          <p className="text-sm text-muted-foreground">Configurações do sistema NetControl ACS</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Server className="w-4 h-4 text-primary" />
                Servidor ACS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Servidor ACS</Label>
                <Input defaultValue="https://acs.seudominio.com.br" data-testid="input-acs-url" />
              </div>
              <div className="space-y-2">
                <Label>Porta CWMP</Label>
                <Input defaultValue="7547" data-testid="input-cwmp-port" />
              </div>
              <div className="space-y-2">
                <Label>Intervalo de Inform (segundos)</Label>
                <Input defaultValue="300" type="number" data-testid="input-inform-interval" />
              </div>
              <Separator />
              <Button variant="secondary" className="w-full" data-testid="button-save-acs">
                Salvar Configurações ACS
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Link2 className="w-4 h-4 text-primary" />
                Integração Link Monitor
              </CardTitle>
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
                  <p className="text-xs text-muted-foreground">Sincronizar dados periodicamente</p>
                </div>
                <Switch data-testid="switch-auto-sync" />
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Globe className="w-4 h-4 text-primary" />
                Compatibilidade Flashman
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">Compatível</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Preservar Configs Flashman</p>
                  <p className="text-xs text-muted-foreground">Manter configurações existentes nos dispositivos</p>
                </div>
                <Switch defaultChecked data-testid="switch-flashman-compat" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Importar Dados</p>
                  <p className="text-xs text-muted-foreground">Importar dispositivos e clientes do Flashman</p>
                </div>
                <Button variant="secondary" size="sm" data-testid="button-import-flashman">
                  Importar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
