import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2, Building2, Upload, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  listFornecedores, upsertFornecedor, deleteFornecedor,
  type FornecedorComContagem,
} from "@/lib/fornecedores";
import { upsertFornecedoresBatch, type FornecedorBatchResult } from "@/lib/fornecedores-batch";
import { parseFornecedoresCsv, decodeFile } from "@/lib/fornecedores-csv-parser";
import { TableSkeleton } from "@/components/table-skeleton";
import { EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Central de Campanhas Sumel" },
      { name: "description", content: "Cadastro de fornecedores alimentado pela importação do catálogo de produtos." },
      { property: "og:title", content: "Fornecedores — Central de Campanhas Sumel" },
      { property: "og:description", content: "Cadastro e gestão de parceiros comerciais da Central Sumel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const [rows, setRows] = useState<FornecedorComContagem[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<FornecedorComContagem> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FornecedorComContagem | null>(null);

  // Import CSV state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<(FornecedorBatchResult & { arquivo?: string; validos: number; ignorados: number }) | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const fileRef = useState<React.RefObject<HTMLInputElement | null>>(() => ({ current: null }))[0];

  const load = async (term = busca) => {
    setLoading(true);
    try {
      setRows(await listFornecedores(term));
    } catch (e) {
      toast.error("Falha ao carregar fornecedores", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(busca), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const onSave = async () => {
    if (!editing?.nome?.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    try {
      await upsertFornecedor({
        id: editing.id,
        nome: editing.nome,
        observacoes: editing.observacoes ?? "",
      });
      toast.success("Fornecedor salvo");
      setEditing(null);
      load();
    } catch (e) {
      toast.error("Falha ao salvar", { description: (e as Error).message });
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteFornecedor(confirmDelete.id);
      toast.success("Fornecedor excluído");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error("Falha ao excluir", { description: (e as Error).message });
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    const toastId = toast.loading("Lendo arquivo...");
    try {
      const buf = await file.arrayBuffer();
      const text = decodeFile(buf);
      const parseResult = parseFornecedoresCsv(text);
      toast.loading(`Importando ${parseResult.fornecedores.length.toLocaleString("pt-BR")} fornecedores...`, { id: toastId });
      const result = await upsertFornecedoresBatch(parseResult.fornecedores);
      toast.success("Importação concluída", { id: toastId });
      setImportResult({ ...result, arquivo: file.name, validos: parseResult.validos, ignorados: parseResult.ignorados });
      setShowImportResult(true);
      await load();
    } catch (e) {
      toast.error("Falha na importação", { id: toastId, description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const totalProdutos = rows.reduce((acc, r) => acc + r.produtos, 0);

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description="Parceiros comerciais — cadastrados manualmente ou criados automaticamente na importação do catálogo de produtos."
        actions={
          <div className="flex gap-2">
            <input
              ref={fileRef as unknown as React.RefObject<HTMLInputElement>}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                if (e.target) (e.target as HTMLInputElement).value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => (fileRef as unknown as React.RefObject<HTMLInputElement>).current?.click()}
              disabled={importing}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importando..." : "Importar CSV"}
            </Button>
            <Button className="gap-2" onClick={() => setEditing({ nome: "", observacoes: "" })}>
              <Plus className="h-4 w-4" /> Novo Fornecedor
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Fornecedores cadastrados</div>
          <div className="mt-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold text-navy">{rows.length.toLocaleString("pt-BR")}</span>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Produtos vinculados</div>
          <div className="mt-2 text-2xl font-bold text-primary">{totalProdutos.toLocaleString("pt-BR")}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {loading ? "Buscando..." : `${rows.length.toLocaleString("pt-BR")} resultado(s)`}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 && (
                <TableSkeleton columns={4} rows={5} />
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyModule name="Fornecedores" />
                  </TableCell>
                </TableRow>
              )}
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-navy">{f.nome}</TableCell>
                  <TableCell className="text-right">{f.produtos.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.observacoes || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editing?.nome ?? ""}
                maxLength={120}
                onChange={(e) => setEditing((p) => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editing?.observacoes ?? ""}
                maxLength={500}
                onChange={(e) => setEditing((p) => ({ ...p, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={onSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.nome} — os produtos vinculados não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showImportResult} onOpenChange={setShowImportResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Importação concluída
            </DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              {importResult.arquivo && (
                <p className="text-sm text-muted-foreground">Arquivo: {importResult.arquivo}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Fornecedores válidos no arquivo" value={importResult.validos} />
                <Stat label="Novos cadastrados" value={importResult.novos} />
                <Stat label="Já existiam" value={importResult.existentes} />
                <Stat label="Linhas inválidas ignoradas" value={importResult.ignorados} />
                {importResult.erros > 0 && <Stat label="Erros" value={importResult.erros} />}
                <Stat label="Tempo (segundos)" value={(importResult.duracao_ms / 1000).toFixed(1)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowImportResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-navy">{value}</div>
    </div>
  );
}
