-- Adiciona a coluna checklist se ela ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campanhas' AND column_name = 'checklist') THEN
        ALTER TABLE public.campanhas ADD COLUMN checklist JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Garante permissões explicitas para a tabela campanhas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;
