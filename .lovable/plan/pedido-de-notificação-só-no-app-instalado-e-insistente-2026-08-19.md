# Pedido de notificação: só no app instalado, e insistente

## O que muda

1. **Aparece somente no app instalado (PWA)**
   O pedido de permissão deixa de aparecer no navegador comum e no preview/editor.
   Só é exibido quando o app está rodando em modo aplicativo (instalado na tela inicial,
   janela standalone) — no Android/Chrome e no iPhone (Safari standalone).

2. **Insistente até aceitar**
   Hoje o pedido volta só depois de 1, 3 e 7 dias. Passa a voltar:
   - a cada abertura do app, e
   - de novo dentro da mesma sessão a cada ~2 minutos enquanto o usuário só fechar/adiar,
   até ele aceitar.
   Quando o navegador já bloqueou de vez a permissão ("denied"), o card muda de texto e
   passa a mostrar como reativar nas configurações — sem tentar abrir o prompt nativo em loop
   (o navegador não reabre o prompt depois de um bloqueio).

3. **Texto do card**
   Continua o mesmo, com um reforço curto de que os avisos de novos agendamentos
   dependem da permissão.

## Detalhes técnicos

- `src/lib/push.ts`
  - Nova função `isStandalone()`: `window.matchMedia("(display-mode: standalone)").matches`
    ou `navigator.standalone === true`.
  - `shouldAsk()` passa a exigir `isStandalone()`.
  - Substituir o backoff `[1d, 3d, 7d]` por um backoff curto e cíclico
    (`2 min` dentro da sessão) sem limite de repetições; `deferAsk()` grava só o próximo
    horário, sem escalonar para dias.
- `src/components/PushPermissionPrompt.tsx`
  - Reabre o card por um `setInterval` que reavalia `shouldAsk()` (em vez de um único
    `setTimeout`), e reavalia também ao voltar o foco/visibilidade da aba.
  - Estado `denied`: mostra variante de card com instruções (cadeado → Notificações →
    Permitir), sem botão que chame o prompt nativo.
- `src/routes/__root.tsx` fica como está (o componente já é global); o filtro de rota
  pública continua valendo.
