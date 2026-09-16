CREATE OR REPLACE FUNCTION public.sync_produto_bloqueio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bloqueia boolean;
  _permanente boolean;
  _atual public.produto_bloqueios%ROWTYPE;
BEGIN
  SELECT bloqueia_novo_lancamento, bloqueio_permanente
    INTO _bloqueia, _permanente
    FROM public.falta_status_regras
   WHERE status = NEW.status;

  IF NEW.status = 'Produto descontinuado'::falta_status THEN
    _bloqueia := true;
    _permanente := true;
  ELSIF _bloqueia IS NULL THEN
    _bloqueia := NEW.status <> 'Pendente'::falta_status;
    _permanente := false;
  END IF;

  SELECT * INTO _atual
    FROM public.produto_bloqueios
   WHERE product_id = NEW.product_id
     AND store_id = NEW.store_id;

  IF _bloqueia THEN
    INSERT INTO public.produto_bloqueios
      (product_id, store_id, status, permanente, ativo, motivo, falta_id, tratado_em)
    VALUES
      (NEW.product_id, NEW.store_id, NEW.status, _permanente, true,
       coalesce(NEW.management_observation, ''), NEW.id, now())
    ON CONFLICT (product_id, store_id) DO UPDATE
      SET status = EXCLUDED.status,
          permanente = EXCLUDED.permanente OR public.produto_bloqueios.permanente,
          ativo = true,
          motivo = EXCLUDED.motivo,
          falta_id = EXCLUDED.falta_id,
          tratado_em = now();

    INSERT INTO public.produto_bloqueios_historico
      (product_id, store_id, status_anterior, status_novo, ativo_anterior, ativo_novo,
       changed_by, changed_by_name, motivo)
    VALUES
      (NEW.product_id, NEW.store_id, _atual.status, NEW.status,
       coalesce(_atual.ativo, false), true, auth.uid(), '',
       coalesce(NEW.management_observation, ''));

  ELSIF _atual.id IS NOT NULL AND _atual.ativo AND NOT _atual.permanente THEN
    UPDATE public.produto_bloqueios
       SET ativo = false,
           status = NEW.status,
           motivo = coalesce(NEW.management_observation, '')
     WHERE id = _atual.id;

    INSERT INTO public.produto_bloqueios_historico
      (product_id, store_id, status_anterior, status_novo, ativo_anterior, ativo_novo,
       changed_by, changed_by_name, motivo)
    VALUES
      (NEW.product_id, NEW.store_id, _atual.status, NEW.status, true, false,
       auth.uid(), '', coalesce(NEW.management_observation, ''));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_produto_bloqueado(
  _bloqueio_id uuid,
  _nome text,
  _motivo text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.produto_bloqueios%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para liberar produtos bloqueados';
  END IF;

  IF nullif(btrim(_motivo), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da liberação';
  END IF;

  SELECT * INTO _b
    FROM public.produto_bloqueios
   WHERE id = _bloqueio_id
   FOR UPDATE;

  IF _b.id IS NULL THEN
    RAISE EXCEPTION 'Bloqueio não encontrado';
  END IF;

  IF NOT _b.ativo THEN
    RAISE EXCEPTION 'Este produto já está liberado';
  END IF;

  UPDATE public.produto_bloqueios
     SET ativo = false,
         permanente = false,
         motivo = btrim(_motivo)
   WHERE id = _bloqueio_id;

  INSERT INTO public.produto_bloqueios_historico
    (product_id, store_id, status_anterior, status_novo, ativo_anterior, ativo_novo,
     changed_by, changed_by_name, motivo)
  VALUES
    (_b.product_id, _b.store_id, _b.status, NULL, true, false,
     auth.uid(), coalesce(nullif(btrim(_nome), ''), 'Administração'), btrim(_motivo));
END;
$$;