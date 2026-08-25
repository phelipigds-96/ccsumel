CREATE TABLE public.fracionamento_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_balanca text NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fracionamento_produtos_codigo_balanca_key ON public.fracionamento_produtos (codigo_balanca);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fracionamento_produtos TO authenticated;
GRANT ALL ON public.fracionamento_produtos TO service_role;

ALTER TABLE public.fracionamento_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fracionamento"
  ON public.fracionamento_produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fracionamento"
  ON public.fracionamento_produtos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update fracionamento"
  ON public.fracionamento_produtos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete fracionamento"
  ON public.fracionamento_produtos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fracionamento_produtos_updated_at
  BEFORE UPDATE ON public.fracionamento_produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();