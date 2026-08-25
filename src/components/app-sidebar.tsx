import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logoSumel from "@/assets/logo-sumel.png";
import { useLocation } from "@tanstack/react-router";

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
  Scale,
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
  { title: "Banco de Oportunidades", url: "/banco-de-oportunidades", icon: PackageOpen },
  { title: "Campanhas Encerradas", url: "/campanhas-encerradas", icon: Archive },
  { title: "Verbas Cooperadas", url: "/verbas-cooperadas", icon: Wallet },
  { title: "Sell Out", url: "/sell-out/acertos", icon: ShoppingCart },
  { title: "Pontas de Gôndola", url: "/pontas-de-gondola", icon: PackageOpen },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Fracionamento", url: "/fracionamento", icon: Scale },
  { title: "Catálogo de Produtos", url: "/catalogo-de-produtos", icon: Package },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];


export function AppSidebar() {
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const allowed = new Set(user?.permissions ?? []);
  const visibleItems = items
    .map((item) => {
      const filteredChildren = item.children?.filter((c) => allowed.has(c.url));
      const parentAllowed = allowed.has(item.url);
      // Show the parent if it's allowed OR any of its children are allowed.
      if (!parentAllowed && !(filteredChildren && filteredChildren.length > 0)) return null;
      return { ...item, children: filteredChildren };
    })
    .filter(Boolean) as Item[];

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    visibleItems.forEach((item) => {
      if (item.children?.some((c) => pathname.startsWith(c.url))) {
        setOpenMenus((prev) => (prev[item.url] ? prev : { ...prev, [item.url]: true }));
      }
    });
  }, [pathname, visibleItems]);

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const toggleMenu = (url: string) => {
    setOpenMenus((prev) => ({ ...prev, [url]: !prev[url] }));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className={`flex items-center py-3 ${collapsed ? "justify-center gap-0 px-0" : "gap-2.5 px-1.5"}`}>
          <div
            className={`grid shrink-0 place-items-center rounded-xl bg-white p-1 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.7)] ${
              collapsed ? "h-8 w-8" : "h-9 w-9"
            }`}
          >
            <img src={logoSumel} alt="Sumel" className="h-full w-full object-contain" />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                Central de Campanhas
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/55">
                MARKETING E COMPRAS
              </div>
            </div>
          )}

        </div>

      </SidebarHeader>

      <SidebarContent className="pt-1">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              Módulos
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>

            <SidebarMenu className="gap-0.5">
              {visibleItems.map((item) => {
                const active = pathname === item.url;
                const hasChildren = !!item.children?.length;
                const childActive = hasChildren && item.children!.some((c) => pathname.startsWith(c.url));
                const isOpen = openMenus[item.url] ?? childActive;
                return (
                  <SidebarMenuItem key={item.url}>
                    <div className="flex items-center">
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="h-9 flex-1 rounded-lg">
                        <Link to={item.url} onClick={handleNavigate} className="flex items-center gap-2.5">
                          <item.icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-sidebar-foreground/60"}`} />
                          {!collapsed && <span className="truncate text-[13px]">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>

                      {hasChildren && !collapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMenu(item.url);
                          }}
                          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          aria-label={isOpen ? "Recolher submenu" : "Expandir submenu"}
                          aria-expanded={isOpen}
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                        </button>
                      )}
                    </div>
                    {hasChildren && !collapsed && isOpen && (
                      <SidebarMenuSub>
                        {item.children!.map((child) => {
                          const cActive = pathname === child.url;
                          return (
                            <SidebarMenuSubItem key={child.url}>
                              <SidebarMenuSubButton asChild isActive={cActive}>
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


      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Sair" className="h-11 rounded-lg">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sidebar-accent text-[11px] font-bold uppercase text-sidebar-accent-foreground">
                {(user?.name ?? user?.username ?? "?").charAt(0)}
              </span>
              {!collapsed && (
                <div className="flex min-w-0 flex-col items-start">
                  <span className="truncate text-xs font-semibold">{user?.name ?? "Sair"}</span>
                  <span className="truncate text-[10px] text-sidebar-foreground/60">Sair</span>
                </div>
              )}
              {!collapsed && <LogOut className="ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/60" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
