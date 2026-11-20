import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Copy,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  Undo2,
  FileText,
  DollarSign,
  Building2,
  ClipboardList,
  CalendarDays,
  Columns3,
  Check,
} from "lucide-react";
import { gerarRelatorioSelloutPDF } from "@/components/sellout-report-generator";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useColumnPrefs } from "@/lib/column-prefs";
import {
  useCampanhasStore,
  campanhasStore,
  type Oferta,
  type Campanha,
} from "@/lib/campanhas-store";

export const Route = createFileRoute("/_app/sell-out/acertos")({
  head: () => ({
    meta: [
      { title: "Acertos de Sell Out — Central de Campanhas Sumel" },
      { name: "description", content: "Calcule a verba de sell out a cobrar de cada fornecedor na Central Sumel." },
      { property: "og:title", content: "Acertos de Sell Out — Central de Campanhas Sumel" },
      { property: "og:description", content: "Calcule a verba de sell out a cobrar de cada fornecedor na Central Sumel." },
    ],
  }),
  component: AcertosSellOut,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

type SortKey = "data-desc" | "data-asc" | "produto" | "fornecedor" | "total-desc" | "total-asc" | "qtd-desc";

function AcertosSellOut() {
  const { campanhas, ofertas, acertos } = useCampanhasStore();
  const [busca, setBusca] = useState("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>("__todos");
  const [sortKey, setSortKey] = useState<SortKey>("data-desc");
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [fornecedoresAbertos, setFornecedoresAbertos] = useState<Record<string, boolean>>({});
  const [aba, setAba] = useState<"pendentes" | "historico">("pendentes");

  const COLUMNS = useMemo(
    () => [
      { key: "produto", label: "Produto" },
      { key: "campanha", label: "Campanha atual" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "precoNormal", label: "Preço Normal" },
      { key: "precoPromocional", label: "Preço Promo" },
      { key: "verba", label: "Verba / un" },
      { key: "qtdVendida", label: "Qtd. vendida" },
      { key: "total", label: "Total a cobrar" },
      { key: "ultimaCampanha", label: "Última campanha" },
    ],
    [],
  );

  const columnKeys = useMemo(() => COLUMNS.map((c) => c.key), [COLUMNS]);
  const { isVisible, toggle } = useColumnPrefs("sellout.acertos", columnKeys);
  const visibleColumnCount = COLUMNS.filter((c) => isVisible(c.key)).length + 1; // + Ações

  const campanhaById = useMemo(() => {
    const m = new Map<string, Campanha>();
    campanhas.forEach((c) => m.set(c.id, c));
    return m;
  }, [campanhas]);

  const ofertasSellOut = useMemo(() => {
    return ofertas
      .filter((o) => o.selloutTemVerba)
      .map((o) => {
        const campanha = campanhaById.get(o.campanhaId);
        const chave = (x: Oferta) =>
          (x.codigo || "") + "|" + (x.gtin || "") + "|" + (x.descricao || "");
        const chaveAtual = chave(o);
        const anteriores = ofertas
          .filter(
            (x) =>
              x.id !== o.id &&
              chave(x) === chaveAtual &&
              x.dataInicial < (o.dataInicial || "9999"),
          )
          .sort((a, b) => (b.dataInicial || "").localeCompare(a.dataInicial || ""));
        const ultima = anteriores[0];
        const ultimaCampanha = ultima ? campanhaById.get(ultima.campanhaId) : undefined;
        const ultimaQtd = ultima ? acertos[ultima.id]?.quantidadeVendida ?? 0 : 0;
        const baixado = acertos[o.id]?.baixado ?? false;
        const baixadoEm = acertos[o.id]?.baixadoEm ?? null;
        return { oferta: o, campanha, ultima, ultimaCampanha, ultimaQtd, baixado, baixadoEm };
      });
  }, [ofertas, acertos, campanhaById]);

  const getQtd = (id: string): number => {
    const raw = quantidades[id];
    if (raw !== undefined) return Number(raw) || 0;
    return acertos[id]?.quantidadeVendida ?? 0;
  };

  const setQtd = (id: string, v: string) => {
    setQuantidades((prev) => ({ ...prev, [id]: v }));
  };

  const salvar = async (id: string) => {
    const qtd = getQtd(id);
    const current = acertos[id];
    
    const { error } = await supabase.from('acertos').upsert({
      oferta_id: id,
      quantidade_vendida: qtd,
      baixado: current?.baixado ?? false,
      baixado_em: current?.baixadoEm ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'oferta_id' });

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar no banco");
      return;
    }

    campanhasStore.setAcerto(id, qtd);
    toast.success("Acerto salvo", { description: `Quantidade registrada: ${qtd}` });
  };

  const darBaixa = async (id: string) => {
    const qtd = getQtd(id);
    const baixadoEm = new Date().toISOString();

    const { error } = await supabase.from('acertos').upsert({
      oferta_id: id,
      quantidade_vendida: qtd,
      baixado: true,
      baixado_em: baixadoEm,
      updated_at: new Date().toISOString()
    }, { onConflict: 'oferta_id' });

    if (error) {
      console.error(error);
      toast.error("Erro ao dar baixa no banco");
      return;
    }

    campanhasStore.setAcerto(id, qtd);
    campanhasStore.setBaixaAcerto(id, true);
    toast.success("Baixa registrada", { description: "O produto foi movido para o histórico de acertos." });
  };

  const reabrir = async (id: string) => {
    const qtd = getQtd(id);

    const { error } = await supabase.from('acertos').upsert({
      oferta_id: id,
      quantidade_vendida: qtd,
      baixado: false,
      baixado_em: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'oferta_id' });

    if (error) {
      console.error(error);
      toast.error("Erro ao reabrir no banco");
      return;
    }

    campanhasStore.setBaixaAcerto(id, false);
    toast.success("Acerto reaberto", { description: "O produto voltou para os pendentes." });
  };

  const fornecedoresDisponiveis = useMemo(() => {
    const s = new Set<string>();
    ofertasSellOut.forEach(({ oferta }) => {
      s.add(oferta.selloutFornecedor || oferta.fornecedor || "—");
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [ofertasSellOut]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let list = ofertasSellOut.filter(({ oferta, campanha, baixado }) => {
      if (aba === "pendentes" ? baixado : !baixado) return false;
      const forn = oferta.selloutFornecedor || oferta.fornecedor || "—";
      if (fornecedorFiltro !== "__todos" && forn !== fornecedorFiltro) return false;
      if (!q) return true;
      return [
        oferta.descricao,
        oferta.codigo,
        oferta.gtin,
        oferta.fornecedor,
        oferta.selloutFornecedor,
        campanha?.nome ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    list = [...list].sort((a, b) => {
      const totalA = getQtd(a.oferta.id) * (a.oferta.selloutValor || 0);
      const totalB = getQtd(b.oferta.id) * (b.oferta.selloutValor || 0);
      const fornA = a.oferta.selloutFornecedor || a.oferta.fornecedor || "";
      const fornB = b.oferta.selloutFornecedor || b.oferta.fornecedor || "";
      
      switch (sortKey) {
        case "produto":
          return a.oferta.descricao.localeCompare(b.oferta.descricao);
        case "fornecedor":
          return fornA.localeCompare(fornB);
        case "data-desc":
          return (b.campanha?.dataInicial || "0000-00-00").localeCompare(a.campanha?.dataInicial || "0000-00-00");
        case "data-asc":
          return (a.campanha?.dataInicial || "9999-99-99").localeCompare(b.campanha?.dataInicial || "9999-99-99");
        case "total-asc":
          return totalA - totalB;
        case "qtd-desc":
          return getQtd(b.oferta.id) - getQtd(a.oferta.id);
        case "total-desc":
        default:
          return totalB - totalA;
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofertasSellOut, busca, fornecedorFiltro, sortKey, quantidades, acertos, aba]);

  const totalGeral = filtradas.reduce((acc, { oferta }) => {
    return acc + getQtd(oferta.id) * (oferta.selloutValor || 0);
  }, 0);

  const resumoPorFornecedor = useMemo(() => {
    const m = new Map<string, typeof filtradas>();
    filtradas.forEach((item) => {
      const key = item.oferta.selloutFornecedor || item.oferta.fornecedor || "—";
      const arr = m.get(key) ?? [];
      arr.push(item);
      m.set(key, arr);
    });
    return Array.from(m.entries())
      .map(([forn, itens]) => ({
        fornecedor: forn,
        itens,
        total: itens.reduce(
          (acc, it) => acc + getQtd(it.oferta.id) * (it.oferta.selloutValor || 0),
          0,
        ),
      }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, quantidades, acertos]);

  const toggleFornecedor = (forn: string) => {
    setFornecedoresAbertos((prev) => ({ ...prev, [forn]: !prev[forn] }));
  };

  const gerarTextoProduto = (item: (typeof filtradas)[number]) => {
    const { oferta, campanha, ultimaCampanha, ultimaQtd } = item;
    const qtd = getQtd(oferta.id);
    const total = qtd * (oferta.selloutValor || 0);
    const periodo = campanha
      ? `${fmtData(campanha.dataInicial)} a ${fmtData(campanha.dataFinal)}`
      : "";
    const historico = ultimaCampanha
      ? `\nNa última campanha (${ultimaCampanha.nome} — ${fmtData(ultimaCampanha.dataInicial)} a ${fmtData(ultimaCampanha.dataFinal)}) foram vendidas ${ultimaQtd} unidades deste produto.`
      : "";
    const precosTxt = [
      oferta.precoNormal > 0 ? `Preço normal de venda: ${brl(oferta.precoNormal)}` : "",
      oferta.precoPromocional > 0
        ? `Preço promocional praticado na ação: ${brl(oferta.precoPromocional)}${oferta.clubeSumel ? " (Clube Sumel)" : ""}`
        : "",
    ]
      .filter(Boolean)
      .map((p) => `\n${p}`)
      .join("");

    return {
      periodo,
      historico,
      qtd,
      total,
      linhaProduto: `Produto: ${oferta.descricao}\nCódigo interno: ${oferta.codigo || "—"}\nCódigo de barras: ${oferta.gtin || "—"}${precosTxt}\nQuantidade vendida: ${qtd} un\nVerba acordada: ${brl(oferta.selloutValor || 0)} por unidade\nTotal a repassar: ${brl(total)}${oferta.selloutObs ? `\nObservações: ${oferta.selloutObs}` : ""}${historico}`,
    };
  };

  const copiarTexto = async (item: (typeof filtradas)[number]) => {
    const { oferta, campanha } = item;
    const fornecedor = oferta.selloutFornecedor || oferta.fornecedor || "Fornecedor";
    const g = gerarTextoProduto(item);
    const texto = `Prezado(a) ${fornecedor},

Segue o acerto de sell out referente à campanha "${campanha?.nome ?? ""}"${g.periodo ? ` (${g.periodo})` : ""}.

${g.linhaProduto}

Solicitamos a gentileza de nos encaminhar a nota de débito / boleto correspondente.

Atenciosamente,
Central de Campanhas Sumel`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado", { description: "Cole no e-mail ou WhatsApp do fornecedor." });
    } catch {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  };

  const imprimirRelatorio = (grupo: (typeof resumoPorFornecedor)[number]) => {
    gerarRelatorioSelloutPDF({
      fornecedor: grupo.fornecedor,
      itens: grupo.itens,
      acertos,
    });
  };

  const copiarFornecedor = async (grupo: (typeof resumoPorFornecedor)[number]) => {
    const blocos = grupo.itens
      .map((it) => {
        const g = gerarTextoProduto(it);
        const camp = it.campanha ? `Campanha: ${it.campanha.nome}${g.periodo ? ` (${g.periodo})` : ""}\n` : "";
        return `${camp}${g.linhaProduto}`;
      })
      .join("\n\n----------\n\n");
    const texto = `Prezado(a) ${grupo.fornecedor},

Segue o acerto de sell out consolidado dos produtos abaixo:

${blocos}

Total geral a repassar: ${brl(grupo.total)}

Solicitamos a gentileza de nos encaminhar a nota de débito / boleto correspondente.

Atenciosamente,
Central de Campanhas Sumel`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem consolidada copiada", {
        description: `${grupo.itens.length} produto(s) de ${grupo.fornecedor}.`,
      });
    } catch {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  };

  return (
    <div className="space-y-6 flex flex-col pb-8">
      <PageHeader
        title="Acertos de Sell Out"
        description="Registre a quantidade vendida por produto e calcule a verba a cobrar de cada fornecedor."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-5 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{aba === "pendentes" ? "Pendentes de acerto" : "Acertos realizados"}</span>
              <div className="text-3xl font-bold text-navy">{ofertasSellOut.filter((o) => (aba === "pendentes" ? !o.baixado : o.baixado)).length}</div>
            </div>
            <div className="h-10 w-10 shrink-0 bg-primary/10 rounded-full flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-5 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total geral a cobrar (filtro)</span>
              <div className="text-3xl font-bold text-primary">{brl(totalGeral)}</div>
            </div>
            <div className="h-10 w-10 shrink-0 bg-emerald-500/10 rounded-full flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-5 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Fornecedores (filtro)</span>
              <div className="text-3xl font-bold text-navy">{resumoPorFornecedor.length}</div>
            </div>
            <div className="h-10 w-10 shrink-0 bg-primary/10 rounded-full flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-card p-4 rounded-xl shadow-sm border border-border/60">
        <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1 w-full lg:w-auto overflow-x-auto shrink-0">
          {(["pendentes", "historico"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAba(k)}
              className={`flex-1 lg:flex-none whitespace-nowrap rounded-md px-5 py-2 text-sm font-semibold transition-all ${
                aba === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {k === "pendentes" ? "Sell out pendentes" : "Histórico de acertos"}
            </button>
          ))}
        </div>

        <div className="flex flex-col w-full lg:w-auto md:flex-row gap-3">
          <div className="relative w-full md:flex-1 lg:w-56 xl:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar (produto, fornecedor...)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>
          <Select value={fornecedorFiltro} onValueChange={setFornecedorFiltro}>
            <SelectTrigger className="w-full md:flex-1 lg:w-[200px] xl:w-[220px] lg:flex-none h-10">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos">Todos os fornecedores</SelectItem>
              {fornecedoresDisponiveis.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-full md:flex-1 lg:w-[220px] xl:w-[250px] lg:flex-none h-10 border-primary/30 hover:border-primary/60 transition-colors">
              <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data-desc">Data da campanha (Mais recente)</SelectItem>
              <SelectItem value="data-asc">Data da campanha (Mais antiga)</SelectItem>
              <SelectItem value="total-desc">Maior total a cobrar</SelectItem>
              <SelectItem value="total-asc">Menor total a cobrar</SelectItem>
              <SelectItem value="qtd-desc">Maior quantidade vendida</SelectItem>
              <SelectItem value="fornecedor">Fornecedor (A–Z)</SelectItem>
              <SelectItem value="produto">Produto (A–Z)</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 px-3.5 border-border/60 shrink-0 gap-2">
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Colunas</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Colunas visíveis</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((col) => {
                const on = isVisible(col.key);
                return (
                  <DropdownMenuItem
                    key={col.key}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggle(col.key);
                    }}
                    className="flex items-center justify-between cursor-pointer text-xs py-1.5"
                  >
                    <span>{col.label}</span>
                    {on && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtradas.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10 bg-card rounded-xl border">
            {aba === "pendentes" ? "Nenhum sell out pendente com os filtros atuais." : "Nenhum acerto no histórico ainda."}
          </div>
        )}
        {filtradas.map((item) => {
          const { oferta, campanha, ultimaCampanha, ultimaQtd } = item;
          const qtd = getQtd(oferta.id);
          const total = qtd * (oferta.selloutValor || 0);

          return (
            <Card key={oferta.id} className="p-4 flex flex-col gap-3 shadow-sm border-border/60">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-medium text-navy leading-tight">{oferta.descricao}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {oferta.codigo || "—"}{oferta.gtin ? ` · ${oferta.gtin}` : ""}
                  </div>
                </div>
                {aba === "pendentes" ? (
                  <Button size="sm" onClick={() => darBaixa(oferta.id)} className="h-8 shrink-0">
                    Dar baixa
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => reabrir(oferta.id)} className="h-8 shrink-0">
                    Reabrir
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                <div>
                  <span className="text-muted-foreground block text-xs">Fornecedor</span>
                  <span className="truncate font-medium">{oferta.selloutFornecedor || oferta.fornecedor || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Campanha</span>
                  <span className="truncate font-medium">{campanha?.nome ?? "—"}</span>
                  {campanha && (
                    <div className="text-[10px] text-muted-foreground">
                      {fmtData(campanha.dataInicial)} a {fmtData(campanha.dataFinal)}
                    </div>
                  )}
                </div>
              </div>

              {(oferta.precoNormal > 0 || oferta.precoPromocional > 0) && (
                <div className="flex items-center justify-between text-xs bg-muted/20 px-2.5 py-1.5 rounded-md border border-border/40">
                  <span className="text-muted-foreground">
                    Normal: <span className="line-through">{oferta.precoNormal > 0 ? brl(oferta.precoNormal) : "—"}</span>
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Promo: {oferta.precoPromocional > 0 ? brl(oferta.precoPromocional) : "—"}
                    {oferta.clubeSumel && <span className="ml-1 text-[10px] font-normal text-purple-700 dark:text-purple-300">(Clube)</span>}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-2 bg-muted/30 p-2 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Verba / un</div>
                  <div className="font-medium text-sm">{brl(oferta.selloutValor || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Qtd. vendida</div>
                  <Input
                    type="number"
                    min={0}
                    value={quantidades[oferta.id] ?? (acertos[oferta.id]?.quantidadeVendida ?? "")}
                    onChange={(e) => setQtd(oferta.id, e.target.value)}
                    onBlur={() => salvar(oferta.id)}
                    className="h-8 w-full bg-background"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-1">
                <span className="text-sm font-semibold">Total a cobrar:</span>
                <span className="font-bold text-primary">{brl(total)}</span>
              </div>

              <div className="mt-1 text-xs border-t pt-2 border-border/50">
                <span className="text-muted-foreground block mb-1 font-medium">Histórico e ref:</span>
                {ultimaCampanha ? (
                  <span className="text-muted-foreground">
                    Na {ultimaCampanha.nome} vendeu {ultimaQtd} un.
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nenhum registro de campanhas passadas.</span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => copiarTexto(item)}
                className="w-full gap-2 mt-1 h-8"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar texto do produto
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="hidden md:block rounded-xl border border-border/60 shadow-sm bg-card overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30 [&>th]:h-9 [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-navy/70">
              {isVisible("produto") && <TableHead className="min-w-[200px]">Produto</TableHead>}
              {isVisible("campanha") && <TableHead className="min-w-[150px]">Campanha atual</TableHead>}
              {isVisible("fornecedor") && <TableHead className="min-w-[140px]">Fornecedor</TableHead>}
              {isVisible("precoNormal") && <TableHead className="text-right whitespace-nowrap min-w-[95px]">Preço Normal</TableHead>}
              {isVisible("precoPromocional") && <TableHead className="text-right whitespace-nowrap min-w-[100px]">Preço Promo</TableHead>}
              {isVisible("verba") && <TableHead className="text-right whitespace-nowrap min-w-[95px]">Verba / un</TableHead>}
              {isVisible("qtdVendida") && <TableHead className="w-32 whitespace-nowrap min-w-[120px]">Qtd. vendida</TableHead>}
              {isVisible("total") && <TableHead className="text-right whitespace-nowrap min-w-[110px]">Total a cobrar</TableHead>}
              {isVisible("ultimaCampanha") && <TableHead className="min-w-[140px]">Última campanha</TableHead>}
              <TableHead className="text-right whitespace-nowrap w-[170px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="text-center text-sm text-muted-foreground py-10">
                  {aba === "pendentes" ? "Nenhum sell out pendente com os filtros atuais." : "Nenhum acerto no histórico ainda."}
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((item) => {
              const { oferta, campanha, ultimaCampanha, ultimaQtd } = item;
              const qtd = getQtd(oferta.id);
              const total = qtd * (oferta.selloutValor || 0);
              return (
                <TableRow key={oferta.id} className="hover:bg-muted/20">
                  {isVisible("produto") && (
                    <TableCell className="py-2.5">
                      <div className="font-medium text-navy leading-snug line-clamp-2" title={oferta.descricao}>
                        {oferta.descricao}
                      </div>
                      <div className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
                        {oferta.codigo || "—"}{oferta.gtin ? ` · ${oferta.gtin}` : ""}
                      </div>
                    </TableCell>
                  )}
                  {isVisible("campanha") && (
                    <TableCell className="py-2.5">
                      <div className="text-sm font-medium leading-snug">{campanha?.nome ?? "—"}</div>
                      {campanha && (
                        <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {fmtData(campanha.dataInicial)} — {fmtData(campanha.dataFinal)}
                        </div>
                      )}
                    </TableCell>
                  )}
                  {isVisible("fornecedor") && (
                    <TableCell className="text-sm py-2.5 text-muted-foreground">
                      <span className="line-clamp-2" title={oferta.selloutFornecedor || oferta.fornecedor || "—"}>
                        {oferta.selloutFornecedor || oferta.fornecedor || "—"}
                      </span>
                    </TableCell>
                  )}
                  {isVisible("precoNormal") && (
                    <TableCell className="text-right text-sm py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">
                      {oferta.precoNormal > 0 ? brl(oferta.precoNormal) : "—"}
                    </TableCell>
                  )}
                  {isVisible("precoPromocional") && (
                    <TableCell className="text-right text-sm py-2.5 whitespace-nowrap tabular-nums">
                      {oferta.precoPromocional > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {brl(oferta.precoPromocional)}
                          </span>
                          {oferta.clubeSumel && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-purple-300 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/30">
                              Clube
                            </Badge>
                          )}
                          {oferta.tipoPromocao === "a_partir_de" && (
                            <span className="text-[10px] text-muted-foreground">
                              ≥ {oferta.quantidadeMinima} un
                            </span>
                          )}
                          {oferta.tipoPromocao === "a_cada" && (
                            <span className="text-[10px] text-muted-foreground">
                              {oferta.quantidadeMinima} un combo
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  {isVisible("verba") && (
                    <TableCell className="text-right text-sm py-2.5 whitespace-nowrap tabular-nums font-medium">
                      {brl(oferta.selloutValor || 0)}
                    </TableCell>
                  )}
                  {isVisible("qtdVendida") && (
                    <TableCell className="py-2.5 whitespace-nowrap">
                      <Input
                        type="number"
                        min={0}
                        value={quantidades[oferta.id] ?? (acertos[oferta.id]?.quantidadeVendida ?? "")}
                        onChange={(e) => setQtd(oferta.id, e.target.value)}
                        onBlur={() => salvar(oferta.id)}
                        className="h-8 w-28 bg-background tabular-nums"
                        placeholder="0"
                      />
                    </TableCell>
                  )}
                  {isVisible("total") && (
                    <TableCell className="text-right font-bold text-primary py-2.5 whitespace-nowrap tabular-nums">
                      {brl(total)}
                    </TableCell>
                  )}
                  {isVisible("ultimaCampanha") && (
                    <TableCell className="py-2.5">
                      {ultimaCampanha ? (
                        <div>
                          <div className="text-xs font-medium leading-snug">{ultimaCampanha.nome}</div>
                          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {fmtData(ultimaCampanha.dataInicial)} · vendeu <span className="font-semibold text-foreground">{ultimaQtd} un</span>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Sem histórico</Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right py-2.5 whitespace-nowrap">
                    <div className="flex justify-end items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copiarTexto(item)}
                        className="gap-1.5 h-8 px-2.5 text-xs shrink-0"
                        title="Copiar texto para WhatsApp / E-mail"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      {aba === "pendentes" ? (
                        <Button size="sm" onClick={() => darBaixa(oferta.id)} className="gap-1.5 h-8 px-2.5 text-xs shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Dar baixa
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => reabrir(oferta.id)} className="gap-1.5 h-8 px-2.5 text-xs shrink-0">
                          <Undo2 className="h-3.5 w-3.5" />
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {resumoPorFornecedor.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-navy mb-3 px-1">Resumo por fornecedor</h3>
          <div className="space-y-3">
            {resumoPorFornecedor.map((grupo) => {
              const aberto = fornecedoresAbertos[grupo.fornecedor] ?? false;
              return (
                <div key={grupo.fornecedor} className="rounded-xl shadow-sm border border-border/60 bg-card overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3">
                    <button
                      type="button"
                      onClick={() => toggleFornecedor(grupo.fornecedor)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {aberto ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-navy truncate">{grupo.fornecedor}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {grupo.itens.length} prod{grupo.itens.length > 1 ? "s" : ""}
                      </Badge>
                    </button>
                    <div className="flex items-center gap-3 pl-6 sm:pl-0">
                      <span className="text-sm font-bold text-primary mr-2">{brl(grupo.total)}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Baixar relatório em PDF"
                        onClick={() => imprimirRelatorio(grupo)}
                        className="shrink-0 h-8 w-8"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copiarFornecedor(grupo)}
                        className="gap-2 h-8 whitespace-nowrap"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Copiar msg</span>
                      </Button>
                    </div>
                  </div>
                  {aberto && (
                    <div className="border-t border-border/50">
                      {grupo.itens.map((it) => {
                        const qtd = getQtd(it.oferta.id);
                        const total = qtd * (it.oferta.selloutValor || 0);
                        return (
                          <div key={it.oferta.id} className="p-3 px-4 border-b border-border/50 last:border-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-navy leading-tight">{it.oferta.descricao}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {it.oferta.codigo || "—"}
                                {it.campanha && ` · ${it.campanha.nome}`}
                              </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-6 md:w-64">
                              <div className="text-sm text-right bg-muted/30 px-2 py-1 rounded">
                                <span className="text-muted-foreground md:hidden text-xs mr-2">Qtd x Verba:</span>
                                {qtd} x {brl(it.oferta.selloutValor || 0)}
                              </div>
                              <div className="text-sm font-semibold text-primary text-right w-24">
                                {brl(total)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
