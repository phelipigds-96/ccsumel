import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SolicitacaoNovoProdutoDialog } from "@/components/solicitacao-novo-produto-dialog";
import { useAuth } from "@/lib/auth";
import { LOJAS, lojaDoUsuario } from "@/lib/produtos-em-falta";
import {
  SOLICITACAO_STATUS,
  listHistoricoSolicitacoesMany,
  listSolicitacoes,
  tratarSolicitacao,
  type SolicitacaoHistorico,
  type SolicitacaoNovoProduto,
  type SolicitacaoStatus,
  type SolicitacaoUrgencia,
} from "@/lib/solicitacoes-produtos";

export const Route = createFileRoute("/_app/solicitacoes-produtos")({
  head: () => ({
    meta: [
      { title: "Solicitações de Novos Produtos — Sumel" },
      {
        name: "description",
        content:
          "Fila de solicitações de cadastro de novos produtos enviadas pelas lojas, com tratativa e histórico.",
      },
      { property: "og:title", content: "Solicitações de Novos Produtos — Sumel" },
      {
        property: "og:description",
        content: "Analise as solicitações de novos produtos e devolva o status para as lojas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SolicitacoesProdutosPage,
});

const STATUS_EMOJI: Record<string, string> = {
  "Pendente": "🔴",
  "Em análise": "🟡",
  "Aprovado": "✅",
  "Cadastro solicitado": "📝",
  "Cadastrado": "📦",
  "Não aprovado": "🚫",
  "Produto já cadastrado": "🔁",
};

const STATUS_TONE: Record<string, string> = {
  "Pendente": "bg-destructive/10 text-destructive border-destructive/30",
  "Em análise": "bg-amber-100 text-amber-800 border-amber-300",
  "Aprovado": "bg-blue-100 text-blue-800 border-blue-300",
  "Cadastro solicitado": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Cadastrado": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Não aprovado": "bg-muted text-muted-foreground border-border",
  "Produto já cadastrado": "bg-cyan-100 text-cyan-800 border-cyan-300",
};

const fmtData = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

interface CamposForm {
  nome: string;
  marca: string;
  gramagem_volume: string;
  categoria: string;
  gtin: string;
  observacao: string;
  quantidade: string;
  urgencia: SolicitacaoUrgencia;
}

function SolicitacoesProdutosPage() {
  const { user } = useAuth();
  const podeGerenciar = !!user?.isAdmin;
  const lojaFixa = lojaDoUsuario(user);

  const [rows, setRows] = useState<SolicitacaoNovoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fLoja, setFLoja] = useState("todas");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fUrgencia, setFUrgencia] = useState("todas");
  const [ordem, setOrdem] = useState("recentes");
  const [novoAberto, setNovoAberto] = useState(false);

  const [aberto, setAberto] = useState<SolicitacaoNovoProduto | null>(null);
  const [novoStatus, setNovoStatus] = useState<SolicitacaoStatus>("Pendente");
  const [obsGestao, setObsGestao] = useState("");
  const [campos, setCampos] = useState<CamposForm | null>(null);
  const [timeline, setTimeline] = useState<SolicitacaoHistorico[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const lojaEfetiva = lojaFixa ?? (fLoja === "todas" ? null : fLoja);

  const carregar = async () => {
    setLoading(true);
    try {
      setRows(await listSolicitacoes({ loja: lojaEfetiva, busca }));
    } catch (e) {
      toast.error("Falha ao carregar as solicitações", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [lojaEfetiva, busca]);

  const contagens = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [rows]);

  const filtrados = useMemo(() => {
    const out = rows.filter((r) => {
      if (fStatus !== "todos" && r.status !== fStatus) return false;
      if (fUrgencia !== "todas" && r.urgencia !== fUrgencia) return false;
      return true;
    });
    const pesoUrgencia = (u: string) => (u === "Alta" ? 0 : 1);
    return [...out].sort((a, b) => {
      if (ordem === "antigas") return +new Date(a.reported_at) - +new Date(b.reported_at);
      if (ordem === "produto") return a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "urgencia")
        return (
          pesoUrgencia(a.urgencia) - pesoUrgencia(b.urgencia) ||
          +new Date(b.reported_at) - +new Date(a.reported_at)
        );
      return +new Date(b.reported_at) - +new Date(a.reported_at);
    });
  }, [rows, fStatus, fUrgencia, ordem]);

  const abrir = (r: SolicitacaoNovoProduto) => {
    setAberto(r);
    setNovoStatus(r.status);
    setObsGestao(r.management_observation ?? "");
    setCampos({
      nome: r.nome,
      marca: r.marca,
      gramagem_volume: r.gramagem_volume,
      categoria: r.categoria,
      gtin: r.gtin ?? "",
      observacao: r.observacao ?? "",
      quantidade: String(r.quantidade_solicitada ?? 1),
      urgencia: (r.urgencia === "Alta" ? "Alta" : "Normal") as SolicitacaoUrgencia,
    });
    setTimeline([]);
    setHistLoading(true);
    listHistoricoSolicitacoesMany([r.id])
      .then(setTimeline)
      .catch(() => setTimeline([]))
      .finally(() => setHistLoading(false));
  };

  const salvar = async () => {
    if (!aberto || !campos) return;
    setSalvando(true);
    try {
      const registrado = await tratarSolicitacao({
        id: aberto.id,
        status_anterior: aberto.status,
        status: novoStatus,
        observation: obsGestao,
        changed_by_name: user?.name || user?.username || "Gestão",
        campos: {
          nome: campos.nome,
          marca: campos.marca,
          gramagem_volume: campos.gramagem_volume,
          categoria: campos.categoria,
          gtin: campos.gtin,
          observacao: campos.observacao,
          quantidade_solicitada: Number(campos.quantidade) || 1,
          urgencia: campos.urgencia,
        },
      });
      toast.success("Solicitação atualizada", {
        description: registrado
          ? "A tratativa foi salva e registrada no histórico."
          : "A tratativa foi salva; o registro no histórico ficou pendente.",
      });
      setAberto(null);
      await carregar();
    } catch (e) {
      toast.error("Não foi possível salvar", { description: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="🧾 Solicitações de Novos Produtos"
        description="Pedidos de cadastro enviados pelas lojas quando o produto não está no catálogo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setNovoAberto(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova solicitação
            </Button>
            <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {SOLICITACAO_STATUS.map((s) => (
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
              {s}
            </p>
            <p className="mt-1 text-2xl font-bold text-navy">{contagens.get(s) ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar produto, marca, EAN ou pessoa…"
            className="pl-9"
          />
        </div>
        {!lojaFixa && (
          <Select value={fLoja} onValueChange={setFLoja}>
            <SelectTrigger>
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {LOJAS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {SOLICITACAO_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fUrgencia} onValueChange={setFUrgencia}>
          <SelectTrigger>
            <SelectValue placeholder="Urgência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Qualquer urgência</SelectItem>
            <SelectItem value="Alta">Urgência alta</SelectItem>
            <SelectItem value="Normal">Urgência normal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger>
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recentes">Mais recentes</SelectItem>
            <SelectItem value="antigas">Mais antigas</SelectItem>
            <SelectItem value="urgencia">Urgência alta primeiro</SelectItem>
            <SelectItem value="produto">Nome do produto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando solicitações…
        </p>
      ) : filtrados.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-semibold text-foreground">Nenhuma solicitação encontrada.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando um produto não for encontrado na busca da Lista de Faltas, a loja pode pedir o cadastro por lá.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => abrir(r)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy">{r.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[r.marca, r.gramagem_volume, r.categoria].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[11px] font-semibold ${STATUS_TONE[r.status] ?? ""}`}
                >
                  {STATUS_EMOJI[r.status]} {r.status}
                </Badge>
              </div>
              {r.urgencia === "Alta" && (
                <span className="inline-flex w-fit items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                  ⚡ Urgência alta
                </span>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{r.store_id}</span>
                <span>{r.reported_by_name}</span>
                <span>{fmtData(r.reported_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <SolicitacaoNovoProdutoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        loja={lojaFixa}
        onCreated={() => void carregar()}
      />

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {aberto && campos && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left leading-snug">{aberto.nome}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Solicitante</p>
                  <p className="font-semibold">{aberto.reported_by_name}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loja</p>
                  <p className="font-semibold">{aberto.store_id}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Data da solicitação</p>
                  <p className="font-semibold">{fmtData(aberto.reported_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status atual</p>
                  <p className="font-semibold">{aberto.status}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Urgência</p>
                  <p className="font-semibold">{aberto.urgencia}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Quantidade solicitada</p>
                  <p className="font-semibold">{aberto.quantidade_solicitada}</p>
                </div>
                {aberto.motivo && (
                  <div className="col-span-full">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Motivo informado pela loja</p>
                    <p className="font-semibold">{aberto.motivo}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-navy">Dados do produto</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-semibold">Nome do produto</Label>
                    <Input
                      value={campos.nome}
                      onChange={(e) => setCampos((c) => (c ? { ...c, nome: e.target.value } : c))}
                      disabled={!podeGerenciar}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Marca</Label>
                    <Input
                      value={campos.marca}
                      onChange={(e) => setCampos((c) => (c ? { ...c, marca: e.target.value } : c))}
                      disabled={!podeGerenciar}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Gramagem / Volume</Label>
                    <Input
                      value={campos.gramagem_volume}
                      onChange={(e) =>
                        setCampos((c) => (c ? { ...c, gramagem_volume: e.target.value } : c))
                      }
                      disabled={!podeGerenciar}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Categoria</Label>
                    <Input
                      value={campos.categoria}
                      onChange={(e) =>
                        setCampos((c) => (c ? { ...c, categoria: e.target.value } : c))
                      }
                      disabled={!podeGerenciar}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Código de barras (EAN)</Label>
                    <Input
                      value={campos.gtin}
                      onChange={(e) => setCampos((c) => (c ? { ...c, gtin: e.target.value } : c))}
                      disabled={!podeGerenciar}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Quantidade solicitada</Label>
                    <Input
                      value={campos.quantidade}
                      onChange={(e) =>
                        setCampos((c) => (c ? { ...c, quantidade: e.target.value } : c))
                      }
                      inputMode="decimal"
                      disabled={!podeGerenciar}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Urgência</Label>
                    <Select
                      value={campos.urgencia}
                      onValueChange={(v) =>
                        setCampos((c) => (c ? { ...c, urgencia: v as SolicitacaoUrgencia } : c))
                      }
                      disabled={!podeGerenciar}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Observação da loja</Label>
                  <Textarea
                    rows={2}
                    value={campos.observacao}
                    onChange={(e) =>
                      setCampos((c) => (c ? { ...c, observacao: e.target.value } : c))
                    }
                    disabled={!podeGerenciar}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-navy">Histórico da solicitação</p>
                {histLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
                  </p>
                ) : timeline.length === 0 ? (
                  <p className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm text-muted-foreground">
                    Nenhuma movimentação registrada.
                  </p>
                ) : (
                  <div className="ml-1.5 space-y-3 border-l-2 border-primary/20 pl-5">
                    {timeline.map((h) => (
                      <div
                        key={h.id}
                        className="relative rounded-lg border border-border/60 bg-muted/10 p-3"
                      >
                        <span className="absolute -left-[27px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-background bg-primary" />
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {h.changed_by_name || "Sistema"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtData(h.created_at)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-sm text-foreground">
                          {h.status_anterior && h.status_anterior !== h.status_novo
                            ? "Alterou o status para "
                            : "Status registrado: "}
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-medium ${STATUS_TONE[h.status_novo] ?? ""}`}
                          >
                            {STATUS_EMOJI[h.status_novo] ?? ""} {h.status_novo}
                          </Badge>
                        </div>
                        {h.observation && (
                          <p className="mt-2 rounded border border-border/50 bg-background p-2 text-sm italic text-foreground">
                            ↳ {h.observation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {podeGerenciar ? (
                <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-primary">
                    TRATATIVA DE COMPRAS
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O status selecionado é o retorno enviado para a loja solicitante.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Nova situação</Label>
                    <Select
                      value={novoStatus}
                      onValueChange={(v) => setNovoStatus(v as SolicitacaoStatus)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOLICITACAO_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_EMOJI[s]} {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Observação da gestão</Label>
                    <Textarea
                      className="bg-background"
                      rows={2}
                      value={obsGestao}
                      onChange={(e) => setObsGestao(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Você está visualizando a solicitação. Apenas a equipe de Compras pode alterar o status.
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(null)}>
                  Fechar
                </Button>
                {podeGerenciar && (
                  <Button onClick={() => void salvar()} disabled={salvando}>
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
