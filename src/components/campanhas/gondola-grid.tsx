import { Tag, Pencil, Trash2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Oferta } from "./types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface GondolaGridProps {
  ofertas: Oferta[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (o: Oferta) => void;
  onDelete: (id: string) => void;
  readOnly: boolean;
}

export function GondolaGrid({
  ofertas,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  readOnly,
}: GondolaGridProps) {
  if (ofertas.length === 0) {
    return (
      <div className="py-14 text-center rounded-xl border border-dashed bg-card">
        <Tag className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-navy">Nenhuma oferta encontrada</p>
        <p className="text-xs text-muted-foreground">Ajuste os filtros de busca.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {ofertas.map((o) => {
        const isSelected = selectedIds.has(o.id);
        const desconto =
          o.precoNormal > 0 &&
          o.precoPromocional > 0 &&
          o.precoPromocional < o.precoNormal
            ? Math.round((1 - o.precoPromocional / o.precoNormal) * 100)
            : 0;
        const economia = Math.max(o.precoNormal - o.precoPromocional, 0);

        return (
          <div
            key={o.id}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-md ${
              isSelected
                ? "border-primary ring-1 ring-primary/40 bg-primary/5"
                : "border-border/70 hover:border-primary/40"
            }`}
          >
            {/* Topo do card: Checkbox e badges */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(o.id)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                )}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {o.codigo || o.gtin}
                </span>
              </div>

              <div className="flex items-center gap-1 flex-wrap justify-end">
                {o.clubeSumel && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] py-0 px-1.5 h-4">
                    Clube
                  </Badge>
                )}
                {desconto > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] font-bold py-0 px-1.5 h-4">
                    -{desconto}%
                  </Badge>
                )}
              </div>
            </div>

            {/* Descrição do Produto */}
            <h4
              className="font-semibold text-xs text-navy leading-snug line-clamp-2 min-h-[2rem] mb-2"
              title={o.descricao}
            >
              {o.descricao}
            </h4>

            {/* Bloco de Preço Promocional Destacado */}
            <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 mb-2.5 text-center">
              {o.precoNormal > 0 && (
                <div className="text-[11px] text-muted-foreground line-through tabular-nums leading-none mb-1">
                  De {brl(o.precoNormal)}
                </div>
              )}
              <div className="text-xl font-black tabular-nums text-primary leading-tight">
                {brl(o.precoPromocional)}
              </div>

              {/* Mecânica / Condição detalhada */}
              {o.tipoPromocao === "a_partir_de" && (
                <div className="mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded py-0.5 px-1 inline-block">
                  A partir de {o.quantidadeMinima} un
                </div>
              )}
              {o.tipoPromocao === "a_cada" && (
                <div className="mt-1 text-[10px] font-semibold text-purple-700 bg-purple-50 rounded py-0.5 px-1 inline-block">
                  A cada {o.quantidadeMinima} un ({brl(o.quantidadeMinima * o.precoPromocional)})
                </div>
              )}
              {o.tipoPromocao === "simples" && economia > 0 && (
                <div className="mt-1 text-[10px] text-emerald-700 font-medium">
                  Economia de {brl(economia)} por un
                </div>
              )}
            </div>

            {/* Rodapé do card: Sell Out e Ações */}
            <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
              <div>
                {o.selloutTemVerba ? (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
                    title={`Verba ${brl(o.selloutValor)} - ${o.selloutFornecedor}`}
                  >
                    <DollarSign className="h-3 w-3" /> {brl(o.selloutValor)}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">{o.categoria}</span>
                )}
              </div>

              {!readOnly && (
                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full hover:bg-muted"
                    onClick={() => onEdit(o)}
                    title="Editar oferta"
                  >
                    <Pencil className="h-3.5 w-3.5 text-navy" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full hover:bg-destructive/10"
                    onClick={() => onDelete(o.id)}
                    title="Excluir oferta"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
