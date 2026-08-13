# Plano de Melhoria do Leitor de Código e Responsividade do Diálogo

Melhorar a experiência de leitura de códigos de barras (mais rápido e preciso) e corrigir problemas de layout em dispositivos móveis no módulo de Banco de Oportunidades e Campanhas.

## Alterações

### 1. Aprimoramento do BarcodeScanner (`src/components/barcode-scanner.tsx`)
- **Aumentar FPS:** De 10 para 20-30 para capturas mais fluidas.
- **Ajustar qrbox:** Tornar a área de captura um pouco maior para facilitar o enquadramento.
- **Melhorar Feedback Visual:** Adicionar uma moldura mais visível e melhorar a animação de scan.
- **Otimizar Configuração:** Adicionar `experimentalFeatures` da biblioteca `html5-qrcode` (como `useBarCodeDetectorIfSupported`).

### 2. Correção de Layout no Banco de Oportunidades (`src/routes/_app.banco-de-oportunidades.tsx`)
- **Scroll no Diálogo:** Garantir que o `DialogContent` tenha `max-h-[90vh]` e `overflow-y-auto` para que o formulário seja rolável em telas pequenas.
- **Espaçamento Mobile:** Ajustar paddings e margens para evitar que botões fiquem escondidos ou inacessíveis.

### 3. Melhoria no Fluxo de Cadastro de Ofertas (`src/routes/_app.campanhas.tsx`)
- **Consistência no Diálogo:** Aplicar os mesmos ajustes de rolagem e altura máxima no `OfertaDialog`.

## Detalhes Técnicos
- Utilizar `overflow-y-auto` nas classes do `DialogContent`.
- Ajustar as configurações do `Html5Qrcode` no hook `startScanner`.
- Verificar se o botão "Salvar" está sempre visível ou acessível via scroll.
