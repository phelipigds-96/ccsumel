import React, { useState, useEffect, useRef } from "react";
import { Search, Camera, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { listProdutos, findByCodigoOrGtin, type Produto } from "@/lib/produtos";
import { brl } from "@/components/campanha-quick-view";
import { toast } from "sonner";

interface ProductSearchProps {
  onSelect: (produto: Produto) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function ProductSearch({ onSelect, autoFocus = true, placeholder }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (searchTerm: string, isFromScanner = false) => {
    const term = searchTerm.trim();
    if (term.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Regra para códigos numéricos: 
      // Se for puramente numérico e não vier do scanner, aplicamos regras de espera
      const isNumeric = /^\d+$/.test(term);
      
      if (isNumeric && !isFromScanner) {
        // Se for 13 dígitos, tratamos como EAN-13 completo
        if (term.length === 13) {
          const exact = await findByCodigoOrGtin(term);
          if (exact) {
            onSelect(exact);
            setQuery("");
            setResults([]);
            setIsOpen(false);
            return;
          }
        }
        
        // Se for menos de 13 dígitos, só fazemos a busca exata por código se for um "Enter" ou se term.length >= 8
        // (Aqui handleSearch é chamado pelo debounce ou pelo Enter)
        if (term.length >= 8 || term.length === 0) {
           const exact = await findByCodigoOrGtin(term);
           if (exact) {
             onSelect(exact);
             setQuery("");
             setResults([]);
             setIsOpen(false);
             return;
           }
        }
        
        // Se for código interno curto (< 8 dígitos), buscamos por descrição/código na listagem geral
        const { rows } = await listProdutos(term, 1, 10);
        setResults(rows);
        setIsOpen(rows.length > 0);
      } else if (isFromScanner) {
        // Busca imediata vinda do scanner
        const exact = await findByCodigoOrGtin(term);
        if (exact) {
          onSelect(exact);
          setQuery("");
          setResults([]);
          setIsOpen(false);
          return;
        }
        const { rows } = await listProdutos(term, 1, 10);
        setResults(rows);
        setIsOpen(rows.length > 0);
      } else {
        // Busca por descrição (texto) - Autocomplete normal
        if (term.length < 3) {
          setResults([]);
          setIsOpen(false);
          return;
        }
        const { rows } = await listProdutos(term, 1, 10);
        setResults(rows);
        setIsOpen(rows.length > 0);
      }
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const isNumeric = /^\d+$/.test(val.trim());
    
    // Se for numérico, aguardamos o usuário terminar (13 dígitos ou debounce maior)
    // Se for texto, debounce normal (400ms)
    const debounceTime = isNumeric 
      ? (val.trim().length === 13 ? 100 : 1000) // Se for 13, dispara quase logo; senão espera 1s
      : 400;

    debounceRef.current = setTimeout(() => {
      handleSearch(val);
    }, debounceTime);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(query);
    }
  };

  const selectProduct = (p: Produto) => {
    onSelect(p);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="rounded-lg border bg-navy/5 p-3 mb-1">
        <Label className="text-xs text-muted-foreground">Localizar produto (Código, EAN ou Descrição)</Label>
        <div className="flex gap-2 mt-1.5">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              autoFocus={autoFocus}
              value={query}
              onChange={onChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Digite o código ou nome do produto..."}
              className="pr-10"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setScannerOpen(true)}
            title="Ler código de barras"
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            onClick={() => handleSearch(query)} 
            disabled={loading} 
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95 max-h-[300px] overflow-y-auto">
          <div className="p-1">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full flex flex-col items-start gap-1 rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer text-left border-b last:border-0"
                onClick={() => selectProduct(p)}
              >
                <div className="font-medium text-navy">{p.descricao}</div>
                <div className="flex justify-between w-full text-[10px] text-muted-foreground uppercase tracking-tight">
                  <span>Cód: {p.codigo} | EAN: {p.gtin || '-'}</span>
                  <span className="font-semibold text-primary">{brl(p.preco_venda)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 3 && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-4 text-center text-sm shadow-md">
          Nenhum produto encontrado.
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onResult={(code) => {
          setQuery(code);
          handleSearch(code, true);
        }}
      />
    </div>
  );
}
