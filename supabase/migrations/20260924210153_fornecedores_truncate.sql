-- Limpa todos os registros da tabela fornecedores
-- Confirmed: não há foreign key de produtos para fornecedores
DELETE FROM fornecedores;

-- Retorna a contagem de linhas removidas (será 0 após o DELETE)
SELECT count(*) AS linhas_removidas FROM fornecedores;
