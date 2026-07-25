import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Printer, Tag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_app/central-de-ofertas")({
  head: () => ({
    meta: [
      { title: "Central de Ofertas — SGMC" },
      { name: "description", content: "Gerencie, filtre e imprima ofertas comerciais no SGMC." },
      { property: "og:title", content: "Central de Ofertas — SGMC" },
      { property: "og:description", content: "Gerencie ofertas comerciais no SGMC." },
    ],
  }),
  component: CentralDeOfertas,
});

type Status = "Ativa" | "Programada" | "Encerrada" | "Rascunho";

interface Oferta {
  id: string;
  codigo: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  precoNormal: number;
  precoPromocional: number;
  clubeSumel: boolean;
  dataInicial: string;
  dataFinal: string;
  campanha: string;
  filial: string;
  corredor: string;
  estoque: number;
  margem: number;
  status: Status;
}

const CATEGORIAS = ["Bebidas", "Mercearia", "Higiene", "Limpeza", "Frios", "Padaria", "Hortifruti"];
const FORNECEDORES = ["Ambev", "Nestlé", "Unilever", "P&G", "Coca-Cola", "BRF", "JBS"];
const FILIAIS = ["Matriz", "Filial 01", "Filial 02", "Filial 03"];
const STATUS: Status[] = ["Ativa", "Programada", "Encerrada", "Rascunho"];

const seed: Oferta[] = [
  { id: "1", codigo: "OF-0001", descricao: "Cerveja Brahma 350ml Pack 12", fornecedor: "Ambev", categoria: "Bebidas", precoNormal: 59.9, precoPromocional: 44.9, clubeSumel: true, dataInicial: "2026-07-20", dataFinal: "2026-08-10", campanha: "Verão Gelado", filial: "Matriz", corredor: "A3", estoque: 320, margem: 18.5, status: "Ativa" },
  { id: "2", codigo: "OF-0002", descricao: "Café Nescafé Tradicional 500g", fornecedor: "Nestlé", categoria: "Mercearia", precoNormal: 29.9, precoPromocional: 23.9, clubeSumel: false, dataInicial: "2026-07-15", dataFinal: "2026-07-30", campanha: "Café da Manhã", filial: "Filial 01", corredor: "B7", estoque: 180, margem: 22.0, status: "Ativa" },
  { id: "3", codigo: "OF-0003", descricao: "Sabão em Pó OMO 1,6kg", fornecedor: "Unilever", categoria: "Limpeza", precoNormal: 39.9, precoPromocional: 31.9, clubeSumel: true, dataInicial: "2026-08-01", dataFinal: "2026-08-20", campanha: "Casa Limpa", filial: "Matriz", corredor: "C2", estoque: 240, margem: 15.0, status: "Programada" },
  { id: "4", codigo: "OF-0004", descricao: "Fralda Pampers G 40un", fornecedor: "P&G", categoria: "Higiene", precoNormal: 89.9, precoPromocional: 69.9, clubeSumel: true, dataInicial: "2026-06-10", dataFinal: "2026-07-05", campanha: "Mês do Bebê", filial: "Filial 02", corredor: "D4", estoque: 60, margem: 25.5, status: "Encerrada" },
  { id: "5", codigo: "OF-0005", descricao: "Refrigerante Coca-Cola 2L", fornecedor: "Coca-Cola", categoria: "Bebidas", precoNormal: 12.9, precoPromocional: 8.99, clubeSumel: false, dataInicial: "2026-07-25", dataFinal: "2026-08-15", campanha: "Verão Gelado", filial: "Filial 03", corredor: "A1", estoque: 500, margem: 12.0, status: "Ativa" },
];

const emptyOferta = (): Oferta => ({
  id: crypto.randomUUID(), codigo: "", descricao: "", fornecedor: FORNECEDORES[0], categoria: CATEGORIAS[0],
  precoNormal: 0, precoPromocional: 0, clubeSumel: false, dataInicial: "", dataFinal: "",
  campanha: "", filial: FILIAIS[0], corredor: "", estoque: 0, margem: 0, status: "Rascunho",
});

const statusVariant: Record<Status, string> = {
  Ativa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Programada: "bg-blue-100 text-blue-700 border-blue-200",
  Encerrada: "bg-slate-200 text-slate-700 border-slate-300",
  Rascunho: "bg-amber-100 text-amber-700 border-amber-200",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function CentralDeOfertas() {
  const [ofertas, setOfertas] = useState<Oferta[]>(seed);
  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fClube, setFClube] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oferta | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ofertas.filter((o) => {
      if (q && ![o.codigo, o.descricao, o.fornecedor, o.campanha].some(f => f.toLowerCase().includes(q))) return false;
      if (fCategoria !== "todas" && o.categoria !== fCategoria) return false;
      if (fStatus !== "todos" && o.status !== fStatus) return false;
      if (fClube === "sim" && !o.clubeSumel) return false;
      if (fClube === "nao" && o.clubeSumel) return false;
      return true;
    });
  }, [ofertas, search, fCategoria, fStatus, fClube]);

  const openNew = () => { setEditing(emptyOferta()); setDialogOpen(true); };
  const openEdit = (o: Oferta) => { setEditing({ ...o }); setDialogOpen(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.codigo.trim() || !editing.descricao.trim()) {
      toast.error("Preencha código e descrição."); return;
    }
    setOfertas((prev) => {
      const exists = prev.some(p => p.id === editing.id);
      return exists ? prev.map(p => p.id === editing.id ? editing : p) : [editing, ...prev];
    });
    toast.success("Oferta salva com sucesso.");
    setDialogOpen(false); setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setOfertas((prev) => prev.filter(p => p.id !== deleteId));
    toast.success("Oferta excluída.");
    setDeleteId(null);
  };

  const printPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14); doc.setTextColor(30, 41, 82);
    doc.text("SGMC — Central de Ofertas", 40, 40);
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}  •  ${filtered.length} oferta(s)`, 40, 56);

    autoTable(doc, {
      startY: 70,
      head: [["Código", "Descrição", "Fornecedor", "Categoria", "Normal", "Promo", "Clube", "Início", "Fim", "Campanha", "Filial", "Corredor", "Estoque", "Margem", "Status"]],
      body: filtered.map(o => [
        o.codigo, o.descricao, o.fornecedor, o.categoria,
        brl(o.precoNormal), brl(o.precoPromocional), o.clubeSumel ? "Sim" : "Não",
        fmtDate(o.dataInicial), fmtDate(o.dataFinal), o.campanha, o.filial, o.corredor,
        String(o.estoque), `${o.margem.toFixed(1)}%`, o.status,
      ]),
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [200, 30, 40], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 248, 250] },
    });
    doc.save(`central-ofertas-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF gerado.");
  };

  return (
    <div>
      <PageHeader
        title="Central de Ofertas"
        description="Publique, filtre e imprima ofertas comerciais."
        actions={
          <>
            <Button variant="outline" onClick={printPDF}><Printer className="mr-2 h-4 w-4" />Imprimir PDF</Button>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nova Oferta</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-[1fr_180px_180px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, descrição, fornecedor ou campanha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fClube} onValueChange={setFClube}>
          <SelectTrigger><SelectValue placeholder="Clube Sumel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Clube: Todos</SelectItem>
            <SelectItem value="sim">Somente Clube</SelectItem>
            <SelectItem value="nao">Sem Clube</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy/5">
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Normal</TableHead>
                <TableHead className="text-right">Promo</TableHead>
                <TableHead className="text-center">Clube</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Corredor</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                    Nenhuma oferta encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                  <TableCell className="font-medium max-w-[240px] truncate">{o.descricao}</TableCell>
                  <TableCell>{o.fornecedor}</TableCell>
                  <TableCell>{o.categoria}</TableCell>
                  <TableCell className="text-right line-through text-muted-foreground">{brl(o.precoNormal)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{brl(o.precoPromocional)}</TableCell>
                  <TableCell className="text-center">
                    {o.clubeSumel ? <Badge className="bg-primary/10 text-primary border-primary/20"><Tag className="h-3 w-3 mr-1" />Sim</Badge> : <span className="text-muted-foreground text-xs">Não</span>}
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(o.dataInicial)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(o.dataFinal)}</TableCell>
                  <TableCell className="text-xs">{o.campanha}</TableCell>
                  <TableCell className="text-xs">{o.filial}</TableCell>
                  <TableCell className="text-xs">{o.corredor}</TableCell>
                  <TableCell className="text-right">{o.estoque}</TableCell>
                  <TableCell className="text-right">{o.margem.toFixed(1)}%</TableCell>
                  <TableCell><Badge variant="outline" className={statusVariant[o.status]}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <OfertaDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        oferta={editing}
        setOferta={setEditing}
        onSave={save}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oferta: Oferta | null;
  setOferta: (o: Oferta) => void;
  onSave: () => void;
}

function OfertaDialog({ open, onOpenChange, oferta, setOferta, onSave }: DialogProps) {
  if (!oferta) return null;
  const upd = <K extends keyof Oferta>(k: K, v: Oferta[K]) => setOferta({ ...oferta, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{oferta.codigo ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
          <DialogDescription>Preencha os dados da oferta comercial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Código"><Input value={oferta.codigo} onChange={(e) => upd("codigo", e.target.value)} placeholder="OF-0000" /></Field>
          <Field label="Campanha"><Input value={oferta.campanha} onChange={(e) => upd("campanha", e.target.value)} /></Field>
          <Field label="Descrição" className="md:col-span-2"><Input value={oferta.descricao} onChange={(e) => upd("descricao", e.target.value)} /></Field>
          <Field label="Fornecedor">
            <Select value={oferta.fornecedor} onValueChange={(v) => upd("fornecedor", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORNECEDORES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={oferta.categoria} onValueChange={(v) => upd("categoria", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Preço Normal (R$)"><Input type="number" step="0.01" value={oferta.precoNormal} onChange={(e) => upd("precoNormal", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Preço Promocional (R$)"><Input type="number" step="0.01" value={oferta.precoPromocional} onChange={(e) => upd("precoPromocional", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Data Inicial"><Input type="date" value={oferta.dataInicial} onChange={(e) => upd("dataInicial", e.target.value)} /></Field>
          <Field label="Data Final"><Input type="date" value={oferta.dataFinal} onChange={(e) => upd("dataFinal", e.target.value)} /></Field>
          <Field label="Filial">
            <Select value={oferta.filial} onValueChange={(v) => upd("filial", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FILIAIS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Corredor"><Input value={oferta.corredor} onChange={(e) => upd("corredor", e.target.value)} placeholder="A1" /></Field>
          <Field label="Estoque"><Input type="number" value={oferta.estoque} onChange={(e) => upd("estoque", parseInt(e.target.value) || 0)} /></Field>
          <Field label="Margem (%)"><Input type="number" step="0.1" value={oferta.margem} onChange={(e) => upd("margem", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Status">
            <Select value={oferta.status} onValueChange={(v) => upd("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Switch checked={oferta.clubeSumel} onCheckedChange={(v) => upd("clubeSumel", v)} id="clube" />
            <Label htmlFor="clube" className="cursor-pointer">Oferta Clube Sumel</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-primary hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
