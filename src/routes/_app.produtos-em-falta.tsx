import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, Loader2, CheckCircle2, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Produto } from "@/lib/produtos";
import { createFalta, LOJAS, lojaDoUsuario } from "@/lib/produtos-em-falta";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/produtos-em-falta")({
  head: () => ({
    meta: [
      { title: "Produtos em Falta — Central de Campanhas Sumel" },
      { name: "description", content: "Registre em segundos um produto que não foi encontrado na loja para a equipe de Compras analisar." },
      { property: "og:title", content: "Produtos em Falta — Central de Campanhas Sumel" },
      { property: "og:description", content: "Pesquise o produto, informe seu nome e registre a falta direto do celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProdutosEmFaltaPage,
});

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const rankProduct = (produto: Produto, term: string) => {
  const description = normalize(produto.descricao);
  const code = normalize(produto.codigo ?? "");
  const gtin = normalize(produto.gtin ?? "");
  if (code === term || gtin === term) return 0;
  if (description === term) return 1;
  if (description.startsWith(`${term} `)) return 2;
  if (description.split(/\s+/).some((word) => word.startsWith(term))) return 3;
  return 4;
};

type Step = "busca" | "registro" | "confirmado";

function ProdutosEmFaltaPage() {
  const [step, setStep] = useState<Step>("busca");

  const [search, setSearch] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [produto, setProduto] = useState<Produto | null>(null);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const { user } = useAuth();
  const lojaFixa = lojaDoUsuario(user);
  const [loja, setLoja] = useState<string>(lojaFixa ?? LOJAS[0] ?? "Matriz");
  useEffect(() => { if (lojaFixa) setLoja(lojaFixa); }, [lojaFixa]);
  const [saving, setSaving] = useState(false);
  const [erroNome, setErroNome] = useState(false);

  const [confirmacao, setConfirmacao] = useState<{ produto: string; nome: string; loja: string } | null>(null);

  const reqId = useRef(0);

  useEffect(() => {
    const termo = search.trim();
    if (termo.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const like = termo.replace(/[%_,().]/g, " ");
        const accentTolerant = normalize(like).replace(/[aeiou]/g, "_");
        const { data, error } = await supabase
          .from("produtos")
          .select("id, descricao, codigo, gtin, preco_venda, custo, fornecedor, ativo")
          .or(
            `descricao.ilike.%${like}%,descricao.ilike.%${accentTolerant}%,codigo.ilike.%${like}%,gtin.ilike.%${like}%`,
          )
          .order("descricao", { ascending: true })
          .limit(300);
        if (error) throw error;
        if (id !== reqId.current) return;
        const termoNorm = normalize(termo);
        const rows = ((data ?? []) as unknown as Produto[])
          .filter(
            (p) =>
              normalize(p.descricao).includes(termoNorm) ||
              normalize(p.codigo ?? "").includes(termoNorm) ||
              normalize(p.gtin ?? "").includes(termoNorm),
          )
          .sort((a, b) => rankProduct(a, termoNorm) - rankProduct(b, termoNorm) || a.descricao.localeCompare(b.descricao, "pt-BR"))
          .slice(0, 60);
        setResultados(rows);
      } catch (e) {
        if (id === reqId.current) toast.error("Falha ao pesquisar", { description: (e as Error).message });
      } finally {
        if (id === reqId.current) setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const nomeRef = useRef<HTMLInputElement>(null);

  const selecionar = (p: Produto) => {
    setProduto(p);
    setErroNome(false);
    setStep("registro");
    setTimeout(() => nomeRef.current?.focus(), 80);
  };


  const registrar = async () => {
    if (!produto) return;
    if (!nome.trim()) {
      setErroNome(true);
      toast.error("Informe seu nome para registrar a falta.");
      return;
    }
    setSaving(true);
    try {
      await createFalta({
        product_id: produto.id,
        store_id: loja,
        reported_by_name: nome,
        observation: obs,
      });
      setConfirmacao({ produto: produto.descricao, nome: nome.trim(), loja });
      setStep("confirmado");
    } catch (e) {
      toast.error("Não foi possível registrar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const recomecar = () => {
    setProduto(null);
    setObs("");
    setSearch("");
    setResultados([]);
    setConfirmacao(null);
    setStep("busca");
  };

  /* --------------------------- Confirmação --------------------------- */
  if (step === "confirmado" && confirmacao) {
    return (
      <div className="mx-auto w-full max-w-md py-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="mt-3 text-lg font-bold text-emerald-800">Falta registrada com sucesso!</p>
          <dl className="mt-4 space-y-2 text-left text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700/70">Produto</dt>
              <dd className="font-semibold text-foreground">{confirmacao.produto}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700/70">Registrado por</dt>
              <dd className="font-semibold text-foreground">{confirmacao.nome}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700/70">Loja</dt>
              <dd className="font-semibold text-foreground">{confirmacao.loja}</dd>
            </div>
          </dl>
        </div>
        <Button className="mt-4 h-14 w-full text-base" onClick={recomecar}>
          Registrar outro produto
        </Button>
      </div>
    );
  }

  /* ---------------------------- Registro ----------------------------- */
  if (step === "registro" && produto) {
    return (
      <div className="mx-auto w-full max-w-md py-2">
        <button
          type="button"
          onClick={() => setStep("busca")}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à pesquisa
        </button>

        <div className="rounded-xl border border-border bg-accent/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Produto selecionado
          </p>
          <p className="mt-1 text-base font-bold leading-snug text-navy">{produto.descricao}</p>
          {(produto.codigo || produto.gtin) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[produto.codigo && `Cód. ${produto.codigo}`, produto.gtin].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pf-nome" className="text-sm font-semibold">
              Quem está registrando? *
            </Label>
            <Input
              id="pf-nome"
              ref={nomeRef}
              value={nome}
              onChange={(e) => { setNome(e.target.value); if (e.target.value.trim()) setErroNome(false); }}
              placeholder="Digite seu nome"
              autoComplete="off"
              className={`h-12 text-base ${erroNome ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {erroNome && (
              <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" /> Informe seu nome para registrar a falta.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Loja</Label>
            {lojaFixa ? (
              <p className="flex h-12 items-center rounded-md border border-border bg-muted/40 px-3 text-base font-semibold">
                {lojaFixa}
              </p>
            ) : (
              <Select value={loja} onValueChange={setLoja}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOJAS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pf-obs" className="text-sm font-semibold">Observação (opcional)</Label>
            <Textarea
              id="pf-obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Algo que ajude a equipe de Compras"
              className="text-base"
            />
          </div>

          <Button className="h-14 w-full text-base font-bold" onClick={registrar} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {saving ? "Registrando…" : "🚨 REGISTRAR FALTA"}
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Busca ------------------------------ */
  return (
    <div className="mx-auto w-full max-w-md py-2">
      <h1 className="text-xl font-bold text-navy">🛒 Produtos em Falta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Encontrou um produto que está faltando?</p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar produto ou código de barras..."
          autoFocus
          inputMode="search"
          autoComplete="off"
          className="h-14 pl-11 text-base"
        />
      </div>

      {search.trim().length < 2 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Digite o nome ou código do produto para pesquisar.
        </p>
      ) : buscando ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Pesquisando…
        </p>
      ) : resultados.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => selecionar(p)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted"
              >
                <span className="block truncate text-sm font-semibold text-foreground">{p.descricao}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.codigo ? `Cód. ${p.codigo}` : p.gtin ?? ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
