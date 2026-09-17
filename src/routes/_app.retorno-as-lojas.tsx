import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  User,
  UserCheck,
  Building2,
  Tag,
  Calendar,
  MessageSquare,
  History,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  listRetornoLojas,
  lojaDoUsuario,
  marcarCiente,
  listHistorico,
  LOJAS,
  type RetornoLoja,
  type FaltaHistorico,
} from "@/lib/produtos-em-falta";

export const Route = createFileRoute("/_app/retorno-as-lojas")({
  head: () => ({
    meta: [
      { title: "Retorno às Lojas — Sumel" },
      {
        name: "description",
        content:
          "Painel de consulta dos retornos de Compras para os produtos apontados em falta.",
      },
    ],
  }),
  component: RetornoAsLojas,
});

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const fmtHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const diasDesde = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};

/** Aparência e destaque por status da tratativa */
const STATUS_VISUAL: Record<string, { emoji: string; classe: string }> = {
  "Em análise": {
    emoji: "🟡",
    classe: "border-amber-300 bg-amber-100 text-amber-900 font-bold",
  },
  Comprar: {
    emoji: "🛒",
    classe: "border-sky-300 bg-sky-100 text-sky-900 font-bold",
  },
  "Pedido realizado": {
    emoji: "📦",
    classe: "border-indigo-300 bg-indigo-100 text-indigo-800 font-bold",
  },
  "Aguardando recebimento": {
    emoji: "🚚",
    classe: "border-cyan-300 bg-cyan-100 text-cyan-900 font-bold",
  },
  "Estoque disponível / verificar loja": {
    emoji: "🔎",
    classe: "border-teal-300 bg-teal-100 text-teal-900 font-bold",
  },
  "Falta no fornecedor": {
    emoji: "⚠️",
    classe: "border-orange-300 bg-orange-100 text-orange-900 font-bold",
  },
  "Produto descontinuado": {
    emoji: "🔴",
    classe: "border-red-300 bg-red-100 text-red-800 font-bold",
  },
  Resolvido: {
    emoji: "✅",
    classe: "border-emerald-300 bg-emerald-100 text-emerald-800 font-bold",
  },
  "Não é ruptura": {
    emoji: "⚪",
    classe: "border-slate-300 bg-slate-100 text-slate-800 font-bold",
  },
};

const visualDe = (status: string) =>
  STATUS_VISUAL[status] ?? {
    emoji: "ℹ️",
    classe: "border-border bg-muted text-foreground font-bold",
  };

function RetornoAsLojas() {
  const { user } = useAuth();
  const lojaFixa = lojaDoUsuario(user);

  const [rows, setRows] = useState<RetornoLoja[]>([]);
  const [prazo, setPrazo] = useState(7);
  const [loading, setLoading] = useState(true);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);
  
  // Filtros
  const [busca, setBusca] = useState("");
  const [loja, setLoja] = useState<string>(lojaFixa ?? "todas");
  const [periodo, setPeriodo] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todas");
  const [leituraFiltro, setLeituraFiltro] = useState<string>("todos");

  // Modal de Histórico
  const [modalHistBase, setModalHistBase] = useState<RetornoLoja | null>(null);
  const [historico, setHistorico] = useState<FaltaHistorico[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: r, prazo: p } = await listRetornoLojas({ loja: lojaFixa });
      setRows(r);
      setPrazo(p);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível carregar os retornos."
      );
    } finally {
      setLoading(false);
    }
  }, [lojaFixa]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleMarcarCiente = async (id: string) => {
    const nomeUsuario = user?.name || user?.username || "Gerente de Loja";
    setMarcandoId(id);
    try {
      await marcarCiente(id, nomeUsuario);
      toast.success("Ciente registrado com sucesso!");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                ciente_at: new Date().toISOString(),
                ciente_by_name: nomeUsuario,
              }
            : r
        )
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível registrar o ciente."
      );
    } finally {
      setMarcandoId(null);
    }
  };

  const handleAbrirHistorico = async (r: RetornoLoja) => {
    setModalHistBase(r);
    setLoadingHist(true);
    try {
      const hist = await listHistorico(r.id);
      setHistorico(hist);
    } catch (e) {
      toast.error("Erro ao carregar o histórico da tratativa.");
    } finally {
      setLoadingHist(false);
    }
  };

  const filtradas = useMemo(() => {
    const s = normalize(busca);
    let result = rows
      .filter((r) =>
        lojaFixa ? true : loja === "todas" || r.store_id === loja
      )
      .filter((r) => (statusFiltro === "todas" ? true : r.status === statusFiltro))
      .filter((r) => {
        if (leituraFiltro === "todos") return true;
        if (leituraFiltro === "nao-lidos") return !r.ciente_at;
        return !!r.ciente_at;
      })
      .filter((r) => {
        if (periodo === "todos") return true;
        const dias = diasDesde(r.retorno_em);
        return periodo === "hoje" ? dias === 0 : dias <= Number(periodo);
      })
      .filter((r) =>
        !s
          ? true
          : [
              r.produto?.descricao,
              r.produto?.codigo,
              r.produto?.gtin,
              r.reported_by_name,
              r.responsavel_nome,
            ]
              .filter(Boolean)
              .some((v) => normalize(String(v)).includes(s))
      );

    // Ordenação privilegiando não lidos e registros mais recentes
    result.sort((a, b) => {
      const aLido = !!a.ciente_at;
      const bLido = !!b.ciente_at;
      if (aLido !== bLido) return aLido ? 1 : -1; // Não lido vem primeiro (-1)
      
      const aData = new Date(a.retorno_em || 0).getTime();
      const bData = new Date(b.retorno_em || 0).getTime();
      return bData - aData;
    });

    return result;
  }, [rows, busca, loja, lojaFixa, periodo, statusFiltro, leituraFiltro]);

  const disponiveisStatus = useMemo(() => {
    const set = new Set(rows.map((r) => r.status));
    return Array.from(set);
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Retorno às Lojas"
        description={
          lojaFixa
            ? `Retornos de Compras das faltas solicitadas pela ${lojaFixa}. Exibição dos últimos ${prazo} dias.`
            : `Painel de consulta dos retornos de Compras para os produtos em falta. Exibição dos últimos ${prazo} dias.`
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs">
          {filtradas.length} retornos exibidos
        </Badge>
        {lojaFixa && (
          <Badge
            variant="outline"
            className="border-primary/40 text-primary font-medium"
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" /> Loja: {lojaFixa}
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => void carregar()}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
        <div className="relative sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, código ou solicitante..."
            className="h-11 pl-9"
          />
        </div>

        <Select value={leituraFiltro} onValueChange={setLeituraFiltro}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Status de Leitura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Situações</SelectItem>
            <SelectItem value="nao-lidos">Não Lidos (Pendentes)</SelectItem>
            <SelectItem value="cientes">Marcados como Ciente</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Status Compras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos Status (Compras)</SelectItem>
            {disponiveisStatus.map((st) => (
              <SelectItem key={st} value={st}>
                {st}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer período</SelectItem>
            <SelectItem value="hoje">Retornos de hoje</SelectItem>
            <SelectItem value="3">Últimos 3 dias</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>

        {!lojaFixa && (
          <Select value={loja} onValueChange={setLoja}>
            <SelectTrigger className="h-11">
              <SelectValue />
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
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground bg-card rounded-xl border border-border/60 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p>Carregando retornos de Compras...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center bg-card/50">
          <PackageCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Nenhum retorno encontrado</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Não há retornos encontrados com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((r) => {
            const visual = visualDe(r.status);
            const isCiente = Boolean(r.ciente_at);

            return (
              <Card
                key={r.id}
                className={`relative flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md border border-l-4 ${
                  isCiente
                    ? "border-border border-l-emerald-500 bg-muted/20 opacity-90"
                    : "border-amber-300/50 border-l-amber-500 bg-card shadow-sm shadow-amber-500/10"
                }`}
              >
                {!isCiente && (
                  <span className="absolute top-0 right-0 flex h-3 w-3 -translate-x-3 translate-y-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-sm"></span>
                  </span>
                )}

                <CardHeader className="pb-3 space-y-2">
                  {/* Badges de Topo: Loja e Status */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pr-4">
                    <Badge
                      variant="outline"
                      className="text-[11px] font-semibold bg-muted/50"
                    >
                      <Building2 className="mr-1 h-3 w-3 text-muted-foreground" />
                      {r.store_id}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[11px] uppercase tracking-wide px-2.5 py-0.5 shadow-sm ${visual.classe}`}
                    >
                      {visual.emoji} {r.status}
                    </Badge>
                  </div>

                  {/* Nome do Produto */}
                  <div>
                    <h3 className="font-bold text-navy leading-snug text-base line-clamp-2">
                      {r.produto?.descricao ?? "Produto não identificado"}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground font-mono">
                      {r.produto?.codigo && (
                        <span className="inline-flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded">
                          <Tag className="h-3 w-3" /> Cód: {r.produto.codigo}
                        </span>
                      )}
                      {r.produto?.gtin && (
                        <span className="inline-flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded">
                          EAN: {r.produto.gtin}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 pb-3 text-xs">
                  {/* Informações detalhadas */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 border border-border/50">
                    <div>
                      <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        Solicitante
                      </span>
                      <span className="font-semibold text-foreground truncate flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        {r.reported_by_name || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        Data Solicitação
                      </span>
                      <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        {fmtHora(r.reported_at)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        Tratado por
                      </span>
                      <span className="font-semibold text-foreground truncate flex items-center gap-1 mt-0.5">
                        <UserCheck className="h-3 w-3 text-sky-600 shrink-0" />
                        {r.responsavel_nome || "Compras"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        Data Tratativa
                      </span>
                      <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-sky-600 shrink-0" />
                        {fmtHora(r.retorno_em)}
                      </span>
                    </div>
                  </div>

                  {/* Resposta/Observação de Compras */}
                  {r.management_observation ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-2.5 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
                      <div className="flex items-center gap-1 font-semibold text-[11px] text-sky-800 dark:text-sky-300 mb-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Resposta de
                        Compras:
                      </div>
                      <p className="text-xs leading-relaxed font-normal whitespace-pre-wrap">
                        {r.management_observation}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic px-1 gap-1 flex items-center">
                      <MessageSquare className="h-3 w-3 opacity-50"/> Sem observações adicionais gravadas.
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-3 pb-3 border-t border-border/60 bg-muted/10 flex items-center gap-2 justify-between">
                   <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleAbrirHistorico(r)}
                      className="h-9 shrink-0 shadow-sm text-xs border-muted-foreground/30 hover:border-muted-foreground/50"
                   >
                      <History className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                      Histórico
                   </Button>

                  {isCiente ? (
                    <div className="flex-1 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-2.5 py-1.5 rounded-md min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Ciente em {fmtHora(r.ciente_at)}
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 shadow-sm"
                      disabled={marcandoId === r.id}
                      onClick={() => void handleMarcarCiente(r.id)}
                    >
                      {marcandoId === r.id ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Marcar Ciente
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Histórico Leitura */}
      <Dialog
        open={!!modalHistBase}
        onOpenChange={(open) => !open && setModalHistBase(null)}
      >
        <DialogContent className="sm:max-w-[550px] bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Linha do Tempo da Tratativa
            </DialogTitle>
            <DialogDescription>
              <div className="mt-1 font-semibold text-foreground">
                {modalHistBase?.produto?.descricao ?? "Produto"}
              </div>
              <div className="text-xs tracking-wide opacity-80">
                Refletindo o histórico recebido de Compras para a {modalHistBase?.store_id}.
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="relative border-l-2 border-border/60 ml-3 pl-5 space-y-6 max-h-[50vh] overflow-y-auto pr-2 py-1">
              {loadingHist ? (
                <div className="flex items-center gap-2 text-sm text-primary py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando registro...
                </div>
              ) : historico.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 italic">
                  Nenhum evento registrado no histórico para esta falta.
                </div>
              ) : (
                historico.map((h) => (
                  <div key={h.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary/20 ring-4 ring-background border-2 border-primary" />
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-bold text-foreground">
                        {h.changed_by_name || "Sistema"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtHora(h.created_at)}
                      </span>
                    </div>
                    {h.status_anterior !== h.status_novo && (
                      <div className="flex items-center gap-1.5 flex-wrap my-1.5">
                        {h.status_anterior && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-muted/40 text-muted-foreground line-through opacity-70 px-1.5 py-0 uppercase border-[0.5px]"
                          >
                            {h.status_anterior}
                          </Badge>
                        )}
                        <span className="text-muted-foreground/50 text-[10px]">
                          →
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold shadow-sm px-1.5 py-0 uppercase ${visualDe(h.status_novo).classe}`}
                        >
                          {visualDe(h.status_novo).emoji} {h.status_novo}
                        </Badge>
                      </div>
                    )}
                    {h.observation && (
                      <div className="mt-2 rounded bg-muted/30 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground border border-border/40">
                        {h.observation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
