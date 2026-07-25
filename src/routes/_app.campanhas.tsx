import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, Printer, Tag, ArrowLeft, Calendar, Package, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Central de Ofertas — SGMC" },
      { name: "description", content: "Gerencie campanhas e suas ofertas comerciais no SGMC." },
      { property: "og:title", content: "Central de Ofertas — SGMC" },
      { property: "og:description", content: "Gerencie campanhas e ofertas no SGMC." },
    ],
  }),
  component: CentralDeOfertas,
});

type Status = "Ativa" | "Programada" | "Encerrada" | "Rascunho";

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  dataInicial: string;
  dataFinal: string;
  status: Status;
}

interface Oferta {
  id: string;
  campanhaId: string;
  codigo: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  precoNormal: number;
  precoPromocional: number;
  clubeSumel: boolean;
  dataInicial: string;
  dataFinal: string;
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

const seedCampanhas: Campanha[] = [
  { id: "c1", nome: "Ofertas da Semana", descricao: "Ofertas semanais rotativas em todas as filiais.", dataInicial: "2026-07-22", dataFinal: "2026-07-28", status: "Ativa" },
  { id: "c2", nome: "Verão Gelado", descricao: "Campanha sazonal de bebidas e sorvetes.", dataInicial: "2026-07-20", dataFinal: "2026-08-15", status: "Ativa" },
  { id: "c3", nome: "Casa Limpa", descricao: "Promoções em produtos de limpeza doméstica.", dataInicial: "2026-08-01", dataFinal: "2026-08-20", status: "Programada" },
  { id: "c4", nome: "Café da Manhã", descricao: "Pães, cafés, laticínios e cereais.", dataInicial: "2026-07-15", dataFinal: "2026-07-30", status: "Ativa" },
  { id: "c5", nome: "Mês do Bebê", descricao: "Higiene infantil e cuidados com o bebê.", dataInicial: "2026-06-10", dataFinal: "2026-07-05", status: "Encerrada" },
];

const seedOfertas: Oferta[] = [
  { id: "1", campanhaId: "c2", codigo: "OF-0001", descricao: "Cerveja Brahma 350ml Pack 12", fornecedor: "Ambev", categoria: "Bebidas", precoNormal: 59.9, precoPromocional: 44.9, clubeSumel: true, dataInicial: "2026-07-20", dataFinal: "2026-08-10", filial: "Matriz", corredor: "A3", estoque: 320, margem: 18.5, status: "Ativa" },
  { id: "2", campanhaId: "c4", codigo: "OF-0002", descricao: "Café Nescafé Tradicional 500g", fornecedor: "Nestlé", categoria: "Mercearia", precoNormal: 29.9, precoPromocional: 23.9, clubeSumel: false, dataInicial: "2026-07-15", dataFinal: "2026-07-30", filial: "Filial 01", corredor: "B7", estoque: 180, margem: 22.0, status: "Ativa" },
  { id: "3", campanhaId: "c3", codigo: "OF-0003", descricao: "Sabão em Pó OMO 1,6kg", fornecedor: "Unilever", categoria: "Limpeza", precoNormal: 39.9, precoPromocional: 31.9, clubeSumel: true, dataInicial: "2026-08-01", dataFinal: "2026-08-20", filial: "Matriz", corredor: "C2", estoque: 240, margem: 15.0, status: "Programada" },
  { id: "4", campanhaId: "c5", codigo: "OF-0004", descricao: "Fralda Pampers G 40un", fornecedor: "P&G", categoria: "Higiene", precoNormal: 89.9, precoPromocional: 69.9, clubeSumel: true, dataInicial: "2026-06-10", dataFinal: "2026-07-05", filial: "Filial 02", corredor: "D4", estoque: 60, margem: 25.5, status: "Encerrada" },
  { id: "5", campanhaId: "c2", codigo: "OF-0005", descricao: "Refrigerante Coca-Cola 2L", fornecedor: "Coca-Cola", categoria: "Bebidas", precoNormal: 12.9, precoPromocional: 8.99, clubeSumel: false, dataInicial: "2026-07-25", dataFinal: "2026-08-15", filial: "Filial 03", corredor: "A1", estoque: 500, margem: 12.0, status: "Ativa" },
  { id: "6", campanhaId: "c1", codigo: "OF-0006", descricao: "Arroz Camil 5kg", fornecedor: "BRF", categoria: "Mercearia", precoNormal: 34.9, precoPromocional: 27.9, clubeSumel: true, dataInicial: "2026-07-22", dataFinal: "2026-07-28", filial: "Matriz", corredor: "B1", estoque: 400, margem: 14.0, status: "Ativa" },
];

const emptyCampanha = (): Campanha => ({
  id: crypto.randomUUID(), nome: "", descricao: "", dataInicial: "", dataFinal: "", status: "Rascunho",
});

const emptyOferta = (campanhaId: string): Oferta => ({
  id: crypto.randomUUID(), campanhaId, codigo: "", descricao: "", fornecedor: FORNECEDORES[0],
  categoria: CATEGORIAS[0], precoNormal: 0, precoPromocional: 0, clubeSumel: false,
  dataInicial: "", dataFinal: "", filial: FILIAIS[0], corredor: "", estoque: 0, margem: 0, status: "Rascunho",
});

const statusVariant: Record<Status, string> = {
  Ativa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Programada: "bg-blue-100 text-blue-700 border-blue-200",
  Encerrada: "bg-slate-200 text-slate-700 border-slate-300",
  Rascunho: "bg-amber-100 text-amber-700 border-amber-200",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function printCampanhaPDF(campanha: Campanha, ofertas: Oferta[]) {
  // Abre a aba SINCRONAMENTE dentro do clique para não ser bloqueada pelo navegador
  const win = window.open("", "_blank");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14); doc.setTextColor(30, 41, 82);
  doc.text(`SGMC — Campanha: ${campanha.nome}`, 40, 40);
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text(
    `Vigência ${fmtDate(campanha.dataInicial)} a ${fmtDate(campanha.dataFinal)}  •  ${ofertas.length} oferta(s)  •  Gerado em ${new Date().toLocaleString("pt-BR")}`,
    40, 56,
  );

  autoTable(doc, {
    startY: 70,
    head: [["Código", "Descrição", "Clube", "Preço Normal", "Preço Promocional", "Período", "Campanha"]],
    body: ofertas.map(o => [
      o.codigo,
      o.descricao,
      o.clubeSumel ? "Sim" : "Não",
      brl(o.precoNormal),
      brl(o.precoPromocional),
      `${fmtDate(o.dataInicial)} a ${fmtDate(o.dataFinal)}`,
      campanha.nome,
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [200, 30, 40], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
  });

  const url = doc.output("bloburl") as unknown as string;

  if (win && !win.closed) {
    win.location.href = url;
  } else {
    // Pop-up bloqueado: cai para exibição na aba atual
    window.location.href = url;
    toast.warning("Permita pop-ups para abrir o PDF em nova aba.");
  }
}



function CentralDeOfertas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>(seedCampanhas);
  const [ofertas, setOfertas] = useState<Oferta[]>(seedOfertas);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = campanhas.find(c => c.id === selectedId) ?? null;

  return selected ? (
    <CampanhaDetalhe
      campanha={selected}
      ofertas={ofertas.filter(o => o.campanhaId === selected.id)}
      onBack={() => setSelectedId(null)}
      onSaveOferta={(o) => setOfertas(prev => {
        const exists = prev.some(p => p.id === o.id);
        return exists ? prev.map(p => p.id === o.id ? o : p) : [o, ...prev];
      })}
      onDeleteOferta={(id) => setOfertas(prev => prev.filter(p => p.id !== id))}
    />
  ) : (
    <CampanhasList
      campanhas={campanhas}
      ofertas={ofertas}
      onOpen={setSelectedId}
      onSave={(c) => setCampanhas(prev => {
        const exists = prev.some(p => p.id === c.id);
        return exists ? prev.map(p => p.id === c.id ? c : p) : [c, ...prev];
      })}
      onDelete={(id) => {
        setCampanhas(prev => prev.filter(p => p.id !== id));
        setOfertas(prev => prev.filter(o => o.campanhaId !== id));
      }}
    />
  );
}

// ============ CAMPANHAS LIST ============

interface ListProps {
  campanhas: Campanha[];
  ofertas: Oferta[];
  onOpen: (id: string) => void;
  onSave: (c: Campanha) => void;
  onDelete: (id: string) => void;
}

function CampanhasList({ campanhas, ofertas, onOpen, onSave, onDelete }: ListProps) {
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const countByCampanha = useMemo(() => {
    const m = new Map<string, number>();
    ofertas.forEach(o => m.set(o.campanhaId, (m.get(o.campanhaId) ?? 0) + 1));
    return m;
  }, [ofertas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campanhas
      .filter(c => {
        if (q && !c.nome.toLowerCase().includes(q) && !c.descricao.toLowerCase().includes(q)) return false;
        if (fStatus !== "todos" && c.status !== fStatus) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (b.dataInicial || "").localeCompare(a.dataInicial || ""));
  }, [campanhas, search, fStatus]);

  const openNew = () => { setEditing(emptyCampanha()); setDialogOpen(true); };
  const openEdit = (c: Campanha) => { setEditing({ ...c }); setDialogOpen(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.nome.trim()) { toast.error("Informe o nome da campanha."); return; }
    onSave(editing);
    toast.success("Campanha salva.");
    setDialogOpen(false); setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Central de Ofertas"
        description="Campanhas comerciais e suas ofertas."
        actions={
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />Nova Campanha
          </Button>
        }
      />

      <div className="rounded-xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma campanha encontrada.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const count = countByCampanha.get(c.id) ?? 0;
            return (
              <div key={c.id} className="group rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-navy leading-tight">{c.nome}</h3>
                  <Badge variant="outline" className={statusVariant[c.status]}>{c.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">{c.descricao || "Sem descrição."}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(c.dataInicial)} → {fmtDate(c.dataFinal)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Package className="h-4 w-4 text-primary" />
                    <strong>{count}</strong> <span className="text-muted-foreground">oferta{count === 1 ? "" : "s"}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" title="Imprimir PDF" onClick={() => { printCampanhaPDF(c, ofertas.filter(o => o.campanhaId === c.id)); toast.success("PDF aberto em nova aba."); }}><Printer className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    <Button size="sm" onClick={() => onOpen(c.id)} className="bg-primary hover:bg-primary/90">
                      Abrir <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      <CampanhaDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }} campanha={editing} setCampanha={setEditing} onSave={save} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>Todas as ofertas vinculadas a esta campanha também serão excluídas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDelete(deleteId); toast.success("Campanha excluída."); setDeleteId(null); } }} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ CAMPANHA DETALHE (ofertas) ============

interface DetalheProps {
  campanha: Campanha;
  ofertas: Oferta[];
  onBack: () => void;
  onSaveOferta: (o: Oferta) => void;
  onDeleteOferta: (id: string) => void;
}

function CampanhaDetalhe({ campanha, ofertas, onBack, onSaveOferta, onDeleteOferta }: DetalheProps) {
  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");
  const [fClube, setFClube] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oferta | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ofertas.filter(o => {
      if (q && ![o.codigo, o.descricao, o.fornecedor].some(f => f.toLowerCase().includes(q))) return false;
      if (fCategoria !== "todas" && o.categoria !== fCategoria) return false;
      if (fStatus !== "todos" && o.status !== fStatus) return false;
      if (fClube === "sim" && !o.clubeSumel) return false;
      if (fClube === "nao" && o.clubeSumel) return false;
      return true;
    });
  }, [ofertas, search, fCategoria, fStatus, fClube]);

  const openNew = () => { setEditing(emptyOferta(campanha.id)); setDialogOpen(true); };
  const openEdit = (o: Oferta) => { setEditing({ ...o }); setDialogOpen(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.codigo.trim() || !editing.descricao.trim()) { toast.error("Preencha código e descrição."); return; }
    onSaveOferta(editing);
    toast.success("Oferta salva.");
    setDialogOpen(false); setEditing(null);
  };

  const printPDF = () => {
    printCampanhaPDF(campanha, filtered);
    toast.success("PDF aberto em nova aba.");
  };


  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar para campanhas
      </button>

      <PageHeader
        title={campanha.nome}
        description={`Vigência ${fmtDate(campanha.dataInicial)} → ${fmtDate(campanha.dataFinal)}  •  ${campanha.descricao || "Ofertas desta campanha."}`}
        actions={
          <>
            <Badge variant="outline" className={`${statusVariant[campanha.status]} mr-1`}>{campanha.status}</Badge>
            <Button variant="outline" onClick={printPDF}><Printer className="mr-2 h-4 w-4" />Imprimir PDF</Button>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nova Oferta</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-[1fr_180px_180px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, descrição ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fClube} onValueChange={setFClube}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                    Nenhuma oferta cadastrada nesta campanha ainda.
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

      <OfertaDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }} oferta={editing} setOferta={setEditing} onSave={save} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDeleteOferta(deleteId); toast.success("Oferta excluída."); setDeleteId(null); } }} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ DIALOGS ============

function CampanhaDialog({ open, onOpenChange, campanha, setCampanha, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; campanha: Campanha | null;
  setCampanha: (c: Campanha) => void; onSave: () => void;
}) {
  if (!campanha) return null;
  const upd = <K extends keyof Campanha>(k: K, v: Campanha[K]) => setCampanha({ ...campanha, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{campanha.nome ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          <DialogDescription>Defina o período e o status da campanha comercial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Nome"><Input value={campanha.nome} onChange={(e) => upd("nome", e.target.value)} placeholder="Ex: Ofertas da Semana" /></Field>
          <Field label="Descrição"><Textarea value={campanha.descricao} onChange={(e) => upd("descricao", e.target.value)} rows={3} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data Inicial"><Input type="date" value={campanha.dataInicial} onChange={(e) => upd("dataInicial", e.target.value)} /></Field>
            <Field label="Data Final"><Input type="date" value={campanha.dataFinal} onChange={(e) => upd("dataFinal", e.target.value)} /></Field>
          </div>
          <Field label="Status">
            <Select value={campanha.status} onValueChange={(v) => upd("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-primary hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfertaDialog({ open, onOpenChange, oferta, setOferta, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; oferta: Oferta | null;
  setOferta: (o: Oferta) => void; onSave: () => void;
}) {
  const [gtin, setGtin] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  if (!oferta) return null;
  const upd = <K extends keyof Oferta>(k: K, v: Oferta[K]) => setOferta({ ...oferta, [k]: v });

  const lookupProduto = async (code?: string) => {
    const g = (code ?? gtin).trim();
    if (!g) { toast.error("Informe um código de barras."); return; }
    setLookingUp(true);
    try {
      const { findByGtin } = await import("@/lib/produtos");
      const p = await findByGtin(g);
      if (!p) { toast.error("Produto não encontrado. Importe o cadastro em Importação."); return; }
      const preco = Number(p.preco_venda) || 0;
      const promo = +(preco * 0.9).toFixed(2); // sugestão -10%
      setOferta({
        ...oferta,
        codigo: p.codigo || g,
        descricao: p.descricao,
        precoNormal: preco,
        precoPromocional: promo,
      });
      toast.success(`Produto carregado. Sugestão promocional: ${brl(promo)} (−10%).`);
    } catch (e) { toast.error("Erro na consulta: " + (e as Error).message); }
    finally { setLookingUp(false); }
  };

  const descontoPct = oferta.precoNormal > 0
    ? ((oferta.precoNormal - oferta.precoPromocional) / oferta.precoNormal) * 100
    : 0;
  const economia = Math.max(oferta.precoNormal - oferta.precoPromocional, 0);
  const setPromoByPct = (pct: number) => {
    const p = +(oferta.precoNormal * (1 - pct / 100)).toFixed(2);
    upd("precoPromocional", Math.max(p, 0));
  };
  const nudge = (delta: number) => {
    const p = +Math.max(oferta.precoPromocional + delta, 0).toFixed(2);
    upd("precoPromocional", p);
  };

  const descontoTone =
    descontoPct <= 0 ? "text-muted-foreground"
    : descontoPct < 5 ? "text-amber-600"
    : descontoPct < 20 ? "text-emerald-600"
    : "text-primary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{oferta.codigo ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
          <DialogDescription>Informe o código de barras para preencher automaticamente ou edite manualmente.</DialogDescription>
        </DialogHeader>

        {/* Busca por GTIN */}
        <div className="rounded-lg border bg-navy/5 p-3 mb-1">
          <Label className="text-xs text-muted-foreground">Código de barras (GTIN)</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              autoFocus
              value={gtin}
              onChange={(e) => setGtin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupProduto(); } }}
              placeholder="Bipe ou digite o código de barras e pressione Enter"
              inputMode="numeric"
            />
            <Button type="button" onClick={() => lookupProduto()} disabled={lookingUp} className="bg-primary hover:bg-primary/90">
              {lookingUp ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Código"><Input value={oferta.codigo} onChange={(e) => upd("codigo", e.target.value)} placeholder="OF-0000" /></Field>
          <Field label="Status">
            <Select value={oferta.status} onValueChange={(v) => upd("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
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

          {/* Calculadora de desconto */}
          <div className="md:col-span-2 rounded-lg border p-4 bg-card">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground">Desconto aplicado</div>
                <div className={`text-2xl font-bold ${descontoTone}`}>
                  {descontoPct.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Economia por unidade</div>
                <div className="text-lg font-semibold text-navy">{brl(economia)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Sugestões:</span>
              {[5, 10, 15, 20, 25, 30].map(p => (
                <Button key={p} type="button" size="sm" variant="outline" onClick={() => setPromoByPct(p)}>
                  −{p}%
                </Button>
              ))}
              <div className="mx-2 h-6 w-px bg-border" />
              <span className="text-xs text-muted-foreground mr-1">Ajuste fino:</span>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge(-1)}>−R$1</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge(-0.1)}>−R$0,10</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge(0.1)}>+R$0,10</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge(1)}>+R$1</Button>
            </div>
          </div>

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
          <div className="flex items-center gap-3 rounded-md border p-3 md:col-span-2">
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
