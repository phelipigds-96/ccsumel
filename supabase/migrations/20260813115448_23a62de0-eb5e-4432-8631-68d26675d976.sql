CREATE TYPE public.oportunidade_prioridade AS ENUM ('Alta', 'Média', 'Baixa');
CREATE TYPE public.oportunidade_motivo AS ENUM ('Excesso de estoque físico', 'Baixo giro', 'Produto parado', 'Produto sazonal', 'Próximo da validade', 'Oportunidade comercial', 'Outros');
CREATE TYPE public.oportunidade_status AS ENUM ('Disponível', 'Reservada', 'Utilizada', 'Arquivada');

CREATE TABLE public.oportunidades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id uuid REFERENCES public.produtos(id),
    gtin text,
    codigo_interno text,
    descricao text NOT NULL,
    custo numeric DEFAULT 0,
    preco_venda numeric DEFAULT 0,
    validade date,
    lote text,
    loja text NOT NULL,
    quantidade_aproximada numeric DEFAULT 0,
    prioridade public.oportunidade_prioridade NOT NULL DEFAULT 'Média',
    motivo public.oportunidade_motivo NOT NULL DEFAULT 'Oportunidade comercial',
    observacoes text,
    data_coleta date NOT NULL DEFAULT CURRENT_DATE,
    status public.oportunidade_status NOT NULL DEFAULT 'Disponível',
    campanha_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL,
    data_utilizacao timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;

ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer usuário autenticado pode ler oportunidades" 
ON public.oportunidades FOR SELECT TO authenticated USING (true);

CREATE POLICY "Qualquer usuário autenticado pode inserir oportunidades" 
ON public.oportunidades FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Qualquer usuário autenticado pode atualizar oportunidades" 
ON public.oportunidades FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Qualquer usuário autenticado pode deletar oportunidades" 
ON public.oportunidades FOR DELETE TO authenticated USING (true);
