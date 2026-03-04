import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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

function Router() {
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center gap-1 p-2 border-b h-12">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </header>
                <main className="flex-1 overflow-hidden">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
