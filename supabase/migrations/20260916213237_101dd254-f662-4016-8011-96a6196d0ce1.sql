REVOKE ALL ON FUNCTION public.sync_produto_bloqueio() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_produto_bloqueio() TO service_role;

REVOKE ALL ON FUNCTION public.liberar_produto_bloqueado(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_produto_bloqueado(uuid, text, text) TO authenticated, service_role;