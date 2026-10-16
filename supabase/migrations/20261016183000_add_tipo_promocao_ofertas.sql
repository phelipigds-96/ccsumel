-- ============================================================================
-- MIGRATION: SUPORTE A PROMOÇÕES POR ATACADO E COMBO NO MÓDULO DE CAMPANHAS
-- Central de Campanhas Sumel
-- ============================================================================

-- 1. Adiciona coluna tipo_promocao e quantidade_minima na tabela public.ofertas
ALTER TABLE public.ofertas 
ADD COLUMN IF NOT EXISTS tipo_promocao text NOT NULL DEFAULT 'simples',
ADD COLUMN IF NOT EXISTS quantidade_minima numeric NOT NULL DEFAULT 1;

-- Comentários explicativos
COMMENT ON COLUMN public.ofertas.tipo_promocao IS 'Mecânica da oferta: simples (Preço Direto tradicional), a_partir_de (Atacado) ou a_cada (Combo/Lote)';
COMMENT ON COLUMN public.ofertas.quantidade_minima IS 'Gatilho de quantidade mínima ou múltiplo para aplicar o preço promocional (ex: 3, 6, 12)';
