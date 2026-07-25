import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Calendar, Package, Paperclip, Printer, Eye } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  type Campanha,
  type Oferta,
  useCampanhasStore,
  categoriaCampanha,
} from "@/lib/campanhas-store";

export const Route = createFileRoute("/_app/campanhas-encerradas")({
  head: () => ({
    meta: [
      { title: "Campanhas Encerradas — SGMC" },
      { name: "description", content: "Arquivo de campanhas comerciais já encerradas." },
      { property: "og:title", content: "Campanhas Encerradas — SGMC" },
      { property: "og:description", content: "Consulte o histórico de campanhas encerradas." },
    ],
  }),
  component: CampanhasEncerradas,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function printPDF(campanha: Campanha, ofertas: Oferta[]) {
  const win = window.open("", "_blank");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14); doc.setTextColor(30, 41, 82);
  doc.text(`SGMC — Campanha (encerrada): ${campanha.nome}`, 40, 40);
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text(
    `Vigência ${fmtDate(campanha.dataInicial)} a ${fmtDate(campanha.dataFinal)}  •  ${ofertas.length} oferta(s)`,
    40, 56,
  );
  autoTable(doc, {
    startY: 70,
    head: [["Código", "Descrição", "Clube", "Preço Normal", "Preço Promocional", "Período"]],
    body: ofertas.map((o) => [
      o.codigo,
      o.descricao,
      o.clubeSumel ? "Sim" : "Não",
      brl(o.precoNormal),
      brl(o.precoPromocional),
      `${fmtDate(o.dataInicial)} a ${fmtDate(o.dataFinal)}`,
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [11, 31, 58], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
  });
  const url = doc.output("bloburl") as unknown as string;
  if (win && !win.closed) win.location.href = url;
  else {
    window.location.href = url;
    toast.warning("Permita pop-ups para abrir o PDF em nova aba.");
  }
}

function CampanhasEncerradas() {
  const { campanhas, ofertas } = useCampanhasStore();
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Campanha | null>(null);

  const encerradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campanhas
      .filter((c) => categoriaCampanha(c) === "encerrada")
      .filter((c) =>
        !q ||
        c.nome.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q),
      )
      .slice()
      .sort((a, b) => (b.dataFinal || "").localeCompare(a.dataFinal || ""));
  }, [campanhas, search]);

  const countByCampanha = useMemo(() => {
    const m = new Map<string, number>();
    ofertas.forEach((o) => m.set(o.campanhaId, (m.get(o.campanhaId) ?? 0) + 1));
    return m;
  }, [ofertas]);

  const ofertasDaSelecionada = useMemo(
    () => (viewing ? ofertas.filter((o) => o.campanhaId === viewing.id) : []),
    [viewing, ofertas],
  );

  return (
    <div>
      <PageHeader
        title="Campanhas Encerradas"
        description="Arquivo somente-leitura das campanhas já finalizadas."
      />

      <div className="rounded-xl border bg-card p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha encerrada..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {encerradas.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma campanha encerrada encontrada.
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-center">Ofertas</TableHead>
                  <TableHead className="text-center">Materiais</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {encerradas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-navy">{c.nome}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {c.descricao || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {fmtDate(c.dataInicial)} → {fmtDate(c.dataFinal)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        {countByCampanha.get(c.id) ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1.5 text-navy">
                        <Paperclip className="h-3.5 w-3.5" />
                        {c.materiais.length}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-slate-200 text-slate-700 border-slate-300"
                      >
                        Encerrada
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Ver ofertas"
                        onClick={() => setViewing(c)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Imprimir PDF"
                        onClick={() => {
                          printPDF(
                            c,
                            ofertas.filter((o) => o.campanhaId === c.id),
                          );
                          toast.success("PDF aberto em nova aba.");
                        }}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewing?.nome}</DialogTitle>
            <DialogDescription>
              {viewing
                ? `Vigência ${fmtDate(viewing.dataInicial)} a ${fmtDate(viewing.dataFinal)} • ${ofertasDaSelecionada.length} oferta(s)`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Clube</TableHead>
                  <TableHead className="text-right">Normal</TableHead>
                  <TableHead className="text-right">Promo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofertasDaSelecionada.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Sem ofertas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  ofertasDaSelecionada.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                      <TableCell>{o.descricao}</TableCell>
                      <TableCell>{o.clubeSumel ? "Sim" : "Não"}</TableCell>
                      <TableCell className="text-right">{brl(o.precoNormal)}</TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {brl(o.precoPromocional)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
