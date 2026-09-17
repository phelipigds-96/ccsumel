import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackageCheck, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  listRetornoLojas, lojaDoUsuario, LOJAS, type RetornoLoja,
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

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const fmtHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : "—";

const diasDesde = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};

/** Aparência por situação. Situações novas caem no padrão, sem quebrar a tela. */
const STATUS_VISUAL: Record<string, { emoji: string; classe: string }> = {
  "Em análise": { emoji: "🟡", classe: "border-amber-300 bg-amber-100 text-amber-900" },
  Comprar: { emoji: "🛒", classe: "border-sky-300 bg-sky-100 text-sky-900" },
  "Pedido realizado": { emoji: "📦", classe: "border-indigo-300 bg-indigo-100 text-indigo-800" },
  "Aguardando recebimento": { emoji: "🚚", classe: "border-cyan-300 bg-cyan-100 text-cyan-900" },
  "Estoque disponível / verificar loja": {
    emoji: "🔎",
    classe: "border-teal-300 bg-teal-100 text-teal-900",
  },
  "Falta no fornecedor": { emoji: "⚠️", classe: "border-orange-300 bg-orange-100 text-orange-900" },
  "Produto descontinuado": { emoji: "🔴", classe: "border-red-300 bg-red-100 text-red-800" },
  Resolvido: { emoji: "✅", classe: "border-emerald-300 bg-emerald-100 text-emerald-800" },
  "Não é ruptura": { emoji: "⚪", classe: "border-slate-300 bg-slate-100 text-slate-800" },
};

const visualDe = (status: string) =>
  STATUS_VISUAL[status] ?? { emoji: "ℹ️", classe: "border-border bg-muted text-foreground" };

function RetornoAsLojas() {
  const { user } = useAuth();
  const lojaFixa = lojaDoUsuario(user);

  const [rows, setRows] = useState<RetornoLoja[]>([]);
  const [prazo, setPrazo] = useState(7);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [loja, setLoja] = useState<string>(lojaFixa ?? "todas");
  const [periodo, setPeriodo] = useState<string>("todos");

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

  const filtradas = useMemo(() => {
    const s = normalize(busca);
    return rows
      .filter((r) => (lojaFixa ? true : loja === "todas" || r.store_id === loja))
      .filter((r) => {
        if (periodo === "todos") return true;
        const dias = diasDesde(r.retorno_em);
        return periodo === "hoje" ? dias === 0 : dias <= Number(periodo);
      })
      .filter((r) =>
        !s
          ? true
          : [r.produto?.descricao, r.produto?.codigo, r.produto?.gtin, r.reported_by_name]
              .filter(Boolean)
              .some((v) => normalize(String(v)).includes(s)),
      );
  }, [rows, busca, loja, lojaFixa, periodo]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Retorno às Lojas"
        description={`Painel de consulta dos retornos de Compras para os produtos apontados em falta. O histórico recente fica visível por ${prazo} dias.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{rows.length} no período</Badge>
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar produto, código ou colaborador"
            className="h-11 pl-9"
            inputMode="search"
          />
        </div>

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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando retornos…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <PackageCheck className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Nenhum retorno de Compras no momento para os filtros aplicados.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((r) => {
            const dias = diasDesde(r.retorno_em);
            const visual = visualDe(r.status);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-card p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold uppercase tracking-wide ${visual.classe}`}
                      >
                        {visual.emoji} {r.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold text-navy">
                      {r.produto?.descricao ?? "Produto"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.produto?.codigo ? `Cód. ${r.produto.codigo}` : ""}
                      {r.produto?.gtin ? ` · EAN ${r.produto.gtin}` : ""} · {r.store_id}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Solicitado por</dt>
                    <dd className="truncate font-medium">{r.reported_by_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Solicitado em</dt>
                    <dd className="font-medium">{fmt(r.reported_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Retorno de Compras em</dt>
                    <dd className="font-medium">{fmtHora(r.retorno_em)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Há</dt>
                    <dd className="font-medium">{dias === 0 ? "hoje" : `${dias} dia(s)`}</dd>
                  </div>
                </dl>

                {r.management_observation && (
                  <div className="mt-3 rounded-lg border border-muted bg-muted/30 p-2.5 text-sm">
                    <p className="mb-0.5 text-xs font-semibold text-foreground/80">Resposta de Compras:</p>
                    <p className="text-muted-foreground font-medium">
                      {r.management_observation}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
