REVOKE EXECUTE ON FUNCTION public.marcar_retorno_ciente(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_retorno_ciente(uuid, text) TO authenticated;