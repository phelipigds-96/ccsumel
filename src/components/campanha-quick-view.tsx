import { Printer, ChevronRight, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import type { Campanha, Oferta, MaterialApoio } from "@/lib/campanhas-store";

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
    ? [["Código", "Descrição do Produto", "Clube", "De", "Por"]]
    : [["Código", "Descrição do Produto", "Clube", "De", "Por", "Período"]];

  const body = ofertas.map((o) => {
    const base = [
      pdfText(o.codigo),
      pdfText(o.descricao),
      o.clubeSumel ? "SIM" : "—",
      brl(o.precoNormal),
      brl(o.precoPromocional),
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
      fontSize: 10,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [222, 226, 233],
      lineWidth: 0.5,
      textColor: [20, 26, 40],
    },
    headStyles: {
      fillColor: [200, 16, 46],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [247, 249, 251] },
    columnStyles: mesmoPeriodo
      ? {
          0: { cellWidth: 62, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 46, halign: "center" },
          3: { cellWidth: 72, halign: "center", textColor: [120, 128, 140] },
          4: { cellWidth: 78, halign: "center", fontStyle: "bold", textColor: [200, 16, 46] },
        }
      : {
          0: { cellWidth: 56, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 40, halign: "center" },
          3: { cellWidth: 64, halign: "center", textColor: [120, 128, 140] },
          4: { cellWidth: 70, halign: "center", fontStyle: "bold", textColor: [200, 16, 46] },
          5: { cellWidth: 110, halign: "center", fontSize: 8 },
        },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index !== 1) {
        data.cell.styles.halign = "center";
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
      doc.text(
        `Central de Campanhas Sumel  •  Vigência ${periodo}  •  ${ofertas.length} produto(s)`,
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
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, M, pageH - 18);
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

export function MateriaisViewer({ materiais }: { materiais: MaterialApoio[] }) {
  const openMaterial = async (m: MaterialApoio) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(m.path);
    if (!data?.publicUrl) { toast.error("Não foi possível abrir o arquivo."); return; }
    window.open(data.publicUrl, "_blank", "noopener");
  };
  return (
    <div className="rounded-xl border bg-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-navy">Anexos da campanha</h3>
        <span className="text-xs text-muted-foreground">({materiais.length})</span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {materiais.map((m) => (
          <li key={m.path} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            {m.tipo.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-navy shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
            <button type="button" onClick={() => openMaterial(m)} className="flex-1 text-left truncate hover:underline text-navy">
              {m.nome}
            </button>
            <span className="text-xs text-muted-foreground">{(m.tamanho / 1024).toFixed(0)} KB</span>
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
          <DialogDescription>
            {fmtDate(campanha.dataInicial)} → {fmtDate(campanha.dataFinal)} • {ofertas.length} produto(s) em oferta
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
                <TableHead className="text-right">Preço promocional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum produto em oferta nesta campanha.
                  </TableCell>
                </TableRow>
              ) : ofertas.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{o.descricao}</TableCell>
                  <TableCell>{o.clubeSumel ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right line-through text-muted-foreground">{brl(o.precoNormal)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{brl(o.precoPromocional)}</TableCell>
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
