import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Devices from "@/pages/devices";
import DeviceDetail from "@/pages/device-detail";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Diagnostics from "@/pages/diagnostics";
import Presets from "@/pages/presets";
import Topology from "@/pages/topology";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import Login from "@/pages/login";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

function Router({ user }: { user: AuthUser }) {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/devices" component={Devices} />
      <Route path="/devices/:id" component={DeviceDetail} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/diagnostics" component={Diagnostics} />
      <Route path="/presets" component={Presets} />
      <Route path="/topology" component={Topology} />
      <Route path="/settings" component={Settings} />
      <Route path="/users">{user.role === "admin" ? <Users /> : <NotFound />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} onLogout={onLogout} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-1 p-2 border-b h-12">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-hidden">
            <Router user={user} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { data, isLoading, isError } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to check auth");
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isLoading) {
      if (data && data.id) {
        setUser(data);
      }
      setLoading(false);
    }
  }, [data, isLoading, isError]);

  const handleLogin = (userData: AuthUser) => {
    setUser(userData);
    queryClient.setQueryData(["/api/auth/me"], userData);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    queryClient.clear();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <AuthenticatedApp user={user} onLogout={handleLogout} />
  );
}

function AppWrapper() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <App />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default AppWrapper;
