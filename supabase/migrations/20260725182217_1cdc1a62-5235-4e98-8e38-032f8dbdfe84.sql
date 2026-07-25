DROP POLICY IF EXISTS produtos_insert_all ON public.produtos;
DROP POLICY IF EXISTS produtos_update_all ON public.produtos;
DROP POLICY IF EXISTS produtos_delete_all ON public.produtos;

CREATE POLICY produtos_insert_valid_product
ON public.produtos
FOR INSERT
TO anon, authenticated
WITH CHECK (char_length(btrim(descricao)) > 0 AND preco_venda >= 0);

CREATE POLICY produtos_update_valid_product
ON public.produtos
FOR UPDATE
TO anon, authenticated
USING (char_length(btrim(descricao)) > 0)
WITH CHECK (char_length(btrim(descricao)) > 0 AND preco_venda >= 0);

CREATE POLICY produtos_delete_existing_product
ON public.produtos
FOR DELETE
TO anon, authenticated
USING (id IS NOT NULL);