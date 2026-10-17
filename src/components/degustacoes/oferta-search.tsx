import React, { useState, useMemo } from "react";
import { Search, Tag, Calendar, Sparkles, Filter, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCampanhasStore,
  statusCampanha,
  fmtCondicaoOferta,
  type Oferta,
  type Campanha,
} from "@/lib/campanhas-store";
import { brl, fmtDate } from "@/components/campanha-quick-view";

export interface SelectedOfertaItem {
  oferta: Oferta;
  campanha: Campanha;
}

interface OfertaSearchProps {
  onSelect: (item: SelectedOfertaItem) => void;
  selectedLoja?: string;
  defaultCampanhaId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function OfertaSearch({
  onSelect,
  selectedLoja,
  defaultCampanhaId,
  placeholder = "Buscar oferta por produto, código, EAN ou nome da campanha...",
  autoFocus = false,
}: OfertaSearchProps) {
  const { campanhas, ofertas, carregando } = useCampanhasStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampanhaFilter, setSelectedCampanhaFilter] = useState<string>(
    defaultCampanhaId || "TODAS",
  );

  // Mapear campanhas válidas (apenas Ativas e Programadas)
  const campanhasValidas = useMemo(() => {
    return campanhas.filter((c) => {
      const st = statusCampanha(c);
      return st === "Ativa" || st === "Programada";
    });
  }, [campanhas]);

  const campanhasMap = useMemo(() => {
    return new Map<string, Campanha>(campanhasValidas.map((c) => [c.id, c]));
  }, [campanhasValidas]);

  // Filtrar ofertas pertencentes às campanhas válidas
  const ofertasElegiveis = useMemo(() => {
    return ofertas
      .map((o) => {
        const c = campanhasMap.get(o.campanhaId);
        if (!c) return null;
        return { oferta: o, campanha: c };
      })
      .filter((x): x is SelectedOfertaItem => x !== null);
  }, [ofertas, campanhasMap]);

  // Aplicar busca e filtro de campanha selecionada
  const filteredResultados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return ofertasElegiveis.filter(({ oferta, campanha }) => {
      // Filtro de Campanha específica
      if (selectedCampanhaFilter !== "TODAS" && campanha.id !== selectedCampanhaFilter) {
        return false;
      }

      // Filtro de texto (descrição, código, GTIN ou nome da campanha)
      if (q) {
        const descMatch = (oferta.descricao || "").toLowerCase().includes(q);
        const codMatch = (oferta.codigo || "").toLowerCase().includes(q);
        const gtinMatch = (oferta.gtin || "").toLowerCase().includes(q);
        const campMatch = (campanha.nome || "").toLowerCase().includes(q);
        const fornMatch = (oferta.fornecedor || "").toLowerCase().includes(q);
        if (!descMatch && !codMatch && !gtinMatch && !campMatch && !fornMatch) {
          return false;
        }
      }

      return true;
    });
  }, [ofertasElegiveis, searchTerm, selectedCampanhaFilter]);

  return (
    <div className="space-y-3">
      {/* Barra de Filtro de Campanha e Campo de Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-5">
          <Select
            value={selectedCampanhaFilter}
            onValueChange={setSelectedCampanhaFilter}
          >
            <SelectTrigger className="w-full text-xs h-9">
              <SelectValue placeholder="Filtrar por Campanha..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="TODAS">
                Todas as campanhas ({campanhasValidas.length})
              </SelectItem>
              {campanhasValidas.map((c) => {
                const st = statusCampanha(c);
                return (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="font-medium">{c.nome}</span>{" "}
                    <span className="text-muted-foreground text-[10px]">
                      ({st} • {fmtDate(c.dataInicial)} a {fmtDate(c.dataFinal)})
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-7 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus={autoFocus}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="pl-8 pr-8 text-xs h-9"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Resultados de Ofertas */}
      <div className="rounded-lg border bg-muted/10 max-h-72 overflow-y-auto divide-y divide-border/60">
        {carregando ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Carregando ofertas de campanhas...
          </div>
        ) : filteredResultados.length === 0 ? (
          <div className="p-6 text-center space-y-1.5">
            <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-accent/60">
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-foreground">
              Nenhuma oferta encontrada em campanhas ativas ou programadas.
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Se este produto não possuir promoção ativa, você pode alternar para a aba{" "}
              <strong>Produto Regular</strong> e cadastrá-lo com o preço padrão da loja.
            </p>
          </div>
        ) : (
          filteredResultados.map(({ oferta, campanha }) => {
            const st = statusCampanha(campanha);
            const desconto =
              oferta.precoNormal > 0 && oferta.precoPromocional > 0
                ? Math.round((1 - oferta.precoPromocional / oferta.precoNormal) * 100)
                : 0;

            return (
              <div
                key={oferta.id}
                className="p-3 hover:bg-accent/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy text-sm truncate">
                      {oferta.descricao}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-medium ${
                        st === "Ativa"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-blue-50 text-blue-700 border-blue-300"
                      }`}
                    >
                      {campanha.nome} ({st})
                    </Badge>
                    {oferta.clubeSumel && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/20"
                      >
                        Clube Sumel
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] flex-wrap">
                    {oferta.codigo && (
                      <span className="font-mono bg-muted px-1 rounded">
                        Cód: {oferta.codigo}
                      </span>
                    )}
                    {oferta.gtin && (
                      <span className="font-mono bg-muted px-1 rounded">
                        EAN: {oferta.gtin}
                      </span>
                    )}
                    {oferta.fornecedor && (
                      <span>Fornecedor: {oferta.fornecedor}</span>
                    )}
                    <span>• Vigência: {fmtDate(campanha.dataInicial)} a {fmtDate(campanha.dataFinal)}</span>
                  </div>
                </div>

                {/* Preços e Ação */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground line-through">
                      De {brl(oferta.precoNormal)}
                    </div>
                    <div className="font-bold text-sm text-primary flex items-center gap-1 justify-end">
                      {desconto > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded">
                          -{desconto}%
                        </span>
                      )}
                      <span>{brl(oferta.precoPromocional)}</span>
                    </div>
                    {oferta.tipoPromocao && oferta.tipoPromocao !== "simples" && (
                      <div className="text-[10px] text-amber-700 font-medium">
                        {fmtCondicaoOferta(oferta)}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-primary hover:bg-primary/90 text-white font-medium"
                    onClick={() => onSelect({ oferta, campanha })}
                  >
                    Selecionar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
        <span>
          Exibindo {filteredResultados.length} oferta(s) elegível(is)
        </span>
        {selectedCampanhaFilter !== "TODAS" && (
          <button
            type="button"
            onClick={() => setSelectedCampanhaFilter("TODAS")}
            className="text-primary hover:underline"
          >
            Ver todas as campanhas
          </button>
        )}
      </div>
    </div>
  );
}
