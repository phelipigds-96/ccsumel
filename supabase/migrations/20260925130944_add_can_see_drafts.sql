-- Adiciona permissão para visualizar campanhas em rascunho
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_see_drafts boolean DEFAULT false NOT NULL;

-- Garante que a policy RLS existente continue funcionando (não recriada, só referenciada)
-- A policy SELECT já permite que cada usuário leia seu próprio registro via auth.uid()
-- A policy UPDATE já permite que cada usuário altere seu próprio registro
-- A nova coluna respeita as mesmas policies existentes

-- Comentário para documentação
COMMENT ON COLUMN users.can_see_drafts IS 'Permite visualizar campanhas com status Rascunho no módulo Campanhas';
