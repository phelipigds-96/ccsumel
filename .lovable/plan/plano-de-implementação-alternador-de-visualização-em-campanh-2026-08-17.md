# Plano de Implementação: Alternador de Visualização em Campanhas

Adicionar a funcionalidade de alternar entre visualização em blocos (cards) e lista (tabela) no módulo de Campanhas, mantendo a preferência do usuário salva.

## Alterações

### 1. Componente de Visualização em Lista
- Criar o componente `CampanhasTable` dentro de `src/routes/_app.campanhas.tsx` (ou extrair se necessário, mas manterei no arquivo para seguir o padrão atual).
- A tabela exibirá: Status, Nome, Data Início, Data Fim, Qtd Produtos, Qtd Anexos e Ações.
- Suportar ordenação por essas colunas.
- Adaptar para mobile: cada linha vira um card compacto mantendo a estrutura de lista.

### 2. Controle de Alternância
- Adicionar botões no topo da página (próximo à busca/filtros): `▦ Blocos` | `☷ Lista`.
- Estilizar com o padrão visual do sistema (vermelho/azul-marinho).

### 3. Persistência da Preferência
- Utilizar o hook `useColumnPrefs` ou similar para salvar a chave `campanhas_view_mode` ("grid" ou "list") no banco de dados via Supabase (tabela `preferencias_colunas`).

### 4. Integração no Módulo Campanhas
- Modificar o `CampanhasList` para renderizar condicionalmente a visualização em blocos ou lista baseada no estado.
- Garantir que busca e filtros funcionem em ambas as visualizações.

## Detalhes Técnicos
- Reutilizar `statusVariant`, `fmtDate`, `printCampanhaPDF`, `CampanhaQuickView`, `CresceVendasDialog` e `DescricaoPrecoDialog`.
- Implementar ordenação local no `useMemo` de `filtered` campanhas.
- Colunas da tabela serão centralizadas/alinhadas conforme padrão do sistema.

Não serão alteradas regras de negócio, permissões ou a estrutura do banco de dados existente.