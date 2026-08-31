# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Preparado para remix

Ao remixar este projeto, o backend (banco, auth e storage) é recriado automaticamente.
Só é preciso reconfigurar os segredos abaixo — sem eles o app funciona, mas os
recursos correspondentes ficam desativados.

| Segredo | Para quê | Obrigatório |
| --- | --- | --- |
| `MERCADOPAGO_ACCESS_TOKEN` | Pagamentos online e assinaturas | Só para cobrar online |
| `MERCADOPAGO_CLIENT_ID` | OAuth: barbearia conectar a conta MP | Só para split |
| `MERCADOPAGO_CLIENT_SECRET` | OAuth: barbearia conectar a conta MP | Só para split |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validar webhooks do Mercado Pago | Só para cobrar online |
| `VAPID_PUBLIC_KEY` | Notificações push (PWA) | Só para push |
| `VAPID_PRIVATE_KEY` | Notificações push (PWA) | Só para push |
| `PUBLIC_SITE_URL` | URL usada nos retornos de pagamento | Opcional |

Sem Mercado Pago configurado, o agendamento online continua funcionando no modo
sem pagamento. Sem VAPID, os avisos push simplesmente não são enviados.

### Primeiros passos após o remix

1. Acesse `/auth` e crie a conta do barbeiro (e-mail/senha ou Google).
2. Complete o cadastro da barbearia no onboarding.
3. Cadastre serviços, preços, barbeiros e horários.
4. Compartilhe o link público `/barbearia/<slug>` com os clientes.
