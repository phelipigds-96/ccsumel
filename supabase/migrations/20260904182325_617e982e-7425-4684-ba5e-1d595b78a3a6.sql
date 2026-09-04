ALTER TABLE public.produtos_em_falta
  ADD COLUMN IF NOT EXISTS pedido_realizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ciente_by uuid,
  ADD COLUMN IF NOT EXISTS ciente_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ciente_at timestamptz;

UPDATE public.produtos_em_falta
   SET pedido_realizado_em = coalesce(managed_at, updated_at)
 WHERE status = 'Pedido realizado' AND pedido_realizado_em IS NULL;

CREATE OR REPLACE FUNCTION public.produtos_em_falta_track_pedido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Pedido realizado'::falta_status
     AND (OLD.status IS DISTINCT FROM NEW.status OR NEW.pedido_realizado_em IS NULL) THEN
    NEW.pedido_realizado_em := coalesce(NEW.pedido_realizado_em, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produtos_em_falta_track_pedido ON public.produtos_em_falta;
CREATE TRIGGER produtos_em_falta_track_pedido
BEFORE INSERT OR UPDATE ON public.produtos_em_falta
FOR EACH ROW EXECUTE FUNCTION public.produtos_em_falta_track_pedido();

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS app_settings_insert_admin ON public.app_settings;
CREATE POLICY app_settings_insert_admin ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS app_settings_update_admin ON public.app_settings;
CREATE POLICY app_settings_update_admin ON public.app_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

GRANT INSERT, UPDATE ON public.app_settings TO authenticated;

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_set_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value)
VALUES ('retorno_lojas', '{"prazo_dias": 7}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.marcar_retorno_ciente(_falta_id uuid, _nome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status falta_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT status INTO _status FROM public.produtos_em_falta WHERE id = _falta_id;
  IF _status IS NULL THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  UPDATE public.produtos_em_falta
     SET ciente_by = auth.uid(),
         ciente_by_name = coalesce(nullif(btrim(_nome), ''), 'Gerência'),
         ciente_at = now()
   WHERE id = _falta_id AND ciente_at IS NULL;

  IF FOUND THEN
    INSERT INTO public.produtos_em_falta_historico
      (falta_id, status_anterior, status_novo, changed_by, changed_by_name, observation)
    VALUES
      (_falta_id, _status, _status, auth.uid(),
       coalesce(nullif(btrim(_nome), ''), 'Gerência'),
       'Retorno às lojas marcado como ciente pela gerência.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_retorno_ciente(uuid, text) TO authenticated;