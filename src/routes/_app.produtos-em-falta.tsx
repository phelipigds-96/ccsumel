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
import {
  createFalta, getBloqueioAtivo, listBloqueiosAtivos, traduzErroLancamento, LOJAS, lojaDoUsuario,
  type ProdutoBloqueio,
} from "@/lib/produtos-em-falta";
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

const dataTratamento = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value));

type Step = "busca" | "registro" | "confirmado";

function ProdutosEmFaltaPage() {
  const [step, setStep] = useState<Step>("busca");

  const [search, setSearch] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [produto, setProduto] = useState<Produto | null>(null);
  const [bloqueios, setBloqueios] = useState<Map<string, ProdutoBloqueio>>(new Map());
  const [bloqueioRegistro, setBloqueioRegistro] = useState<ProdutoBloqueio | null>(null);
  const [checandoBloqueio, setChecandoBloqueio] = useState(false);
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
      setBloqueios(new Map());
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
        try {
          const bl = await listBloqueiosAtivos(rows.map((p) => p.id), loja);
          if (id === reqId.current) setBloqueios(bl);
        } catch {
          /* pesquisa continua mesmo se a checagem de bloqueio falhar; o banco revalida ao salvar */
        }
      } catch (e) {
        if (id === reqId.current) toast.error("Falha ao pesquisar", { description: (e as Error).message });
      } finally {
        if (id === reqId.current) setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, loja]);

  const nomeRef = useRef<HTMLInputElement>(null);

  const selecionar = async (p: Produto) => {
    const conhecido = bloqueios.get(p.id);
    if (conhecido) return;

    setChecandoBloqueio(true);
    try {
      const bloqueioAtual = await getBloqueioAtivo(p.id, loja);
      if (bloqueioAtual) {
        setBloqueios((atuais) => new Map(atuais).set(p.id, bloqueioAtual));
        toast.error("🔴 Produto bloqueado", {
          description: `${p.descricao}\nStatus: ${bloqueioAtual.status}\nTratado em: ${dataTratamento(bloqueioAtual.tratado_em)}`,
          duration: 8000,
        });
        return;
      }
      setProduto(p);
      setBloqueioRegistro(null);
      setErroNome(false);
      setStep("registro");
      setTimeout(() => nomeRef.current?.focus(), 80);
    } catch {
      // O gatilho do banco continua sendo a proteção final caso esta consulta falhe.
      setProduto(p);
      setBloqueioRegistro(null);
      setErroNome(false);
      setStep("registro");
      setTimeout(() => nomeRef.current?.focus(), 80);
    } finally {
      setChecandoBloqueio(false);
    }
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
      const bloqueioAtual = await getBloqueioAtivo(produto.id, loja);
      if (bloqueioAtual) {
        setBloqueioRegistro(bloqueioAtual);
        setBloqueios((atuais) => new Map(atuais).set(produto.id, bloqueioAtual));
        toast.error("⚠️ Produto não disponível para novo lançamento", {
          description: `Status atual: ${bloqueioAtual.status}`,
          duration: 8000,
        });
        return;
      }

      await createFalta({
        product_id: produto.id,
        store_id: loja,
        reported_by_name: nome,
        observation: obs,
      });
      setConfirmacao({ produto: produto.descricao, nome: nome.trim(), loja });
      setStep("confirmado");
    } catch (e) {
      const msg = traduzErroLancamento(e);
      if (msg.includes("retorno da área de Compras") || msg.includes("solicitação pendente")) {
        toast.error("⚠️ Produto não disponível para novo lançamento", { description: msg, duration: 8000 });
        // Volta à pesquisa para o colaborador ver o selo de bloqueio do produto
        setProduto(null);
        setStep("busca");
      } else {
        toast.error("Não foi possível registrar", { description: msg });
      }
    } finally {
      setSaving(false);
    }
  };

  const recomecar = () => {
    setProduto(null);
    setBloqueioRegistro(null);
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

        {bloqueioRegistro && (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <p className="font-bold text-destructive">🔴 PRODUTO BLOQUEADO</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Produto: {produto.descricao}</p>
            <p className="mt-1 text-sm text-foreground">Status: {bloqueioRegistro.status}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Solicitação anterior tratada em: {dataTratamento(bloqueioRegistro.tratado_em)}
            </p>
            <p className="mt-2 text-sm text-foreground">
              O produto não pode ser adicionado novamente à Lista de Faltas.
            </p>
          </div>
        )}

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

          <Button
            className="h-14 w-full text-base font-bold"
            onClick={registrar}
            disabled={saving || checandoBloqueio || Boolean(bloqueioRegistro)}
          >
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {bloqueioRegistro ? "PRODUTO BLOQUEADO" : saving ? "Registrando…" : "🚨 REGISTRAR FALTA"}
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
          {resultados.map((p) => {
            const bloqueio = bloqueios.get(p.id);
            if (bloqueio) {
              return (
                <li key={p.id} className="bg-destructive/5">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled
                    className="h-auto w-full cursor-not-allowed flex-col items-start rounded-none px-4 py-3 text-left opacity-100"
                    aria-label={`${p.descricao}, produto bloqueado, status ${bloqueio.status}`}
                  >
                    <span className="block max-w-full truncate text-sm font-semibold text-muted-foreground">{p.descricao}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {p.codigo ? `Cód. ${p.codigo}` : p.gtin ?? ""}
                    </span>
                    <span className="mt-1.5 whitespace-normal text-[11px] font-bold text-destructive">
                      🔴 PRODUTO BLOQUEADO — {bloqueio.status}
                    </span>
                    {bloqueio.permanente && (
                      <span className="mt-0.5 whitespace-normal text-[11px] font-normal text-muted-foreground">
                        Bloqueio permanente definido por Compras.
                      </span>
                    )}
                  </Button>
                </li>
              );
            }
            return (
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
