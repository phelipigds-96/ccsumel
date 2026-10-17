import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Store,
  Truck,
  User,
  Tag,
  Package,
  Paperclip,
  FileText,
  ImageIcon,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DegustacaoStatusBadge } from "@/components/degustacoes/degustacao-status-badge";
import { brl, fmtDate } from "@/components/campanha-quick-view";
import {
  listDegustacaoProdutos,
  parseDegustacaoAnexos,
  getDegustacaoArquivoUrl,
  isDegustacaoImage,
  type Degustacao,
  type DegustacaoProduto,
  type AnexoDegustacao,
} from "@/lib/degustacoes";
import { toast } from "sonner";

interface DegustacaoQuickViewProps {
  degustacao: Degustacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DegustacaoQuickView({
  degustacao,
  open,
  onOpenChange,
}: DegustacaoQuickViewProps) {
  const [produtos, setProdutos] = useState<DegustacaoProduto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  useEffect(() => {
    if (open && degustacao) {
      setLoadingProdutos(true);
      listDegustacaoProdutos(degustacao.id)
        .then((items) => setProdutos(items))
        .catch((err) => {
          console.error("Erro ao carregar produtos:", err);
          toast.error("Erro ao carregar produtos da degustação");
        })
        .finally(() => setLoadingProdutos(false));
    } else {
      setProdutos([]);
    }
  }, [open, degustacao]);

  if (!degustacao) return null;

  const anexos = parseDegustacaoAnexos(degustacao);

  const handleOpenAnexo = async (anexo: AnexoDegustacao) => {
    try {
      const url = await getDegustacaoArquivoUrl(anexo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Não foi possível abrir o anexo.");
    }
  };

  const horarioFormatado =
    degustacao.horario_inicio || degustacao.horario_fim
      ? `${degustacao.horario_inicio ? degustacao.horario_inicio.slice(0, 5) : "--:--"} às ${degustacao.horario_fim ? degustacao.horario_fim.slice(0, 5) : "--:--"}`
      : "Horário não especificado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 border-b pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="text-navy text-xl font-bold flex items-center gap-2">
              <span>{degustacao.nome}</span>
            </DialogTitle>
            <DegustacaoStatusBadge status={degustacao.status} />
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Visualização informativa da operação de chão de loja</span>
            {degustacao.campanha_nome && (
              <Badge
                variant="outline"
                className="bg-primary/5 text-primary border-primary/20 text-[10px] gap-1 font-medium"
              >
                <Tag className="h-2.5 w-2.5" />
                {degustacao.campanha_nome}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-5">
          {/* Ficha Resumo da Operação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-lg border text-xs">
            <div className="flex items-center gap-2 text-foreground">
              <Store className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Loja / Filial
                </span>
                <span className="font-semibold text-navy">{degustacao.loja}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-foreground">
              <Truck className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Fornecedor Parceiro
                </span>
                <span className="font-semibold text-navy">{degustacao.fornecedor_nome}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Data do Evento
                </span>
                <span className="font-semibold text-navy">{fmtDate(degustacao.data)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Horário de Execução
                </span>
                <span className="font-semibold text-navy">{horarioFormatado}</span>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 text-foreground border-t pt-2">
              <User className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Promotor / Responsável em Loja
                </span>
                <span className="font-semibold text-navy">{degustacao.responsavel_nome}</span>
              </div>
            </div>
          </div>

          {/* Diretrizes / Observações de Espaço */}
          {degustacao.observacoes?.trim() && (
            <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20 dark:border-amber-900">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 text-[11px] uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" />
                Diretrizes e Orientações Operacionais
              </div>
              <p className="text-amber-950 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
                {degustacao.observacoes}
              </p>
            </div>
          )}

          {/* Produtos em Degustação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                Produtos da Ação ({produtos.length})
              </h4>
            </div>

            {loadingProdutos ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Carregando produtos participantes...
              </div>
            ) : produtos.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/10">
                Nenhum produto cadastrado para esta degustação.
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-[11px]">
                      <TableHead className="w-20">Código</TableHead>
                      <TableHead>Descrição do Produto</TableHead>
                      <TableHead className="text-center w-28">Tipo</TableHead>
                      <TableHead className="text-right w-24">Preço De</TableHead>
                      <TableHead className="text-right w-24">Preço Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((p) => (
                      <TableRow key={p.id} className="text-xs">
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {p.codigo ?? "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-navy leading-tight">{p.descricao}</div>
                          {p.gtin && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              EAN: {p.gtin}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {p.oferta_id ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              🏷️ Promoção
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 text-muted-foreground"
                            >
                              Regular
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.oferta_id ? (
                            <span className="line-through">{brl(Number(p.preco_base) || 0)}</span>
                          ) : (
                            <span>{brl(Number(p.preco_base) || 0)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {brl(Number(p.preco_praticado) || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Materiais para Impressão e Decoração */}
          {anexos.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                Materiais para Impressão e Decoração ({anexos.length})
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {anexos.map((m) => (
                  <li
                    key={m.path}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card p-2 text-xs shadow-2xs hover:border-primary/40 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDegustacaoImage(m.tipo) ? (
                        <ImageIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="truncate font-medium text-navy text-[11px]" title={m.nome}>
                        {m.nome}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenAnexo(m)}
                      className="h-7 text-xs text-primary gap-1 shrink-0 px-2"
                      title="Visualizar ou Imprimir"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visualizar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
