import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function AcertosSellOut() {
  const { campanhas, ofertas, acertos } = useCampanhasStore();
  const [busca, setBusca] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});

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
        // Última campanha do produto (excluindo atual): mesma chave (codigo+gtin), data final < atual
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
        return { oferta: o, campanha, ultima, ultimaCampanha, ultimaQtd };
      });
  }, [ofertas, acertos, campanhaById]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ofertasSellOut;
    return ofertasSellOut.filter(({ oferta, campanha }) =>
      [
        oferta.descricao,
        oferta.codigo,
        oferta.gtin,
        oferta.fornecedor,
        oferta.selloutFornecedor,
        campanha?.nome ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [ofertasSellOut, busca]);

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

  const totalGeral = filtradas.reduce((acc, { oferta }) => {
    return acc + getQtd(oferta.id) * (oferta.selloutValor || 0);
  }, 0);

  const totalPorFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    filtradas.forEach(({ oferta }) => {
      const key = oferta.selloutFornecedor || oferta.fornecedor || "—";
      const v = getQtd(oferta.id) * (oferta.selloutValor || 0);
      m.set(key, (m.get(key) ?? 0) + v);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, quantidades, acertos]);

  const copiarTexto = async (item: (typeof ofertasSellOut)[number]) => {
    const { oferta, campanha, ultimaCampanha, ultimaQtd } = item;
    const qtd = getQtd(oferta.id);
    const total = qtd * (oferta.selloutValor || 0);
    const fornecedor = oferta.selloutFornecedor || oferta.fornecedor || "Fornecedor";
    const periodo =
      campanha ? `${fmtData(campanha.dataInicial)} a ${fmtData(campanha.dataFinal)}` : "";
    const historico = ultimaCampanha
      ? `\nNa última campanha (${ultimaCampanha.nome} — ${fmtData(ultimaCampanha.dataInicial)} a ${fmtData(ultimaCampanha.dataFinal)}) foram vendidas ${ultimaQtd} unidades deste produto.`
      : "";
    const texto = `Prezado(a) ${fornecedor},

Segue o acerto de sell out referente à campanha "${campanha?.nome ?? ""}"${periodo ? ` (${periodo})` : ""}.

Produto: ${oferta.descricao}
Código interno: ${oferta.codigo || "—"}
Código de barras: ${oferta.gtin || "—"}
Quantidade vendida: ${qtd} un
Verba acordada: ${brl(oferta.selloutValor || 0)} por unidade
Total a repassar: ${brl(total)}${oferta.selloutObs ? `\nObservações: ${oferta.selloutObs}` : ""}${historico}

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

  return (
    <div>
      <PageHeader
        title="Acertos de Sell Out"
        description="Registre a quantidade vendida por produto e calcule a verba a cobrar de cada fornecedor."
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Produtos com verba</div>
            <div className="mt-1 text-2xl font-bold text-navy">{ofertasSellOut.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total geral a cobrar</div>
            <div className="mt-1 text-2xl font-bold text-primary">{brl(totalGeral)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Fornecedores</div>
            <div className="mt-1 text-2xl font-bold text-navy">{totalPorFornecedor.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por produto, fornecedor ou campanha..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
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
                  Nenhum produto com sell out marcado.
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copiarTexto(item)}
                      className="gap-2"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPorFornecedor.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-navy mb-2">Resumo por fornecedor</h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {totalPorFornecedor.map(([forn, val]) => (
              <div
                key={forn}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <span className="text-sm font-medium">{forn}</span>
                <span className="text-sm font-bold text-primary">{brl(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
