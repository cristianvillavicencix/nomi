import { Building2 } from "lucide-react";
import { useLogout } from "ra-core";
import { NavLink, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { isPlatformEmpresasPath } from "./platformConsolePaths";

const PlatformNavItem = ({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) => {
  const location = useLocation();
  const active = to === "empresas" ? isPlatformEmpresasPath(location.pathname) : false;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <NavLink
          to={to}
          className="flex items-center gap-2"
          end={to === "empresas"}
          state={{ _scrollToTop: true }}
        >
          {icon}
          {label}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

/**
 * Shell de consola Nomi (`/sas`): operadores de plataforma; sidebar extensible bajo /sas/….
 */
export const PlatformLayout = () => {
  const logout = useLogout();
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar variant="floating" collapsible="icon" className="print:hidden">
        <SidebarHeader className="px-2 pt-2 pb-0">
          <div className="relative flex items-center justify-between pr-8 group-data-[collapsible=icon]:pr-0">
            <div className="group-data-[collapsible=icon]:hidden min-w-0">
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex items-center gap-2 py-1.5 px-2 min-w-0">
                    <img
                      className="[.light_&]:hidden h-5 shrink-0"
                      src={darkModeLogo}
                      alt={title}
                    />
                    <img
                      className="[.dark_&]:hidden h-5 shrink-0"
                      src={lightModeLogo}
                      alt={title}
                    />
                    <span className="text-sm font-semibold truncate">Plataforma</span>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
            <div className="hidden h-8 w-8 group-data-[collapsible=icon]:block" aria-hidden />
            <SidebarTrigger
              className="absolute top-0.5 right-0 group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0"
              variant="ghost"
              size="icon"
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Consola SaaS</SidebarGroupLabel>
            <SidebarMenu>
              <PlatformNavItem
                to="empresas"
                label="Empresas"
                icon={<Building2 className="size-4" />}
              />
            </SidebarMenu>
            <p className="px-2 text-xs text-muted-foreground mt-2 max-w-[14rem] group-data-[collapsible=icon]:hidden">
              Más módulos: rutas bajo <code className="text-[0.65rem]">/sas/…</code>.
            </p>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-1">
          <p className="text-[10px] text-muted-foreground px-1 mb-1 group-data-[collapsible=icon]:hidden">
            Separada del CRM
          </p>
        </SidebarFooter>
      </Sidebar>
      <main
        className="ml-auto flex h-svh min-h-0 w-full max-w-full flex-col overflow-hidden peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)] peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))] sm:transition-[width] sm:duration-200 sm:ease-linear"
        role="main"
      >
        <div className="border-b border-border flex h-12 shrink-0 items-center justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-1">
            <SidebarTrigger className="shrink-0 md:hidden" />
            <h2 className="text-sm font-medium text-muted-foreground truncate">Nomi — operador de plataforma</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeModeToggle />
            <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
};
