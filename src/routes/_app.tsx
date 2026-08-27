import { Outlet, createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { useAuth, PERMISSIONS } from "@/lib/auth";

function RouteGuard() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  // Find the most specific permission key that matches the current route.
  const match = PERMISSIONS.map((p) => p.key)
    .filter((key) => pathname === key || pathname.startsWith(key + "/"))
    .sort((a, b) => b.length - a.length)[0];

  if (loading || !user || !match) return <Outlet />;
  if (user.isAdmin || (user.permissions ?? []).includes(match)) return <Outlet />;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold text-navy">Acesso não autorizado</h1>
      <p className="text-sm text-muted-foreground">
        Você não possui permissão para acessar este módulo. Solicite liberação a um administrador.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/dashboard">Voltar ao Dashboard</Link>
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b border-border/70 bg-background/70 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:gap-3 sm:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-6 w-px bg-border" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-5 w-1 shrink-0 rounded-full bg-primary" />
              <span className="truncate text-sm font-semibold tracking-tight text-navy">
                Central de campanhas Sumel
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 py-1 pl-1 pr-2 shadow-sm sm:pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11px] font-bold uppercase text-navy-foreground">
                {(user?.name ?? user?.username ?? "?").charAt(0)}
              </span>
              <span className="hidden sm:inline-block max-w-[140px] truncate text-xs font-medium text-muted-foreground">
                {user?.username}
              </span>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
            <RouteGuard />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
