-- Migration: Adicionar codigo_interno e razao_social na tabela fornecedores
-- Data: 2026-10-16

-- 1. Adiciona as colunas na tabela fornecedores
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS codigo_interno text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS razao_social text NOT NULL DEFAULT '';

-- 2. Migra os dados existentes (se houver): inicializa razao_social com o nome atual
UPDATE public.fornecedores
SET razao_social = nome
WHERE razao_social = '' AND nome <> '';

-- 3. Índices para performance em buscas e ordenações
CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo_interno
  ON public.fornecedores (codigo_interno);

CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_social
  ON public.fornecedores (razao_social);

-- 4. Índice para garantir unicidade do código interno (quando informado)
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_codigo_interno_key
  ON public.fornecedores (codigo_interno)
  WHERE codigo_interno <> '';
