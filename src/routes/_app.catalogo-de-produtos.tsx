import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Search, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  listProdutos, countProdutos, deleteProduto, importProdutosByCodigo,
  saveImportHistorico, getLastImport,
  type Produto, type ImportRow, type ImportResult, type ImportacaoHistorico,
} from "@/lib/produtos";
import { parseProdutosCsv } from "@/lib/produtos-csv-parser";
import { useAuth } from "@/lib/auth";
import { TableSkeleton } from "@/components/table-skeleton";

export const Route = createFileRoute("/_app/catalogo-de-produtos")({
  head: () => ({
    meta: [
      { title: "Catálogo de Produtos — Central de Campanhas Sumel" },
      { name: "description", content: "Catálogo central de produtos importados do ERP via CSV." },
      { property: "og:title", content: "Catálogo de Produtos — Central de Campanhas Sumel" },
      { property: "og:description", content: "Base de produtos importados para a Central de Campanhas Sumel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogoProdutos,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CatalogoProdutos() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ total: number; ativos: number }>({ total: 0, ativos: 0 });
  const [lastImport, setLastImport] = useState<ImportacaoHistorico | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<(ImportResult & { arquivo?: string }) | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Produto | null>(null);
  const [page, setPage] = useState(1);
  const [totalResultados, setTotalResultados] = useState(0);
  const pageSize = 10;
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const [res, c, li] = await Promise.all([listProdutos(busca, p, pageSize), countProdutos(), getLastImport()]);
      setProdutos(res.rows);
      setTotalResultados(res.total);
      setCounts(c);
      setLastImport(li);
    } catch (e) {
      toast.error("Falha ao carregar produtos", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load(1);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);


  const handleFile = async (file: File) => {
    setImporting(true);
    setProgress({ done: 0, total: 0 });
    const toastId = toast.loading("Lendo arquivo...");
    try {
      const buf = await file.arrayBuffer();
      // Tenta UTF-8; se der replacement chars, tenta windows-1252
      let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      if (text.includes("\uFFFD")) {
        text = new TextDecoder("windows-1252").decode(buf);
      }
      let rows: ImportRow[] = [];
      try {
        rows = parseProdutosCsv(text).rows;
      } catch (err) {
        const preview = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5).join(" | ");
        throw new Error(`${(err as Error).message} Primeiras linhas: ${preview.slice(0, 300)}`);
      }
      if (rows.length === 0) {
        toast.error("Nenhum produto encontrado no arquivo.", { id: toastId });
        return;
      }
      toast.loading(`Importando 0 / ${rows.length.toLocaleString("pt-BR")}...`, { id: toastId });
      const res = await importProdutosByCodigo(rows, {
        onProgress: (done, total) => {
          setProgress({ done, total });
          toast.loading(
            `Importando ${done.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}...`,
            { id: toastId },
          );
        },
      });
      await saveImportHistorico(res, { usuario: user?.username ?? null, arquivo: file.name });
      toast.success("Importação concluída", { id: toastId });
      setResult({ ...res, arquivo: file.name });
      setShowResult(true);
      await load();
    } catch (e) {
      toast.error("Falha na importação", { id: toastId, description: (e as Error).message });
    } finally {
      setImporting(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteProduto(confirmDelete.id);
      toast.success("Produto excluído");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error("Falha ao excluir", { description: (e as Error).message });
    }
  };

  const lastImportLabel = useMemo(() => {
    if (!lastImport) return "Nunca importado";
    const d = new Date(lastImport.created_at);
    return d.toLocaleString("pt-BR");
  }, [lastImport]);

  return (
    <div>
      <PageHeader
        title="Catálogo de Produtos"
        description="Base central de produtos, alimentada pelo ERP via arquivo CSV (código, código de barras, descrição, preço de venda, fornecedor, custo)."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {importing
                ? progress
                  ? `Importando ${progress.done}/${progress.total}`
                  : "Importando..."
                : "Importar Produtos"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Última importação</div>
          <div className="mt-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-navy">{lastImportLabel}</div>
          </div>
          {lastImport && (
            <div className="mt-1 text-xs text-muted-foreground">
              {lastImport.processados.toLocaleString("pt-BR")} processados
              {lastImport.usuario ? ` · ${lastImport.usuario}` : ""}
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Total de produtos</div>
          <div className="mt-2 text-2xl font-bold text-navy">{counts.total.toLocaleString("pt-BR")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Produtos ativos</div>
          <div className="mt-2 text-2xl font-bold text-primary">{counts.ativos.toLocaleString("pt-BR")}</div>
        </div>
      </div>

      {importing && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-navy">
              {progress
                ? `Importando ${progress.done.toLocaleString("pt-BR")} de ${progress.total.toLocaleString("pt-BR")} produtos...`
                : "Lendo arquivo..."}
            </span>
            <span className="text-muted-foreground text-xs">
              {progress && progress.total > 0
                ? `${Math.round((progress.done / progress.total) * 100)}%`
                : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{
                width:
                  progress && progress.total > 0
                    ? `${Math.min(100, (progress.done / progress.total) * 100)}%`
                    : "8%",
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, código de barras ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {loading ? "Buscando..." : `${totalResultados.toLocaleString("pt-BR")} resultado(s)`}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Código de Barras</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Preço Atual</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>Última Atualização</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && produtos.length === 0 && (
                <TableSkeleton columns={8} rows={5} />
              )}
              {!loading && produtos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum produto cadastrado. Importe um arquivo CSV do ERP.
                  </TableCell>
                </TableRow>
              )}
              {produtos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.codigo ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.gtin ?? "—"}</TableCell>
                  <TableCell>{p.descricao}</TableCell>
                  <TableCell className="text-xs">{p.fornecedor?.trim() || "—"}</TableCell>
                  <TableCell className="text-right">{brl(Number(p.preco_venda) || 0)}</TableCell>
                  <TableCell className="text-right">{brl(Number(p.custo) || 0)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.updated_at ? new Date(p.updated_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setConfirmDelete(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-4 p-4 border-t sm:flex-row sm:items-center sm:justify-between text-sm">
          <div className="text-xs text-muted-foreground order-2 sm:order-1">
            {totalResultados === 0
              ? "0 de 0"
              : `${((page - 1) * pageSize + 1).toLocaleString("pt-BR")}–${Math.min(page * pageSize, totalResultados).toLocaleString("pt-BR")} de ${totalResultados.toLocaleString("pt-BR")}`}
          </div>
          <div className="flex items-center justify-between gap-2 order-1 sm:order-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <div className="text-xs text-muted-foreground">
              Página {page} de {Math.max(1, Math.ceil(totalResultados / pageSize))}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= Math.ceil(totalResultados / pageSize) || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>


      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Importação concluída
            </DialogTitle>
            <DialogDescription>
              {result?.arquivo ? `Arquivo: ${result.arquivo}` : ""}
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Produtos processados" value={result.processados} />
              <Stat label="Novos produtos" value={result.novos} />
              <Stat label="Produtos atualizados" value={result.atualizados} />
              <Stat label="Sem código de barras" value={result.sem_barras} />
              <Stat label="Erros encontrados" value={result.erros} />
              <Stat label="Tempo (segundos)" value={(result.duracao_ms / 1000).toFixed(1)} />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.descricao} — essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
