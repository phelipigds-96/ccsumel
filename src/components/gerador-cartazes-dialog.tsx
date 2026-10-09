import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateCartazesPDF, CartazTemplate } from "@/lib/pdf-cartazes";
import { Campanha, Oferta } from "@/lib/campanhas-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export function GeradorCartazesDialog({
  campanha,
  ofertas,
  open,
  onOpenChange
}: {
  campanha: Campanha | null;
  ofertas: Oferta[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [templates, setTemplates] = useState<CartazTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      void loadTemplates();
      setSelectedOffers(ofertas.map(o => o.id));
    }
  }, [open, ofertas]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("cartaz_templates" as any).select("*").order("nome");
      if (error) throw error;
      setTemplates((data as any) || []);
    } catch (e) {
      toast.error("Erro ao carregar modelos de cartaz.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) {
      toast.error("Selecione um modelo de cartaz.");
      return;
    }
    const offersToPrint = ofertas.filter(o => selectedOffers.includes(o.id));
    if (offersToPrint.length === 0) {
      toast.error("Selecione ao menos um produto.");
      return;
    }

    setGenerating(true);
    try {
      const validade = campanha?.dataFinal 
        ? `Ofertas válidas até ${new Date(campanha.dataFinal + "T00:00:00").toLocaleDateString("pt-BR")}`
        : "";
      const pdfUrl = await generateCartazesPDF(offersToPrint, template, validade);
      window.open(pdfUrl, "_blank");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao gerar cartazes.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleOffer = (id: string) => {
    setSelectedOffers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar Cartazes de Loja</DialogTitle>
          <DialogDescription>
            Impressão vetorial em Meia Folha A4 na horizontal (2 cartazes por folha).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
          {loading ? (
            <div className="flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Modelo do Cartaz</label>
                {templates.length === 0 ? (
                  <p className="text-xs text-red-500">Nenhum modelo cadastrado. Acesse a rota /cartazes para criar.</p>
                ) : (
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Produtos para Imprimir</label>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedOffers(ofertas.map(o => o.id))}>Selecionar Todos</Button>
                </div>
                <div className="border rounded-md max-h-[200px] overflow-y-auto p-2 space-y-2 bg-muted/20">
                  {ofertas.map(o => (
                    <div key={o.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`chk-${o.id}`} 
                        checked={selectedOffers.includes(o.id)}
                        onCheckedChange={() => toggleOffer(o.id)}
                      />
                      <label htmlFor={`chk-${o.id}`} className="text-sm cursor-pointer truncate">
                        {o.descricao} <strong className="text-xs text-muted-foreground ml-2">R$ {o.precoPromocional?.toFixed(2)}</strong>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={generating || templates.length === 0}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Imprimir Cartazes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
