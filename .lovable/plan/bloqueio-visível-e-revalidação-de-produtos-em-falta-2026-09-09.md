# Bloqueio visível e revalidação de Produtos em Falta

## Objetivo
Garantir que produtos bloqueados não possam ser lançados, mesmo quando o bloqueio surgir entre a pesquisa e o salvamento.

## Alterações
- Manter o aviso destacado diretamente nos resultados da pesquisa, com produto e status.
- Revalidar produto e loja ao selecionar um resultado, antes de abrir o formulário.
- Revalidar novamente ao registrar e desabilitar a ação quando um bloqueio for detectado.
- Exibir uma mensagem clara com status e data do tratamento, retornando à pesquisa quando necessário.
- Preservar a validação já existente no banco como última proteção contra concorrência.

## Verificação
- Confirmar que um item bloqueado não abre o formulário.
- Confirmar que um bloqueio criado após a seleção impede o salvamento.
- Executar a checagem de tipos; o erro indicado em `utils.ts` não ocorre no conteúdo atual e será validado novamente após a alteração.
