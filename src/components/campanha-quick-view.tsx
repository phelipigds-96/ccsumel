import { Printer, ChevronRight, Paperclip, FileText, Image as ImageIcon, MapPin, Pencil } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import type { Campanha, Oferta, MaterialApoio } from "@/lib/campanhas-store";
import { formatFiliais, fmtCondicaoOferta } from "@/lib/campanhas-store";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (s: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

/** Limpa o texto para o PDF: remove caracteres de controle e colapsa espaços. */
export const pdfText = (v: unknown) =>
  String(v ?? "")
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function printCampanhaPDF(campanha: Campanha, ofertas: Oferta[]) {
  // Abre a aba SINCRONAMENTE dentro do clique para não ser bloqueada pelo navegador
  const win = window.open("", "_blank");

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 32;

  const periodo = `${fmtDate(campanha.dataInicial)} a ${fmtDate(campanha.dataFinal)}`;
  const mesmoPeriodo = ofertas.every(
    (o) => o.dataInicial === campanha.dataInicial && o.dataFinal === campanha.dataFinal,
  );

  const head = mesmoPeriodo
    ? [["Código", "Descrição do Produto", "Clube", "De", "Por", "% Desc.", "Condição"]]
    : [["Código", "Descrição do Produto", "Clube", "De", "Por", "% Desc.", "Condição", "Período"]];

  const body = ofertas.map((o) => {
    const desconto = o.precoNormal > 0 && o.precoPromocional > 0 && o.precoPromocional < o.precoNormal
      ? Math.round((1 - o.precoPromocional / o.precoNormal) * 100)
      : 0;

    const condicao = (() => {
      if (o.tipoPromocao === "a_partir_de") {
        return `A partir de ${o.quantidadeMinima} un`;
      }
      if (o.tipoPromocao === "a_cada") {
        const total = (o.quantidadeMinima || 1) * o.precoPromocional;
        return `A cada ${o.quantidadeMinima} un (${o.quantidadeMinima} por ${brl(total)})`;
      }
      return "Preço direto";
    })();

    const base = [
      pdfText(o.codigo),
      pdfText(o.descricao),
      o.clubeSumel ? "SIM" : "—",
      brl(o.precoNormal),
      brl(o.precoPromocional),
      desconto > 0 ? `-${desconto}%` : "—",
      condicao,
    ];
    return mesmoPeriodo
      ? base
      : [...base, `${fmtDate(o.dataInicial)} a ${fmtDate(o.dataFinal)}`];
  });

  autoTable(doc, {
    head,
    body,
    startY: 96,
    margin: { top: 96, right: M, bottom: 44, left: M },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [222, 226, 233],
      lineWidth: 0.5,
      textColor: [20, 26, 40],
    },
    headStyles: {
      fillColor: [11, 31, 58], // Navy institucional Sumel
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: mesmoPeriodo
      ? {
          0: { cellWidth: 46, halign: "center" }, // Código
          1: { cellWidth: "auto" }, // Descrição
          2: { cellWidth: 36, halign: "center" }, // Clube
          3: { cellWidth: 55, halign: "right", textColor: [120, 128, 140] }, // De
          4: { cellWidth: 58, halign: "right", fontStyle: "bold", textColor: [200, 16, 46] }, // Por
          5: { cellWidth: 46, halign: "center", fontStyle: "bold", textColor: [13, 148, 136] }, // % Desc.
          6: { cellWidth: 94, halign: "center", fontSize: 8 }, // Condição
        }
      : {
          0: { cellWidth: 42, halign: "center" }, // Código
          1: { cellWidth: "auto" }, // Descrição
          2: { cellWidth: 32, halign: "center" }, // Clube
          3: { cellWidth: 50, halign: "right", textColor: [120, 128, 140] }, // De
          4: { cellWidth: 54, halign: "right", fontStyle: "bold", textColor: [200, 16, 46] }, // Por
          5: { cellWidth: 42, halign: "center", fontStyle: "bold", textColor: [13, 148, 136] }, // % Desc.
          6: { cellWidth: 80, halign: "center", fontSize: 7.5 }, // Condição
          7: { cellWidth: 70, halign: "center", fontSize: 7.5 }, // Período
        },
    didParseCell: (data) => {
      if (data.section === "head") {
        if (
          data.column.index === 0 ||
          data.column.index === 2 ||
          data.column.index === 5 ||
          data.column.index === 6 ||
          data.column.index === 7
        ) {
          data.cell.styles.halign = "center";
        } else if (data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.halign = "right";
        }
      }
    },
    didDrawPage: () => {
      doc.setFillColor(11, 31, 58);
      doc.rect(0, 0, pageW, 72, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(pdfText(campanha.nome).toUpperCase(), M, 34);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(200, 210, 225);
      const filiaisText = formatFiliais(campanha.filiais);
      doc.text(
        `Sumel  •  Filial: ${filiaisText}  •  Vigência: ${periodo}  •  ${ofertas.length} produto(s)`,
        M,
        52,
      );

      const pageH = doc.internal.pageSize.getHeight();
      const page = doc.getNumberOfPages();
      doc.setDrawColor(222, 226, 233);
      doc.setLineWidth(0.5);
      doc.line(M, pageH - 30, pageW - M, pageH - 30);
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Central de Campanhas Sumel  •  Gerado em ${new Date().toLocaleString("pt-BR")}`, M, pageH - 18);
      doc.text(`Página ${page}`, pageW - M, pageH - 18, { align: "right" });
    },
  });

  const url = doc.output("bloburl") as unknown as string;

  if (win && !win.closed) {
    win.location.href = url;
  } else {
    window.location.href = url;
    toast.warning("Permita pop-ups para abrir o PDF em nova aba.");
  }
}

const BUCKET = "campanha-materiais";

export function MateriaisViewer({ materiais, onGerenciar, className }: { materiais: MaterialApoio[]; onGerenciar?: () => void; className?: string }) {
  const openMaterial = async (m: MaterialApoio) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o arquivo. Verificando acesso público...");
      // Fallback para URL pública caso a assinada falhe
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(m.path);
      if (publicData?.publicUrl) {
        window.open(publicData.publicUrl, "_blank", "noopener");
      } else {
        toast.error("Erro ao gerar link de acesso.");
      }
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <div className={`rounded-xl border border-border/60 bg-card p-3 mb-3 shadow-xs ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Materiais de apoio</h3>
          <span className="text-[11px] font-medium text-navy/70">({materiais.length})</span>
        </div>
        {onGerenciar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onGerenciar}
            className="h-6 text-[11px] text-primary hover:text-primary hover:bg-primary/5 px-2"
          >
            <Pencil className="h-3 w-3 mr-1" /> Gerenciar / Anexar
          </Button>
        )}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {materiais.map((m) => (
          <li key={m.path} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/80 px-2.5 py-1.5 text-xs transition-colors hover:border-primary/30">
            {m.tipo.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5 text-navy shrink-0" /> : <FileText className="h-3.5 w-3.5 text-primary shrink-0" />}
            <button type="button" onClick={() => openMaterial(m)} className="flex-1 text-left truncate hover:underline text-navy font-medium text-[11px]">
              {m.nome}
            </button>
            <span className="text-[10px] text-muted-foreground shrink-0">{(m.tamanho / 1024).toFixed(0)} KB</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CampanhaQuickView({
  campanha, ofertas, onOpenChange, onAbrir,
}: {
  campanha: Campanha | null;
  ofertas: Oferta[];
  onOpenChange: (v: boolean) => void;
  onAbrir?: (id: string) => void;
}) {
  if (!campanha) return null;
  return (
    <Dialog open={!!campanha} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campanha.nome}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span>{fmtDate(campanha.dataInicial)} → {fmtDate(campanha.dataFinal)}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-red-500/80" title={formatFiliais(campanha.filiais)}>
              <MapPin className="h-3.5 w-3.5" />
              <span className="max-w-[250px] truncate">{formatFiliais(campanha.filiais)}</span>
            </span>
            <span>•</span>
            <span>{ofertas.length} produto(s) em oferta</span>
          </DialogDescription>
        </DialogHeader>

        {campanha.materiais.length > 0 && <MateriaisViewer materiais={campanha.materiais} />}

        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Clube</TableHead>
                <TableHead className="text-right">Preço normal</TableHead>
                <TableHead className="text-right">Preço promo</TableHead>
                <TableHead className="text-center">Condição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum produto em oferta nesta campanha.
                  </TableCell>
                </TableRow>
              ) : ofertas.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{o.descricao}</TableCell>
                  <TableCell>{o.clubeSumel ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right text-muted-foreground line-through tabular-nums text-xs">
                    {brl(o.precoNormal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary tabular-nums text-xs">
                    {brl(o.precoPromocional)}
                  </TableCell>
                  <TableCell className="text-center">
                    {o.tipoPromocao === "a_partir_de" ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                        A partir de {o.quantidadeMinima} un
                      </span>
                    ) : o.tipoPromocao === "a_cada" ? (
                      <span className="inline-flex items-center rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                        A cada {o.quantidadeMinima} un
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { printCampanhaPDF(campanha, ofertas); toast.success("PDF aberto em nova aba."); }}>
            <Printer className="mr-2 h-4 w-4" />Imprimir PDF
          </Button>
          {onAbrir && (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => onAbrir(campanha.id)}>
              Abrir campanha <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
