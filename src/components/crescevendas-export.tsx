import { useMemo, useState } from "react";
import { Download, Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Campanha, Oferta } from "@/lib/campanhas-store";

/** Extrai todos os códigos de barras informados no campo "cresce vendas". */
function codigosDaOferta(o: Oferta): string[] {
  const extras = (o.gtinsCresceVendas || "")
    .split(/[^0-9]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  if (extras.length) return Array.from(new Set(extras));
  const principal = (o.gtin || "").replace(/\D/g, "");
  if (principal) return [principal];
  return o.codigo ? [String(o.codigo).trim()] : [];
}

const fmtNum = (n: number, decimal: "," | ".") =>
  n.toFixed(2).replace(".", decimal);

export function gerarCresceVendas(
  ofertas: Oferta[],
  limite: number,
  decimal: "," | "." = ",",
): string {
  const linhas: string[] = [];
  for (const o of ofertas) {
    for (const cod of codigosDaOferta(o)) {
      linhas.push(
        [cod, fmtNum(o.precoNormal, decimal), fmtNum(o.precoPromocional, decimal), String(limite)].join(";"),
      );
    }
  }
  return linhas.join("\n");
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

export function CresceVendasDialog({
  campanha, ofertas, open, onOpenChange,
}: {
  campanha: Campanha;
  ofertas: Oferta[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [limite, setLimite] = useState(1);
  const [decimal, setDecimal] = useState<"," | ".">(",");

  const conteudo = useMemo(
    () => gerarCresceVendas(ofertas, limite, decimal),
    [ofertas, limite, decimal],
  );
  const totalLinhas = conteudo ? conteudo.split("\n").length : 0;

  const baixar = () => {
    const blob = new Blob([conteudo + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crescevendas-${slug(campanha.nome) || "campanha"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo gerado para importação na CresceVendas.");
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(conteudo);
    toast.success("Descontos copiados.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar para CresceVendas</DialogTitle>
          <DialogDescription>
            Uma linha por desconto: código; preço; preço promocional; limite por cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cv-limite">Limite por cliente</Label>
            <Input
              id="cv-limite" type="number" min={1} value={limite}
              onChange={(e) => setLimite(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Separador decimal</Label>
            <Select value={decimal} onValueChange={(v) => setDecimal(v as "," | ".")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Vírgula (9,99)</SelectItem>
                <SelectItem value=".">Ponto (9.99)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Prévia — {totalLinhas} linha(s)</Label>
          <Textarea readOnly value={conteudo} rows={10} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">
            Produtos com "códigos de barras cresce vendas" geram uma linha para cada variação.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copiar} disabled={!conteudo}>
            <Copy className="mr-2 h-4 w-4" />Copiar
          </Button>
          <Button onClick={baixar} disabled={!conteudo} className="bg-primary hover:bg-primary/90">
            <FileDown className="mr-2 h-4 w-4" />Baixar .txt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Download };
