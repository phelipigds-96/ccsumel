import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, RefreshCw, Flame, Lock } from "lucide-react";
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
  listFaltas, updateFaltaStatus, listHistoricoMany, podeGerenciarFaltas, FALTA_STATUS, LOJAS,
  getBloqueioAtivo, alterarCondicaoBloqueio, listBloqueiosAtivosTodos, listHistoricoBloqueios,
  type FaltaStatus, type FaltaHistorico, type ProdutoEmFalta, type ProdutoBloqueio,
  type ProdutoBloqueioAtivo, type ProdutoBloqueioHistorico,
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
  primeiro: ProdutoEmFalta;
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
  const podeGerenciar = podeGerenciarFaltas(user);
  const [rows, setRows] = useState<ProdutoEmFalta[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [fLoja, setFLoja] = useState("todas");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fPeriodo, setFPeriodo] = useState("todos");
  const [fMin, setFMin] = useState("1");
  const [ordem, setOrdem] = useState("recentes");

  const [aberto, setAberto] = useState<Grupo | null>(null);
  const [novoStatus, setNovoStatus] = useState<FaltaStatus>("Em análise");
  const [obsGestao, setObsGestao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [timeline, setTimeline] = useState<FaltaHistorico[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [bloqueio, setBloqueio] = useState<ProdutoBloqueio | null>(null);
  const [motivoLiberacao, setMotivoLiberacao] = useState("");
  const [liberando, setLiberando] = useState(false);

  // Alteração da condição de bloqueio (administrador)
  const [gerirBloqueios, setGerirBloqueios] = useState(false);
  const [listaBloqueios, setListaBloqueios] = useState<ProdutoBloqueioAtivo[]>([]);
  const [carregandoBloqueios, setCarregandoBloqueios] = useState(false);
  const [buscaBloqueio, setBuscaBloqueio] = useState("");
  const [lojaBloqueio, setLojaBloqueio] = useState("todas");
  const [selecionado, setSelecionado] = useState<ProdutoBloqueioAtivo | null>(null);
  const [novaCondicao, setNovaCondicao] = useState<string>("Produto ativo");
  const [motivoAlteracao, setMotivoAlteracao] = useState("");
  const [alterando, setAlterando] = useState(false);
  const [historicoBloqueios, setHistoricoBloqueios] = useState<ProdutoBloqueioHistorico[]>([]);


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
      const primeiro = itens[itens.length - 1]!;
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
        primeiro,
        status: ultimo.status,
      });
    }

    const pendPrio = (g: Grupo) => (g.status === "Pendente" ? 0 : g.status === "Resolvido" ? 2 : 1);
    out.sort((a, b) => {
      if (ordem === "quantidade") return b.total - a.total || +new Date(b.ultimo.reported_at) - +new Date(a.ultimo.reported_at);
      if (ordem === "recentes") return +new Date(b.ultimo.reported_at) - +new Date(a.ultimo.reported_at);
      if (ordem === "antigas") return +new Date(a.primeiro.reported_at) - +new Date(b.primeiro.reported_at);
      // Prioridade de Compras: pendentes → mais apontamentos → mais antigas
      return (
        pendPrio(a) - pendPrio(b) ||
        b.total - a.total ||
        +new Date(a.primeiro.reported_at) - +new Date(b.primeiro.reported_at)
      );
    });
    return out;
  }, [rows, busca, fLoja, fStatus, fPeriodo, fMin, ordem]);

  const resumo = useMemo(() => {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const pendentesProdutos = new Set(
      rows.filter((r) => r.status === "Pendente").map((r) => `${r.product_id}::${r.store_id}`),
    ).size;
    const hoje = rows.filter((r) => new Date(r.reported_at) >= inicioHoje).length;
    const contagem = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.product_id}::${r.store_id}`;
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
    let multiplos = 0;
    for (const v of contagem.values()) if (v > 1) multiplos += 1;
    return { pendentesProdutos, hoje, multiplos };
  }, [rows]);


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
    setBloqueio(null);
    setMotivoLiberacao("");
    void carregarTimeline(g);
    getBloqueioAtivo(g.ultimo.product_id, g.loja)
      .then(setBloqueio)
      .catch(() => setBloqueio(null));
  };

  const liberar = async () => {
    if (!bloqueio) return;
    if (!motivoLiberacao.trim()) {
      toast.error("Informe o motivo da liberação.");
      return;
    }
    setLiberando(true);
    try {
      const registrado = await alterarCondicaoBloqueio({
        bloqueio,
        novoStatus: "Produto ativo",
        motivo: motivoLiberacao,
      });
      toast.success("Bloqueio liberado", {
        description: registrado
          ? "O produto voltou a poder ser solicitado nesta loja e a alteração foi registrada no histórico."
          : "O produto voltou a poder ser solicitado nesta loja. O histórico não pôde ser gravado agora.",
      });
      setBloqueio(null);
      setMotivoLiberacao("");
    } catch (e) {
      toast.error("Não foi possível liberar", { description: (e as Error).message });
    } finally {
      setLiberando(false);
    }
  };

  const carregarBloqueios = async (loja: string) => {
    setCarregandoBloqueios(true);
    try {
      setListaBloqueios(await listBloqueiosAtivosTodos({ loja: loja === "todas" ? null : loja }));
    } catch (e) {
      toast.error("Falha ao carregar os bloqueios", { description: (e as Error).message });
    } finally {
      setCarregandoBloqueios(false);
    }
  };

  const carregarHistoricoBloqueios = async () => {
    setHistoricoBloqueios(await listHistoricoBloqueios(50));
  };

  const abrirGestaoBloqueios = () => {
    setGerirBloqueios(true);
    setSelecionado(null);
    setMotivoAlteracao("");
    setNovaCondicao("Produto ativo");
    void carregarBloqueios(lojaBloqueio);
    void carregarHistoricoBloqueios();
  };

  const confirmarAlteracao = async () => {
    if (!selecionado) return;
    if (!motivoAlteracao.trim()) {
      toast.error("Informe o motivo da alteração.");
      return;
    }
    setAlterando(true);
    try {
      const registrado = await alterarCondicaoBloqueio({
        bloqueio: selecionado,
        novoStatus: novaCondicao,
        motivo: motivoAlteracao,
      });
      if (registrado) {
        toast.success("Condição de bloqueio alterada", {
          description: `“${selecionado.status}” → “${novaCondicao}” registrado no histórico.`,
        });
      } else {
        toast.warning("Condição alterada, mas o histórico não foi gravado", {
          description: "A alteração valeu; o registro no histórico ficou pendente.",
        });
      }
      setSelecionado(null);
      setMotivoAlteracao("");
      await Promise.all([
        carregar(),
        carregarBloqueios(lojaBloqueio),
        carregarHistoricoBloqueios(),
      ]);
    } catch (e) {
      toast.error("Não foi possível alterar a condição", { description: (e as Error).message });
    } finally {
      setAlterando(false);
    }
  };

  const bloqueiosFiltrados = useMemo(() => {
    const termo = normalize(buscaBloqueio);
    if (!termo) return listaBloqueios;
    return listaBloqueios.filter((b) =>
      [b.produto?.descricao, b.produto?.codigo, b.produto?.gtin, b.store_id, b.status]
        .filter(Boolean)
        .map((v) => normalize(String(v)))
        .join(" ")
        .includes(termo),
    );
  }, [listaBloqueios, buscaBloqueio]);

  const aplicarStatus = async () => {
    if (!aberto) return;
    setSalvando(true);
    try {
      for (const item of aberto.itens) {
        const novaObs = obsGestao.trim();
        const obsAtual = item.management_observation?.trim() || "";
        if (item.status === novoStatus && obsAtual === novaObs) continue;

        await updateFaltaStatus({
          id: item.id,
          status_anterior: item.status,
          status: novoStatus,
          observation: novaObs,
          changed_by_name: user?.name || user?.username || "Gestão",
        });
      }
      toast.success("Situação atualizada");
      setAberto({
        ...aberto,
        status: novoStatus,
        itens: aberto.itens.map((i) => ({ ...i, status: novoStatus, management_observation: obsGestao.trim() })),
      });
      await Promise.all([carregar(), carregarTimeline(aberto)]);
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={abrirGestaoBloqueios}>
              <Lock className="mr-2 h-4 w-4" /> Bloqueios
            </Button>
            <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        }
      />

      {/* Resumo rápido */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-2xl font-bold text-destructive">{resumo.pendentesProdutos}</p>
          <p className="text-xs font-medium text-muted-foreground">produtos pendentes</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-2xl font-bold text-navy">{resumo.hoje}</p>
          <p className="text-xs font-medium text-muted-foreground">apontamentos hoje</p>
        </div>
        <button
          type="button"
          onClick={() => setFMin(fMin === "2" ? "1" : "2")}
          className={`rounded-xl border p-3 text-left transition-colors ${
            fMin === "2" ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <p className="text-2xl font-bold text-navy">{resumo.multiplos}</p>
          <p className="text-xs font-medium text-muted-foreground">produtos com múltiplos apontamentos</p>
        </button>
      </div>

      {/* Indicadores */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
              <span className="mr-1">{STATUS_EMOJI[s]}</span>
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
            <SelectItem value="antigas">Mais antigas</SelectItem>

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
                      <Badge variant="outline" className={`text-xs font-semibold ${STATUS_TONE[g.status]}`}>
                        {STATUS_EMOJI[g.status]} {g.status}
                      </Badge>

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
                <DialogTitle className="text-left leading-snug">Detalhes da solicitação</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="col-span-full">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produto</p>
                  <p className="font-semibold text-base">{aberto.produtoNome}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">EAN / Código</p>
                  <p className="font-semibold">{aberto.produtoInfo || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fornecedor</p>
                  <p className="font-semibold truncate" title={aberto.ultimo.produto?.fornecedor}>{aberto.ultimo.produto?.fornecedor || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Custo / Preço de Venda</p>
                  <p className="font-semibold">
                    {aberto.ultimo.produto?.custo ? aberto.ultimo.produto.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} /{" "}
                    {aberto.ultimo.produto?.preco_venda ? aberto.ultimo.produto.preco_venda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loja</p>
                  <p className="font-semibold">{aberto.loja}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status atual</p>
                  <p className="font-semibold">{aberto.status}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Colaborador (recente)</p>
                  <p className="font-semibold">{aberto.ultimo.reported_by_name}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Data e hora (recente)</p>
                  <p className="font-semibold">
                    {new Date(aberto.ultimo.reported_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Data do Pedido</p>
                  <p className="font-semibold">
                    {aberto.ultimo.pedido_realizado_em
                      ? new Date(aberto.ultimo.pedido_realizado_em).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric"
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total de apontamentos</p>
                  <p className="font-semibold">{aberto.total}</p>
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

              <div>
                <p className="mb-3 text-sm font-semibold text-navy flex items-center justify-between">
                  <span>Linha do tempo (Histórico de alterações)</span>
                </p>
                {timelineLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
                  </p>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">Nenhuma movimentação registrada no histórico.</p>
                ) : (
                  <div className="space-y-3 border-l-2 border-primary/20 ml-1.5 pl-5">
                    {timeline.filter((h, i, arr) => {
                      if (i === 0) return true;
                      const prev = arr[i - 1];
                      return !(
                        prev.status_novo === h.status_novo &&
                        prev.observation === h.observation &&
                        prev.changed_by_name === h.changed_by_name &&
                        Math.abs(new Date(h.created_at).getTime() - new Date(prev.created_at).getTime()) < 60000
                      );
                    }).map((h) => (
                      <div key={h.id} className="relative rounded-lg border border-border/60 bg-muted/10 p-3 shadow-sm hover:bg-muted/30 transition-colors">
                        <span className="absolute -left-[27px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                        
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
                          <span className="font-semibold text-sm text-foreground">{h.changed_by_name || "Sistema"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        
                        <div className="text-sm text-foreground mb-1 shadow-none bg-transparent p-0">
                          {h.status_anterior && h.status_anterior !== h.status_novo ? (
                            <span className="flex items-center flex-wrap gap-1">
                              Alterou o status para 
                              <Badge variant="outline" className={`text-xs ml-1 font-medium ${STATUS_TONE[h.status_novo] || ''}`}>
                                {STATUS_EMOJI[h.status_novo]} {h.status_novo}
                              </Badge>
                            </span>
                          ) : h.status_anterior && h.status_anterior === h.status_novo ? (
                            <span className="flex items-center flex-wrap gap-1">
                              Atualizou a tratativa mantendo o status 
                              <Badge variant="outline" className={`text-[10px] ml-1 font-medium ${STATUS_TONE[h.status_novo] || ''}`}>
                                {h.status_novo}
                              </Badge>
                            </span>
                          ) : (
                            <span className="flex items-center flex-wrap gap-1">
                              Registrou a falta inicial 
                              <Badge variant="outline" className={`text-[10px] ml-1 font-medium ${STATUS_TONE[h.status_novo] || ''}`}>
                                {h.status_novo}
                              </Badge>
                            </span>
                          )}
                        </div>
                        
                        {h.observation && (
                          <div className="mt-2 text-sm bg-background p-2.5 rounded border border-border/50 text-foreground italic flex items-start gap-2">
                            <span className="text-muted-foreground">↳</span> {h.observation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {bloqueio && (
                <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-destructive">🔒 Bloqueio de novos lançamentos</p>
                  <p className="text-sm text-foreground">
                    Este produto está bloqueado para novas solicitações na loja <span className="font-semibold">{bloqueio.store_id}</span> —
                    situação: <span className="font-semibold">{STATUS_EMOJI[bloqueio.status]} {bloqueio.status}</span>
                    {bloqueio.permanente && " (bloqueio permanente)"}.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Definido em {new Date(bloqueio.tratado_em).toLocaleString("pt-BR")}.
                  </p>
                  {user?.isAdmin ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Motivo da liberação (obrigatório)</Label>
                        <Textarea
                          rows={2}
                          value={motivoLiberacao}
                          onChange={(e) => setMotivoLiberacao(e.target.value)}
                          placeholder="Ex.: produto voltou a ser trabalhado pelo fornecedor"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => void liberar()}
                        disabled={liberando}
                      >
                        {liberando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        ✅ Liberar produto (Produto ativo)
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Somente um administrador pode liberar este produto para novos lançamentos.
                    </p>
                  )}
                </div>
              )}

              {podeGerenciar && (
                <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-primary">TRATATIVA DE COMPRAS</p>
                  <p className="text-xs text-muted-foreground">O status selecionado servirá como retorno para a loja.</p>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Nova situação</Label>
                    <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as FaltaStatus)}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FALTA_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_EMOJI[s]} {s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Observação da gestão</Label>
                    <Textarea className="bg-background" rows={2} value={obsGestao} onChange={(e) => setObsGestao(e.target.value)} />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(null)}>Fechar</Button>
                {podeGerenciar && (
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

      {/* Alteração da condição de bloqueio (administrador) */}
      <Dialog
        open={gerirBloqueios}
        onOpenChange={(o) => {
          setGerirBloqueios(o);
          if (!o) setSelecionado(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left">Alterar condição de bloqueio</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Produtos bloqueados para novos lançamentos na Lista de Faltas. Um administrador pode alterar a
            condição — por exemplo, de “Produto descontinuado” para “Produto ativo” — informando o motivo da
            alteração. A ação fica registrada no histórico e o produto volta a poder ser lançado.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaBloqueio}
                onChange={(e) => setBuscaBloqueio(e.target.value)}
                placeholder="Pesquisar produto, código ou loja…"
                className="pl-9"
              />
            </div>
            <Select
              value={lojaBloqueio}
              onValueChange={(v) => {
                setLojaBloqueio(v);
                setSelecionado(null);
                void carregarBloqueios(v);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {LOJAS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {carregandoBloqueios ? (
              <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando bloqueios…
              </p>
            ) : bloqueiosFiltrados.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum produto bloqueado com os filtros atuais.
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-border/70 overflow-y-auto">
                {bloqueiosFiltrados.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelecionado(b);
                        setNovaCondicao("Produto ativo");
                        setMotivoAlteracao("");
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                        selecionado?.id === b.id ? "bg-accent" : ""
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-foreground">
                        {b.produto?.descricao ?? "Produto"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          b.store_id,
                          b.produto?.codigo && `Cód. ${b.produto.codigo}`,
                          b.permanente && "bloqueio permanente",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 text-xs font-medium text-destructive">
                        {b.status} · desde {new Date(b.tratado_em).toLocaleString("pt-BR")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selecionado && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-semibold text-navy">
                {selecionado.produto?.descricao ?? "Produto"} · {selecionado.store_id}
              </p>
              <p className="text-xs text-muted-foreground">
                Situação anterior: <span className="font-semibold">{STATUS_EMOJI[selecionado.status]} {selecionado.status}</span>
              </p>
              {user?.isAdmin ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Nova condição</Label>
                    <Select value={novaCondicao} onValueChange={setNovaCondicao}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Produto ativo">
                          ✅ Produto ativo (libera o lançamento na Lista de Faltas)
                        </SelectItem>
                        {FALTA_STATUS.filter((s) => s !== selecionado.status).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_EMOJI[s]} {s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Motivo da alteração (obrigatório)</Label>
                    <Textarea
                      rows={2}
                      value={motivoAlteracao}
                      onChange={(e) => setMotivoAlteracao(e.target.value)}
                      placeholder="Ex.: produto voltou a ser trabalhado pelo fornecedor"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelecionado(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => void confirmarAlteracao()} disabled={alterando}>
                      {alterando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar alteração
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Somente um administrador pode alterar a condição de bloqueio. Sua conta tem acesso apenas
                  para consulta.
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-navy">Histórico de alterações de bloqueio</p>
            {historicoBloqueios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            ) : (
              <ol className="max-h-64 space-y-3 overflow-y-auto border-l border-border pl-4">
                {historicoBloqueios.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{h.produto?.descricao ?? "Produto"}</span> · {h.store_id}
                    </p>
                    <p className="text-sm text-foreground">
                      {h.status_anterior ? `“${h.status_anterior}”` : "—"} →{" "}
                      <span className="font-semibold">“{h.status_novo}”</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      por {h.changed_by_name || "Administrador"}
                      {h.motivo ? ` · Motivo: ${h.motivo}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGerirBloqueios(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
