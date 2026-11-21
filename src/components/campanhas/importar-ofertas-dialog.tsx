import { useState, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  Tag,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

interface ImportarOfertasDialogProps {
  campanha: Campanha;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (total: number) => void;
}

interface ParsedItem {
  lineNum: number;
  raw: string;
  codigo: string;
  descricao: string;
  precoNormal: number;
  precoPromocional: number;
  categoria: string;
  descontoPct: number;
  valido: boolean;
  erro?: string;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const p0 = (parts[0] || "").toLowerCase();
  const p1 = (parts[1] || "").toLowerCase();
  return (
    p0.includes("cod") ||
    p0.includes("cód") ||
    p0.includes("item") ||
    p1.includes("desc") ||
    p1.includes("prod") ||
    p1.includes("nome")
  );
}

const EXEMPLO_TEXTO = `7891000100103;Leite Condensado Moça 395g;8,99;6,99
7891000200204;Café Pilão Tradicional 500g;22,50;18,90
001234;Arroz Tio João Tipo 1 5kg;29,90;24,90
7894900010015;Refrigerante Coca-Cola 2L;9,99;7,99
7891035000508;Sabão em Pó Omo Lavagem Perfeita 1.6kg;26,90;21,90`;

export function ImportarOfertasDialog({
  campanha,
  open,
  onOpenChange,
  onSuccess,
}: ImportarOfertasDialogProps) {
  const [texto, setTexto] = useState("");
  const [clubeSumel, setClubeSumel] = useState(campanha.clubeSumel ?? false);

  const parsed = useMemo(() => {
    if (!texto.trim()) return [];

    const lines = texto.split(/\r?\n/);
    const results: ParsedItem[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = splitRow(trimmed);

      // Pula linha de cabeçalho
      if (idx === 0 && isHeader(parts)) {
        return;
      }

      const lineNum = idx + 1;

      if (parts.length < 4) {
        results.push({
          lineNum,
          raw: trimmed,
          codigo: parts[0] || "",
          descricao: parts[1] || "",
          precoNormal: 0,
          precoPromocional: 0,
          categoria: "Mercearia",
          descontoPct: 0,
          valido: false,
          erro: `Esperado 4 campos (código;descrição;preço normal;preço promo), encontrados ${parts.length}.`,
        });
        return;
      }

      const codigo = parts[0];
      const descricao = parts[1];
      const precoNormal = parsePrice(parts[2]);
      const precoPromocional = parsePrice(parts[3]);

      if (!codigo) {
        results.push({
          lineNum,
          raw: trimmed,
          codigo: "",
          descricao,
          precoNormal,
          precoPromocional,
          categoria: "Mercearia",
          descontoPct: 0,
          valido: false,
          erro: "Código do produto não informado.",
        });
        return;
      }

      if (!descricao) {
        results.push({
          lineNum,
          raw: trimmed,
          codigo,
          descricao: "",
          precoNormal,
          precoPromocional,
          categoria: "Mercearia",
          descontoPct: 0,
          valido: false,
          erro: "Descrição do produto não informada.",
        });
        return;
      }

      if (precoPromocional <= 0) {
        results.push({
          lineNum,
          raw: trimmed,
          codigo,
          descricao,
          precoNormal,
          precoPromocional,
          categoria: "Mercearia",
          descontoPct: 0,
          valido: false,
          erro: "Preço promocional deve ser maior que zero.",
        });
        return;
      }

      const descontoPct =
        precoNormal > 0 && precoPromocional < precoNormal
          ? Math.round((1 - precoPromocional / precoNormal) * 100)
          : 0;

      results.push({
        lineNum,
        raw: trimmed,
        codigo,
        descricao,
        precoNormal,
        precoPromocional,
        categoria: detectCategoria(descricao),
        descontoPct,
        valido: true,
      });
    });

    return results;
  }, [texto]);

  const validos = useMemo(() => parsed.filter((p) => p.valido), [parsed]);
  const invalidos = useMemo(() => parsed.filter((p) => !p.valido), [parsed]);

  const handleImport = () => {
    if (validos.length === 0) return;

    const novasOfertas: Oferta[] = validos.map((item) => ({
      id: crypto.randomUUID(),
      campanhaId: campanha.id,
      codigo: item.codigo,
      gtin: item.codigo.length >= 8 ? item.codigo : "",
      gtinsCresceVendas: "",
      descricao: item.descricao,
      fornecedor: FORNECEDORES[0],
      categoria: item.categoria || CATEGORIAS[0],
      precoNormal: item.precoNormal,
      custo: 0,
      precoPromocional: item.precoPromocional,
      tipoPromocao: "simples",
      quantidadeMinima: 1,
      clubeSumel: clubeSumel,
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
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-navy text-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Importar Ofertas em Lote
          </DialogTitle>
          <DialogDescription>
            Cole suas ofertas no formato{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-navy font-semibold text-xs">
              código;descrição;preço normal;preço promo
            </code>
            . Também suporta colar direto de colunas do Excel ou Google Sheets.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Instruções e Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-navy">Área de Colagem:</span>
              <span className="text-[11px] text-muted-foreground">
                (uma oferta por linha)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTexto(EXEMPLO_TEXTO)}
                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Preencher Exemplo
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
            placeholder={`Cole aqui as ofertas...\nExemplo:\n7891000100103;Leite Condensado Moça 395g;8,99;6,99\n7891000200204;Café Pilão Tradicional 500g;22,50;18,90`}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-navy">
                    Pré-visualização do Reconhecimento:
                  </span>
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
              <div className="rounded-xl border bg-card overflow-hidden max-h-56 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[50px] text-xs">Linha</TableHead>
                      <TableHead className="w-[120px] text-xs">Código</TableHead>
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="w-[100px] text-xs">Categoria</TableHead>
                      <TableHead className="text-right w-[100px] text-xs">Preço De</TableHead>
                      <TableHead className="text-right w-[100px] text-xs">Preço Por</TableHead>
                      <TableHead className="text-center w-[80px] text-xs">Desconto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((item) => {
                      if (!item.valido) {
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
                          <TableCell className="text-xs font-medium text-navy max-w-[240px] truncate" title={item.descricao}>
                            {item.descricao}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.categoria}
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
              disabled={validos.length === 0}
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
