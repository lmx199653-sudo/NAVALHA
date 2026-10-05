# Roadmap — Cobrança e Planos NAVALHA PRO
- [x] Migração: tabelas billing e assinaturas (`subscriptions`, `subscription_invoices`, `mercadopago_events`)
- [x] Integração Mercado Pago: Preapproval recorrente fixo no dia 5 com webhook e desduplicação
- [x] Tela de Onboarding com seleção de planos (Plano 1 — Grátis vs Plano 2 — Premium)
- [x] Regra de Ciclo no dia 05 com tolerância até o dia 15 sem bloqueios
- [x] Adesão após o dia 15 iniciando no próximo ciclo sem taxas adicionais
- [x] Contabilização exclusiva de agendamentos com status "CONCLUÍDO"
- [x] Painel "Meu Plano" (`/cobranca`) com KPIs do ciclo, barra de progresso e upgrade com 1 clique
- [x] Avisos de tolerância e limite de 100 agendamentos no `SubscriptionBanner`
- [x] Validação completa de TypeScript e build Vite
