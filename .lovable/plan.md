# Plano de Correção: Leitura de Código de Barras no Banco de Oportunidades

O usuário relatou que a leitura de código de barras funciona corretamente no módulo de **Campanhas**, mas apresenta problemas no **Banco de Oportunidades**. O objetivo é replicar a lógica e a interface de busca de produtos das Campanhas para o Banco de Oportunidades, garantindo consistência e eficiência.

## Alterações

### Módulo: Banco de Oportunidades (`src/routes/_app.banco-de-oportunidades.tsx`)

- **Replicação da UI de Busca**: Substituir o campo de busca simples pelo container estilizado (`bg-navy/5`) utilizado nas Campanhas.
- **Estado de Busca**: Adicionar o estado `busca` e `lookingUp` para gerenciar a entrada do usuário e o feedback visual de carregamento.
- **Sincronização de Estados**: Garantir que o resultado do scanner atualize tanto o campo de texto quanto dispare a busca do produto.
- **Correção de Duplicação**: Remover a instância duplicada do componente `BarcodeScanner` que existe no final do arquivo.
- **Melhoria no Lookup**: Refinar a função `handleProductLookup` para fornecer feedback visual de "Buscando..." e gerenciar melhor o estado do formulário.

## Detalhes Técnicos

- Utilizar o componente `BarcodeScanner` com a prop `onResult` atualizando o estado `busca` e chamando a função de busca.
- Implementar o `onKeyDown` (Enter) no input para disparar a busca manualmente de forma idêntica ao módulo de campanhas.
- Garantir que ao encontrar um produto, os campos internos do `editing` sejam preenchidos corretamente (GTIN, código, descrição, custo, preço de venda).
