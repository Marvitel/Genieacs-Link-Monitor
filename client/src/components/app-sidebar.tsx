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
  LogOut,
  UserCog,
  Shield,
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
import type { AuthUser } from "@/App";

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

interface AppSidebarProps {
  user: AuthUser;
  onLogout: () => void;
}

export function AppSidebar({ user, onLogout }: AppSidebarProps) {
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
              {user.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={location === "/users"}
                  >
                    <Link href="/users" data-testid="link-nav-users">
                      <UserCog className="w-4 h-4" />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Shield className="w-3 h-3 text-muted-foreground" />
          <span className="truncate font-medium" data-testid="text-current-user">{user.displayName || user.username}</span>
          <Badge variant="outline" className="text-[9px] ml-auto">{user.role}</Badge>
        </div>
        <div className="flex items-center justify-between gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onLogout}
            className="text-xs gap-1 h-7"
            data-testid="button-logout"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            className="h-7 w-7"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
