import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  ArrowRight,
  Eye,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Store,
  Truck,
  Clock,
  Calendar,
  User,
} from "lucide-react";
import { useCampanhasStore, campanhasStore, categoriaCampanha, type Campanha } from "@/lib/campanhas-store";
import { CampanhaQuickView, fmtDate } from "@/components/campanha-quick-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { listDegustacoes, type DegustacaoWithProdutosCount, type Degustacao } from "@/lib/degustacoes";
import { DegustacaoQuickView } from "@/components/degustacoes/degustacao-quick-view";
import { DegustacaoStatusBadge } from "@/components/degustacoes/degustacao-status-badge";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Central de Campanhas Sumel" },
      { name: "description", content: "Visão consolidada da Central de Campanhas Sumel — campanhas, ofertas, verbas e calendário promocional." },
      { property: "og:title", content: "Dashboard — Central de Campanhas Sumel" },
      { property: "og:description", content: "Painel do Sistema de Gestão de Marketing Comercial na Central Sumel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

interface CampanhaDash {
  id: string;
  nome: string;
  dataInicial: string;
  dataFinal: string;
  ofertas: number;
  status: "Ativa" | "Programada" | "Encerrada";
}

const STATUS_COLOR: Record<CampanhaDash["status"], string> = {
  Ativa: "bg-primary",
  Programada: "bg-navy",
  Encerrada: "bg-border",
};

function getSaudacao(agora: Date, nome: string) {
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const primeiroNome = (nome || "").trim();
  const nomeFmt = primeiroNome ? `, ${primeiroNome}` : "";

  // 03h00 (180 min) às 11h59 (719 min)
  if (minutos >= 180 && minutos <= 719) {
    return `Bom dia${nomeFmt}`;
  }
  // 12h00 (720 min) às 18h00 (1080 min)
  if (minutos >= 720 && minutos <= 1080) {
    return `Boa tarde${nomeFmt}`;
  }
  // 18h01 (1081 min) às 02h59 (179 min)
  return `Boa noite${nomeFmt}`;
}

function WelcomeModal({ open, onOpenChange, userName }: { open: boolean; onOpenChange: (v: boolean) => void; userName: string }) {
  const primeiroNome = userName.split(" ")[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 text-left">
        <div className="bg-navy px-6 pb-8 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white">
            Bem-vindo de volta,<br />{primeiroNome}! 👋
          </h2>
        </div>
        <div className="bg-background px-6 pb-6 pt-6">
          <p className="mb-6 text-center text-sm leading-relaxed text-muted-foreground">
            É sempre bom ver você por aqui.
          </p>
          <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl font-semibold">
            Bora lá!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground", className)}>
      {children}
    </p>
  );
}

function DashboardPage() {
  const agora = useMemo(() => new Date(), []);
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const { campanhas: rawCampanhas, ofertas: rawOfertas } = useCampanhasStore();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const quickView = useMemo(
    () => (quickViewId ? rawCampanhas.find((c) => c.id === quickViewId) ?? null : null),
    [quickViewId, rawCampanhas],
  );
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const { user } = useAuth();
  const primeiroNome = (user?.name ?? "").split(" ")[0];

  useEffect(() => {
    void campanhasStore.reload();
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("justLoggedIn") === "1") {
      sessionStorage.removeItem("justLoggedIn");
      setWelcomeOpen(true);
    }
  }, []);

  const campanhas: CampanhaDash[] = useMemo(() => {
    return rawCampanhas.filter((c) => categoriaCampanha(c) !== "rascunho").map((c) => {
      const cat = categoriaCampanha(c);
      const status: CampanhaDash["status"] =
        cat === "ativa" ? "Ativa" : cat === "futura" ? "Programada" : "Encerrada";
      return {
        id: c.id,
        nome: c.nome,
        dataInicial: c.dataInicial,
        dataFinal: c.dataFinal,
        ofertas: rawOfertas.filter((o) => o.campanhaId === c.id).length,
        status,
      };
    });
  }, [rawCampanhas, rawOfertas]);

  const ativas = useMemo(
    () =>
      campanhas
        .filter((c) => c.status === "Ativa")
        .sort((a, b) => a.dataFinal.localeCompare(b.dataFinal)),
    [campanhas],
  );

  const proximas = useMemo(
    () =>
      campanhas
        .filter((c) => c.status === "Programada")
        .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial)),
    [campanhas],
  );

  const produtosEmOferta = ativas.reduce((sum, c) => sum + c.ofertas, 0);

  const abrirQuickView = (id: string) => {
    setQuickViewId(id);
  };

  const EyeBtn = ({ id }: { id: string }) => (
    <button
      type="button"
      title="Ver produtos e detalhes"
      onClick={() => abrirQuickView(id)}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
  );

  // ── Degustações no Chão de Loja ──
  const [degustacoes, setDegustacoes] = useState<DegustacaoWithProdutosCount[]>([]);
  const [loadingDegustacoes, setLoadingDegustacoes] = useState(true);
  const [quickViewDegustacao, setQuickViewDegustacao] = useState<Degustacao | null>(null);

  useEffect(() => {
    let isMounted = true;
    listDegustacoes()
      .then((data) => {
        if (isMounted) setDegustacoes(data);
      })
      .catch((err) => {
        console.error("Erro ao carregar degustações no dashboard:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingDegustacoes(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const degustacoesHoje = useMemo(() => {
    return degustacoes.filter(
      (d) =>
        (d.status === "Ativa" || d.data === todayStr) &&
        d.status !== "Cancelada" &&
        d.status !== "Concluída",
    );
  }, [degustacoes, todayStr]);

  const degustacoesFuturas = useMemo(() => {
    return degustacoes
      .filter((d) => d.status === "Programada" && d.data > todayStr)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [degustacoes, todayStr]);

  return (
    <>
      <WelcomeModal
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        userName={user?.name ?? ""}
      />
      <div className="space-y-8">

        {/* ── Cabeçalho sóbrio ── */}
        <div className="relative overflow-hidden rounded-xl border-b-2 border-primary bg-navy px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                {getSaudacao(agora, primeiroNome)}
              </h1>
              <p className="mt-0.5 text-xs text-white/60">
                {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto shrink-0 rounded-lg font-semibold">
              <Link to="/campanhas">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova campanha
              </Link>
            </Button>
          </div>
        </div>

        {/* ── KPI barra compacta ── */}
        <div className="rounded-xl border bg-card px-6 py-4 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Visão geral
          </p>
          <div className="flex items-stretch divide-x divide-border">
            <div className="flex flex-1 flex-col items-center px-6 py-1">
              <span className="font-display text-3xl font-bold tabular-nums text-navy">{ativas.length}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Ativas</span>
            </div>
            <div className="flex flex-1 flex-col items-center px-6 py-1">
              <span className="font-display text-3xl font-bold tabular-nums text-navy">{proximas.length}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Programadas</span>
            </div>
            <div className="flex flex-1 flex-col items-center px-6 py-1">
              <span className="font-display text-3xl font-bold tabular-nums text-primary">{produtosEmOferta}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Produtos em oferta</span>
            </div>
          </div>
        </div>

        {/* ── Calendário e Campanhas lado a lado ── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Calendário compacto */}
          <div className="rounded-xl border bg-card shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-navy" />
                <SectionLabel className="mb-0">Calendário</SectionLabel>
              </div>
            </div>
            <div className="p-3.5 flex-1 flex flex-col">
              <MiniCalendar
                campaigns={campanhas}
                onOpen={abrirQuickView}
                EyeBtn={EyeBtn}
              />
            </div>
          </div>

          {/* Campanhas ativas */}
          <div className="rounded-xl border bg-card shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <SectionLabel className="mb-0">Campanhas Ativas</SectionLabel>
              </div>
              <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                {ativas.length}
              </Badge>
            </div>
            <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto flex-1">
              {ativas.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-muted-foreground">
                  Nenhuma campanha ativa no momento.
                </div>
              ) : (
                ativas.map((c) => {
                  const restam = differenceInCalendarDays(parseISO(c.dataFinal), hoje);
                  const soon = restam >= 0 && restam <= 3;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-navy" title={c.nome}>{c.nome}</p>
                        <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(c.dataInicial), "dd/MM")}–{format(parseISO(c.dataFinal), "dd/MM")}
                          {c.ofertas > 0 && ` · ${c.ofertas} prod.`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          soon ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : restam <= 0 ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground bg-muted/50",
                        )}>
                          {restam <= 0 ? "hoje" : `${restam}d`}
                        </span>
                        <EyeBtn id={c.id} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Próximas campanhas */}
          <div className="rounded-xl border bg-card shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-navy" />
                <SectionLabel className="mb-0">Programadas</SectionLabel>
              </div>
              <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                {proximas.length}
              </Badge>
            </div>
            <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto flex-1">
              {proximas.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-muted-foreground">
                  Nenhuma campanha programada para os próximos dias.
                </div>
              ) : (
                proximas.map((c) => {
                  const dias = differenceInCalendarDays(parseISO(c.dataInicial), hoje);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-navy" title={c.nome}>{c.nome}</p>
                        <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(c.dataInicial), "dd/MM")}–{format(parseISO(c.dataFinal), "dd/MM")}
                          {c.ofertas > 0 && ` · ${c.ofertas} prod.`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {dias <= 0 ? "inicia hoje" : `em ${dias}d`}
                        </span>
                        <EyeBtn id={c.id} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Bloco Degustações (Chão de Loja) ── */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-3.5 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Utensils className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-navy">Degustações</h3>
                <p className="text-[11px] text-muted-foreground">
                  Ações no chão de loja ativas e programadas
                </p>
              </div>
            </div>

            <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-navy font-semibold hover:text-primary">
              <Link to="/degustacoes">
                Ver todas as degustações <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="p-5">
            {loadingDegustacoes ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Carregando degustações...
              </div>
            ) : degustacoesHoje.length === 0 && degustacoesFuturas.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground bg-muted/5">
                Nenhuma degustação ativa ou programada no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Coluna 1: Hoje / Em Andamento */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Hoje / Em Andamento ({degustacoesHoje.length})
                    </span>
                  </div>

                  {degustacoesHoje.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/5">
                      Nenhuma degustação acontecendo hoje.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {degustacoesHoje.map((d) => (
                        <div
                          key={d.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setQuickViewDegustacao(d)}
                          onKeyDown={(e) => e.key === "Enter" && setQuickViewDegustacao(d)}
                          className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/25 p-3.5 transition-all hover:border-emerald-400 hover:shadow-xs cursor-pointer dark:bg-emerald-950/15 dark:border-emerald-900"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-navy group-hover:text-primary transition-colors">
                                {d.nome}
                              </span>
                              <DegustacaoStatusBadge status={d.status} />
                              {d.campanha_nome && (
                                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                  {d.campanha_nome}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1 text-foreground font-medium">
                                <Store className="h-3 w-3 text-muted-foreground" /> {d.loja}
                              </span>
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3 text-muted-foreground" /> {d.fornecedor_nome}
                              </span>
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                <Clock className="h-3 w-3" />
                                {d.horario_inicio ? d.horario_inicio.slice(0, 5) : "--:--"}
                                {d.horario_fim ? ` às ${d.horario_fim.slice(0, 5)}` : ""}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" /> {d.responsavel_nome}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 pointer-events-none"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver Detalhes
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coluna 2: Próximas Programadas */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-navy" />
                      Próximas Programadas ({degustacoesFuturas.length})
                    </span>
                  </div>

                  {degustacoesFuturas.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/5">
                      Nenhuma degustação futura agendada.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {degustacoesFuturas.map((d) => (
                        <div
                          key={d.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setQuickViewDegustacao(d)}
                          onKeyDown={(e) => e.key === "Enter" && setQuickViewDegustacao(d)}
                          className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-card p-3.5 transition-all hover:border-primary/40 hover:shadow-xs cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-navy group-hover:text-primary transition-colors">
                                {d.nome}
                              </span>
                              <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                                {fmtDate(d.data)}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1 text-foreground font-medium">
                                <Store className="h-3 w-3 text-muted-foreground" /> {d.loja}
                              </span>
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3 text-muted-foreground" /> {d.fornecedor_nome}
                              </span>
                              {d.horario_inicio && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {d.horario_inicio.slice(0, 5)}
                                  {d.horario_fim ? ` às ${d.horario_fim.slice(0, 5)}` : ""}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" /> {d.responsavel_nome}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground group-hover:text-primary pointer-events-none"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <CampanhaQuickView
          campanha={quickView}
          ofertas={quickView ? rawOfertas.filter((o) => o.campanhaId === quickView.id) : []}
          onOpenChange={(v) => { if (!v) setQuickViewId(null); }}
        />

        <DegustacaoQuickView
          degustacao={quickViewDegustacao}
          open={!!quickViewDegustacao}
          onOpenChange={(v) => {
            if (!v) setQuickViewDegustacao(null);
          }}
        />

        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm" className="text-navy">
            <Link to="/campanhas">
              Ver todas as campanhas <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

/* ── Calendário mini inline ─────────────────────────────────────────────── */
function MiniCalendar({
  campaigns,
  onOpen,
  EyeBtn,
}: {
  campaigns: CampanhaDash[];
  onOpen: (id: string) => void;
  EyeBtn: React.ComponentType<{ id: string }>;
}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const firstDay = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
  const daysInMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMes }, (_, i) => i + 1),
  ];

  const isToday = (d: number) =>
    mes.getMonth() === hoje.getMonth() &&
    mes.getFullYear() === hoje.getFullYear() &&
    d === hoje.getDate();

  const campaignsOnDay = (d: number) => {
    const date = new Date(mes.getFullYear(), mes.getMonth(), d);
    return campaigns.filter((c) => {
      const ini = parseISO(c.dataInicial);
      const fim = parseISO(c.dataFinal);
      return (
        date >= new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()) &&
        date <= new Date(fim.getFullYear(), fim.getMonth(), fim.getDate())
      );
    });
  };

  const selectedDayCampaigns = selectedDay !== null ? campaignsOnDay(selectedDay) : [];

  return (
    <div>
      {/* Navegação do mês */}
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1)); setSelectedDay(null); }}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold capitalize text-navy">
            {format(mes, "MMMM yyyy", { locale: ptBR })}
          </span>
          <button
            type="button"
            onClick={() => {
              setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
              setSelectedDay(hoje.getDate());
            }}
            className="text-[10px] font-semibold text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10 transition-colors"
            title="Ir para o dia de hoje"
          >
            Hoje
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1)); setSelectedDay(null); }}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="mb-1 grid grid-cols-7">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Células */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const onD = isToday(d);
          const dayCampaigns = campaignsOnDay(d);
          const hasAtiva = dayCampaigns.some((c) => c.status === "Ativa");
          const hasProg = dayCampaigns.some((c) => c.status === "Programada");
          const isSelected = selectedDay === d;
          const tooltip = dayCampaigns.length
            ? dayCampaigns.map((c) => c.nome).join(", ")
            : undefined;
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              title={tooltip}
              onClick={() => setSelectedDay(isSelected ? null : d)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedDay(isSelected ? null : d)}
              className={cn(
                "relative flex h-8 flex-col items-center justify-center rounded text-[10px] transition-colors",
                onD ? "bg-primary font-semibold text-white" : "text-navy hover:bg-secondary",
                isSelected && !onD ? "ring-1 ring-primary bg-primary/5" : "",
              )}
            >
              <span>{d}</span>
              {dayCampaigns.length > 0 && (
                <div className="mt-0.5 flex gap-0.5">
                  {hasAtiva && <span className="h-1 w-1 rounded-full bg-primary" />}
                  {hasProg && <span className="h-1 w-1 rounded-full bg-navy" />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="mt-3 flex items-center justify-between text-[9px] text-muted-foreground border-t border-border/50 pt-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Ativas
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-navy" /> Programadas
          </span>
        </div>
        {selectedDay !== null && (
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="text-primary hover:underline font-medium"
          >
            Limpar seleção
          </button>
        )}
      </div>

      {/* Campanhas do dia selecionado */}
      {selectedDay !== null && (
        <div className="mt-2.5 border-t border-border/60 pt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy">
              {format(new Date(mes.getFullYear(), mes.getMonth(), selectedDay), "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {selectedDayCampaigns.length} {selectedDayCampaigns.length === 1 ? "ação" : "ações"}
            </span>
          </div>
          {selectedDayCampaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma campanha neste dia.</p>
          ) : (
            <ul className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
              {selectedDayCampaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-navy">{c.nome}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {format(parseISO(c.dataInicial), "dd/MM")}–{format(parseISO(c.dataFinal), "dd/MM")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn(
                      "text-[9px] font-semibold px-1 py-0.2 rounded uppercase tracking-wide",
                      c.status === "Ativa" ? "text-primary bg-primary/10" : "text-navy bg-navy/10",
                    )}>
                      {c.status}
                    </span>
                    <EyeBtn id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
