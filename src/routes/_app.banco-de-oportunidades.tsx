import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { 
  Plus, Search, Package, MapPin, Calendar, AlertCircle, 
  ArrowRight, Filter, MoreHorizontal, History, 
  CheckCircle2, Clock, Archive, Tag, Trash2, Pencil,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { findByCodigoOrGtin } from "@/lib/produtos";
import { 
  listOportunidades, saveOportunidade, deleteOportunidade, 
  type Oportunidade, type OportunidadePrioridade, type OportunidadeMotivo, type OportunidadeStatus 
} from "@/lib/oportunidades";
import { useCampanhasStore } from "@/lib/campanhas-store";
import { brl, fmtDate } from "@/components/campanha-quick-view";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/banco-de-oportunidades")({
  component: BancoDeOportunidades,
});

const PRIORIDADES: OportunidadePrioridade[] = ['Alta', 'Média', 'Baixa'];
const MOTIVOS: OportunidadeMotivo[] = [
  'Excesso de estoque físico', 'Baixo giro', 'Produto parado', 
  'Produto sazonal', 'Próximo da validade', 'Oportunidade comercial', 'Outros'
];
const LOJAS = ["Matriz", "Filial 01", "Filial 02", "Filial 03"];

function BancoDeOportunidades() {
  const { user } = useAuth();
  const readOnly = !!user?.readOnly;
  const { campanhas } = useCampanhasStore();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todas");
  const [filterPrioridade, setFilterPrioridade] = useState("Todas");
  const [filterLoja, setFilterLoja] = useState("Todas");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Oportunidade> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<Oportunidade | null>(null);

  const loadData = async () => {
    try {
      const data = await listOportunidades();
      setOportunidades(data);
    } catch (error) {
      toast.error("Erro ao carregar oportunidades.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const s = {
      disponiveis: 0,
      alta: 0,
      reservadas: 0,
      utilizadas: 0,
      porLoja: {} as Record<string, number>
    };
    oportunidades.forEach(o => {
      if (o.status === 'Disponível') s.disponiveis++;
      if (o.prioridade === 'Alta') s.alta++;
      if (o.status === 'Reservada') s.reservadas++;
      if (o.status === 'Utilizada') s.utilizadas++;
      s.porLoja[o.loja] = (s.porLoja[o.loja] ?? 0) + 1;
    });
    return s;
  }, [oportunidades]);

  const filtered = useMemo(() => {
    return oportunidades.filter(o => {
      const term = search.toLowerCase();
      const matchesSearch = !term || 
        o.descricao.toLowerCase().includes(term) || 
        (o.gtin && o.gtin.includes(term)) || 
        (o.codigo_interno && o.codigo_interno.includes(term));
      
      const matchesStatus = filterStatus === "Todas" || o.status === filterStatus;
      const matchesPrioridade = filterPrioridade === "Todas" || o.prioridade === filterPrioridade;
      const matchesLoja = filterLoja === "Todas" || o.loja === filterLoja;
      
      return matchesSearch && matchesStatus && matchesPrioridade && matchesLoja;
    });
  }, [oportunidades, search, filterStatus, filterPrioridade, filterLoja]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.descricao) {
      toast.error("Identifique o produto primeiro.");
      return;
    }
    setSubmitting(true);
    try {
      await saveOportunidade(editing);
      toast.success("Oportunidade salva.");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Erro ao salvar oportunidade.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta oportunidade?")) return;
    try {
      await deleteOportunidade(id);
      toast.success("Oportunidade excluída.");
      loadData();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleProductLookup = async (code: string) => {
    if (!code) return;
    try {
      const p = await findByCodigoOrGtin(code);
      if (p) {
        setEditing(prev => ({
          ...prev,
          produto_id: p.id,
          gtin: p.gtin,
          codigo_interno: p.codigo,
          descricao: p.descricao,
          custo: p.custo,
          preco_venda: p.preco_venda,
        }));
        toast.success("Produto encontrado!");
      } else {
        toast.error("Produto não encontrado no catálogo.");
      }
    } catch (error) {
      toast.error("Erro na busca.");
    }
  };

  const statusIcons: Record<OportunidadeStatus, any> = {
    'Disponível': <Clock className="h-4 w-4 text-amber-500" />,
    'Reservada': <Tag className="h-4 w-4 text-blue-500" />,
    'Utilizada': <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    'Arquivada': <Archive className="h-4 w-4 text-slate-500" />,
  };

  const prioridadeVariant: Record<OportunidadePrioridade, string> = {
    'Alta': "bg-red-100 text-red-700 border-red-200",
    'Média': "bg-amber-100 text-amber-700 border-amber-200",
    'Baixa': "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Banco de Oportunidades" 
        description="Gerencie oportunidades comerciais encontradas nas lojas."
        actions={!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              // Limpa busca/filtros
              setSearch("");
              setFilterStatus("Todas");
              setFilterPrioridade("Todas");
            }} className="border-border/70 text-muted-foreground hover:text-navy">
              <Filter className="mr-2 h-4 w-4" /> Todos
            </Button>
            <Button onClick={() => {
              setEditing({
                prioridade: 'Média',
                motivo: 'Oportunidade comercial',
                loja: LOJAS[0],
                data_coleta: new Date().toISOString().split('T')[0],
                status: 'Disponível',
                quantidade_aproximada: 0
              });
              setDialogOpen(true);
            }} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Nova Oportunidade
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-amber-50/30 border-amber-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-amber-600">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-700">{stats.disponiveis}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/30 border-red-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-red-600">Alta Prioridade</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-700">{stats.alta}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/30 border-blue-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-blue-600">Reservadas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-700">{stats.reservadas}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/30 border-emerald-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-emerald-600">Utilizadas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">{stats.utilizadas}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-card p-3 rounded-lg border">
        <span className="font-semibold uppercase tracking-wider">Por Loja:</span>
        {LOJAS.map(loja => (
          <span key={loja} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50">
            <MapPin className="h-3 w-3" />
            {loja}: <strong>{stats.porLoja[loja] ?? 0}</strong>
          </span>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por descrição, GTIN ou código..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-9" 
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todos Status</SelectItem>
                <SelectItem value="Disponível">Disponível</SelectItem>
                <SelectItem value="Reservada">Reservada</SelectItem>
                <SelectItem value="Utilizada">Utilizada</SelectItem>
                <SelectItem value="Arquivada">Arquivada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas Prioridades</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLoja} onValueChange={setFilterLoja}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Loja" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas Lojas</SelectItem>
                {LOJAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="text-right">Qtd. Aprox.</TableHead>
                <TableHead className="text-right">Venda (R$)</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Coleta</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Nenhuma oportunidade encontrada.</TableCell></TableRow>
              ) : (
                filtered.map(o => (
                  <TableRow key={o.id} className="group">
                    <TableCell>
                      <Badge variant="outline" className="flex w-fit items-center gap-1.5 font-medium">
                        {statusIcons[o.status]}
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-navy">{o.descricao}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
                          GTIN: {o.gtin || '-'} | COD: {o.codigo_interno || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {o.loja}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{o.quantidade_aproximada}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{brl(o.preco_venda)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={prioridadeVariant[o.prioridade]}>
                        {o.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.motivo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(o.data_coleta)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setHistoryOpen(o)}>
                            <History className="mr-2 h-4 w-4" /> Ver Histórico
                          </DropdownMenuItem>
                          {!readOnly && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setEditing({...o}); setDialogOpen(true); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(o.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* DIALOG DE CADASTRO/EDIÇÃO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Editar Oportunidade' : 'Nova Oportunidade'}</DialogTitle>
              <DialogDescription>
                Identifique o produto pelo código de barras e preencha as informações da coleta física.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Identificar Produto (GTIN/Código)</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Escanear ou digitar..." 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleProductLookup(e.currentTarget.value);
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (Auto)</Label>
                  <Input value={editing?.descricao || ""} readOnly className="bg-muted" placeholder="Busque um produto..." />
                </div>
              </div>

              {editing?.descricao && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Loja</Label>
                      <Select value={editing.loja} onValueChange={(v) => setEditing({...editing, loja: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LOJAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade Aprox.</Label>
                      <Input 
                        type="number" 
                        value={editing.quantidade_aproximada} 
                        onChange={e => setEditing({...editing, quantidade_aproximada: Number(e.target.value)})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select value={editing.prioridade} onValueChange={(v) => setEditing({...editing, prioridade: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Motivo da Oportunidade</Label>
                      <Select value={editing.motivo} onValueChange={(v) => setEditing({...editing, motivo: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data da Coleta</Label>
                      <Input 
                        type="date" 
                        value={editing.data_coleta} 
                        onChange={e => setEditing({...editing, data_coleta: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Validade (Opcional)</Label>
                      <Input 
                        type="date" 
                        value={editing.validade || ""} 
                        onChange={e => setEditing({...editing, validade: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lote (Opcional)</Label>
                      <Input 
                        value={editing.lote || ""} 
                        onChange={e => setEditing({...editing, lote: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea 
                      value={editing.observacoes || ""} 
                      onChange={e => setEditing({...editing, observacoes: e.target.value})} 
                      placeholder="Detalhes adicionais sobre a coleta..."
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting || !editing?.descricao}>
                {submitting ? 'Salvando...' : 'Salvar Oportunidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE HISTÓRICO */}
      <Dialog open={!!historyOpen} onOpenChange={(v) => !v && setHistoryOpen(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Histórico da Oportunidade</DialogTitle>
          </DialogHeader>
          {historyOpen && (
            <div className="space-y-6 pt-4">
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-navy">{historyOpen.descricao}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className={prioridadeVariant[historyOpen.prioridade]}>{historyOpen.prioridade}</Badge>
                  <span>• Coletado em {fmtDate(historyOpen.data_coleta)}</span>
                </div>
              </div>

              <div className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Oportunidade Encontrada</span>
                    <span className="text-xs text-muted-foreground">
                      Loja: {historyOpen.loja} | Qtd: {historyOpen.quantidade_aproximada}
                    </span>
                    <span className="text-[10px] italic text-muted-foreground">Motivo: {historyOpen.motivo}</span>
                  </div>
                </div>

                {historyOpen.campanha_id && (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-blue-500" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Vinculada à Campanha</span>
                      <span className="text-xs text-blue-600 font-medium">
                        {campanhas.find(c => c.id === historyOpen.campanha_id)?.nome || "Campanha não encontrada"}
                      </span>
                      {historyOpen.data_utilizacao && (
                        <span className="text-[10px] text-muted-foreground">Em {new Date(historyOpen.data_utilizacao).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                )}

                {historyOpen.status === 'Utilizada' && (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Transformada em Oferta</span>
                      <span className="text-xs text-emerald-600">Publicada e ativa no sistema.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setHistoryOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
