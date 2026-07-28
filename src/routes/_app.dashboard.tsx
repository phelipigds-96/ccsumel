import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Megaphone,
  Tag,
  Wallet,
  Plus,
  FileText,
  Truck,
  ArrowRight,
  BellOff,
} from "lucide-react";
import { useCampanhasStore, categoriaCampanha } from "@/lib/campanhas-store";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

  const campanhas: CampanhaDash[] = useMemo(() => {
    return rawCampanhas.map((c) => {
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
    () => campanhas.filter((c) => c.status === "Ativa"),
    [campanhas],
  );

  const proximas = useMemo(
    () =>
      campanhas
        .filter((c) => c.status === "Programada")
        .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
        .slice(0, 5),
    [campanhas],
  );

  const ultimas = useMemo(
    () => [...campanhas].sort((a, b) => b.dataInicial.localeCompare(a.dataInicial)).slice(0, 5),
    [campanhas],
  );

  const produtosEmOferta = ativas.reduce((sum, c) => sum + c.ofertas, 0);
  const pontasOcupadas = 36;
  const pontasTotal = 50;
  const ocupacao = Math.round((pontasOcupadas / pontasTotal) * 100);

  const [mesRef, setMesRef] = useState<Date>(hoje);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | undefined>(hoje);

  const { diasAtivos, diasProgramados } = useMemo(() => {
    const a: Date[] = [];
    const p: Date[] = [];
    campanhas.forEach((c) => {
      const start = parseISO(c.dataInicial);
      const end = parseISO(c.dataFinal);
      const cursor = new Date(start);
      while (cursor <= end) {
        if (c.status === "Ativa") a.push(new Date(cursor));
        else if (c.status === "Programada") p.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return { diasAtivos: a, diasProgramados: p };
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

      {/* KPIs — grade uniforme */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-6">
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
            Ofertas ativas
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-navy">{produtosEmOferta}</span>
            <span className="text-xs font-medium text-muted-foreground">produtos</span>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pontas ocupadas
            </p>
            <span className="text-xs font-bold text-navy">{ocupacao}%</span>
          </div>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-navy">
              {pontasOcupadas}
              <span className="text-lg text-muted-foreground/50">/{pontasTotal}</span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${ocupacao}%` }} />
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Saldo de verba
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-navy">R$ 284k</span>
            <span className="text-xs font-medium text-muted-foreground">fornecedor</span>
          </div>
        </Panel>
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6 lg:col-span-8">
          {/* Calendário */}
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
            <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr]">
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
                className="pointer-events-auto rounded-xl border p-3"
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
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_PILL[c.status]}`}>
                          {c.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          {/* Listas */}
          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <div className="flex items-center justify-between border-b p-5">
                <h3 className="font-display text-sm font-semibold text-navy">Próximas campanhas</h3>
                <Link to="/campanhas" className="text-xs font-semibold text-muted-foreground hover:text-navy">
                  Ver
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
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-navy" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-navy">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {dias <= 0 ? "Inicia hoje" : `Inicia em ${dias} dia${dias > 1 ? "s" : ""}`}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {c.ofertas} prod.
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center justify-between border-b p-5">
                <h3 className="font-display text-sm font-semibold text-navy">Últimas cadastradas</h3>
                <Link to="/campanhas" className="text-xs font-semibold text-muted-foreground hover:text-navy">
                  Ver todas
                </Link>
              </div>
              <div className="p-2">
                {ultimas.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>
                ) : (
                  ultimas.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{c.nome}</p>
                        <p className="truncate text-xs font-medium text-muted-foreground">
                          {format(parseISO(c.dataInicial), "dd/MM/yyyy")} – {format(parseISO(c.dataFinal), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_PILL[c.status]}`}>
                        {c.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="col-span-12 space-y-6 lg:col-span-4">
          <div className="rounded-2xl bg-navy p-6 text-navy-foreground shadow-lg">
            <h3 className="font-display mb-4 text-base font-semibold">Atalhos rápidos</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nova campanha", to: "/campanhas", icon: Megaphone },
                { label: "Publicar oferta", to: "/campanhas", icon: Tag },
                { label: "Solicitar verba", to: "/verbas-cooperadas", icon: Wallet },
                { label: "Fornecedores", to: "/fornecedores", icon: Truck },
              ].map((s) => (
                <Link
                  key={s.label}
                  to={s.to}
                  className="group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center transition-colors hover:bg-white/10"
                >
                  <span className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-white/10 transition-transform group-hover:scale-110">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-tight opacity-80">
                    {s.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card p-8 text-center">
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-background">
              <BellOff className="h-6 w-6 text-muted-foreground/50" />
            </span>
            <h4 className="font-display text-sm font-semibold text-navy">Nenhum alerta crítico</h4>
            <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
              Tudo em conformidade com o cronograma atual.
            </p>
          </div>

          <Panel className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Ocupação de lojas
                </p>
                <p className="font-display text-lg font-bold text-navy">
                  {ocupacao >= 70 ? "Alto volume" : "Volume moderado"}
                </p>
              </div>
              <div className="flex items-end gap-1">
                <span className="h-4 w-1 rounded-full bg-emerald-500" />
                <span className="h-6 w-1 rounded-full bg-emerald-500" />
                <span className="h-5 w-1 rounded-full bg-emerald-500" />
                <span className="h-7 w-1 rounded-full bg-emerald-500" />
                <span className="h-4 w-1 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          </Panel>
        </div>
      </div>

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
