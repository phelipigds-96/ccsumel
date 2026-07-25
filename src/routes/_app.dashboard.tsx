import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Megaphone,
  Tag,
  Wallet,
  PackageOpen,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  FileText,
  Truck,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo — SGMC" },
      { name: "description", content: "Visão executiva do SGMC — campanhas, ofertas, verbas, pontas de gôndola e tarefas." },
      { property: "og:title", content: "Dashboard Executivo — SGMC" },
      { property: "og:description", content: "Painel executivo do Sistema de Gestão de Marketing Comercial." },
    ],
  }),
  component: DashboardPage,
});

const kpis = [
  { label: "Campanhas ativas", value: "12", delta: "+2", up: true, icon: Megaphone, hint: "vs. mês anterior" },
  { label: "Ofertas vigentes", value: "48", delta: "+5", up: true, icon: Tag, hint: "vs. mês anterior" },
  { label: "Saldo de verbas", value: "R$ 284k", delta: "-3%", up: false, icon: Wallet, hint: "verbas cooperadas" },
  { label: "Pontas ocupadas", value: "36/50", delta: "72%", up: true, icon: PackageOpen, hint: "ocupação atual" },
];

const sellOutData = [
  { mes: "Jan", valor: 820 },
  { mes: "Fev", valor: 910 },
  { mes: "Mar", valor: 870 },
  { mes: "Abr", valor: 1020 },
  { mes: "Mai", valor: 1140 },
  { mes: "Jun", valor: 1080 },
  { mes: "Jul", valor: 1230 },
];

const verbasPorCategoria = [
  { categoria: "Bebidas", valor: 95 },
  { categoria: "Mercearia", valor: 72 },
  { categoria: "Higiene", valor: 58 },
  { categoria: "Limpeza", valor: 41 },
  { categoria: "Perecíveis", valor: 34 },
];

const ocupacaoPontas = [
  { name: "Ocupadas", value: 36 },
  { name: "Livres", value: 14 },
];

const contratos = [
  { fornecedor: "Distribuidora Aurora", tipo: "Verba cooperada", vence: "em 3 dias", risco: "alto" },
  { fornecedor: "Alimentos Solar", tipo: "Ponta de gôndola", vence: "em 7 dias", risco: "alto" },
  { fornecedor: "Bebidas Sul", tipo: "Campanha promocional", vence: "em 12 dias", risco: "médio" },
  { fornecedor: "Higiene Prime", tipo: "Verba cooperada", vence: "em 21 dias", risco: "médio" },
  { fornecedor: "Lácteos Vale", tipo: "Central de ofertas", vence: "em 28 dias", risco: "baixo" },
];

const ultimasCampanhas = [
  { nome: "Volta às Aulas 2026", periodo: "01/02 – 28/02", lojas: 42, status: "Ativa" },
  { nome: "Semana do Consumidor", periodo: "10/03 – 17/03", lojas: 58, status: "Planejada" },
  { nome: "Páscoa Doce", periodo: "20/03 – 05/04", lojas: 60, status: "Ativa" },
  { nome: "Outono Saudável", periodo: "01/04 – 30/04", lojas: 35, status: "Rascunho" },
];

const tarefas = [
  { titulo: "Aprovar verba — Distribuidora Aurora", prazo: "Hoje", done: false },
  { titulo: "Revisar encarte da Semana do Consumidor", prazo: "Amanhã", done: false },
  { titulo: "Enviar relatório de sell out — Bebidas Sul", prazo: "Sex, 26/07", done: false },
  { titulo: "Confirmar ocupação de pontas — Loja 12", prazo: "Seg, 29/07", done: true },
  { titulo: "Renovar contrato — Higiene Prime", prazo: "Ter, 30/07", done: false },
];

const RISCO: Record<string, string> = {
  alto: "bg-destructive/10 text-destructive border-destructive/20",
  médio: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  baixo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

const STATUS: Record<string, string> = {
  Ativa: "bg-primary/10 text-primary border-primary/20",
  Planejada: "bg-navy/10 text-navy border-navy/20",
  Rascunho: "bg-muted text-muted-foreground border-border",
};

const PIE_COLORS = ["var(--primary)", "var(--navy)"];

function DashboardPage() {
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
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
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
              <div
                className={`mt-1 flex items-center gap-1 text-xs ${
                  k.up ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {k.up ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
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
            { label: "Publicar oferta", to: "/central-de-ofertas", icon: Tag },
            { label: "Solicitar verba", to: "/verbas-cooperadas", icon: Wallet },
            { label: "Cadastrar fornecedor", to: "/fornecedores", icon: Truck },
          ].map((s) => (
            <Button
              key={s.label}
              asChild
              variant="outline"
              className="justify-between h-auto py-3"
            >
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

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-navy">Sell Out mensal</CardTitle>
            <CardDescription>Evolução em R$ (milhares)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sellOutData} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="sell" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#sell)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-navy">Ocupação de pontas</CardTitle>
            <CardDescription>Distribuição atual</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ocupacaoPontas}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {ocupacaoPontas.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Verbas + Contratos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-navy">Verbas por categoria</CardTitle>
            <CardDescription>Saldo em R$ (milhares)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verbasPorCategoria} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="categoria" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="valor" fill="var(--navy)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-navy flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" /> Contratos próximos do vencimento
              </CardTitle>
              <CardDescription>Renove antes do prazo para não perder benefícios</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-navy">
              Ver todos <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {contratos.map((c) => (
                <div key={c.fornecedor} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.fornecedor}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.tipo}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline">{c.vence}</span>
                    <Badge variant="outline" className={RISCO[c.risco]}>
                      {c.risco}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimas campanhas + Tarefas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-navy">Últimas campanhas cadastradas</CardTitle>
              <CardDescription>Ordenadas por data de criação</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-navy">
              <Link to="/campanhas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {ultimasCampanhas.map((c) => (
                <div key={c.nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.periodo} · {c.lojas} lojas
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS[c.status]}>
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-navy flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Tarefas pendentes
              </CardTitle>
              <CardDescription>
                {tarefas.filter((t) => !t.done).length} em aberto
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium text-navy">
                    {tarefas.filter((t) => t.done).length}/{tarefas.length}
                  </span>
                </div>
                <Progress
                  value={(tarefas.filter((t) => t.done).length / tarefas.length) * 100}
                  className="h-2"
                />
              </div>
              <ul className="space-y-2">
                {tarefas.map((t) => (
                  <li
                    key={t.titulo}
                    className="flex items-start gap-2 rounded-md border border-border/60 bg-card p-2.5"
                  >
                    {t.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm ${
                          t.done ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {t.titulo}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.prazo}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
