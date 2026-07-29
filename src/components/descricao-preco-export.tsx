import { useMemo, useState } from "react";
import { Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Campanha, Oferta } from "@/lib/campanhas-store";

type Sep = "espaco" | "tab" | "ponto-virgula";

const sepChar: Record<Sep, string> = { espaco: " ", tab: "\t", "ponto-virgula": ";" };

export function gerarDescricaoPreco(
  ofertas: Oferta[],
  separador: Sep = "espaco",
  decimal: "," | "." = ",",
): string {
  return ofertas
    .map((o) =>
      [(o.descricao || "").trim(), o.precoNormal.toFixed(2).replace(".", decimal)].join(sepChar[separador]),
    )
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

export function DescricaoPrecoDialog({
  campanha, ofertas, open, onOpenChange,
}: {
  campanha: Campanha;
  ofertas: Oferta[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [separador, setSeparador] = useState<Sep>("espaco");
  const [decimal, setDecimal] = useState<"," | ".">(",");

  const conteudo = useMemo(
    () => gerarDescricaoPreco(ofertas, separador, decimal),
    [ofertas, separador, decimal],
  );
  const totalLinhas = conteudo ? conteudo.split("\n").length : 0;

  const baixar = () => {
    const blob = new Blob([conteudo + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `descricao-preco-${slug(campanha.nome) || "campanha"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo gerado.");
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(conteudo);
    toast.success("Lista copiada.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar Descrição e Preço Atual</DialogTitle>
          <DialogDescription>
            Uma linha por oferta: descrição do produto e preço atual. Exemplo: Produto A 5,99
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Separador</Label>
            <Select value={separador} onValueChange={(v) => setSeparador(v as Sep)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="espaco">Espaço (Produto A 5,99)</SelectItem>
                <SelectItem value="tab">Tabulação</SelectItem>
                <SelectItem value="ponto-virgula">Ponto e vírgula</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Separador decimal</Label>
            <Select value={decimal} onValueChange={(v) => setDecimal(v as "," | ".")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Vírgula (5,99)</SelectItem>
                <SelectItem value=".">Ponto (5.99)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Prévia — {totalLinhas} linha(s)</Label>
          <Textarea readOnly value={conteudo} rows={10} className="font-mono text-xs" />
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
