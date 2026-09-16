# Bloqueio permanente de produto descontinuado

## Objetivo
Garantir que o fim do prazo do Retorno às Lojas nunca libere um produto marcado como “Produto descontinuado”.

## Alterações
- Reforçar no banco que “Produto descontinuado” sempre cria ou mantém um bloqueio permanente por produto e loja, independentemente da configuração geral dos demais status.
- Preservar o bloqueio quando a ocorrência sair do Retorno às Lojas ou receber qualquer atualização automática.
- Manter a liberação somente pela ação administrativa existente, com motivo obrigatório, usuário, data e horário no histórico.
- Manter intactos o registro de faltas, o Retorno às Lojas e as regras configuráveis dos demais status.

## Verificação
- Confirmar no banco que o prazo de 7 dias apenas filtra a visualização e não altera bloqueios.
- Confirmar que mudar para “Produto descontinuado” gera bloqueio permanente por produto e loja.
- Confirmar que somente a liberação administrativa desativa esse bloqueio e registra o histórico.
- Executar a checagem de tipos; o erro informado em `utils.ts` não existe no arquivo atual e não foi reproduzido na checagem atual.

## Detalhes técnicos
- Aplicar uma migração idempotente para endurecer a função de sincronização e corrigir eventuais bloqueios existentes de “Produto descontinuado” que não estejam permanentes.
- Não vincular a validade do bloqueio ao campo de entrada ou ao prazo do Retorno às Lojas.
