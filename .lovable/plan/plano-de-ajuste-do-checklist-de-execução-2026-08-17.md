# Plano de Ajuste do Checklist de Execução

Padronizar o checklist de campanhas com etapas fixas, remoção de criação manual e automação do progresso, conforme solicitado.

## Alterações Técnicas

### 1. Modelo de Dados (`src/lib/campanhas-store.ts`)
- Alterar `ChecklistStatus` para ser binário: `Pendente` | `Concluída`.
- Definir a constante `CHECKLIST_PADRAO` com as 8 etapas solicitadas.
- Atualizar a função `toCampanha` para injetar automaticamente o checklist padrão em campanhas novas ou existentes, garantindo a ordem e removendo tarefas manuais antigas.

### 2. Interface do Checklist (`src/components/campanha-checklist.tsx`)
- Remover campo de entrada de nova tarefa e botão de exclusão.
- Transformar os itens em botões clicáveis para alternar o status (toggle).
- Implementar indicador visual "🟢 Campanha pronta" quando atingir 8/8 tarefas.
- Ajustar cálculo de progresso para suportar decimais (ex: 12.5% por tarefa).
- Manter a restrição de acesso apenas para usuários Admin.

## Verificação
- Validar se o checklist aparece automaticamente ao abrir qualquer campanha.
- Testar o toggle de status e o cálculo da porcentagem.
- Confirmar se o selo "Campanha pronta" aparece ao completar todos os itens.
- Garantir que não há mais opções para adicionar ou renomear tarefas.
