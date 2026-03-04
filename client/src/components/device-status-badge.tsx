import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, AlertTriangle, Wrench } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Wifi; className: string }> = {
  online: { label: "Online", variant: "default", icon: Wifi, className: "bg-emerald-600 text-white border-emerald-700" },
  offline: { label: "Offline", variant: "destructive", icon: WifiOff, className: "" },
  warning: { label: "Alerta", variant: "outline", icon: AlertTriangle, className: "border-amber-500 text-amber-500" },
  maintenance: { label: "Manutenção", variant: "secondary", icon: Wrench, className: "" },
};

export function DeviceStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.offline;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${status}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function DeviceTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    ont: "ONT/ONU",
    router: "Roteador",
    mesh: "Mesh",
    switch: "Switch",
    olt: "OLT",
  };
  return (
    <Badge variant="outline" data-testid={`badge-type-${type}`}>
      {labels[type] || type}
    </Badge>
  );
}
