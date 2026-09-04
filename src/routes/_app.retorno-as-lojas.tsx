import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, PackageCheck, RefreshCw, Search } from "lucide-react";
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
  listRetornoLojas, marcarCiente, lojaDoUsuario, LOJAS, type RetornoLoja,
} from "@/lib/produtos-em-falta";

export const Route = createFileRoute("/_app/retorno-as-lojas")({
  head: () => ({
    meta: [
      { title: "Retorno às Lojas — Sumel" },
      {
        name: "description",
        content:
          "Produtos apontados em falta pela loja que já tiveram o pedido realizado por Compras, com confirmação de ciência da gerência.",
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

type Filtro = "todos" | "nao-lidos" | "cientes";


function RetornoAsLojas() {
  const { user } = useAuth();
  const lojaFixa = lojaDoUsuario(user);

  const [rows, setRows] = useState<RetornoLoja[]>([]);
  const [prazo, setPrazo] = useState(7);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [loja, setLoja] = useState<string>(lojaFixa ?? "todas");
  const [periodo, setPeriodo] = useState<string>("todos");
  const [salvando, setSalvando] = useState<string | null>(null);

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
      .filter((r) => (filtro === "nao-lidos" ? !r.ciente_at : filtro === "cientes" ? !!r.ciente_at : true))
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
  }, [rows, busca, filtro, loja, lojaFixa, periodo]);

  const naoLidos = rows.filter((r) => !r.ciente_at).length;

  const confirmar = async (r: RetornoLoja) => {
    const nome = user?.name || user?.username || "Gerência";
    setSalvando(r.id);
    try {
      await marcarCiente(r.id, nome);
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, ciente_at: new Date().toISOString(), ciente_by_name: nome }
            : x,
        ),
      );
      toast.success("Retorno marcado como ciente.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar como ciente.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Retorno às Lojas"
        description={`Produtos apontados pela equipe que Compras já avaliou. Cada retorno fica visível por ${prazo} dias.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          {naoLidos} aguardando ciência
        </Badge>
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar produto, código ou colaborador"
            className="h-11 pl-9"
            inputMode="search"
          />
        </div>

        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="nao-lidos">Não lidos</SelectItem>
            <SelectItem value="cientes">Cientes</SelectItem>
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
            <SelectTrigger className="h-11 lg:col-span-1">
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
            Nenhum retorno de Compras no momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((r) => {
            const novo = !r.ciente_at;
            const dias = diasDesde(r.retorno_em);
            const visual = visualDe(r.status);
            return (
              <li
                key={r.id}
                className={`rounded-xl border p-3 sm:p-4 ${
                  novo ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {novo && (
                        <Badge className="bg-blue-600 text-white hover:bg-blue-600">🔵 Novo retorno</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold uppercase tracking-wide ${visual.classe}`}
                      >
                        {visual.emoji} {r.status}
                      </Badge>

                      {r.ciente_at && (
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
                          ✓ Ciente
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold text-navy">
                      {r.produto?.descricao ?? "Produto"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.produto?.codigo ? `Cód. ${r.produto.codigo}` : ""}
                      {r.produto?.gtin ? ` · EAN ${r.produto.gtin}` : ""} · {r.store_id}
                    </p>
                  </div>

                  {novo && (
                    <Button
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={() => void confirmar(r)}
                      disabled={salvando === r.id}
                    >
                      {salvando === r.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Ciente
                    </Button>
                  )}
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
                    <dt className="text-muted-foreground">Pedido realizado em</dt>
                    <dd className="font-medium">{fmtHora(r.pedido_realizado_em)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Há</dt>
                    <dd className="font-medium">{dias === 0 ? "hoje" : `${dias} dia(s)`}</dd>
                  </div>
                </dl>

                {r.management_observation && (
                  <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Compras:</span>{" "}
                    {r.management_observation}
                  </p>
                )}

                {r.ciente_at && (
                  <p className="mt-2 text-[11px] text-emerald-700">
                    Ciente por {r.ciente_by_name || "gerência"} em {fmtHora(r.ciente_at)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
