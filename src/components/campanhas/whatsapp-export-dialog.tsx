import { useState, useMemo } from "react";
import { MessageSquare, Copy, Check, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { type Campanha, type Oferta, formatFiliais } from "./types";

interface WhatsappExportDialogProps {
  campanha: Campanha | null;
  ofertas: Oferta[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function getCategoriaEmoji(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("bebid")) return "🍺";
  if (c.includes("carn") || c.includes("açougue") || c.includes("frio")) return "🥩";
  if (c.includes("padar")) return "🥖";
  if (c.includes("horti") || c.includes("frut") || c.includes("verdura")) return "🍎";
  if (c.includes("limpez")) return "🧼";
  if (c.includes("higien")) return "🧴";
  return "🛒";
}

export function WhatsappExportDialog({
  campanha,
  ofertas,
  open,
  onOpenChange,
}: WhatsappExportDialogProps) {
  const [copied, setCopied] = useState(false);

  const textoWhatsApp = useMemo(() => {
    if (!campanha) return "";

    const lines: string[] = [];
    lines.push(`🔥 *SUPERMERCADOS SUMEL — OFERTAS DA SEMANA* 🔥`);
    lines.push(`📢 *${campanha.nome.toUpperCase()}*`);
    if (campanha.descricao) {
      lines.push(`ℹ️ _${campanha.descricao}_`);
    }
    lines.push(`📅 *Vigência:* ${fmtDate(campanha.dataInicial)} até ${fmtDate(campanha.dataFinal)}`);
    lines.push(`📍 *Válido em:* ${formatFiliais(campanha.filiais)}`);
    lines.push(``);
    lines.push(`🛍️ *CONFIRA OS DESTAQUES:*`);

    if (ofertas.length === 0) {
      lines.push(`_(Nenhum produto cadastrado nesta campanha)_`);
    } else {
      ofertas.forEach((o) => {
        const emoji = getCategoriaEmoji(o.categoria);
        const clubeTag = o.clubeSumel ? ` ⭐ *Exclusivo Clube Sumel*` : "";

        if (o.tipoPromocao === "a_partir_de") {
          lines.push(
            `${emoji} *${o.descricao}*${clubeTag}\n   📦 A partir de ${o.quantidadeMinima} un sai por *${brl(o.precoPromocional)} cada*`
          );
        } else if (o.tipoPromocao === "a_cada") {
          const total = (o.quantidadeMinima || 1) * o.precoPromocional;
          lines.push(
            `${emoji} *${o.descricao}*${clubeTag}\n   🔁 A cada ${o.quantidadeMinima} un sai por *${brl(total)}* (${brl(o.precoPromocional)} cada)`
          );
        } else {
          const deTexto = o.precoNormal > 0 ? `De ~${brl(o.precoNormal)}~ por ` : "Por ";
          lines.push(
            `${emoji} *${o.descricao}*${clubeTag}\n   🏷️ ${deTexto}*${brl(o.precoPromocional)}*`
          );
        }
      });
    }

    lines.push(``);
    lines.push(`⚠️ *Ofertas válidas enquanto durarem os estoques.*`);
    lines.push(`Supermercados Sumel — Mais economia para o seu dia a dia! 💙`);

    return lines.join("\n");
  }, [campanha, ofertas]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textoWhatsApp);
      setCopied(true);
      toast.success("Texto formatado para WhatsApp copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleOpenWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoWhatsApp)}`;
    window.open(url, "_blank");
  };

  if (!campanha) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-navy text-lg">
            <MessageSquare className="h-5 w-5 text-emerald-600" /> Exportar para WhatsApp
          </DialogTitle>
          <DialogDescription>
            Texto formatado pronto para envio em grupos, listas de transmissão e redes sociais.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {/* Card estilo WhatsApp */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 text-xs font-mono leading-relaxed text-emerald-950 whitespace-pre-wrap select-all shadow-xs">
            {textoWhatsApp}
          </div>
        </div>

        <DialogFooter className="p-6 pt-3 border-t bg-muted/10 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenWhatsApp}
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no WhatsApp
          </Button>
          <Button
            size="sm"
            onClick={handleCopy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar Texto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
