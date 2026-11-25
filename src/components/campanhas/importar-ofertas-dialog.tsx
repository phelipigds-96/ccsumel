import { useState, useMemo, useEffect, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  Loader2,
  Barcode,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type Campanha,
  type Oferta,
  CATEGORIAS,
  FORNECEDORES,
  statusCampanha,
} from "./types";
import { campanhasStore } from "@/lib/campanhas-store";
import {
  findProdutosByCodigos,
  listProdutos,
  type Produto,
} from "@/lib/produtos";

interface ImportarOfertasDialogProps {
  campanha: Campanha;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (total: number) => void;
}

interface RawLine {
  lineNum: number;
  raw: string;
  parts: string[];
}

interface ParsedItem {
  lineNum: number;
  raw: string;
  codigo: string;
  gtin: string;
  descricao: string;
  fornecedor: string;
  custo: number;
  precoNormal: number;
  precoPromocional: number;
  categoria: string;
  descontoPct: number;
  status: "valido" | "erro" | "buscando";
  erro?: string;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNumBr = (n: number) =>
  n.toFixed(2).replace(".", ",");

function parsePrice(val: string): number {
  if (!val) return 0;
  let clean = val.replace(/R\$/gi, "").replace(/\s/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function detectCategoria(desc: string): string {
  const d = (desc || "").toLowerCase();
  if (
    d.includes("cervej") ||
    d.includes("refrig") ||
    d.includes("suco") ||
    d.includes("vinho") ||
    d.includes("vodka") ||
    d.includes("gin") ||
    d.includes("bebida") ||
    d.includes("whisky") ||
    d.includes("água") ||
    d.includes("energetic")
  ) {
    return "Bebidas";
  }
  if (
    d.includes("sabonete") ||
    d.includes("shampoo") ||
    d.includes("condicionador") ||
    d.includes("creme") ||
    d.includes("desodor") ||
    d.includes("fralda") ||
    d.includes("papel hig")
  ) {
    return "Higiene";
  }
  if (
    d.includes("deterg") ||
    d.includes("amaciante") ||
    d.includes("sabão") ||
    d.includes("desinfet") ||
    d.includes("alvej") ||
    d.includes("limp") ||
    d.includes("esponja")
  ) {
    return "Limpeza";
  }
  if (
    d.includes("queijo") ||
    d.includes("presunto") ||
    d.includes("manteiga") ||
    d.includes("iogurte") ||
    d.includes("requeij") ||
    d.includes("linguiça") ||
    d.includes("salame") ||
    d.includes("bacon") ||
    d.includes("carne") ||
    d.includes("frango")
  ) {
    return "Frios";
  }
  if (
    d.includes("pão") ||
    d.includes("bolo") ||
    d.includes("torta") ||
    d.includes("torrada") ||
    d.includes("biscoito") ||
    d.includes("bolacha")
  ) {
    return "Padaria";
  }
  if (
    d.includes("maçã") ||
    d.includes("banana") ||
    d.includes("tomate") ||
    d.includes("batata") ||
    d.includes("cebola") ||
    d.includes("laranja") ||
    d.includes("alface") ||
    d.includes("cenoura") ||
    d.includes("uva") ||
    d.includes("melancia")
  ) {
    return "Hortifruti";
  }
  return "Mercearia";
}

function splitRow(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((s) => s.trim());
  }
  if (line.includes(";")) {
    return line.split(";").map((s) => s.trim());
  }
  if (line.includes("|")) {
    return line.split("|").map((s) => s.trim());
  }
  return line.split(",").map((s) => s.trim());
}

function isHeader(parts: string[]): boolean {
  const p0 = (parts[0] || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const joined = parts
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/^\d+$/.test(p0)) return false;
  return (
    p0.includes("cod") ||
    p0.includes("item") ||
    joined.includes("preco") ||
    joined.includes("promo") ||
    joined.includes("desc")
  );
}

const EXEMPLO_FALLBACK = `102030;18,90;14,99
102031;5,40;4,29
102032;29,90;24,90`;

export function ImportarOfertasDialog({
  campanha,
  open,
  onOpenChange,
  onSuccess,
}: ImportarOfertasDialogProps) {
  const [texto, setTexto] = useState("");
  const [clubeSumel, setClubeSumel] = useState(campanha.clubeSumel ?? false);
  const [produtosMap, setProdutosMap] = useState<Map<string, Produto>>(new Map());
  const [attemptedCodes, setAttemptedCodes] = useState<Set<string>>(new Set());
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [loadingExemplo, setLoadingExemplo] = useState(false);
  const attemptedRef = useRef<Set<string>>(new Set());

  // Reinicia cache de tentativa ao abrir o modal para garantir dados atualizados do catálogo
  useEffect(() => {
    if (open) {
      setClubeSumel(campanha.clubeSumel ?? false);
      attemptedRef.current = new Set();
      setAttemptedCodes(new Set());
      setProdutosMap(new Map());
    }
  }, [open, campanha.clubeSumel]);

  const rawLines = useMemo<RawLine[]>(() => {
    if (!texto.trim()) return [];
    const lines = texto.split(/\r?\n/);
    const out: RawLine[] = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parts = splitRow(trimmed);
      if (out.length === 0 && isHeader(parts)) return;
      out.push({ lineNum: idx + 1, raw: trimmed, parts });
    });
    return out;
  }, [texto]);

  const codigosParaBuscar = useMemo(() => {
    const set = new Set<string>();
    for (const row of rawLines) {
      if (row.parts.length >= 3 && row.parts[0]) {
        set.add(row.parts[0].trim());
      }
    }
    return Array.from(set);
  }, [rawLines]);

  useEffect(() => {
    if (!open) return;
    const pendentes = codigosParaBuscar.filter((c) => !attemptedRef.current.has(c));
    if (pendentes.length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingLookup(true);
      try {
        const encontrados = await findProdutosByCodigos(pendentes);
        if (cancelled) return;

        for (const c of pendentes) {
          attemptedRef.current.add(c);
        }
        setAttemptedCodes(new Set(attemptedRef.current));

        if (encontrados.size > 0) {
          setProdutosMap((prev) => {
            const next = new Map(prev);
            encontrados.forEach((val, key) => next.set(key, val));
            return next;
          });
        }
      } catch (err) {
        console.error("Erro ao consultar catálogo de produtos:", err);
        if (!cancelled) {
          toast.error("Não foi possível consultar o Catálogo de Produtos.");
        }
      } finally {
        if (!cancelled) setLoadingLookup(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [codigosParaBuscar, open]);

  const parsed = useMemo<ParsedItem[]>(() => {
    return rawLines.map(({ lineNum, raw, parts }) => {
      if (parts.length < 3) {
        return {
          lineNum,
          raw,
          codigo: parts[0] || "",
          gtin: "",
          descricao: "",
          fornecedor: FORNECEDORES[0],
          custo: 0,
          precoNormal: 0,
          precoPromocional: 0,
          categoria: "Mercearia",
          descontoPct: 0,
          status: "erro",
          erro: `Esperado 3 campos (código interno;preço normal;preço promo), encontrados ${parts.length}.`,
        };
      }

      const codigoTerm = parts[0].trim();
      if (!codigoTerm) {
        return {
          lineNum,
          raw,
          codigo: "",
          gtin: "",
          descricao: "",
          fornecedor: FORNECEDORES[0],
          custo: 0,
          precoNormal: 0,
          precoPromocional: 0,
          categoria: "Mercearia",
          descontoPct: 0,
          status: "erro",
          erro: "Código interno não informado.",
        };
      }

      const isLegacy4Cols = parts.length >= 4;
      const precoNormalInput = parsePrice(isLegacy4Cols ? parts[2] : parts[1]);
      const precoPromoInput = parsePrice(isLegacy4Cols ? parts[3] : parts[2]);
      const manualDesc = isLegacy4Cols ? parts[1].trim() : "";

      const prod = produtosMap.get(codigoTerm);
      const jaConsultado = attemptedCodes.has(codigoTerm);

      if (!prod && !jaConsultado) {
        return {
          lineNum,
          raw,
          codigo: codigoTerm,
          gtin: "",
          descricao: manualDesc || "Consultando catálogo...",
          fornecedor: FORNECEDORES[0],
          custo: 0,
          precoNormal: precoNormalInput,
          precoPromocional: precoPromoInput,
          categoria: "Mercearia",
          descontoPct: 0,
          status: "buscando",
        };
      }

      if (!prod && !manualDesc) {
        return {
          lineNum,
          raw,
          codigo: codigoTerm,
          gtin: "",
          descricao: "",
          fornecedor: FORNECEDORES[0],
          custo: 0,
          precoNormal: precoNormalInput,
          precoPromocional: precoPromoInput,
          categoria: "Mercearia",
          descontoPct: 0,
          status: "erro",
          erro: `Código interno "${codigoTerm}" não encontrado no Catálogo de Produtos.`,
        };
      }

      const codigoFinal = prod?.codigo?.trim() || codigoTerm;
      const gtinFinal = prod?.gtin?.trim() || "";
      const descricaoFinal = prod?.descricao?.trim() || manualDesc;
      const fornecedorFinal = prod?.fornecedor?.trim() || FORNECEDORES[0];
      const custoFinal = Number(prod?.custo) || 0;
      const precoNormalFinal =
        precoNormalInput > 0 ? precoNormalInput : Number(prod?.preco_venda) || 0;

      if (precoPromoInput <= 0) {
        return {
          lineNum,
          raw,
          codigo: codigoFinal,
          gtin: gtinFinal,
          descricao: descricaoFinal,
          fornecedor: fornecedorFinal,
          custo: custoFinal,
          precoNormal: precoNormalFinal,
          precoPromocional: precoPromoInput,
          categoria: detectCategoria(descricaoFinal),
          descontoPct: 0,
          status: "erro",
          erro: "Preço promocional deve ser maior que zero.",
        };
      }

      const descontoPct =
        precoNormalFinal > 0 && precoPromoInput < precoNormalFinal
          ? Math.round((1 - precoPromoInput / precoNormalFinal) * 100)
          : 0;

      return {
        lineNum,
        raw,
        codigo: codigoFinal,
        gtin: gtinFinal,
        descricao: descricaoFinal,
        fornecedor: fornecedorFinal,
        custo: custoFinal,
        precoNormal: precoNormalFinal,
        precoPromocional: precoPromoInput,
        categoria: detectCategoria(descricaoFinal),
        descontoPct,
        status: "valido",
      };
    });
  }, [rawLines, produtosMap, attemptedCodes]);

  const validos = useMemo(() => parsed.filter((p) => p.status === "valido"), [parsed]);
  const invalidos = useMemo(() => parsed.filter((p) => p.status === "erro"), [parsed]);
  const buscandoCount = useMemo(() => parsed.filter((p) => p.status === "buscando").length, [parsed]);

  const handlePreencherExemplo = async () => {
    setLoadingExemplo(true);
    try {
      const { rows } = await listProdutos("", 1, 10);
      const comCodigo = rows.filter((p) => !!p.codigo?.trim()).slice(0, 4);
      if (comCodigo.length > 0) {
        const linhas = comCodigo.map((p) => {
          const base = Number(p.preco_venda) > 0 ? Number(p.preco_venda) : 14.9;
          const promo = Math.max(0.99, Number((base * 0.85).toFixed(2)));
          return `${p.codigo};${fmtNumBr(base)};${fmtNumBr(promo)}`;
        });
        setTexto(linhas.join("\n"));
      } else {
        setTexto(EXEMPLO_FALLBACK);
      }
    } catch {
      setTexto(EXEMPLO_FALLBACK);
    } finally {
      setLoadingExemplo(false);
    }
  };

  const handleImport = () => {
    if (validos.length === 0) return;

    const novasOfertas: Oferta[] = validos.map((item) => ({
      id: crypto.randomUUID(),
      campanhaId: campanha.id,
      codigo: item.codigo,
      gtin: item.gtin,
      gtinsCresceVendas: "",
      descricao: item.descricao,
      fornecedor: item.fornecedor || FORNECEDORES[0],
      categoria: item.categoria || CATEGORIAS[0],
      precoNormal: item.precoNormal,
      custo: item.custo,
      precoPromocional: item.precoPromocional,
      tipoPromocao: "simples",
      quantidadeMinima: 1,
      clubeSumel,
      dataInicial: campanha.dataInicial,
      dataFinal: campanha.dataFinal,
      filiais: [...(campanha.filiais ?? [])],
      corredor: "",
      estoque: 0,
      margem: 0,
      status: statusCampanha(campanha),
      selloutTemVerba: false,
      selloutFornecedor: "",
      selloutValor: 0,
      selloutObs: "",
    }));

    campanhasStore.setOfertas((prev) => [...novasOfertas, ...prev]);

    toast.success(
      `${novasOfertas.length} oferta(s) importada(s) com sucesso na campanha "${campanha.nome}"!`
    );

    if (onSuccess) {
      onSuccess(novasOfertas.length);
    }

    setTexto("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-navy text-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Importar Ofertas em Lote
          </DialogTitle>
          <DialogDescription>
            Cole suas ofertas no formato{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-navy font-semibold text-xs">
              código interno;preço normal;preço promo
            </code>
            . A descrição e o código de barras são preenchidos automaticamente pelo Catálogo de Produtos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Instruções e Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-navy">Área de Colagem:</span>
              <span className="text-[11px] text-muted-foreground">
                (uma oferta por linha · também aceita colar 3 colunas do Excel)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePreencherExemplo}
                disabled={loadingExemplo}
                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                {loadingExemplo ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                Preencher Exemplo
              </Button>
              {texto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTexto("")}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={`Cole aqui as ofertas...\nFormato: código interno;preço normal;preço promo\nExemplo:\n12345;8,99;6,99\n67890;22,50;18,90`}
            rows={6}
            className="w-full rounded-xl border border-input bg-card p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {/* Opções adicionais de importação */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3.5 py-2.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clubeSumel}
                onChange={(e) => setClubeSumel(e.target.checked)}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
              <span className="font-medium text-navy">
                Marcar produtos como exclusivos <strong>Clube Sumel</strong>
              </span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              Vigência e filiais seguirão o padrão desta campanha.
            </span>
          </div>

          {/* Pré-visualização dos dados parseados */}
          {parsed.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-navy">
                    Pré-visualização do Reconhecimento:
                  </span>
                  {(loadingLookup || buscandoCount > 0) && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] gap-1"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Consultando catálogo...
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {validos.length} válido(s)
                  </Badge>
                  {invalidos.length > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] gap-1"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {invalidos.length} com erro
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabela de pré-visualização */}
              <div className="rounded-xl border bg-card overflow-hidden max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[48px] text-xs">Linha</TableHead>
                      <TableHead className="w-[95px] text-xs">Cód. Interno</TableHead>
                      <TableHead className="w-[130px] text-xs">Cód. Barras</TableHead>
                      <TableHead className="text-xs">Descrição (Catálogo)</TableHead>
                      <TableHead className="text-right w-[90px] text-xs">Preço De</TableHead>
                      <TableHead className="text-right w-[90px] text-xs">Preço Por</TableHead>
                      <TableHead className="text-center w-[75px] text-xs">Desc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((item) => {
                      if (item.status === "buscando") {
                        return (
                          <TableRow key={`wait-${item.lineNum}`} className="opacity-70">
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {item.lineNum}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-navy">
                              {item.codigo}
                            </TableCell>
                            <TableCell colSpan={5} className="text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Buscando descrição e código de barras no catálogo...
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      if (item.status === "erro") {
                        return (
                          <TableRow
                            key={`err-${item.lineNum}`}
                            className="bg-destructive/5 text-destructive hover:bg-destructive/10"
                          >
                            <TableCell className="font-mono text-xs">{item.lineNum}</TableCell>
                            <TableCell colSpan={6} className="text-xs">
                              <span className="font-semibold">Erro:</span> {item.erro}
                              <span className="block font-mono text-[10px] text-muted-foreground mt-0.5 truncate max-w-lg">
                                {item.raw}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={`ok-${item.lineNum}`} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.lineNum}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-navy font-medium">
                            {item.codigo}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {item.gtin ? (
                              <span className="inline-flex items-center gap-1">
                                <Barcode className="h-3 w-3 text-muted-foreground/70" />
                                {item.gtin}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600">Sem barras</span>
                            )}
                          </TableCell>
                          <TableCell
                            className="text-xs font-medium text-navy max-w-[240px] truncate"
                            title={item.descricao}
                          >
                            {item.descricao}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground line-through">
                            {item.precoNormal > 0 ? brl(item.precoNormal) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums font-bold text-primary">
                            {brl(item.precoPromocional)}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.descontoPct > 0 ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] font-bold py-0 px-1.5 h-4">
                                -{item.descontoPct}%
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 px-6 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {validos.length > 0 && (
              <span>
                Total a importar: <strong>{validos.length} produto(s)</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={loadingLookup || buscandoCount > 0 || validos.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Importar {validos.length > 0 ? `(${validos.length})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
