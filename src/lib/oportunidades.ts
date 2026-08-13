
import { supabase } from "@/integrations/supabase/client";

export type OportunidadePrioridade = 'Alta' | 'Média' | 'Baixa';
export type OportunidadeMotivo = 'Excesso de estoque físico' | 'Baixo giro' | 'Produto parado' | 'Produto sazonal' | 'Próximo da validade' | 'Oportunidade comercial' | 'Outros';
export type OportunidadeStatus = 'Disponível' | 'Reservada' | 'Utilizada' | 'Arquivada';

export interface Oportunidade {
  id: string;
  produto_id: string | null;
  gtin: string | null;
  codigo_interno: string | null;
  descricao: string;
  custo: number;
  preco_venda: number;
  validade: string | null;
  lote: string | null;
  loja: string;
  quantidade_aproximada: number;
  prioridade: OportunidadePrioridade;
  motivo: OportunidadeMotivo;
  observacoes: string | null;
  data_coleta: string;
  status: OportunidadeStatus;
  campanha_id: string | null;
  data_utilizacao: string | null;
  created_at?: string;
}

export async function listOportunidades() {
  const { data, error } = await supabase
    .from('oportunidades' as any)
    .select('*')
    .order('data_coleta', { ascending: false });
  
  if (error) throw error;
  return data as Oportunidade[];
}

export async function saveOportunidade(oportunidade: Partial<Oportunidade>) {
  const { data, error } = await supabase
    .from('oportunidades' as any)
    .upsert(oportunidade)
    .select()
    .single();
    
  if (error) throw error;
  return data as Oportunidade;
}

export async function deleteOportunidade(id: string) {
  const { error } = await supabase
    .from('oportunidades' as any)
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

export async function updateOportunidadeStatus(id: string, status: OportunidadeStatus, campanhaId?: string | null) {
  const update: any = { status };
  if (campanhaId !== undefined) {
    update.campanha_id = campanhaId;
    if (status === 'Utilizada') {
      update.data_utilizacao = new Date().toISOString();
    } else if (status === 'Disponível') {
      update.campanha_id = null;
      update.data_utilizacao = null;
    }
  }
  
  const { error } = await supabase
    .from('oportunidades' as any)
    .update(update)
    .eq('id', id);
    
  if (error) throw error;
}
