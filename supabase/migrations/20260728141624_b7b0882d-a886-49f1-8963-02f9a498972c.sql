CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  notes text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_admin boolean NOT NULL DEFAULT false,
  read_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO anon, authenticated;
GRANT ALL ON public.usuarios TO service_role;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY usuarios_all ON public.usuarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER usuarios_set_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();

INSERT INTO public.usuarios (name, username, password, status, notes, permissions, is_admin)
VALUES (
  'Administrador', 'admin', 'admin', 'ativo',
  'Usuário administrador padrão. Altere a senha após o primeiro acesso.',
  '["/dashboard","/campanhas","/campanhas-encerradas","/verbas-cooperadas","/sell-out","/sell-out/acertos","/pontas-de-gondola","/fornecedores","/catalogo-de-produtos","/relatorios","/usuarios","/configuracoes"]'::jsonb,
  true
);

CREATE TABLE public.preferencias_colunas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tabela text NOT NULL,
  colunas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tabela)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_colunas TO anon, authenticated;
GRANT ALL ON public.preferencias_colunas TO service_role;
ALTER TABLE public.preferencias_colunas ENABLE ROW LEVEL SECURITY;
CREATE POLICY preferencias_colunas_all ON public.preferencias_colunas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER preferencias_colunas_set_updated_at BEFORE UPDATE ON public.preferencias_colunas FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();