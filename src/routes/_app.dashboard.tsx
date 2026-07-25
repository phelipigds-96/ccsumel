import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Tag, Wallet, ShoppingCart, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SGMC" },
      { name: "description", content: "Visão geral do SGMC — campanhas, ofertas, verbas e sell out." },
      { property: "og:title", content: "Dashboard — SGMC" },
      { property: "og:description", content: "Visão geral do SGMC." },
    ],
  }),
  component: DashboardPage,
});

const kpis = [
  { label: "Campanhas ativas", value: "12", delta: "+2", up: true, icon: Megaphone },
  { label: "Ofertas publicadas", value: "48", delta: "+5", up: true, icon: Tag },
  { label: "Verbas cooperadas", value: "R$ 284k", delta: "-3%", up: false, icon: Wallet },
  { label: "Sell Out (mês)", value: "R$ 1,2M", delta: "+8%", up: true, icon: ShoppingCart },
];

function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral do desempenho comercial e de marketing."
        actions={<Button className="bg-primary hover:bg-primary/90">Nova campanha</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </CardTitle>
              <k.icon className="h-4 w-4 text-navy" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-navy">{k.value}</div>
              <div className={`mt-1 flex items-center gap-1 text-xs ${k.up ? "text-green-600" : "text-destructive"}`}>
                {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {k.delta} vs. mês anterior
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-navy">Campanhas recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {["Volta às Aulas 2026", "Promo Verão", "Semana do Consumidor", "Black Friday Prep"].map((c, i) => (
                <div key={c} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{c}</div>
                    <div className="text-xs text-muted-foreground">{10 + i} lojas • {5 + i} fornecedores</div>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">Ativa</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-navy">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start">Nova oferta</Button>
            <Button variant="outline" className="justify-start">Solicitar verba</Button>
            <Button variant="outline" className="justify-start">Cadastrar fornecedor</Button>
            <Button variant="outline" className="justify-start">Gerar relatório</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
