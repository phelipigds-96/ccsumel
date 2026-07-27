import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Megaphone,
  Wallet,
  ShoppingCart,
  PackageOpen,
  Truck,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Package,
  Archive,
  Calculator,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

type Item = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  children?: { title: string; url: string; icon: typeof LayoutDashboard }[];
};

const items: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "Campanhas Encerradas", url: "/campanhas-encerradas", icon: Archive },
  { title: "Verbas Cooperadas", url: "/verbas-cooperadas", icon: Wallet },
  {
    title: "Sell Out",
    url: "/sell-out",
    icon: ShoppingCart,
    children: [
      { title: "Acertos", url: "/sell-out/acertos", icon: Calculator },
    ],
  },
  { title: "Pontas de Gôndola", url: "/pontas-de-gondola", icon: PackageOpen },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Catálogo de Produtos", url: "/catalogo-de-produtos", icon: Package },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];


export function AppSidebar() {
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-black">
            C
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-sidebar-foreground leading-tight truncate">Central de Campanhas</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 truncate">
                MARKETING E COMPRAS
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Módulos</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                const hasChildren = !!item.children?.length;
                const parentOpen = hasChildren && (active || item.children!.some((c) => pathname.startsWith(c.url)));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} onClick={handleNavigate} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                    {hasChildren && !collapsed && parentOpen && (
                      <SidebarMenuSub>
                        {item.children!.map((child) => {
                          const childActive = pathname === child.url;
                          return (
                            <SidebarMenuSubItem key={child.url}>
                              <SidebarMenuSubButton asChild isActive={childActive}>
                                <Link to={child.url} onClick={handleNavigate} className="flex items-center gap-2">
                                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Sair">
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <div className="flex min-w-0 flex-col items-start">
                  <span className="truncate text-xs font-semibold">{user?.name ?? "Sair"}</span>
                  <span className="truncate text-[10px] text-sidebar-foreground/60">Sair</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
