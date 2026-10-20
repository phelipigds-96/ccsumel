import React, { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Truck,
  User,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  FileCheck2,
  RotateCcw,
  Ban,
  Play,
  CheckCircle,
  FileText,
  History,
  Package,
  Paperclip,
  Upload,
  ImageIcon,
  ExternalLink,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductSearch } from "@/components/product-search";
import { OfertaSearch, type SelectedOfertaItem } from "@/components/degustacoes/oferta-search";
import { DegustacaoStatusBadge } from "@/components/degustacoes/degustacao-status-badge";
import { JustificativaDialog } from "@/components/degustacoes/justificativa-dialog";
import {
  listDegustacaoProdutos,
  addDegustacaoProduto,
  updateDegustacaoProduto,
  deleteDegustacaoProduto,
  listDegustacaoHistorico,
  cancelDegustacao,
  concluirDegustacao,
  reabrirDegustacao,
  mudarStatusDegustacao,
  updateDegustacao,
  getTodayDegustacaoIso,
  getStatusEfetivoDegustacao,
  type Degustacao,
  type DegustacaoProduto,
  type DegustacaoHistorico,
  type DegustacaoStatus,
  type AnexoDegustacao,
  uploadDegustacaoArquivo,
  removeDegustacaoArquivo,
  getDegustacaoArquivoUrl,
  updateDegustacaoAnexos,
  parseDegustacaoAnexos,
  isDegustacaoImage,
  DEGUSTACOES_FILE_ACCEPT,
} from "@/lib/degustacoes";
import type { Produto } from "@/lib/produtos";
import { brl } from "@/components/campanha-quick-view";

interface DegustacaoDetalhesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  degustacao: Degustacao | null;
  isMaster: boolean;
  currentUser?: { name?: string; username?: string };
  onRefreshList: () => void;
  onEditAgendamento: (degustacao: Degustacao) => void;
}

export function DegustacaoDetalhesSheet({
  open,
  onOpenChange,
  degustacao,
  isMaster,
  currentUser,
  onRefreshList,
  onEditAgendamento,
}: DegustacaoDetalhesSheetProps) {
  const [currentDegustacao, setCurrentDegustacao] = useState<Degustacao | null>(degustacao);
  const [produtos, setProdutos] = useState<DegustacaoProduto[]>([]);
  const [historico, setHistorico] = useState<DegustacaoHistorico[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [activeTab, setActiveTab] = useState("produtos");
  const [addProductMode, setAddProductMode] = useState<"oferta" | "produto">("oferta");

  // State para edição de preços e quantidades na tabela de produtos
  const [editValues, setEditValues] = useState<
    Record<string, { preco_praticado: number; quantidade_vendida: number }>
  >({});
  const [savingProdutoId, setSavingProdutoId] = useState<string | null>(null);

  // Dialog de Justificativa state
  const [justificativaModal, setJustificativaModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: "default" | "destructive" | "secondary";
    actionType: "CANCEL" | "REOPEN" | "CONCLUDE_EDIT" | "ITEM_UPDATE" | "ITEM_DELETE";
    payload?: any;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    confirmVariant: "default",
    actionType: "CANCEL",
  });

  // Modal de Conclusão / Apuração de Resultados
  const [concluirModalOpen, setConcluirModalOpen] = useState(false);
  const [observacoesResultados, setObservacoesResultados] = useState("");
  const [concluding, setConcluding] = useState(false);

  // Anexos e Materiais de Apoio
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const anexos = useMemo(
    () => parseDegustacaoAnexos(currentDegustacao),
    [currentDegustacao],
  );

  const handleUploadFiles = async (files: FileList | null) => {
    if (!currentDegustacao || !files || files.length === 0) return;
    setUploadingFiles(true);
    const added: AnexoDegustacao[] = [];
    for (const file of Array.from(files)) {
      try {
        const anexo = await uploadDegustacaoArquivo(currentDegustacao.id, file);
        added.push(anexo);
      } catch (err) {
        toast.error((err as Error).message);
      }
    }

    if (added.length > 0) {
      try {
        const novosAnexos = [...anexos, ...added];
        const updated = await updateDegustacaoAnexos(currentDegustacao.id, novosAnexos);
        setCurrentDegustacao(updated);
        onRefreshList();
        toast.success(`${added.length} material(is) anexado(s) com sucesso.`);
      } catch (err) {
        toast.error("Erro ao salvar novos anexos.");
      }
    }
    setUploadingFiles(false);
  };

  const handleRemoveAnexo = async (anexo: AnexoDegustacao) => {
    if (!currentDegustacao) return;
    try {
      await removeDegustacaoArquivo(anexo);
      const novosAnexos = anexos.filter((a) => a.path !== anexo.path);
      const updated = await updateDegustacaoAnexos(currentDegustacao.id, novosAnexos);
      setCurrentDegustacao(updated);
      onRefreshList();
      toast.success("Arquivo removido.");
    } catch (err) {
      toast.error("Erro ao remover arquivo.");
    }
  };

  const handleOpenAnexo = async (anexo: AnexoDegustacao) => {
    try {
      const url = await getDegustacaoArquivoUrl(anexo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Não foi possível abrir o anexo.");
    }
  };

  // Sincroniza dados da degustação selecionada com status de ciclo de vida atualizado
  useEffect(() => {
    if (degustacao) {
      setCurrentDegustacao({
        ...degustacao,
        status: getStatusEfetivoDegustacao(degustacao),
      });
    } else {
      setCurrentDegustacao(null);
    }
    if (degustacao && open) {
      loadProdutos(degustacao.id);
      loadHistorico(degustacao.id);
      setObservacoesResultados(degustacao.observacoes_resultados ?? "");
    }
  }, [degustacao, open]);

  const loadProdutos = async (degustacaoId: string) => {
    setLoadingProdutos(true);
    try {
      const items = await listDegustacaoProdutos(degustacaoId);
      setProdutos(items);

      // Preenche os campos editáveis
      const initialEdits: Record<
        string,
        { preco_praticado: number; quantidade_vendida: number }
      > = {};
      items.forEach((p) => {
        initialEdits[p.id] = {
          preco_praticado: Number(p.preco_praticado) || 0,
          quantidade_vendida: Number(p.quantidade_vendida) || 0,
        };
      });
      setEditValues(initialEdits);
    } catch (err) {
      toast.error("Erro ao carregar produtos da degustação.");
    } finally {
      setLoadingProdutos(false);
    }
  };

  const loadHistorico = async (degustacaoId: string) => {
    setLoadingHistorico(true);
    try {
      const data = await listDegustacaoHistorico(degustacaoId);
      setHistorico(data);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Totais calculados
  const totais = useMemo(() => {
    let qtd = 0;
    let fat = 0;
    produtos.forEach((p) => {
      const e = editValues[p.id];
      const q = e ? e.quantidade_vendida : p.quantidade_vendida;
      const pr = e ? e.preco_praticado : p.preco_praticado;
      qtd += Number(q) || 0;
      fat += (Number(q) || 0) * (Number(pr) || 0);
    });
    return { qtd, fat };
  }, [produtos, editValues]);

  // Adicionar produto
  const handleAddProduto = async (produto: Produto) => {
    if (!currentDegustacao) return;

    // Verificar se já existe
    const exists = produtos.some((p) => p.produto_id === produto.id || p.codigo === produto.codigo);
    if (exists) {
      toast.info("Este produto já foi adicionado a esta degustação.");
      return;
    }

    // Se a degustação já estiver concluída, exigir justificativa
    if (currentDegustacao.status === "Concluída") {
      setJustificativaModal({
        open: true,
        title: "Justificativa Obrigatória",
        description:
          "Esta degustação já foi concluída. Adicionar um novo item exige o registro de uma justificativa no histórico de auditoria.",
        confirmLabel: "Adicionar Item",
        confirmVariant: "default",
        actionType: "ITEM_UPDATE",
        payload: { produtoToAdd: produto },
      });
      return;
    }

    try {
      await addDegustacaoProduto({
        degustacao_id: currentDegustacao.id,
        produto_id: produto.id,
        codigo: produto.codigo,
        gtin: produto.gtin,
        descricao: produto.descricao,
        preco_base: produto.preco_venda || 0,
        preco_praticado: produto.preco_venda || 0,
        quantidade_vendida: 0,
      });

      toast.success("Produto adicionado à degustação!");
      await loadProdutos(currentDegustacao.id);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } catch (err) {
      toast.error("Falha ao adicionar produto", { description: (err as Error).message });
    }
  };

  // Adicionar oferta específica de campanha
  const handleAddOferta = async (item: SelectedOfertaItem) => {
    if (!currentDegustacao) return;

    const { oferta, campanha } = item;

    // Verificar se já existe (por oferta_id, código ou gtin)
    const exists = produtos.some(
      (p) =>
        (p.oferta_id && p.oferta_id === oferta.id) ||
        (oferta.codigo && p.codigo === oferta.codigo) ||
        (oferta.gtin && p.gtin === oferta.gtin)
    );
    if (exists) {
      toast.info("Esta oferta já foi adicionada a esta degustação.");
      return;
    }

    if (currentDegustacao.status === "Concluída") {
      setJustificativaModal({
        open: true,
        title: "Justificativa Obrigatória",
        description:
          "Esta degustação já foi concluída. Adicionar um novo item exige o registro de uma justificativa no histórico de auditoria.",
        confirmLabel: "Adicionar Item",
        confirmVariant: "default",
        actionType: "ITEM_UPDATE",
        payload: {
          insertData: {
            degustacao_id: currentDegustacao.id,
            oferta_id: oferta.id,
            codigo: oferta.codigo || null,
            gtin: oferta.gtin || null,
            descricao: oferta.descricao,
            preco_base: oferta.precoNormal || 0,
            preco_praticado: oferta.precoPromocional || 0,
            quantidade_vendida: 0,
          },
          campanhaToAdd: campanha,
        },
      });
      return;
    }

    try {
      await addDegustacaoProduto({
        degustacao_id: currentDegustacao.id,
        oferta_id: oferta.id,
        codigo: oferta.codigo || null,
        gtin: oferta.gtin || null,
        descricao: oferta.descricao,
        preco_base: oferta.precoNormal || 0,
        preco_praticado: oferta.precoPromocional || 0,
        quantidade_vendida: 0,
      });

      // Se a degustação ainda não tiver campanha vinculada, vincula a campanha desta oferta
      if (!currentDegustacao.campanha_id) {
        await updateDegustacao(currentDegustacao.id, {
          campanha_id: campanha.id,
          campanha_nome: campanha.nome,
        });
        setCurrentDegustacao((prev) =>
          prev ? { ...prev, campanha_id: campanha.id, campanha_nome: campanha.nome } : prev,
        );
      }

      toast.success(`Oferta "${oferta.descricao}" adicionada à degustação!`);
      await loadProdutos(currentDegustacao.id);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } catch (err) {
      toast.error("Falha ao adicionar oferta", { description: (err as Error).message });
    }
  };

  // Salvar alterações de um produto
  const handleSaveProduto = async (p: DegustacaoProduto) => {
    if (!currentDegustacao) return;
    const values = editValues[p.id];
    if (!values) return;

    if (values.quantidade_vendida < 0 || values.preco_praticado < 0) {
      toast.error("Quantidade e preço não podem ser negativos.");
      return;
    }

    // Se estiver concluída, requer justificativa
    if (currentDegustacao.status === "Concluída") {
      setJustificativaModal({
        open: true,
        title: "Justificativa Obrigatória",
        description:
          "Esta degustação já foi concluída. Alterar quantidades ou preços de produtos exige justificativa para a auditoria.",
        confirmLabel: "Salvar Alterações",
        confirmVariant: "default",
        actionType: "ITEM_UPDATE",
        payload: { produtoId: p.id, values },
      });
      return;
    }

    setSavingProdutoId(p.id);
    try {
      await updateDegustacaoProduto(p.id, {
        preco_praticado: values.preco_praticado,
        quantidade_vendida: values.quantidade_vendida,
      });

      // Se a degustação ainda estava em 'Programada' ou 'Ativa', atualiza seu status para 'Aguardando Resultados'
      // para refletir que a apuração de resultados já foi iniciada
      let statusAvisado = false;
      if (currentDegustacao.status === "Programada" || currentDegustacao.status === "Ativa") {
        try {
          const updated = await updateDegustacao(currentDegustacao.id, {
            status: "Aguardando Resultados",
          });
          setCurrentDegustacao(updated);
          statusAvisado = true;
        } catch (statusErr) {
          console.warn("Avanço de status para Aguardando Resultados:", statusErr);
        }
      }

      toast.success("Resultados do produto salvos!", {
        description: statusAvisado
          ? "Status da degustação avançou para 'Aguardando Resultados'. Ao terminar de lançar os itens, clique em 'Apurar e Concluir'."
          : undefined,
      });
      await loadProdutos(currentDegustacao.id);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } catch (err) {
      toast.error("Erro ao salvar produto", { description: (err as Error).message });
    } finally {
      setSavingProdutoId(null);
    }
  };

  // Excluir produto
  const handleDeleteProduto = async (p: DegustacaoProduto) => {
    if (!currentDegustacao) return;

    if (currentDegustacao.status === "Concluída") {
      setJustificativaModal({
        open: true,
        title: "Justificativa de Exclusão de Item",
        description:
          "Esta degustação já foi concluída. A remoção de produtos afeta o faturamento final e requer justificativa obrigatória.",
        confirmLabel: "Excluir Item",
        confirmVariant: "destructive",
        actionType: "ITEM_DELETE",
        payload: { produtoId: p.id },
      });
      return;
    }

    if (!confirm(`Remover "${p.descricao}" da degustação?`)) return;

    try {
      await deleteDegustacaoProduto(p.id, currentDegustacao.id);
      toast.success("Produto removido.");
      await loadProdutos(currentDegustacao.id);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } catch (err) {
      toast.error("Falha ao remover produto", { description: (err as Error).message });
    }
  };

  // Transições de status diretas (Programada -> Ativa, Ativa -> Aguardando Resultados)
  const handleStatusChange = async (novoStatus: DegustacaoStatus) => {
    if (!currentDegustacao) return;
    try {
      const updated = await mudarStatusDegustacao(currentDegustacao.id, novoStatus);
      setCurrentDegustacao(updated);
      toast.success(`Status alterado para "${novoStatus}"`);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } catch (err) {
      toast.error("Erro ao alterar status", { description: (err as Error).message });
    }
  };

  // Concluir degustação (com validação de produtos e auto-save de edições pendentes)
  const handleOpenConcluirModal = async () => {
    if (!currentDegustacao) return;
    if (produtos.length === 0) {
      toast.error(
        "Não é possível concluir uma degustação sem produtos vinculados. Adicione pelo menos um produto antes de concluir.",
      );
      return;
    }

    // Auto-save: Salva automaticamente valores pendentes que ainda não tenham sido gravados manualmente
    let houveAlteracao = false;
    for (const p of produtos) {
      const val = editValues[p.id];
      if (
        val &&
        (Number(val.quantidade_vendida) !== Number(p.quantidade_vendida) ||
          Number(val.preco_praticado) !== Number(p.preco_praticado))
      ) {
        houveAlteracao = true;
        try {
          await updateDegustacaoProduto(p.id, {
            preco_praticado: Number(val.preco_praticado) || 0,
            quantidade_vendida: Number(val.quantidade_vendida) || 0,
          });
        } catch (e) {
          console.warn("Falha no auto-save de item pendente antes de concluir:", e);
        }
      }
    }
    if (houveAlteracao) {
      await loadProdutos(currentDegustacao.id);
    }

    setConcluirModalOpen(true);
  };

  const handleConfirmConcluir = async () => {
    if (!currentDegustacao) return;
    setConcluding(true);
    try {
      const updated = await concluirDegustacao(currentDegustacao.id, {
        observacoesResultados,
        userName: currentUser?.name || currentUser?.username || "Administrador",
      });
      setCurrentDegustacao(updated);
      toast.success("Degustação concluída e resultados registrados com sucesso!");
      setConcluirModalOpen(false);
      await loadProdutos(currentDegustacao.id);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } catch (err) {
      toast.error("Erro ao concluir degustação", { description: (err as Error).message });
    } finally {
      setConcluding(false);
    }
  };

  // Reabrir degustação
  const handleTriggerReabrir = () => {
    setJustificativaModal({
      open: true,
      title: "Reabrir Degustação",
      description:
        "Informe a justificativa técnica para reabrir esta degustação e permitir a reedição dos resultados.",
      confirmLabel: "Reabrir Degustação",
      confirmVariant: "default",
      actionType: "REOPEN",
    });
  };

  // Cancelar degustação
  const handleTriggerCancelar = () => {
    setJustificativaModal({
      open: true,
      title: "Cancelar Degustação",
      description:
        "O cancelamento é definitivo e exige uma justificativa para o histórico permanente de auditoria.",
      confirmLabel: "Confirmar Cancelamento",
      confirmVariant: "destructive",
      actionType: "CANCEL",
    });
  };

  // Processamento do modal de justificativa
  const handleJustificativaConfirm = async (justificativa: string) => {
    if (!currentDegustacao) return;

    if (justificativaModal.actionType === "CANCEL") {
      const updated = await cancelDegustacao(currentDegustacao.id, justificativa);
      setCurrentDegustacao(updated);
      toast.success("Degustação cancelada com registro de auditoria.");
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } else if (justificativaModal.actionType === "REOPEN") {
      const updated = await reabrirDegustacao(
        currentDegustacao.id,
        "Aguardando Resultados",
        justificativa,
      );
      setCurrentDegustacao(updated);
      toast.success("Degustação reaberta para 'Aguardando Resultados'.");
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } else if (justificativaModal.actionType === "ITEM_UPDATE") {
      const { produtoId, values, produtoToAdd, insertData, campanhaToAdd } = justificativaModal.payload || {};
      if (insertData) {
        await addDegustacaoProduto(insertData, justificativa);
        if (campanhaToAdd && !currentDegustacao.campanha_id) {
          await updateDegustacao(
            currentDegustacao.id,
            {
              campanha_id: campanhaToAdd.id,
              campanha_nome: campanhaToAdd.nome,
            },
            justificativa,
          );
          setCurrentDegustacao((prev) =>
            prev ? { ...prev, campanha_id: campanhaToAdd.id, campanha_nome: campanhaToAdd.nome } : prev,
          );
        }
        toast.success("Oferta adicionada à degustação concluída.");
      } else if (produtoToAdd) {
        await addDegustacaoProduto(
          {
            degustacao_id: currentDegustacao.id,
            produto_id: produtoToAdd.id,
            codigo: produtoToAdd.codigo,
            gtin: produtoToAdd.gtin,
            descricao: produtoToAdd.descricao,
            preco_base: produtoToAdd.preco_venda || 0,
            preco_praticado: produtoToAdd.preco_venda || 0,
            quantidade_vendida: 0,
          },
          justificativa,
        );
        toast.success("Produto adicionado à degustação concluída.");
      } else if (produtoId && values) {
        await updateDegustacaoProduto(
          produtoId,
          {
            preco_praticado: values.preco_praticado,
            quantidade_vendida: values.quantidade_vendida,
          },
          justificativa,
        );
        toast.success("Valores do produto atualizados na degustação concluída.");
      }
      await loadProdutos(currentDegustacao.id);
      await loadHistorico(currentDegustacao.id);
      onRefreshList();
    } else if (justificativaModal.actionType === "ITEM_DELETE") {
      const { produtoId } = justificativaModal.payload || {};
      if (produtoId) {
        await deleteDegustacaoProduto(produtoId, currentDegustacao.id, justificativa);
        toast.success("Produto removido com justificativa auditada.");
        await loadProdutos(currentDegustacao.id);
        await loadHistorico(currentDegustacao.id);
        onRefreshList();
      }
    }
  };

  if (!currentDegustacao) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl md:max-w-3xl overflow-y-auto p-0 flex flex-col"
        >
          {/* Header Superior */}
          <div className="bg-navy/5 p-4 sm:p-6 border-b border-border/80">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2">
              <DegustacaoStatusBadge status={currentDegustacao.status} />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-navy">{currentDegustacao.loja}</span>
              </div>
            </div>

            <SheetTitle className="text-lg sm:text-xl font-bold text-navy leading-snug">
              {currentDegustacao.nome}
            </SheetTitle>
            <SheetDescription className="text-xs sm:text-sm mt-1 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <strong>Fornecedor:</strong> {currentDegustacao.fornecedor_nome}
              </span>
              {currentDegustacao.campanha_nome && (
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  <strong>Campanha:</strong> {currentDegustacao.campanha_nome}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <strong>Data:</strong>{" "}
                {new Date(currentDegustacao.data + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              {(currentDegustacao.horario_inicio || currentDegustacao.horario_fim) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <strong>Horário:</strong>{" "}
                  {currentDegustacao.horario_inicio?.slice(0, 5) ?? "--:--"} às{" "}
                  {currentDegustacao.horario_fim?.slice(0, 5) ?? "--:--"}
                </span>
              )}
            </SheetDescription>

            {/* Banner de Ações Rápidas de Ciclo de Vida */}
            {isMaster ? (
              <div className="mt-3.5 sm:mt-4 pt-3 border-t border-border/60 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                {currentDegustacao.status === "Programada" && (
                  <>
                    {currentDegustacao.data < getTodayDegustacaoIso() ? (
                      <Button
                        size="sm"
                        className="col-span-2 sm:col-span-1 h-10 sm:h-8 bg-primary hover:bg-primary/90 text-white font-semibold text-xs"
                        onClick={handleOpenConcluirModal}
                      >
                        <CheckCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1.5" /> Apurar e Concluir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="col-span-2 sm:col-span-1 h-10 sm:h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                        onClick={() => handleStatusChange("Ativa")}
                      >
                        <Play className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1.5" /> Iniciar Degustação
                      </Button>
                    )}
                  </>
                )}

                {currentDegustacao.status === "Ativa" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-1 h-10 sm:h-8 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold text-xs"
                      onClick={() => handleStatusChange("Aguardando Resultados")}
                    >
                      <Clock className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1 text-amber-600 shrink-0" /> Aguardar Apuração
                    </Button>
                    <Button
                      size="sm"
                      className="col-span-1 h-10 sm:h-8 bg-primary hover:bg-primary/90 text-white font-semibold text-xs"
                      onClick={handleOpenConcluirModal}
                    >
                      <CheckCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1 shrink-0" /> Concluir
                    </Button>
                  </>
                )}

                {currentDegustacao.status === "Aguardando Resultados" && (
                  <Button
                    size="sm"
                    className="col-span-2 sm:col-span-1 h-10 sm:h-8 bg-primary hover:bg-primary/90 text-white font-semibold text-xs"
                    onClick={handleOpenConcluirModal}
                  >
                    <CheckCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1.5" /> Apurar e Concluir
                  </Button>
                )}

                {currentDegustacao.status !== "Cancelada" &&
                  currentDegustacao.status !== "Concluída" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-1 h-10 sm:h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs font-semibold"
                      onClick={handleTriggerCancelar}
                    >
                      <Ban className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1" /> Cancelar
                    </Button>
                  )}

                {(currentDegustacao.status === "Concluída" ||
                  currentDegustacao.status === "Cancelada") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="col-span-2 sm:col-span-1 h-10 sm:h-8 text-navy hover:bg-navy/10 text-xs font-semibold"
                    onClick={handleTriggerReabrir}
                  >
                    <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1" /> Reabrir Degustação
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditAgendamento(currentDegustacao)}
                  className="col-span-1 sm:ml-auto h-10 sm:h-8 text-xs font-semibold"
                >
                  Editar Agendamento
                </Button>
              </div>
            ) : (
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5 italic bg-muted/40 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Modo leitura: apenas administradores ativos podem alterar produtos, status ou agendamentos.
              </div>
            )}
          </div>

          {/* Navegação de Seções da Degustação: Caixa Suspensa (Select) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                  Seção:
                </span>
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger className="w-full sm:w-[320px] h-10 sm:h-9 bg-background font-semibold text-navy text-xs sm:text-sm shadow-2xs border-input cursor-pointer">
                    <SelectValue placeholder="Selecione a seção..." />
                  </SelectTrigger>
                  <SelectContent className="shadow-lg">
                    <SelectItem value="produtos" className="cursor-pointer text-xs sm:text-sm font-medium py-2">
                      📦 Produtos & Resultados ({produtos.length})
                    </SelectItem>
                    <SelectItem value="detalhes" className="cursor-pointer text-xs sm:text-sm font-medium py-2">
                      📄 Dados do Agendamento
                    </SelectItem>
                    <SelectItem value="anexos" className="cursor-pointer text-xs sm:text-sm font-medium py-2">
                      📎 Materiais & Anexos ({anexos.length})
                    </SelectItem>
                    <SelectItem value="auditoria" className="cursor-pointer text-xs sm:text-sm font-medium py-2">
                      🕒 Histórico de Auditoria ({historico.length})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Atalhos rápidos em telas médias/grandes */}
              <div className="hidden lg:flex items-center gap-1">
                <Button
                  type="button"
                  variant={activeTab === "produtos" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs font-medium gap-1",
                    activeTab === "produtos" && "bg-background text-primary font-bold shadow-xs border"
                  )}
                  onClick={() => setActiveTab("produtos")}
                >
                  <Package className="h-3.5 w-3.5 text-primary" />
                  Produtos ({produtos.length})
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "detalhes" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs font-medium gap-1",
                    activeTab === "detalhes" && "bg-background text-primary font-bold shadow-xs border"
                  )}
                  onClick={() => setActiveTab("detalhes")}
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Dados
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "anexos" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs font-medium gap-1",
                    activeTab === "anexos" && "bg-background text-primary font-bold shadow-xs border"
                  )}
                  onClick={() => setActiveTab("anexos")}
                >
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  Anexos ({anexos.length})
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "auditoria" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs font-medium gap-1",
                    activeTab === "auditoria" && "bg-background text-navy font-bold shadow-xs border"
                  )}
                  onClick={() => setActiveTab("auditoria")}
                >
                  <History className="h-3.5 w-3.5 text-navy" />
                  Auditoria ({historico.length})
                </Button>
              </div>
            </div>

            {/* CONTEÚDO TAB PRODUTOS */}
            <TabsContent value="produtos" className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 flex-1 m-0">
              {/* Se for Master e não estiver cancelada, permite adicionar produtos */}
              {isMaster && currentDegustacao.status !== "Cancelada" && (
                <div className="rounded-xl border bg-card p-3.5 sm:p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-primary" /> Adicionar Produto à Degustação
                    </h4>
                    <div className="grid grid-cols-2 sm:inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setAddProductMode("oferta")}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md font-medium transition text-xs flex items-center justify-center gap-1",
                          addProductMode === "oferta"
                            ? "bg-card text-navy shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span>🏷️</span> Oferta em Campanha
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddProductMode("produto")}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md font-medium transition text-xs flex items-center justify-center gap-1",
                          addProductMode === "produto"
                            ? "bg-card text-navy shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span>📦</span> Produto Regular
                      </button>
                    </div>
                  </div>

                  {addProductMode === "oferta" ? (
                    <OfertaSearch
                      defaultCampanhaId={currentDegustacao.campanha_id || undefined}
                      selectedLoja={currentDegustacao.loja}
                      onSelect={handleAddOferta}
                    />
                  ) : (
                    <ProductSearch
                      autoFocus={false}
                      placeholder="Localize produto regular por código, EAN ou descrição..."
                      onSelect={handleAddProduto}
                    />
                  )}
                </div>
              )}

              {/* VISUALIZAÇÃO DESKTOP: TABELA TRADICIONAL */}
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-28 text-right">Preço Base</TableHead>
                      <TableHead className="w-32 text-right">Preço Praticado</TableHead>
                      <TableHead className="w-28 text-right">Qtd Vendida</TableHead>
                      <TableHead className="w-32 text-right">Total Faturado</TableHead>
                      {isMaster && currentDegustacao.status !== "Cancelada" && (
                        <TableHead className="w-20 text-center">Ações</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProdutos ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Carregando produtos vinculados...
                        </TableCell>
                      </TableRow>
                    ) : produtos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                          Nenhum produto cadastrado para esta degustação.
                          {isMaster && (
                            <p className="text-xs text-amber-600 mt-1 font-medium">
                              É necessário adicionar pelo menos 1 produto antes de concluir.
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      produtos.map((p) => {
                        const edit = editValues[p.id] || {
                          preco_praticado: p.preco_praticado,
                          quantidade_vendida: p.quantidade_vendida,
                        };
                        const rowTotal = (Number(edit.quantidade_vendida) || 0) * (Number(edit.preco_praticado) || 0);

                        return (
                          <TableRow key={p.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-navy text-sm leading-tight">
                                  {p.descricao}
                                </span>
                                {p.oferta_id ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 shrink-0 font-medium"
                                  >
                                    🏷️ Promoção
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 text-muted-foreground shrink-0 font-normal"
                                  >
                                    Regular
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Cód: {p.codigo ?? "-"} | EAN: {p.gtin ?? "-"}
                              </div>
                            </TableCell>

                            <TableCell className="text-right text-xs text-muted-foreground font-mono">
                              {brl(p.preco_base)}
                            </TableCell>

                            <TableCell className="text-right">
                              {isMaster && currentDegustacao.status !== "Cancelada" ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="h-8 w-24 text-right font-mono text-xs ml-auto"
                                  value={edit.preco_praticado}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        ...edit,
                                        preco_praticado: parseFloat(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              ) : (
                                <span className="font-mono text-xs">
                                  {brl(p.preco_praticado)}
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              {isMaster && currentDegustacao.status !== "Cancelada" ? (
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  className="h-8 w-20 text-right font-mono text-xs ml-auto"
                                  value={edit.quantidade_vendida}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        ...edit,
                                        quantidade_vendida: parseInt(e.target.value, 10) || 0,
                                      },
                                    }))
                                  }
                                />
                              ) : (
                                <span className="font-mono text-xs font-semibold">
                                  {p.quantidade_vendida} un
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-navy text-xs">
                              {brl(rowTotal)}
                            </TableCell>

                            {isMaster && currentDegustacao.status !== "Cancelada" && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    title="Salvar valores"
                                    disabled={savingProdutoId === p.id}
                                    onClick={() => handleSaveProduto(p)}
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="Remover produto"
                                    onClick={() => handleDeleteProduto(p)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* VISUALIZAÇÃO MOBILE: CARDS ERGONÔMICOS PARA PRODUTOS */}
              <div className="block md:hidden space-y-3">
                {loadingProdutos ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-xl bg-card text-xs">
                    Carregando produtos vinculados...
                  </div>
                ) : produtos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-xl bg-card p-4 space-y-2">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="text-sm font-medium">Nenhum produto cadastrado para esta degustação.</p>
                    {isMaster && (
                      <p className="text-xs text-amber-600 font-medium">
                        É necessário adicionar pelo menos 1 produto antes de concluir.
                      </p>
                    )}
                  </div>
                ) : (
                  produtos.map((p) => {
                    const edit = editValues[p.id] || {
                      preco_praticado: p.preco_praticado,
                      quantidade_vendida: p.quantidade_vendida,
                    };
                    const rowTotal = (Number(edit.quantidade_vendida) || 0) * (Number(edit.preco_praticado) || 0);

                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-3"
                      >
                        {/* Topo do Card de Produto */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-navy text-sm leading-snug">
                                {p.descricao}
                              </span>
                              {p.oferta_id ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 shrink-0 font-medium"
                                >
                                  🏷️ Promoção
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 text-muted-foreground shrink-0 font-normal"
                                >
                                  Regular
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Cód: {p.codigo ?? "-"} &bull; EAN: {p.gtin ?? "-"}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] uppercase text-muted-foreground block font-medium">Preço Base</span>
                            <span className="text-xs text-muted-foreground font-mono line-through">{brl(p.preco_base)}</span>
                          </div>
                        </div>

                        {/* Grid de Inputs de Preço Praticado e Quantidade Vendida */}
                        <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-muted/30 rounded-lg">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-navy block">
                              Preço Praticado (R$)
                            </label>
                            {isMaster && currentDegustacao.status !== "Cancelada" ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-10 font-mono text-sm bg-background font-semibold"
                                value={edit.preco_praticado}
                                onChange={(e) =>
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      ...edit,
                                      preco_praticado: parseFloat(e.target.value) || 0,
                                    },
                                  }))
                                }
                              />
                            ) : (
                              <div className="h-10 flex items-center font-mono text-sm font-semibold text-navy">
                                {brl(p.preco_praticado)}
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-navy block">
                              Qtd Vendida (un)
                            </label>
                            {isMaster && currentDegustacao.status !== "Cancelada" ? (
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                className="h-10 font-mono text-sm bg-background font-semibold"
                                value={edit.quantidade_vendida}
                                onChange={(e) =>
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      ...edit,
                                      quantidade_vendida: parseInt(e.target.value, 10) || 0,
                                    },
                                  }))
                                }
                              />
                            ) : (
                              <div className="h-10 flex items-center font-mono text-sm font-semibold text-navy">
                                {p.quantidade_vendida} un
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Rodapé do Card: Total e Botões de Ação */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <span className="text-[10px] uppercase text-muted-foreground block font-medium">Subtotal</span>
                            <span className="text-base font-extrabold text-primary font-mono">{brl(rowTotal)}</span>
                          </div>

                          {isMaster && currentDegustacao.status !== "Cancelada" && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1 shadow-2xs active:scale-95"
                                disabled={savingProdutoId === p.id}
                                onClick={() => handleSaveProduto(p)}
                              >
                                <Save className="h-3.5 w-3.5" />
                                Salvar
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200 active:scale-95"
                                title="Remover produto"
                                onClick={() => handleDeleteProduto(p)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Totais Gerais */}
              <div className="rounded-xl bg-navy/5 p-3.5 sm:p-4 border grid grid-cols-3 gap-2 text-center sm:text-left sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold block">
                    Produtos
                  </span>
                  <div className="text-sm sm:text-lg font-bold text-navy">{produtos.length} <span className="hidden sm:inline">item(s)</span></div>
                </div>

                <div className="border-x sm:border-x-0 border-border/60 px-1 sm:px-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold block">
                    Qtd Total
                  </span>
                  <div className="text-sm sm:text-lg font-bold text-navy">{totais.qtd} un</div>
                </div>

                <div className="sm:border-l sm:pl-4 sm:border-border/80 sm:text-right">
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold block">
                    Faturamento
                  </span>
                  <div className="text-sm sm:text-xl font-extrabold text-primary truncate">{brl(totais.fat)}</div>
                </div>
              </div>

              {/* Caixa de Finalização e Oficialização de Resultados */}
              {isMaster &&
                currentDegustacao.status !== "Cancelada" &&
                currentDegustacao.status !== "Concluída" &&
                produtos.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <p className="text-xs font-bold text-navy flex items-center justify-center sm:justify-start gap-1.5">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        Finalizar e Oficializar Degustação
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {currentDegustacao.data <= getTodayDegustacaoIso()
                          ? "Esta degustação já foi executada em loja. Oficialize os números de vendas para consolidar no histórico e na auditoria."
                          : "Ao concluir, o status mudará para 'Concluída' e os resultados financeiros serão consolidados permanentemente."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto h-9 px-4 bg-primary hover:bg-primary/90 text-white font-semibold text-xs gap-1.5 shrink-0 shadow-xs"
                      onClick={handleOpenConcluirModal}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Apurar e Concluir
                    </Button>
                  </div>
                )}
            </TabsContent>

            {/* CONTEÚDO TAB DETALHES DO AGENDAMENTO */}
            <TabsContent value="detalhes" className="p-3.5 sm:p-6 space-y-3 sm:space-y-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-xl border p-3.5 sm:p-4 bg-card space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Loja de Realização</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary shrink-0" /> {currentDegustacao.loja}
                  </p>
                </div>

                <div className="rounded-xl border p-3.5 sm:p-4 bg-card space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fornecedor Parceiro</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-primary shrink-0" /> {currentDegustacao.fornecedor_nome}
                  </p>
                </div>

                <div className="rounded-xl border p-3.5 sm:p-4 bg-card space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Promotor / Responsável</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary shrink-0" /> {currentDegustacao.responsavel_nome}
                  </p>
                </div>

                <div className="rounded-xl border p-3.5 sm:p-4 bg-card space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data e Horários</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    {new Date(currentDegustacao.data + "T00:00:00").toLocaleDateString("pt-BR")}{" "}
                    ({currentDegustacao.horario_inicio?.slice(0, 5) ?? "--"} às{" "}
                    {currentDegustacao.horario_fim?.slice(0, 5) ?? "--"})
                  </p>
                </div>
              </div>

              <div className="rounded-xl border p-3.5 sm:p-4 bg-card space-y-1.5">
                <Label className="text-xs text-muted-foreground">Observações e Orientações</Label>
                <p className="text-sm text-foreground whitespace-pre-line">
                  {currentDegustacao.observacoes || (
                    <span className="italic text-muted-foreground">Nenhuma observação registrada.</span>
                  )}
                </p>
              </div>

              {currentDegustacao.observacoes_resultados && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 sm:p-4 space-y-2">
                  <Label className="text-xs text-emerald-800 font-semibold">
                    Parecer de Resultados e Fechamento
                  </Label>
                  <p className="text-sm text-emerald-950 whitespace-pre-line">
                    {currentDegustacao.observacoes_resultados}
                  </p>
                  {currentDegustacao.resultado_registrado_por_nome && (
                    <div className="text-xs text-emerald-700 mt-2">
                      Registrado por:{" "}
                      <strong>{currentDegustacao.resultado_registrado_por_nome}</strong> em{" "}
                      {currentDegustacao.resultado_registrado_em
                        ? new Date(currentDegustacao.resultado_registrado_em).toLocaleString("pt-BR")
                        : "-"}
                    </div>
                  )}
                </div>
              )}

              {/* Resumo de Materiais Anexados */}
              <div className="rounded-xl border p-3.5 sm:p-4 bg-card space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                    Materiais de Impressão e Decoração ({anexos.length})
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary font-semibold"
                    onClick={() => setActiveTab("anexos")}
                  >
                    Ver todos &rarr;
                  </Button>
                </div>

                {anexos.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum material para impressão ou decoração anexado.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {anexos.map((m) => (
                      <button
                        key={m.path}
                        type="button"
                        onClick={() => handleOpenAnexo(m)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-background hover:bg-muted text-navy truncate max-w-[220px]"
                        title="Clique para visualizar ou baixar"
                      >
                        {isDegustacaoImage(m.tipo) ? (
                          <ImageIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        )}
                        <span className="truncate">{m.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* CONTEÚDO TAB MATERIAIS & ANEXOS */}
            <TabsContent value="anexos" className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 m-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                <div>
                  <h3 className="text-sm font-bold text-navy flex items-center gap-1.5">
                    <Paperclip className="h-4 w-4 text-primary shrink-0" />
                    Materiais para Impressão & Decoração do Espaço
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cartazes de oferta, testeiras para gôndola, manual de instruções e artes de ponto de degustação.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-muted rounded-full text-foreground shrink-0 self-start sm:self-auto">
                  {anexos.length} anexo(s)
                </span>
              </div>

              {/* Upload Dropzone */}
              {isMaster && currentDegustacao.status !== "Cancelada" && (
                <label
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 sm:p-6 cursor-pointer transition text-center",
                    uploadingFiles
                      ? "opacity-60 pointer-events-none bg-muted/40"
                      : "hover:border-primary hover:bg-primary/5 border-muted-foreground/25 bg-muted/10"
                  )}
                >
                  <Upload className="h-6 w-6 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-navy">
                    {uploadingFiles ? "Fazendo upload do arquivo..." : "Clique para anexar ou arraste arquivos aqui"}
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground">
                    Suporta arquivos em PDF, JPG e PNG de até 20 MB por arquivo
                  </span>
                  <input
                    type="file"
                    accept={DEGUSTACOES_FILE_ACCEPT}
                    multiple
                    className="hidden"
                    disabled={uploadingFiles}
                    onChange={(e) => {
                      handleUploadFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {/* Lista e Grade de Anexos */}
              {anexos.length === 0 ? (
                <div className="text-center py-10 border rounded-xl bg-card/50 space-y-2">
                  <Paperclip className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Nenhum material anexado</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Nenhum arquivo de impressão ou arte para decoração foi anexado para esta degustação ainda.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {anexos.map((m) => {
                    const isImg = isDegustacaoImage(m.tipo);
                    return (
                      <div
                        key={m.path}
                        className="rounded-xl border bg-card p-3 shadow-2xs hover:shadow-xs hover:border-primary/40 transition flex flex-col justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-md bg-muted/50 shrink-0">
                            {isImg ? (
                              <ImageIcon className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <FileText className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-semibold text-navy truncate hover:underline cursor-pointer"
                              title={m.nome}
                              onClick={() => handleOpenAnexo(m)}
                            >
                              {m.nome}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {(m.tamanho / 1024).toFixed(0)} KB &bull; {m.tipo.split("/")[1]?.toUpperCase() || "ARQUIVO"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t text-xs">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-xs font-medium text-primary hover:text-primary/80 gap-1 active:scale-95"
                            onClick={() => handleOpenAnexo(m)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Visualizar
                          </Button>

                          {isMaster && currentDegustacao.status !== "Cancelada" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive gap-1 active:scale-95"
                              onClick={() => handleRemoveAnexo(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* CONTEÚDO TAB AUDITORIA */}
            <TabsContent value="auditoria" className="p-3.5 sm:p-6 space-y-3 sm:space-y-4 m-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <History className="h-4 w-4 text-navy shrink-0" />
                Registros gravados permanentemente via triggers e functions no Supabase.
              </div>

              {loadingHistorico ? (
                <p className="text-center py-6 text-sm text-muted-foreground">
                  Carregando trilha de auditoria...
                </p>
              ) : historico.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">
                  Nenhum registro de auditoria encontrado para este evento.
                </p>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {historico.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-xl border bg-card p-3 sm:p-4 text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-2">
                        <span className="font-bold text-navy uppercase tracking-wider text-[11px]">
                          {h.acao}
                        </span>
                        <span className="text-muted-foreground font-mono text-[10px] sm:text-xs">
                          {new Date(h.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                        <span>
                          Autor: <strong className="text-foreground">{h.changed_by_name}</strong>
                        </span>
                        {h.status_anterior && (
                          <span>
                            Status:{" "}
                            <span className="line-through">{h.status_anterior}</span> &rarr;{" "}
                            <strong className="text-foreground">{h.status_novo}</strong>
                          </span>
                        )}
                      </div>

                      {h.produto_descricao && (
                        <div className="text-muted-foreground">
                          Produto afetado:{" "}
                          <strong className="text-foreground">{h.produto_descricao}</strong>
                        </div>
                      )}

                      {h.justificativa && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900 mt-2">
                          <strong className="block text-[11px] uppercase tracking-wider text-amber-800">
                            Justificativa Registrada:
                          </strong>
                          {h.justificativa}
                        </div>
                      )}

                      {h.observacao && (
                        <p className="text-muted-foreground italic mt-1">{h.observacao}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Modal de Conclusão / Apuração de Resultados */}
      <Dialog open={concluirModalOpen} onOpenChange={setConcluirModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6 rounded-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-navy text-lg sm:text-xl font-bold">Concluir Degustação e Apurar Resultados</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Confirme a finalização desta degustação. O faturamento e volume total serão
              consolidados no histórico do módulo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="bg-navy/5 p-3 rounded-lg border text-xs space-y-1">
              <div className="flex justify-between">
                <span>Total de Itens:</span>
                <strong>{produtos.length} produto(s)</strong>
              </div>
              <div className="flex justify-between">
                <span>Volume Vendido:</span>
                <strong>{totais.qtd} unidades</strong>
              </div>
              <div className="flex justify-between text-primary font-bold">
                <span>Faturamento Total:</span>
                <span>{brl(totais.fat)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-resultados" className="text-xs font-semibold">
                Observações dos Resultados / Parecer do Evento
              </Label>
              <Textarea
                id="obs-resultados"
                placeholder="Ex: Boa aceitação do público, excelente engajamento do promotor, etc."
                value={observacoesResultados}
                onChange={(e) => setObservacoesResultados(e.target.value)}
                className="resize-none min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConcluirModalOpen(false)}
              disabled={concluding}
              className="w-full sm:w-auto h-11 sm:h-9 text-xs sm:text-sm"
            >
              Voltar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto h-11 sm:h-9 bg-primary hover:bg-primary/90 text-xs sm:text-sm font-semibold"
              onClick={handleConfirmConcluir}
              disabled={concluding}
            >
              {concluding ? "Concluindo..." : "Confirmar Conclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reutilizável de Justificativa Auditada */}
      <JustificativaDialog
        open={justificativaModal.open}
        onOpenChange={(op) => setJustificativaModal((prev) => ({ ...prev, open: op }))}
        title={justificativaModal.title}
        description={justificativaModal.description}
        confirmLabel={justificativaModal.confirmLabel}
        confirmVariant={justificativaModal.confirmVariant}
        onConfirm={handleJustificativaConfirm}
      />
    </>
  );
}
