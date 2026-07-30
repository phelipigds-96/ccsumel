import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, FileText, ArrowRight, Eye } from "lucide-react";
import { useCampanhasStore, categoriaCampanha, type Campanha } from "@/lib/campanhas-store";
import { CampanhaQuickView } from "@/components/campanha-quick-view";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { format, isSameDay, isWithinInterval, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";


export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Central de campanhas Sumel" },
      { name: "description", content: "Visão consolidada da Central de campanhas Sumel — campanhas, ofertas, verbas e calendário promocional." },
      { property: "og:title", content: "Dashboard — Central de campanhas Sumel" },
      { property: "og:description", content: "Painel do Sistema de Gestão de Marketing Comercial." },
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

const STATUS_DOT: Record<CampanhaDash["status"], string> = {
  Ativa: "bg-primary",
  Programada: "bg-navy",
  Encerrada: "bg-border",
};

const STATUS_PILL: Record<CampanhaDash["status"], string> = {
  Ativa: "bg-emerald-50 text-emerald-600 font-semibold",
  Programada: "bg-navy/5 text-navy font-semibold",
  Encerrada: "border border-border text-muted-foreground",
};

function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,31,58,0.04)] ${className}`}>
      {children}
    </div>
  );
}

function DashboardPage() {
  const hoje = new Date();
  const { campanhas: rawCampanhas, ofertas: rawOfertas } = useCampanhasStore();
  const [quickView, setQuickView] = useState<Campanha | null>(null);

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

  const [mesRef, setMesRef] = useState<Date>(hoje);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | undefined>(hoje);

  const abrirQuickView = (id: string) => {
    const c = rawCampanhas.find((x) => x.id === id);
    if (c) setQuickView(c);
  };

  const EyeBtn = ({ id }: { id: string }) => (
    <button
      type="button"
      title="Ver produtos, anexos e imprimir PDF"
      aria-label="Visualização rápida da campanha"
      onClick={() => abrirQuickView(id)}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      <Eye className="h-4 w-4" />
    </button>
  );

  const { diasAtivos, diasProgramados, campanhasPorDia } = useMemo(() => {
    const a: Date[] = [];
    const p: Date[] = [];
    const map = new Map<string, string[]>();
    campanhas.forEach((c) => {
      const start = parseISO(c.dataInicial);
      const end = parseISO(c.dataFinal);
      const cursor = new Date(start);
      while (cursor <= end) {
        if (c.status === "Ativa") a.push(new Date(cursor));
        else if (c.status === "Programada") p.push(new Date(cursor));
        const key = format(cursor, "yyyy-MM-dd");
        const label = `${c.nome} (${c.status}) — ${format(start, "dd/MM")} a ${format(end, "dd/MM")}`;
        map.set(key, [...(map.get(key) ?? []), label]);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return { diasAtivos: a, diasProgramados: p, campanhasPorDia: map };
  }, [campanhas]);


  const campanhasDoDia = diaSelecionado
    ? campanhas.filter(
        (c) =>
          isWithinInterval(diaSelecionado, { start: parseISO(c.dataInicial), end: parseISO(c.dataFinal) }) ||
          isSameDay(parseISO(c.dataInicial), diaSelecionado) ||
          isSameDay(parseISO(c.dataFinal), diaSelecionado),
      )
    : [];

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">Painel de Controle</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bem-vindo à Central de Campanhas Sumel.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="hidden rounded-lg sm:inline-flex">
            <FileText className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button asChild className="rounded-lg">
            <Link to="/campanhas">
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
        <Panel className="p-4 sm:p-6">

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Campanhas ativas
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-navy">{ativas.length}</span>
            <span className="text-xs font-medium text-muted-foreground">em andamento</span>
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Campanhas programadas
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-navy">{proximas.length}</span>
            <span className="text-xs font-medium text-muted-foreground">a iniciar</span>
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ofertas ativas
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-navy">{produtosEmOferta}</span>
            <span className="text-xs font-medium text-muted-foreground">produtos</span>
          </div>
        </Panel>
      </div>

      {/* Calendário em destaque */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-6">
          <h3 className="font-display text-base font-semibold text-navy">Calendário de campanhas</h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Ativas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-navy" /> Programadas
            </span>
          </div>
        </div>
        <div className="grid gap-8 p-6 lg:grid-cols-[auto_1fr]">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={diaSelecionado}
            onSelect={setDiaSelecionado}
            month={mesRef}
            onMonthChange={setMesRef}
            modifiers={{ ativa: diasAtivos, programada: diasProgramados }}
            modifiersClassNames={{
              ativa: "bg-primary/10 text-primary font-semibold rounded-md",
              programada: "bg-navy/10 text-navy font-semibold rounded-md",
            }}
            components={{
              DayButton: (props) => {
                const nomes = campanhasPorDia.get(format(props.day.date, "yyyy-MM-dd"));
                return (
                  <CalendarDayButton
                    {...props}
                    title={
                      nomes?.length
                        ? `${format(props.day.date, "dd/MM/yyyy")}\n${nomes.map((n) => `• ${n}`).join("\n")}`
                        : `${format(props.day.date, "dd/MM/yyyy")}\nSem campanhas`
                    }
                  />
                );
              },
            }}
            className="pointer-events-auto rounded-xl border p-4 [--cell-size:2.6rem]"
          />

          <div className="min-w-0">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {diaSelecionado ? format(diaSelecionado, "PPP", { locale: ptBR }) : "Selecione um dia"}
            </div>
            {campanhasDoDia.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Nenhuma campanha neste dia.
              </div>
            ) : (
              <ul className="space-y-2">
                {campanhasDoDia.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{c.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {format(parseISO(c.dataInicial), "dd/MM")} – {format(parseISO(c.dataFinal), "dd/MM")} · {c.ofertas} ofertas
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_PILL[c.status]}`}>
                        {c.status}
                      </span>
                      <EyeBtn id={c.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      {/* Campanhas ativas e futuras em destaque */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between border-b p-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <h3 className="font-display text-sm font-semibold text-navy">Campanhas ativas</h3>
              <span className="text-xs text-muted-foreground">({ativas.length})</span>
            </div>
            <Link to="/campanhas" className="text-xs font-semibold text-muted-foreground hover:text-navy">
              Ver todas
            </Link>
          </div>
          <div className="p-2">
            {ativas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma campanha ativa.</p>
            ) : (
              ativas.map((c) => {
                const restam = differenceInCalendarDays(parseISO(c.dataFinal), hoje);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl p-3 transition-colors hover:bg-secondary/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">{c.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {format(parseISO(c.dataInicial), "dd/MM")} – {format(parseISO(c.dataFinal), "dd/MM")} · {c.ofertas} produtos ·{" "}
                        {restam <= 0 ? "encerra hoje" : `${restam} dia${restam > 1 ? "s" : ""} restantes`}
                      </p>
                    </div>
                    <EyeBtn id={c.id} />
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b p-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-navy" />
              <h3 className="font-display text-sm font-semibold text-navy">Próximas campanhas</h3>
              <span className="text-xs text-muted-foreground">({proximas.length})</span>
            </div>
            <Link to="/campanhas" className="text-xs font-semibold text-muted-foreground hover:text-navy">
              Ver todas
            </Link>
          </div>
          <div className="p-2">
            {proximas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma campanha programada.</p>
            ) : (
              proximas.map((c) => {
                const dias = differenceInCalendarDays(parseISO(c.dataInicial), hoje);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl p-3 transition-colors hover:bg-secondary/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">{c.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {format(parseISO(c.dataInicial), "dd/MM")} – {format(parseISO(c.dataFinal), "dd/MM")} · {c.ofertas} produtos ·{" "}
                        {dias <= 0 ? "inicia hoje" : `inicia em ${dias} dia${dias > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <EyeBtn id={c.id} />
                  </div>
                );
              })
            )}
          </div>
        </Panel>
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
  );
}

