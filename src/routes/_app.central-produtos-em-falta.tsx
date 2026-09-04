import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, RefreshCw, Flame } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  listFaltas, updateFaltaStatus, listHistoricoMany, FALTA_STATUS, LOJAS,
  type FaltaStatus, type FaltaHistorico, type ProdutoEmFalta,
} from "@/lib/produtos-em-falta";

const STATUS_EMOJI: Record<FaltaStatus, string> = {
  "Pendente": "🔴",
  "Em análise": "🟡",
  "Comprar": "🛒",
  "Pedido realizado": "📦",
  "Aguardando recebimento": "🚚",
  "Estoque disponível / verificar loja": "🔎",
  "Falta no fornecedor": "⚠️",
  "Produto descontinuado": "🚫",
  "Resolvido": "✅",
  "Não é ruptura": "➖",
};

export const Route = createFileRoute("/_app/central-produtos-em-falta")({
  head: () => ({
    meta: [
      { title: "Central de Produtos em Falta — Sumel" },
      { name: "description", content: "Fila de trabalho de Compras: apontamentos de ruptura por produto e loja, com intensidade, filtros e histórico." },
      { property: "og:title", content: "Central de Produtos em Falta — Sumel" },
      { property: "og:description", content: "Analise os apontamentos de falta do chão de loja e trate cada ruptura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CentralProdutosEmFalta,
});

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const STATUS_TONE: Record<FaltaStatus, string> = {
  "Pendente": "bg-destructive/10 text-destructive border-destructive/30",
  "Em análise": "bg-amber-100 text-amber-800 border-amber-300",
  "Comprar": "bg-blue-100 text-blue-800 border-blue-300",
  "Pedido realizado": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Aguardando recebimento": "bg-violet-100 text-violet-800 border-violet-300",
  "Estoque disponível / verificar loja": "bg-cyan-100 text-cyan-800 border-cyan-300",
  "Falta no fornecedor": "bg-orange-100 text-orange-800 border-orange-300",
  "Produto descontinuado": "bg-muted text-muted-foreground border-border",
  "Resolvido": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Não é ruptura": "bg-muted text-muted-foreground border-border",
};

const INDICADORES: FaltaStatus[] = [
  "Pendente", "Em análise", "Comprar", "Pedido realizado", "Aguardando recebimento", "Resolvido",
];

interface Grupo {
  key: string;
  produtoNome: string;
  produtoInfo: string;
  loja: string;
  itens: ProdutoEmFalta[];
  total: number;
  ultimo: ProdutoEmFalta;
  status: FaltaStatus;
}

function fmt(dt: string) {
  const d = new Date(dt);
  const hoje = new Date();
  const sameDay = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Hoje ${hora}` : `${d.toLocaleDateString("pt-BR")} ${hora}`;
}

function CentralProdutosEmFalta() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProdutoEmFalta[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [fLoja, setFLoja] = useState("todas");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fPeriodo, setFPeriodo] = useState("todos");
  const [fMin, setFMin] = useState("1");
  const [ordem, setOrdem] = useState("pendentes");

  const [aberto, setAberto] = useState<Grupo | null>(null);
  const [novoStatus, setNovoStatus] = useState<FaltaStatus>("Em análise");
  const [obsGestao, setObsGestao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      setRows(await listFaltas());
    } catch (e) {
      toast.error("Falha ao carregar apontamentos", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const contagens = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [rows]);

  const grupos = useMemo<Grupo[]>(() => {
    const limite = (() => {
      if (fPeriodo === "hoje") { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
      if (fPeriodo === "7") { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
      if (fPeriodo === "30") { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
      return null;
    })();

    const termo = normalize(busca);
    const filtrados = rows.filter((r) => {
      if (fLoja !== "todas" && r.store_id !== fLoja) return false;
      if (fStatus !== "todos" && r.status !== fStatus) return false;
      if (limite && new Date(r.reported_at) < limite) return false;
      if (termo) {
        const alvo = [r.produto?.descricao, r.produto?.codigo, r.produto?.gtin, r.reported_by_name]
          .filter(Boolean).map((v) => normalize(String(v))).join(" ");
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });

    const map = new Map<string, ProdutoEmFalta[]>();
    for (const r of filtrados) {
      const k = `${r.product_id}::${r.store_id}`;
      const arr = map.get(k);
      if (arr) arr.push(r); else map.set(k, [r]);
    }

    const min = Number(fMin) || 1;
    const out: Grupo[] = [];
    for (const [key, itens] of map) {
      itens.sort((a, b) => +new Date(b.reported_at) - +new Date(a.reported_at));
      const ultimo = itens[0]!;
      if (itens.length < min) continue;
      out.push({
        key,
        produtoNome: ultimo.produto?.descricao ?? "Produto removido",
        produtoInfo: [ultimo.produto?.codigo && `Cód. ${ultimo.produto.codigo}`, ultimo.produto?.gtin]
          .filter(Boolean).join(" · "),
        loja: ultimo.store_id,
        itens,
        total: itens.length,
        ultimo,
        status: ultimo.status,
      });
    }

    const pendPrio = (g: Grupo) => (g.status === "Pendente" ? 0 : g.status === "Resolvido" ? 2 : 1);
    out.sort((a, b) => {
      if (ordem === "quantidade") return b.total - a.total || +new Date(b.ultimo.reported_at) - +new Date(a.ultimo.reported_at);
      if (ordem === "recentes") return +new Date(b.ultimo.reported_at) - +new Date(a.ultimo.reported_at);
      return pendPrio(a) - pendPrio(b) || b.total - a.total || +new Date(b.ultimo.reported_at) - +new Date(a.ultimo.reported_at);
    });
    return out;
  }, [rows, busca, fLoja, fStatus, fPeriodo, fMin, ordem]);

  const carregarTimeline = async (g: Grupo) => {
    setTimelineLoading(true);
    try {
      setTimeline(await listHistoricoMany(g.itens.map((i) => i.id)));
    } catch (e) {
      toast.error("Falha ao carregar o histórico", { description: (e as Error).message });
    } finally {
      setTimelineLoading(false);
    }
  };

  const abrir = (g: Grupo) => {
    setAberto(g);
    setNovoStatus(g.status);
    setObsGestao(g.ultimo.management_observation ?? "");
    setTimeline([]);
    void carregarTimeline(g);
  };

  const aplicarStatus = async () => {
    if (!aberto) return;
    setSalvando(true);
    try {
      for (const item of aberto.itens) {
        if (item.status === novoStatus && !obsGestao.trim()) continue;
        await updateFaltaStatus({
          id: item.id,
          status_anterior: item.status,
          status: novoStatus,
          observation: obsGestao,
          changed_by_name: user?.name || user?.username || "Gestão",
        });
      }
      toast.success("Situação atualizada");
      setAberto(null);
      await carregar();
    } catch (e) {
      toast.error("Não foi possível atualizar", { description: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="🚨 Central de Produtos em Falta"
        description="Fila de trabalho de Compras e Gestão a partir dos apontamentos do chão de loja."
        actions={
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {INDICADORES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFStatus(fStatus === s ? "todos" : s)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              fStatus === s ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
              {s === "Resolvido" ? "Resolvidos" : s === "Pendente" ? "Pendentes" : s}
            </p>
            <p className="mt-1 text-2xl font-bold text-navy">{contagens.get(s) ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar produto, código ou pessoa…"
            className="pl-9"
          />
        </div>
        <Select value={fLoja} onValueChange={setFLoja}>
          <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as lojas</SelectItem>
            {LOJAS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {FALTA_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPeriodo} onValueChange={setFPeriodo}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer data</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fMin} onValueChange={setFMin}>
          <SelectTrigger><SelectValue placeholder="Ocorrências" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Qualquer quantidade</SelectItem>
            <SelectItem value="2">2 ou mais</SelectItem>
            <SelectItem value="3">3 ou mais</SelectItem>
            <SelectItem value="5">5 ou mais</SelectItem>
            <SelectItem value="10">10 ou mais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Pendentes primeiro</SelectItem>
            <SelectItem value="quantidade">Maior nº de apontamentos</SelectItem>
            <SelectItem value="recentes">Mais recentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando apontamentos…
          </p>
        ) : grupos.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nenhum apontamento encontrado com os filtros atuais.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {grupos.map((g) => {
              const forte = g.total >= 5;
              const medio = g.total >= 3 && !forte;
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => abrir(g)}
                    className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4 ${
                      forte ? "border-l-4 border-l-destructive bg-destructive/[0.03]" : medio ? "border-l-4 border-l-amber-400" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{g.produtoNome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[g.loja, g.produtoInfo].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${
                          forte ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : medio ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {forte && <Flame className="h-3 w-3" />}
                        {g.total} {g.total === 1 ? "apontamento" : "apontamentos"}
                      </span>
                      <span className="text-xs text-muted-foreground">{fmt(g.ultimo.reported_at)}</span>
                      <span className="max-w-[140px] truncate text-xs font-medium text-foreground">
                        {g.ultimo.reported_by_name}
                      </span>
                      <Badge variant="outline" className={`text-xs ${STATUS_TONE[g.status]}`}>{g.status}</Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalhes */}
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left leading-snug">{aberto.produtoNome}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loja</p>
                  <p className="font-semibold">{aberto.loja}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Apontamentos</p>
                  <p className="font-semibold">{aberto.total}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Situação atual</p>
                  <p className="font-semibold">{aberto.status}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produto</p>
                  <p className="font-semibold">{aberto.produtoInfo || "—"}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-navy">Histórico dos apontamentos</p>
                <ul className="space-y-2">
                  {aberto.itens.map((i) => (
                    <li key={i.id} className="rounded-lg border border-border/70 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{i.reported_by_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(i.reported_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {i.observation && (
                        <p className="mt-1 text-sm text-muted-foreground">Observação: {i.observation}</p>
                      )}
                      {i.management_observation && (
                        <p className="mt-1 text-sm text-navy">Gestão: {i.management_observation}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {user?.isAdmin && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-navy">Tratativa da gestão</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Nova situação</Label>
                    <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as FaltaStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FALTA_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Observação da gestão</Label>
                    <Textarea rows={2} value={obsGestao} onChange={(e) => setObsGestao(e.target.value)} />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(null)}>Fechar</Button>
                {user?.isAdmin && (
                  <Button onClick={() => void aplicarStatus()} disabled={salvando}>
                    {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar tratativa
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
