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
} from "lucide-react";
import { toast } from "sonner";
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
import { ProductSearch } from "@/components/product-search";
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
  type Degustacao,
  type DegustacaoProduto,
  type DegustacaoHistorico,
  type DegustacaoStatus,
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

  // Sincroniza dados da degustação selecionada
  useEffect(() => {
    setCurrentDegustacao(degustacao);
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

      toast.success("Resultados do produto atualizados!");
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

  // Concluir degustação (com validação de produtos)
  const handleOpenConcluirModal = () => {
    if (!currentDegustacao) return;
    if (produtos.length === 0) {
      toast.error(
        "Não é possível concluir uma degustação sem produtos vinculados. Adicione pelo menos um produto antes de concluir.",
      );
      return;
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
      const { produtoId, values, produtoToAdd } = justificativaModal.payload || {};
      if (produtoToAdd) {
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
          <div className="bg-navy/5 p-6 border-b border-border/80">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <DegustacaoStatusBadge status={currentDegustacao.status} />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-navy">{currentDegustacao.loja}</span>
              </div>
            </div>

            <SheetTitle className="text-xl font-bold text-navy">
              {currentDegustacao.nome}
            </SheetTitle>
            <SheetDescription className="text-sm mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <strong>Fornecedor:</strong> {currentDegustacao.fornecedor_nome}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <strong>Data:</strong>{" "}
                {new Date(currentDegustacao.data + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              {(currentDegustacao.horario_inicio || currentDegustacao.horario_fim) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <strong>Horário:</strong>{" "}
                  {currentDegustacao.horario_inicio?.slice(0, 5) ?? "--:--"} às{" "}
                  {currentDegustacao.horario_fim?.slice(0, 5) ?? "--:--"}
                </span>
              )}
            </SheetDescription>

            {/* Banner de Ações Rápidas de Ciclo de Vida */}
            {isMaster ? (
              <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2">
                {currentDegustacao.status === "Programada" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleStatusChange("Ativa")}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Iniciar Degustação
                  </Button>
                )}

                {currentDegustacao.status === "Ativa" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                      onClick={() => handleStatusChange("Aguardando Resultados")}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1 text-amber-600" /> Aguardar Apuração
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-white"
                      onClick={handleOpenConcluirModal}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Concluir Degustação
                    </Button>
                  </>
                )}

                {currentDegustacao.status === "Aguardando Resultados" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white"
                    onClick={handleOpenConcluirModal}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Apurar e Concluir
                  </Button>
                )}

                {currentDegustacao.status !== "Cancelada" &&
                  currentDegustacao.status !== "Concluída" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={handleTriggerCancelar}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                  )}

                {(currentDegustacao.status === "Concluída" ||
                  currentDegustacao.status === "Cancelada") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-navy hover:bg-navy/10"
                    onClick={handleTriggerReabrir}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reabrir Degustação
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditAgendamento(currentDegustacao)}
                  className="ml-auto"
                >
                  Editar Agendamento
                </Button>
              </div>
            ) : (
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5 italic bg-muted/40 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Modo leitura: apenas administradores ativos podem alterar produtos, status ou agendamentos.
              </div>
            )}
          </div>

          {/* Abas Principais */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-6 border-b">
              <TabsList className="bg-transparent border-b-0 p-0 h-11 gap-6">
                <TabsTrigger
                  value="produtos"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1"
                >
                  <Package className="h-4 w-4 mr-1.5" />
                  Produtos & Resultados ({produtos.length})
                </TabsTrigger>
                <TabsTrigger
                  value="detalhes"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  Dados do Agendamento
                </TabsTrigger>
                <TabsTrigger
                  value="auditoria"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1"
                >
                  <History className="h-4 w-4 mr-1.5" />
                  Histórico de Auditoria ({historico.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* CONTEÚDO TAB PRODUTOS */}
            <TabsContent value="produtos" className="p-6 space-y-5 flex-1 m-0">
              {/* Se for Master e não estiver cancelada, permite adicionar produtos */}
              {isMaster && currentDegustacao.status !== "Cancelada" && (
                <div className="rounded-lg border bg-card p-4 space-y-2 shadow-xs">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Adicionar Produto à Degustação
                  </h4>
                  <ProductSearch
                    autoFocus={false}
                    placeholder="Localize por código, EAN ou descrição do produto..."
                    onSelect={handleAddProduto}
                  />
                </div>
              )}

              {/* Tabela de Produtos */}
              <div className="rounded-md border overflow-hidden">
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
                              <div className="font-medium text-navy text-sm leading-tight">
                                {p.descricao}
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

              {/* Totais Gerais */}
              <div className="rounded-lg bg-navy/5 p-4 border flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Produtos Cadastrados
                  </span>
                  <div className="text-lg font-bold text-navy">{produtos.length} item(s)</div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Volume Total Vendido
                  </span>
                  <div className="text-lg font-bold text-navy">{totais.qtd} un</div>
                </div>

                <div className="text-right border-l pl-4 border-border/80">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Faturamento Apurado
                  </span>
                  <div className="text-xl font-extrabold text-primary">{brl(totais.fat)}</div>
                </div>
              </div>
            </TabsContent>

            {/* CONTEÚDO TAB DETALHES DO AGENDAMENTO */}
            <TabsContent value="detalhes" className="p-6 space-y-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 bg-card space-y-2">
                  <Label className="text-xs text-muted-foreground">Loja de Realização</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" /> {currentDegustacao.loja}
                  </p>
                </div>

                <div className="rounded-lg border p-4 bg-card space-y-2">
                  <Label className="text-xs text-muted-foreground">Fornecedor Parceiro</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-primary" /> {currentDegustacao.fornecedor_nome}
                  </p>
                </div>

                <div className="rounded-lg border p-4 bg-card space-y-2">
                  <Label className="text-xs text-muted-foreground">Promotor / Responsável</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" /> {currentDegustacao.responsavel_nome}
                  </p>
                </div>

                <div className="rounded-lg border p-4 bg-card space-y-2">
                  <Label className="text-xs text-muted-foreground">Data e Horários</Label>
                  <p className="font-semibold text-navy text-sm flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    {new Date(currentDegustacao.data + "T00:00:00").toLocaleDateString("pt-BR")}{" "}
                    ({currentDegustacao.horario_inicio?.slice(0, 5) ?? "--"} às{" "}
                    {currentDegustacao.horario_fim?.slice(0, 5) ?? "--"})
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4 bg-card space-y-2">
                <Label className="text-xs text-muted-foreground">Observações e Orientações</Label>
                <p className="text-sm text-foreground whitespace-pre-line">
                  {currentDegustacao.observacoes || (
                    <span className="italic text-muted-foreground">Nenhuma observação registrada.</span>
                  )}
                </p>
              </div>

              {currentDegustacao.observacoes_resultados && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
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
            </TabsContent>

            {/* CONTEÚDO TAB AUDITORIA */}
            <TabsContent value="auditoria" className="p-6 space-y-4 m-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <History className="h-4 w-4 text-navy" />
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
                <div className="space-y-3">
                  {historico.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border bg-card p-4 text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                        <span className="font-bold text-navy uppercase tracking-wider">
                          {h.acao}
                        </span>
                        <span className="text-muted-foreground font-mono">
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
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900 mt-2">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Concluir Degustação e Apurar Resultados</DialogTitle>
            <DialogDescription>
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConcluirModalOpen(false)}
              disabled={concluding}
            >
              Voltar
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90"
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
