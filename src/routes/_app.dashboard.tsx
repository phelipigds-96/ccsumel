import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Megaphone,
  Tag,
  Wallet,
  PackageOpen,
  TrendingUp,
  TrendingDown,
  Plus,
  FileText,
  Truck,
  ArrowRight,
  CalendarDays,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo — SGMC" },
      { name: "description", content: "Visão executiva do SGMC — campanhas, ofertas, verbas e calendário promocional." },
      { property: "og:title", content: "Dashboard Executivo — SGMC" },
      { property: "og:description", content: "Painel executivo do Sistema de Gestão de Marketing Comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

// ------- MOCK DATA -------
interface CampanhaDash {
  id: string;
  nome: string;
  dataInicial: string; // ISO
  dataFinal: string;   // ISO
  lojas: number;
  ofertas: number;
  status: "Ativa" | "Programada" | "Encerrada";
}

const campanhas: CampanhaDash[] = [
  { id: "c1", nome: "Semana do Cliente",       dataInicial: "2026-07-22", dataFinal: "2026-07-28", lojas: 42, ofertas: 24, status: "Ativa" },
  { id: "c2", nome: "Verão Gelado",            dataInicial: "2026-07-20", dataFinal: "2026-08-15", lojas: 58, ofertas: 36, status: "Ativa" },
  { id: "c3", nome: "Volta às Aulas",          dataInicial: "2026-08-01", dataFinal: "2026-08-20", lojas: 60, ofertas: 42, status: "Programada" },
  { id: "c4", nome: "Café da Manhã",           dataInicial: "2026-07-15", dataFinal: "2026-07-30", lojas: 35, ofertas: 18, status: "Ativa" },
  { id: "c5", nome: "Higiene em Dobro",        dataInicial: "2026-08-10", dataFinal: "2026-08-31", lojas: 50, ofertas: 28, status: "Programada" },
  { id: "c6", nome: "Setembro Saudável",       dataInicial: "2026-09-01", dataFinal: "2026-09-15", lojas: 40, ofertas: 22, status: "Programada" },
];

const STATUS: Record<string, string> = {
  Ativa: "bg-primary/10 text-primary border-primary/20",
  Programada: "bg-navy/10 text-navy border-navy/20",
  Encerrada: "bg-muted text-muted-foreground border-border",
};

function DashboardPage() {
  const hoje = new Date();

  const ativas = useMemo(
    () => campanhas.filter(c =>
      isWithinInterval(hoje, { start: parseISO(c.dataInicial), end: parseISO(c.dataFinal) })
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const proximas = useMemo(
    () => campanhas
      .filter(c => parseISO(c.dataInicial) > hoje)
      .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
      .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const ultimas = useMemo(
    () => [...campanhas]
      .sort((a, b) => b.dataInicial.localeCompare(a.dataInicial))
      .slice(0, 5),
    [],
  );

  const produtosEmOferta = campanhas
    .filter(c => c.status === "Ativa")
    .reduce((sum, c) => sum + c.ofertas, 0);

  const kpis = [
    { label: "Campanhas ativas", value: String(ativas.length), delta: "+2", up: true, icon: Megaphone, hint: "vs. mês anterior" },
    { label: "Produtos com ofertas ativas", value: String(produtosEmOferta), delta: "+12", up: true, icon: Tag, hint: "SKUs promocionados" },
    { label: "Pontas ocupadas", value: "36/50", delta: "72%", up: true, icon: PackageOpen, hint: "ocupação atual" },
    { label: "Saldo de verba de fornecedor", value: "R$ 284k", delta: "-3%", up: false, icon: Wallet, hint: "verbas cooperadas" },
  ];

  // Calendário: dias com campanha ativa ou programada
  const [mesRef, setMesRef] = useState<Date>(hoje);

  const diasAtivos: Date[] = [];
  const diasProgramados: Date[] = [];
  campanhas.forEach(c => {
    const start = parseISO(c.dataInicial);
    const end = parseISO(c.dataFinal);
    const cursor = new Date(start);
    while (cursor <= end) {
      if (c.status === "Ativa") diasAtivos.push(new Date(cursor));
      else if (c.status === "Programada") diasProgramados.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const [diaSelecionado, setDiaSelecionado] = useState<Date | undefined>(hoje);
  const campanhasDoDia = diaSelecionado
    ? campanhas.filter(c =>
        isWithinInterval(diaSelecionado, { start: parseISO(c.dataInicial), end: parseISO(c.dataFinal) }) ||
        isSameDay(parseISO(c.dataInicial), diaSelecionado) ||
        isSameDay(parseISO(c.dataFinal), diaSelecionado),
      )
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        description="Panorama consolidado do marketing comercial em tempo real."
        actions={
          <>
            <Button variant="outline" className="hidden sm:inline-flex">
              <FileText className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/campanhas"><Plus className="mr-2 h-4 w-4" /> Nova campanha</Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </CardTitle>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-accent">
                <k.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-navy">{k.value}</div>
              <div className={`mt-1 flex items-center gap-1 text-xs ${k.up ? "text-emerald-600" : "text-destructive"}`}>
                {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span className="font-semibold">{k.delta}</span>
                <span className="text-muted-foreground font-normal">· {k.hint}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Atalhos rápidos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-navy">Atalhos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Nova campanha", to: "/campanhas", icon: Megaphone },
            { label: "Publicar oferta", to: "/campanhas", icon: Tag },
            { label: "Solicitar verba", to: "/verbas-cooperadas", icon: Wallet },
            { label: "Cadastrar fornecedor", to: "/fornecedores", icon: Truck },
          ].map((s) => (
            <Button key={s.label} asChild variant="outline" className="justify-between h-auto py-3">
              <Link to={s.to}>
                <span className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{s.label}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Calendário + campanhas do dia */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> Calendário de campanhas
            </CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1 mr-3">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Ativas
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-navy" /> Programadas
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[auto_1fr]">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={diaSelecionado}
                onSelect={setDiaSelecionado}
                month={mesRef}
                onMonthChange={setMesRef}
                modifiers={{ ativa: diasAtivos, programada: diasProgramados }}
                modifiersClassNames={{
                  ativa: "bg-primary/15 text-primary font-semibold rounded-md",
                  programada: "bg-navy/15 text-navy font-semibold rounded-md",
                }}
                className="pointer-events-auto rounded-md border p-3"
              />
              <div className="min-w-0">
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {diaSelecionado ? format(diaSelecionado, "PPP", { locale: ptBR }) : "Selecione um dia"}
                </div>
                {campanhasDoDia.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhuma campanha neste dia.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {campanhasDoDia.map((c) => (
                      <li key={c.id} className="rounded-md border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {format(parseISO(c.dataInicial), "dd/MM")} – {format(parseISO(c.dataFinal), "dd/MM")} · {c.lojas} lojas · {c.ofertas} ofertas
                            </div>
                          </div>
                          <Badge variant="outline" className={STATUS[c.status]}>{c.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-navy flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Próximas campanhas
              </CardTitle>
              <CardDescription>Programadas para os próximos dias</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-navy">
              <Link to="/campanhas">Ver <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma campanha programada.
              </div>
            ) : (
              <ul className="divide-y">
                {proximas.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Início {format(parseISO(c.dataInicial), "dd/MM/yyyy")} · {c.ofertas} ofertas
                        </div>
                      </div>
                      <Badge variant="outline" className={STATUS[c.status]}>{c.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas campanhas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-navy">Últimas campanhas cadastradas</CardTitle>
            <CardDescription>Ordenadas por data de início</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-navy">
            <Link to="/campanhas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {ultimas.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {format(parseISO(c.dataInicial), "dd/MM/yyyy")} – {format(parseISO(c.dataFinal), "dd/MM/yyyy")} · {c.lojas} lojas · {c.ofertas} ofertas
                  </div>
                </div>
                <Badge variant="outline" className={STATUS[c.status]}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
