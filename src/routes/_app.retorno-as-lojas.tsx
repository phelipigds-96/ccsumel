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
import { useAuth } from "@/lib/auth";
import {
  listRetornoLojas,
  lojaDoUsuario,
  marcarCiente,
  LOJAS,
  type RetornoLoja,
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
      { property: "og:title", content: "Retorno às Lojas — Sumel" },
      {
        property: "og:description",
        content: "Acompanhe os retornos de Compras para as faltas apontadas pela sua loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  "Em análise": { emoji: "🟡", classe: "border-amber-300 bg-amber-100 text-amber-900 font-bold" },
  Comprar: { emoji: "🛒", classe: "border-sky-300 bg-sky-100 text-sky-900 font-bold" },
  "Pedido realizado": { emoji: "📦", classe: "border-indigo-300 bg-indigo-100 text-indigo-800 font-bold" },
  "Aguardando recebimento": { emoji: "🚚", classe: "border-cyan-300 bg-cyan-100 text-cyan-900 font-bold" },
  "Estoque disponível / verificar loja": {
    emoji: "🔎",
    classe: "border-teal-300 bg-teal-100 text-teal-900 font-bold",
  },
  "Falta no fornecedor": { emoji: "⚠️", classe: "border-orange-300 bg-orange-100 text-orange-900 font-bold" },
  "Produto descontinuado": { emoji: "🔴", classe: "border-red-300 bg-red-100 text-red-800 font-bold" },
  Resolvido: { emoji: "✅", classe: "border-emerald-300 bg-emerald-100 text-emerald-800 font-bold" },
  "Não é ruptura": { emoji: "⚪", classe: "border-slate-300 bg-slate-100 text-slate-800 font-bold" },
};

const visualDe = (status: string) =>
  STATUS_VISUAL[status] ?? { emoji: "ℹ️", classe: "border-border bg-muted text-foreground font-bold" };

function RetornoAsLojas() {
  const { user } = useAuth();
  const lojaFixa = lojaDoUsuario(user);

  const [rows, setRows] = useState<RetornoLoja[]>([]);
  const [prazo, setPrazo] = useState(7);
  const [loading, setLoading] = useState(true);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [loja, setLoja] = useState<string>(lojaFixa ?? "todas");
  const [periodo, setPeriodo] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: r, prazo: p } = await listRetornoLojas({ loja: lojaFixa });
      setRows(r);
      setPrazo(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os retornos.");
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
            : r,
        ),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível registrar o ciente.",
      );
    } finally {
      setMarcandoId(null);
    }
  };

  const filtradas = useMemo(() => {
    const s = normalize(busca);
    return rows
      .filter((r) => (lojaFixa ? true : loja === "todas" || r.store_id === loja))
      .filter((r) => (statusFiltro === "todas" ? true : r.status === statusFiltro))
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
              .some((v) => normalize(String(v)).includes(s)),
      );
  }, [rows, busca, loja, lojaFixa, periodo, statusFiltro]);

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
          <Badge variant="outline" className="border-primary/40 text-primary font-medium">
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
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, código ou solicitante..."
            className="h-11 pl-9"
          />
        </div>

        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os Status</SelectItem>
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
            Não há retornos de Compras registrados no período ou para os filtros selecionados.
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
                className={`flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md border-l-4 ${isCiente ? "border-l-emerald-500 bg-card" : "border-l-amber-500 bg-card"}`}
              >
                <CardHeader className="pb-3 space-y-2">
                  {/* Badges de Topo: Loja e Status */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Badge variant="outline" className="text-[11px] font-semibold bg-muted/50">
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
                        <MessageSquare className="h-3.5 w-3.5" /> Resposta de Compras:
                      </div>
                      <p className="text-xs leading-relaxed font-normal whitespace-pre-wrap">
                        {r.management_observation}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic px-1">
                      Sem observações adicionais de Compras.
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 pb-3 border-t border-border/60 bg-muted/10 flex items-center justify-between">
                  {isCiente ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-2.5 py-1.5 rounded-md w-full">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Ciente por {r.ciente_by_name || "Loja"} em {fmtHora(r.ciente_at)}
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 shadow-sm"
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
                          Marcar como Ciente
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
    </div>
  );
}
