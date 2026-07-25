import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Trash2, Search, ShoppingCart, Package, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { listProdutos, upsertProdutos, deleteProduto, deleteAllProdutos, type Produto } from "@/lib/produtos";

export const Route = createFileRoute("/_app/importacao")({
  head: () => ({
    meta: [
      { title: "Importação — SGMC" },
      { name: "description", content: "Importe cadastros de produtos e vendas a partir de planilhas do ERP." },
      { property: "og:title", content: "Importação — SGMC" },
      { property: "og:description", content: "Importação de produtos e vendas via XLSX no SGMC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Importacao,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Mapeamento das colunas esperadas do ERP → chaves internas
const COL_MAP: Record<string, keyof ParsedRow> = {
  "desc.": "descricao",
  "desc": "descricao",
  "descricao": "descricao",
  "descrição": "descricao",
  "produto": "descricao",
  "nome produto": "descricao",
  "descricao produto": "descricao",
  "descrição produto": "descricao",
  "cod.": "codigo",
  "cód.": "codigo",
  "cod": "codigo",
  "codigo": "codigo",
  "código": "codigo",
  "cod produto": "codigo",
  "cód produto": "codigo",
  "codigo produto": "codigo",
  "código produto": "codigo",
  "gtin": "gtin",
  "ean": "gtin",
  "ean13": "gtin",
  "cod barras": "gtin",
  "cód barras": "gtin",
  "cod barra": "gtin",
  "cód barra": "gtin",
  "codigo de barras": "gtin",
  "código de barras": "gtin",
  "prc. venda": "preco_venda",
  "prç. venda": "preco_venda",
  "prc venda": "preco_venda",
  "prç venda": "preco_venda",
  "pr venda": "preco_venda",
  "vl venda": "preco_venda",
  "valor venda": "preco_venda",
  "preco venda": "preco_venda",
  "preço venda": "preco_venda",
  "preco de venda": "preco_venda",
  "preço de venda": "preco_venda",
  "preco atual": "preco_venda",
  "preço atual": "preco_venda",
  "preco": "preco_venda",
  "preço": "preco_venda",
};

interface ParsedRow {
  descricao: string;
  codigo: string;
  gtin: string;
  preco_venda: number;
}

function normalizeKey(k: unknown) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function inferColumnTarget(header: string): keyof ParsedRow | null {
  const exact = COL_MAP[header];
  if (exact) return exact;

  const compact = header.replace(/[^a-z0-9]/g, "");
  if (header.includes("gtin") || header.includes("ean") || header.includes("barra")) return "gtin";
  if (header.includes("preco") || header.includes("prc") || header.includes("valor") || compact.startsWith("vl")) {
    return "preco_venda";
  }
  if (header.includes("descr") || header.includes("produto") || header.includes("nome")) return "descricao";
  if (header.includes("codigo") || header.includes("cod") || compact === "sku") return "codigo";
  return null;
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  const normalized = hasComma && hasDot
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : hasComma
      ? cleaned.replace(",", ".")
      : cleaned;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("fullwide", { useGrouping: false });
  return String(value).trim();
}

// Encontra a linha de cabeçalho procurando por células que batam com COL_MAP.
function findHeaderRow(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const row = matrix[i] ?? [];
    let hits = 0;
    for (const cell of row) if (inferColumnTarget(normalizeKey(cell))) hits++;
    if (hits >= 2) return i;
  }
  return 0;
}

function readFile(file: File): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result === undefined || result === null) reject(new Error("Arquivo sem conteúdo."));
      else resolve(result);
    };
    reader.onerror = () => reject(reader.error);
    if (/\.csv$/i.test(file.name) || file.type.includes("csv")) reader.readAsText(file, "utf-8");
    else reader.readAsArrayBuffer(file);
  });
}

async function parseWorkbook(file: File): Promise<ParsedRow[]> {
  const contents = await readFile(file);
  try {
    const wb = typeof contents === "string"
      ? XLSX.read(contents, { type: "string", raw: true })
      : XLSX.read(contents, { type: "array", raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Planilha vazia.");
    const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false, raw: true });
    if (matrix.length === 0) throw new Error("Planilha sem dados.");
    const headerIdx = findHeaderRow(matrix);
    const headers = (matrix[headerIdx] ?? []).map(normalizeKey);
    const mapped = headers.map(inferColumnTarget);
    if (!mapped.some(Boolean)) {
      throw new Error(`Não encontrei colunas conhecidas. Cabeçalhos lidos: ${headers.join(" | ")}`);
    }

    const rows: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
      const raw = matrix[i] ?? [];
      const out: ParsedRow = { descricao: "", codigo: "", gtin: "", preco_venda: 0 };
      for (let c = 0; c < headers.length; c++) {
        const target = mapped[c];
        if (!target) continue;
        const val = raw[c];
        if (target === "preco_venda") out.preco_venda = parseMoney(val);
        else out[target] = parseText(val);
      }
      if (out.descricao || out.gtin || out.codigo) rows.push(out);
    }

    const withDescription = rows.filter((row) => row.descricao.trim());
    if (withDescription.length === 0) {
      throw new Error(`Reconheci o arquivo, mas não encontrei descrições de produtos. Cabeçalhos lidos: ${headers.join(" | ")}`);
    }
    if (withDescription.every((row) => !row.codigo.trim() && !row.gtin.trim())) {
      toast.warning("Importei a prévia, mas não identifiquei código/GTIN. Confira o nome da coluna de código.");
    }
    if (withDescription.every((row) => row.preco_venda === 0)) {
      toast.warning("Importei a prévia, mas os preços vieram zerados. Confira o nome/formato da coluna de preço.");
    }
    return withDescription;
  } catch (err) {
    throw err instanceof Error ? err : new Error("Não foi possível ler o arquivo.");
  }
}

function Importacao() {
  return (
    <div>
      <PageHeader title="Importação" description="Importe cadastros do ERP para o SGMC." />
      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="produtos"><Package className="h-4 w-4 mr-2" />Produtos</TabsTrigger>
          <TabsTrigger value="vendas"><ShoppingCart className="h-4 w-4 mr-2" />Vendas</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos"><ProdutosTab /></TabsContent>
        <TabsContent value="vendas"><VendasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// =========== PRODUTOS ===========
function ProdutosTab() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (q = "") => {
    setLoading(true);
    try { setProdutos(await listProdutos(q)); }
    catch (e) { toast.error("Erro ao carregar produtos: " + (e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(p =>
      p.descricao?.toLowerCase().includes(q) ||
      p.gtin?.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q)
    );
  }, [produtos, search]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseWorkbook(file);
      if (rows.length === 0) { toast.error("Nenhuma linha válida encontrada na planilha."); return; }
      setPreview(rows);
    } catch (err) { toast.error("Erro ao ler arquivo: " + (err as Error).message); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setUploading(true);
    const toastId = toast.loading(`Importando 0 / ${preview.length}...`);
    try {
      const payload = preview.map(r => ({
        gtin: r.gtin || null,
        codigo: r.codigo || null,
        descricao: r.descricao || "(sem descrição)",
        preco_venda: r.preco_venda || 0,
      }));
      const { inserted } = await upsertProdutos(payload, {
        chunkSize: 1000,
        onProgress: (done, total) => {
          toast.loading(`Importando ${done.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}...`, { id: toastId });
        },
      });
      toast.success(`${inserted.toLocaleString("pt-BR")} produto(s) importado(s) / atualizado(s).`, { id: toastId });
      setPreview(null);
      await load(search);
    } catch (err) { toast.error("Erro ao importar: " + (err as Error).message, { id: toastId }); }
    finally { setUploading(false); }
  };

  const clearAll = async () => {
    try {
      await deleteAllProdutos();
      toast.success("Cadastro de produtos limpo.");
      await load();
    } catch (e) { toast.error("Erro: " + (e as Error).message); }
    setConfirmClear(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Desc.", "Cód.", "GTIN", "Prç. venda"],
      ["Cerveja Brahma 350ml", "1001", "7891149102525", 3.49],
      ["Café Nescafé 500g", "1002", "7891000100103", 23.90],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo-produtos-sgmc.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-navy">Importar planilha do ERP</h3>
            <p className="text-sm text-muted-foreground">
              Formato XLSX com as colunas <strong>Desc.</strong>, <strong>Cód.</strong>, <strong>GTIN</strong>, <strong>Prç. venda</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />Modelo XLSX
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
            <Button onClick={() => fileRef.current?.click()} className="bg-primary hover:bg-primary/90">
              <Upload className="h-4 w-4 mr-2" />Selecionar arquivo
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-4 border-b gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-navy flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Produtos cadastrados</h3>
            <p className="text-xs text-muted-foreground">{produtos.length} produto(s) na base.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por GTIN, código ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-80" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} disabled={produtos.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />Limpar tudo
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy/5">
                <TableHead>GTIN</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Preço Venda</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum produto cadastrado. Importe uma planilha para começar.</TableCell></TableRow>
              ) : filtered.slice(0, 200).map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.gtin ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.codigo ?? "-"}</TableCell>
                  <TableCell className="font-medium">{p.descricao}</TableCell>
                  <TableCell className="text-right">{brl(p.preco_venda)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={async () => { await deleteProduto(p.id); toast.success("Removido."); load(search); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 200 && (
            <div className="text-xs text-muted-foreground text-center py-2">Mostrando 200 de {filtered.length}. Refine a busca.</div>
          )}
        </div>
      </div>

      {/* Preview dialog */}
      <AlertDialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação</AlertDialogTitle>
            <AlertDialogDescription>
              {preview?.length} linha(s) detectada(s). Produtos existentes (mesmo GTIN) serão atualizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-navy/5">
                  <TableHead>GTIN</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview?.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.gtin || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo || "-"}</TableCell>
                    <TableCell className="text-sm">{r.descricao}</TableCell>
                    <TableCell className="text-right">{brl(r.preco_venda)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(preview?.length ?? 0) > 20 && <div className="text-xs text-muted-foreground text-center py-2">…e mais {(preview?.length ?? 0) - 20} linha(s).</div>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>Cancelar</AlertDialogCancel>
            <Button type="button" onClick={confirmImport} disabled={uploading} className="bg-primary hover:bg-primary/90">
              {uploading ? "Importando..." : "Confirmar importação"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os produtos?</AlertDialogTitle>
            <AlertDialogDescription>Isto remove todos os {produtos.length} produto(s) cadastrados. A ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll} className="bg-destructive hover:bg-destructive/90">Limpar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =========== VENDAS (placeholder) ===========
function VendasTab() {
  return (
    <div className="rounded-xl border border-dashed bg-card p-10 text-center">
      <ShoppingCart className="h-10 w-10 text-primary mx-auto mb-3" />
      <h3 className="font-semibold text-navy mb-1">Importação de Vendas</h3>
      <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-4">
        Em breve: importe planilhas de vendas do ERP para conciliar sell out com fornecedores,
        apurar verbas cooperadas e gerar relatórios de performance por campanha.
      </p>
      <Button disabled variant="outline"><Upload className="h-4 w-4 mr-2" />Selecionar planilha de vendas</Button>
    </div>
  );
}
