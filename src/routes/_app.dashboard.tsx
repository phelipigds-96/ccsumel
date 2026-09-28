import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Plus, ArrowRight, Eye, CalendarDays, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useCampanhasStore, categoriaCampanha, type Campanha } from "@/lib/campanhas-store";
import { CampanhaQuickView } from "@/components/campanha-quick-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

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

function getSaudacao(hora: number, nome: string) {
  if (hora < 12) return `Bom dia, ${nome}`;
  if (hora < 18) return `Boa tarde, ${nome}`;
  return `Boa noite, ${nome}`;
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
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hora = hoje.getHours();
  const { campanhas: rawCampanhas, ofertas: rawOfertas } = useCampanhasStore();
  const [quickView, setQuickView] = useState<Campanha | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const { user } = useAuth();
  const primeiroNome = (user?.name ?? "").split(" ")[0];

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
    const c = rawCampanhas.find((x) => x.id === id);
    if (c) setQuickView(c);
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

  // ── Timeline Gantt: 37 dias (−7 a +30 a partir de hoje) ───────────────
  const [tlOffset, setTlOffset] = useState(0);

  const tlDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(hoje);
    start.setDate(start.getDate() - 7 + tlOffset);
    for (let i = 0; i < 37; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [tlOffset]);

  const tlCampanhas = useMemo(
    () =>
      campanhas.filter((c) => {
        const ini = parseISO(c.dataInicial);
        const fim = parseISO(c.dataFinal);
        return tlDays.some(
          (d) =>
            d >= new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()) &&
            d <= new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()),
        );
      }),
    [campanhas, tlDays],
  );

  const cellW = 32;
  const todayIdx = tlDays.findIndex(
    (d) =>
      d.getFullYear() === hoje.getFullYear() &&
      d.getMonth() === hoje.getMonth() &&
      d.getDate() === hoje.getDate(),
  );

  const MESES_ABREV = ["jan","fev","mar","abr","mai","jun"," jul","ago","set","out","nov","dez"];

  // Primeira célula de cada mês no range
  const mesLabels = useMemo(() => {
    const m = new Map<string, number>();
    tlDays.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!m.has(key)) m.set(key, i);
    });
    return m;
  }, [tlDays]);

  const barLeft = (ini: Date, fim: Date) => {
    const s = tlDays[0];
    const startDay = Math.max(0, Math.floor((ini.getTime() - s.getTime()) / 86400000));
    const endDay = Math.min(tlDays.length - 1, Math.floor((fim.getTime() - s.getTime()) / 86400000));
    const left = startDay * cellW;
    const width = Math.max(cellW, (endDay - startDay + 1) * cellW);
    return { left, width };
  };

  // Dias que encerram em ≤3 dias
  const endingSoon = (fim: string) => {
    const diff = differenceInCalendarDays(parseISO(fim), hoje);
    return diff >= 0 && diff <= 3;
  };

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
                {getSaudacao(hora, primeiroNome)}
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

        {/* ── Timeline Gantt ── */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <SectionLabel>Timeline — próximas semanas</SectionLabel>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTlOffset((p) => p - 7)}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setTlOffset(0)}
                className="grid h-7 min-w-[44px] place-items-center rounded-lg px-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Hoje
              </button>
              <button
                onClick={() => setTlOffset((p) => p + 7)}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 border-b border-border/50 px-4 py-1.5">
            <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="h-2 w-4 rounded-sm bg-primary" /> Ativa
            </span>
            <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="h-2 w-4 rounded-sm bg-navy" /> Programada
            </span>
            <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="h-2 w-0.5 bg-primary" /> Hoje
            </span>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: tlDays.length * cellW + 160 }}>
              {/* Cabeçalho de datas */}
              <div className="flex h-8 items-center border-b bg-secondary/40 px-2">
                <div className="w-[160px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Campanha
                </div>
                <div className="flex">
                  {tlDays.map((d, i) => {
                    const isToday =
                      d.getFullYear() === hoje.getFullYear() &&
                      d.getMonth() === hoje.getMonth() &&
                      d.getDate() === hoje.getDate();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isMonthStart = Array.from(mesLabels.entries()).some(([, idx]) => idx === i);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "relative flex flex-col items-center justify-center border-l border-border/40",
                          isToday ? "bg-primary/10" : "",
                          isWeekend ? "bg-secondary/30" : "",
                        )}
                        style={{ width: cellW, height: "100%" }}
                      >
                        {isMonthStart && (
                          <span className={cn("text-[9px] font-bold", isToday ? "text-primary" : "text-muted-foreground")}>
                            {MESES_ABREV[d.getMonth()]}
                          </span>
                        )}
                        <span className={cn("text-[9px] font-semibold", isToday ? "text-primary" : "text-muted-foreground/60")}>
                          {format(d, "dd")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Linhas de campanha */}
              <div className="relative">
                {/* Indicador de hoje */}
                {todayIdx >= 0 && (
                  <div
                    className="absolute top-0 z-10 h-full w-0.5 bg-primary"
                    style={{ left: 160 + todayIdx * cellW + cellW / 2 }}
                  />
                )}
                {tlCampanhas.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma campanha neste período.</p>
                ) : (
                  tlCampanhas.map((c) => {
                    const ini = parseISO(c.dataInicial);
                    const fim = parseISO(c.dataFinal);
                    const { left, width } = barLeft(ini, fim);
                    const soon = endingSoon(c.dataFinal);
                    return (
                      <div
                        key={c.id}
                        className="flex h-9 items-center border-b border-border/40 px-2 transition-colors hover:bg-secondary/30"
                      >
                        <div className="sticky left-0 w-[160px] shrink-0 bg-card pr-2">
                          <p className="truncate text-xs font-medium text-navy">{c.nome}</p>
                        </div>
                        <div className="relative flex-1">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => abrirQuickView(c.id)}
                            onKeyDown={(e) => e.key === "Enter" && abrirQuickView(c.id)}
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-80",
                              c.status === "Ativa" ? "bg-primary" : "bg-navy",
                              soon && "ring-1 ring-amber-400",
                            )}
                            style={{ left, width: Math.max(width - 4, 20) }}
                          >
                            <span className="block truncate">{c.nome}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Calendário e Listas lado a lado ── */}
        <div className="grid gap-6 lg:grid-cols-5">

          {/* Calendário compacto */}
          <div className="rounded-xl border bg-card shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <CalendarDays className="h-4 w-4 text-navy" />
              <SectionLabel className="mb-0">Calendário</SectionLabel>
            </div>
            <div className="p-3">
              <MiniCalendar
                campaigns={campanhas}
                onOpen={abrirQuickView}
                EyeBtn={EyeBtn}
              />
            </div>
          </div>

          {/* Campanhas ativas */}
          <div className="rounded-xl border bg-card shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <SectionLabel className="mb-0">Ativas</SectionLabel>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{ativas.length}</span>
            </div>
            <div className="divide-y divide-border/60">
              {ativas.length === 0 ? (
                <p className="py-4 px-4 text-xs text-muted-foreground">Nenhuma.</p>
              ) : (
                ativas.map((c) => {
                  const restam = differenceInCalendarDays(parseISO(c.dataFinal), hoje);
                  const soon = restam >= 0 && restam <= 3;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-navy">{c.nome}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {format(parseISO(c.dataInicial), "dd/MM")}–{format(parseISO(c.dataFinal), "dd/MM")}
                          {c.ofertas > 0 && ` · ${c.ofertas} prod.`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={cn(
                          "text-[10px] font-semibold",
                          soon ? "text-amber-600" : restam <= 0 ? "text-primary" : "text-muted-foreground",
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
          <div className="rounded-xl border bg-card shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-navy" />
                <SectionLabel className="mb-0">Programadas</SectionLabel>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{proximas.length}</span>
            </div>
            <div className="divide-y divide-border/60">
              {proximas.length === 0 ? (
                <p className="py-4 px-4 text-xs text-muted-foreground">Nenhuma.</p>
              ) : (
                proximas.map((c) => {
                  const dias = differenceInCalendarDays(parseISO(c.dataInicial), hoje);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-navy">{c.nome}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {format(parseISO(c.dataInicial), "dd/MM")}–{format(parseISO(c.dataFinal), "dd/MM")}
                          {c.ofertas > 0 && ` · ${c.ofertas} prod.`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {dias <= 0 ? "hoje" : `${dias}d`}
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

        <CampanhaQuickView
          campanha={quickView}
          ofertas={quickView ? rawOfertas.filter((o) => o.campanhaId === quickView.id) : []}
          onOpenChange={(v) => { if (!v) setQuickView(null); }}
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
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1)); setSelectedDay(null); }}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className="text-xs font-semibold capitalize text-navy">
          {format(mes, "MMMM yyyy", { locale: ptBR })}
        </span>
        <button
          onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1)); setSelectedDay(null); }}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="h-3 w-3" />
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
      <div className="mt-3 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Ativas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-navy" /> Programadas
        </span>
      </div>

      {/* Campanhas do dia selecionado */}
      {selectedDay !== null && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {format(new Date(mes.getFullYear(), mes.getMonth(), selectedDay), "dd 'de' MMMM", { locale: ptBR })}
          </p>
          {selectedDayCampaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma campanha neste dia.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedDayCampaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/30 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-navy">{c.nome}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {format(parseISO(c.dataInicial), "dd/MM")}–{format(parseISO(c.dataFinal), "dd/MM")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide",
                      c.status === "Ativa" ? "text-primary" : "text-navy",
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
