# NAVALHA PRO — Histórico do Projeto e Sistema de Planos

> Registro consolidado das funcionalidades, regras de negócio de cobrança, integração com Mercado Pago e histórico de versões do sistema.
> Atualizado em: 05 de Outubro de 2026.

---

## 1. Estrutura dos Planos da Plataforma

Após a conclusão do cadastro da barbearia (ou a qualquer momento pelo menu **Meu Plano**), a barbearia pode alternar entre 2 modalidades:

### 🟢 Plano 1 — GRÁTIS
- **Valor:** R$ 0 / mês
- **Limite de Atendimentos:** Até **100 agendamentos concluídos** por ciclo mensal.
- **Cobrança:** Totalmente isento de taxas ou mensalidades.
- **Recursos inclusos:**
  - Agenda completa com visão diária, semanal e mensal
  - Catálogo de serviços e gestão de barbeiros
  - Página pública online para agendamento dos clientes
  - Lembretes e avisos automáticos via WhatsApp
  - Suporte ao cliente

### ⭐ Plano 2 — PREMIUM (Recomendado)
- **Valor:** R$ 49,90 / mês
- **Limite de Atendimentos:** **Agendamentos concluídos ilimitados**.
- **Destaque visual:** Card com iluminação dourada e selo de recomendação.
- **Cobrança:** Sem cobrança imediata ao selecionar; faturamento mensal com vencimento no dia 05.
- **Recursos adicionais:**
  - Sem trava ou limite de agendamentos
  - Relatórios financeiros e métricas avançadas
  - Prioridade no atendimento e suporte técnico

---

## 2. Regras de Negócio e Ciclo Financeiro

### A. Seleção e Ativação
1. **Escolha com 1 clique:** O barbeiro apenas clica em *"Escolher plano"*.
2. **Sem cobrança imediata:** A ativação do plano é instantânea na conta da barbearia, sem bloqueio ou redirecionamento forçado de checkout no momento da escolha.

### B. Início e Vencimento do Ciclo
- **Dia de Início e Vencimento:** Fixo no **dia 05** de cada mês.
- **Período do Ciclo:** Do dia 05 do mês corrente até o dia 05 do mês subsequente.
- A contagem de agendamentos mensais é zerada e contabilizada dentro deste ciclo.

### C. Período de Tolerância
- **Tolerância de 10 dias:** Do dia 05 até às 23:59 do **dia 15**.
- Durante toda a tolerância, o acesso ao sistema permanece **100% liberado**.
- Qualquer bloqueio ou restrição de agendamento por inadimplência só tem início no **dia 16**.

### D. Adesão Após o Dia 15 (Isenção de Taxas)
- Se a barbearia ativar ou escolher o plano **após o dia 15** (a partir do dia 16):
  - Começa a usufruir dos recursos **imediatamente**.
  - O ciclo oficial de cobrança tem início apenas no **próximo ciclo (dia 05 do mês seguinte)**.
  - **Zero taxas adicionais:** Isenção completa de cobrança proporcional (pro-rata) pelos dias restantes até o próximo dia 05.

### E. Contabilização Estrita de Agendamentos
- São contabilizados **EXCLUSIVAMENTE agendamentos com status "CONCLUÍDO"** (`done` / `completed`).
- Agendamentos cancelados, pendentes, futuros, em andamento ou faltas (**no_show**) **NÃO são contabilizados nem cobrados**.
- Ao atingir 100 agendamentos concluídos no Plano Grátis:
  - O painel exibe aviso chamativo de teto atingido.
  - Apresenta botão direto de upgrade para o Plano Premium (R$ 49,90/mês).

---

## 3. Arquitetura Técnica e Módulos Implementados

| Módulo / Arquivo | Responsabilidade |
| :--- | :--- |
| `src/lib/plans.ts` | Configuração dos planos, funções `calculateCycleInfo`, `saveBarbershopPlan`, `getBarbershopPlanInfo`. |
| `src/components/PlanSelectionCards.tsx` | Componente reutilizável com os 2 planos lado a lado e destaque visual para o Premium. |
| `src/routes/_authenticated/onboarding.tsx` | Transição pós-cadastro da barbearia para seleção de plano antes do Dashboard. |
| `src/routes/_authenticated/cobranca.tsx` | Tela Meu Plano com KPIs do ciclo, contagem de concluídos em tempo real, upgrade e recibos. |
| `src/components/SubscriptionBanner.tsx` | Banner de alerta no topo do app para tolerância até dia 15 e limite de 100 agendamentos. |
| `src/lib/mercadopago.functions.ts` | Server functions de checkout recorrente no Mercado Pago com `billing_day: 5`. |
| `src/routes/api/public/mercadopago/webhook.ts` | Webhook público para atualização automática de status de pagamento via Mercado Pago. |

---

## 4. Histórico Recente de Commits no Repositório

- **`635072a`**: *Ajusta ciclo para início no dia 5 com tolerância até dia 15 e adesão após dia 15 no próximo ciclo sem taxas*
- **`7ad42c6`**: *Implementa tela de escolha de planos (Grátis e Premium), ciclo de 30 dias e contagem exclusiva de agendamentos concluídos*
- **`f2baf8b`**: *Fallback automático para ambiente de teste evitando erro payer e collector*
- **`40dee22`**: *Design premium com KPIs de status, grid de benefícios e histórico de recibos para Meu Plano*
- **`1821dfa`**: *Design ultra simples e direto para Meu Plano*
- **`d7c5b79`**: *Renomeia para Meu Plano e Planos dos Clientes, moderniza interface com Hero Card*
- **`3dd6bdc`**: *Aplicou migration Mercado Pago*
- **`4b0b0a2`**: *Corrige inicialização de useSubscriptionAccess e protege AppShell contra falhas de renderização*
- **`099d8c6`**: *Implementa integração completa do Mercado Pago com ciclo fixo no dia 5, webhooks e painel administrativo*
- **`e51c518`**: *Implementa redirecionamento e retorno automático do Chrome para o app nativo após login Google*
- **`4b19159`**: *Corrige State verification failed no login Google no app Android (v1.0.11)*
- **`a45d26d`**: *Implementa suporte completo a notificações push, VAPID, POST_NOTIFICATIONS (v1.0.9)*
- **`83415c1`**: *Bump para versionCode 10 (v1.0.8) para Produção Google Play*
