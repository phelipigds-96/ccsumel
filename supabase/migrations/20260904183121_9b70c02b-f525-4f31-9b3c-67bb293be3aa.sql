ALTER TABLE public.produtos_em_falta ADD COLUMN IF NOT EXISTS retorno_em timestamp with time zone;

CREATE OR REPLACE FUNCTION public.produtos_em_falta_track_pedido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'Pedido realizado'::falta_status
     AND (OLD.status IS DISTINCT FROM NEW.status OR NEW.pedido_realizado_em IS NULL) THEN
    NEW.pedido_realizado_em := coalesce(NEW.pedido_realizado_em, now());
  END IF;

  IF NEW.status <> 'Pendente'::falta_status AND NEW.retorno_em IS NULL THEN
    NEW.retorno_em := now();
  END IF;

  IF NEW.status = 'Pendente'::falta_status THEN
    NEW.retorno_em := NULL;
  END IF;

  RETURN NEW;
END;
$function$;