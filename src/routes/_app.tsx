import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";

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
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border/70 bg-background/70 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-6 w-px bg-border" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-5 w-1 shrink-0 rounded-full bg-primary" />
              <span className="truncate text-sm font-semibold tracking-tight text-navy">
                Central de campanhas Sumel
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 py-1 pl-1 pr-3 shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11px] font-bold uppercase text-navy-foreground">
                {(user?.name ?? user?.username ?? "?").charAt(0)}
              </span>
              <span className="max-w-[140px] truncate text-xs font-medium text-muted-foreground">
                {user?.username}
              </span>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
