import { useState, useEffect, useMemo } from "react";
import { Search, Target, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { listOportunidades, type Oportunidade } from "@/lib/oportunidades";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface BancoOportunidadesSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (o: Oportunidade) => void;
}

export function BancoOportunidadesSelectDialog({
  open,
  onOpenChange,
  onSelect,
}: BancoOportunidadesSelectDialogProps) {
  const [opts, setOpts] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setLoading(true);
      listOportunidades()
        .then((data) => {
          setOpts(data.filter((o) => o.status === "Disponível"));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return opts.filter(
      (o) =>
        o.descricao.toLowerCase().includes(q) ||
        o.gtin?.includes(q) ||
        o.codigo_interno?.includes(q)
    );
  }, [opts, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl text-navy">
            <Target className="h-5 w-5 text-primary" /> Selecionar do Banco de Oportunidades
          </DialogTitle>
          <DialogDescription>
            Escolha um item disponível para adicionar a esta campanha.
          </DialogDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, código ou barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full border-border/70"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm">Carregando oportunidades...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <Package className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">Nenhuma oportunidade disponível</p>
              <p className="text-xs">Ajuste os filtros ou cadastre novas oportunidades.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onSelect(o)}
                  className="flex items-center justify-between rounded-xl border border-border/70 p-4 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-navy truncate">{o.descricao}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 shrink-0 ${
                          o.prioridade === "Alta"
                            ? "bg-red-50 text-red-600 border-red-200"
                            : o.prioridade === "Média"
                            ? "bg-orange-50 text-orange-600 border-orange-200"
                            : "bg-blue-50 text-blue-600 border-blue-200"
                        }`}
                      >
                        {o.prioridade}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{o.gtin || o.codigo_interno}</span>
                      <span>•</span>
                      <span>{o.motivo}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <div className="text-sm font-bold text-navy">{brl(o.preco_venda)}</div>
                    <div className="text-[10px] text-muted-foreground">Custo {brl(o.custo)}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 rounded-full text-[10px] px-2"
                    >
                      Selecionar <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
