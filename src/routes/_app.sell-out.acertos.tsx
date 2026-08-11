import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Search, ChevronDown, ChevronRight, ArrowUpDown, CheckCircle2, Undo2, FileText } from "lucide-react";
import { gerarRelatorioSelloutPDF } from "@/components/sellout-report-generator";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  useCampanhasStore,
  campanhasStore,
  type Oferta,
  type Campanha,
} from "@/lib/campanhas-store";

export const Route = createFileRoute("/_app/sell-out/acertos")({
  head: () => ({
    meta: [
      { title: "Acertos de Sell Out — SGMC" },
      { name: "description", content: "Calcule a verba de sell out a cobrar de cada fornecedor." },
      { property: "og:title", content: "Acertos de Sell Out — SGMC" },
      { property: "og:description", content: "Calcule a verba de sell out a cobrar de cada fornecedor." },
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

type SortKey = "produto" | "fornecedor" | "total-desc" | "total-asc" | "qtd-desc";

function AcertosSellOut() {
  const { campanhas, ofertas, acertos } = useCampanhasStore();
  const [busca, setBusca] = useState("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>("__todos");
  const [sortKey, setSortKey] = useState<SortKey>("total-desc");
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [fornecedoresAbertos, setFornecedoresAbertos] = useState<Record<string, boolean>>({});
  const [aba, setAba] = useState<"pendentes" | "historico">("pendentes");

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

  const salvar = (id: string) => {
    const qtd = getQtd(id);
    campanhasStore.setAcerto(id, qtd);
    toast.success("Acerto salvo", { description: `Quantidade registrada: ${qtd}` });
  };

  const darBaixa = (id: string) => {
    campanhasStore.setAcerto(id, getQtd(id));
    campanhasStore.setBaixaAcerto(id, true);
    toast.success("Baixa registrada", { description: "O produto foi movido para o histórico de acertos." });
  };

  const reabrir = (id: string) => {
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
    return {
      periodo,
      historico,
      qtd,
      total,
      linhaProduto: `Produto: ${oferta.descricao}\nCódigo interno: ${oferta.codigo || "—"}\nCódigo de barras: ${oferta.gtin || "—"}\nQuantidade vendida: ${qtd} un\nVerba acordada: ${brl(oferta.selloutValor || 0)} por unidade\nTotal a repassar: ${brl(total)}${oferta.selloutObs ? `\nObservações: ${oferta.selloutObs}` : ""}${historico}`,
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
    <div>
      <PageHeader
        title="Acertos de Sell Out"
        description="Registre a quantidade vendida por produto e calcule a verba a cobrar de cada fornecedor."
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{aba === "pendentes" ? "Pendentes de acerto" : "Acertos realizados"}</div>
            <div className="mt-1 text-2xl font-bold text-navy">{ofertasSellOut.filter((o) => (aba === "pendentes" ? !o.baixado : o.baixado)).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total geral a cobrar (filtro atual)</div>
            <div className="mt-1 text-2xl font-bold text-primary">{brl(totalGeral)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Fornecedores (filtro atual)</div>
            <div className="mt-1 text-2xl font-bold text-navy">{resumoPorFornecedor.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
        {(["pendentes", "historico"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              aba === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "pendentes" ? "Sell out pendentes" : "Histórico de acertos"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto, código, campanha..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={fornecedorFiltro} onValueChange={setFornecedorFiltro}>
          <SelectTrigger className="md:w-64">
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
          <SelectTrigger className="md:w-56">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total-desc">Maior total a cobrar</SelectItem>
            <SelectItem value="total-asc">Menor total a cobrar</SelectItem>
            <SelectItem value="qtd-desc">Maior quantidade vendida</SelectItem>
            <SelectItem value="fornecedor">Fornecedor (A–Z)</SelectItem>
            <SelectItem value="produto">Produto (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Campanha atual</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Verba / un</TableHead>
              <TableHead className="w-32">Qtd. vendida</TableHead>
              <TableHead className="text-right">Total a cobrar</TableHead>
              <TableHead>Última campanha</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                  {aba === "pendentes" ? "Nenhum sell out pendente com os filtros atuais." : "Nenhum acerto no histórico ainda."}
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((item) => {
              const { oferta, campanha, ultimaCampanha, ultimaQtd } = item;
              const qtd = getQtd(oferta.id);
              const total = qtd * (oferta.selloutValor || 0);
              return (
                <TableRow key={oferta.id}>
                  <TableCell>
                    <div className="font-medium text-navy">{oferta.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {oferta.codigo || "—"}{oferta.gtin ? ` · ${oferta.gtin}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{campanha?.nome ?? "—"}</div>
                    {campanha && (
                      <div className="text-xs text-muted-foreground">
                        {fmtData(campanha.dataInicial)} — {fmtData(campanha.dataFinal)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {oferta.selloutFornecedor || oferta.fornecedor || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{brl(oferta.selloutValor || 0)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={quantidades[oferta.id] ?? (acertos[oferta.id]?.quantidadeVendida ?? "")}
                      onChange={(e) => setQtd(oferta.id, e.target.value)}
                      onBlur={() => salvar(oferta.id)}
                      className="h-9 w-28"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {brl(total)}
                  </TableCell>
                  <TableCell>
                    {ultimaCampanha ? (
                      <div>
                        <div className="text-sm">{ultimaCampanha.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtData(ultimaCampanha.dataInicial)} · vendeu {ultimaQtd} un
                        </div>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Sem histórico</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copiarTexto(item)}
                        className="gap-2"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      {aba === "pendentes" ? (
                        <Button size="sm" onClick={() => darBaixa(oferta.id)} className="gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Dar baixa
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => reabrir(oferta.id)} className="gap-2">
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
          <h3 className="text-sm font-semibold text-navy mb-3">Resumo por fornecedor</h3>
          <div className="space-y-3">
            {resumoPorFornecedor.map((grupo) => {
              const aberto = fornecedoresAbertos[grupo.fornecedor] ?? false;
              return (
                <div key={grupo.fornecedor} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleFornecedor(grupo.fornecedor)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {aberto ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold text-navy">{grupo.fornecedor}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {grupo.itens.length} produto{grupo.itens.length > 1 ? "s" : ""}
                      </Badge>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">{brl(grupo.total)}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => imprimirRelatorio(grupo)}
                        className="gap-2"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Relatório PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copiarFornecedor(grupo)}
                        className="gap-2"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar mensagem
                      </Button>
                    </div>
                  </div>
                  {aberto && (
                    <div className="border-t px-4 py-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Campanha</TableHead>
                            <TableHead className="text-right">Qtd.</TableHead>
                            <TableHead className="text-right">Verba/un</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupo.itens.map((it) => {
                            const qtd = getQtd(it.oferta.id);
                            const total = qtd * (it.oferta.selloutValor || 0);
                            return (
                              <TableRow key={it.oferta.id}>
                                <TableCell>
                                  <div className="text-sm font-medium">{it.oferta.descricao}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {it.oferta.codigo || "—"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{it.campanha?.nome ?? "—"}</TableCell>
                                <TableCell className="text-right text-sm">{qtd}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {brl(it.oferta.selloutValor || 0)}
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold text-primary">
                                  {brl(total)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
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
