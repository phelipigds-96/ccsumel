import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type Oferta, type Acerto, type Campanha } from "@/lib/campanhas-store";

interface SelloutReportProps {
  fornecedor: string;
  itens: Array<{
    oferta: Oferta;
    campanha?: Campanha;
    baixadoEm: string | null;
  }>;
  acertos: Record<string, Acerto>;
}

export function gerarRelatorioSelloutPDF({ fornecedor, itens, acertos }: SelloutReportProps) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtData = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) {
         const parts = iso.split("-");
         if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
         return iso;
      }
      return d.toLocaleDateString("pt-BR");
    } catch {
      return iso || "—";
    }
  };

  // Header
  doc.setFillColor(11, 31, 58); // Navy
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Sell Out", 15, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Fornecedor: ${fornecedor}`, 15, 30);
  doc.text(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 15, 30, { align: "right" });

  // Body
  const tableData = itens.map((item) => {
    const acerto = acertos[item.oferta.id];
    const qtd = acerto?.quantidadeVendida ?? 0;
    const valorUn = item.oferta.selloutValor || 0;
    const total = qtd * valorUn;
    
    return [
      item.oferta.descricao,
      item.oferta.codigo || "—",
      item.campanha?.nome || "—",
      fmtData(item.baixadoEm),
      brl(valorUn),
      qtd.toString(),
      brl(total)
    ];
  });

  const totalGeral = itens.reduce((acc, item) => {
    const acerto = acertos[item.oferta.id];
    return acc + (acerto?.quantidadeVendida ?? 0) * (item.oferta.selloutValor || 0);
  }, 0);

  autoTable(doc, {
    startY: 50,
    head: [["Produto", "Código", "Campanha", "Data Baixa", "Vl. Unit", "Qtd", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [200, 16, 46], textColor: [255, 255, 255], halign: "center" }, // Red
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: "center" },
      2: { cellWidth: 35 },
      3: { halign: "center" },
      4: { halign: "right" },
      5: { halign: "center" },
      6: { halign: "right", fontStyle: "bold" }
    },
    foot: [[{ content: "TOTAL GERAL A COBRAR:", colSpan: 6, styles: { halign: "right", fontStyle: "bold" } }, { content: brl(totalGeral), styles: { halign: "right", fontStyle: "bold", textColor: [200, 16, 46] } }]],
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  if (finalY < 270) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("__________________________________", pageWidth / 2, finalY + 15, { align: "center" });
    doc.text("Assinatura do Responsável", pageWidth / 2, finalY + 22, { align: "center" });
  }

  // Open in new tab
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
