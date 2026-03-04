import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Router,
  Users,
  Settings,
  FileSliders,
  Activity,
  Network,
  Moon,
  Sun,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Dispositivos", url: "/devices", icon: Router },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Diagnósticos", url: "/diagnostics", icon: Activity },
];

const configItems = [
  { title: "Presets", url: "/presets", icon: FileSliders },
  { title: "Topologia", url: "/topology", icon: Network },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home-logo">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Network className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">NetControl ACS</span>
              <span className="text-[10px] text-muted-foreground leading-none">Gerenciamento de Rede</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Configuração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "")}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between gap-1">
          <Badge variant="secondary" className="text-[10px]">v1.0.0</Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
