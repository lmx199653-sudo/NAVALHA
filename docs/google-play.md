# NAVALHA PRO — Guia de publicação na Google Play

Checklist completo para gerar o **AAB** (Trusted Web Activity) e preencher a ficha do app.
Todos os documentos exigidos já estão publicados no site:

| Requisito Google Play              | URL pública                                        |
| ---------------------------------- | -------------------------------------------------- |
| Política de Privacidade            | https://pronavalha.lovable.app/privacidade         |
| Termos de Uso                      | https://pronavalha.lovable.app/termos              |
| Exclusão de conta (link Data Safety) | https://pronavalha.lovable.app/excluir-conta     |
| Segurança dos Dados (resumo)       | https://pronavalha.lovable.app/seguranca-dados     |
| Suporte / contato                  | https://pronavalha.lovable.app/suporte             |
| Digital Asset Links                | https://pronavalha.lovable.app/.well-known/assetlinks.json |

E-mails, nome do desenvolvedor e datas ficam em `src/lib/legal.ts` — altere lá e todas as páginas atualizam.

---

## 1. Antes de gerar o AAB

1. **Publique o site** (botão Publish) para que as URLs acima estejam no ar.
2. Ajuste `src/lib/legal.ts`: `supportEmail`, `privacyEmail` e `developerName` devem ser reais e monitorados.
3. Se usar domínio próprio, troque `websiteUrl` e as URLs deste guia.

## 2. Gerar o AAB com Bubblewrap (TWA)

Requisitos: Node 18+, JDK 17, Android SDK (o Bubblewrap baixa se faltar).

```bash
npm i -g @nicolo-ribaudo/bubblewrap-cli   # ou: npm i -g @bubblewrap/cli
mkdir navalha-android && cd navalha-android
bubblewrap init --manifest https://pronavalha.lovable.app/manifest.webmanifest
```

Respostas sugeridas no assistente:

| Pergunta                | Valor                                    |
| ----------------------- | ---------------------------------------- |
| Domain                  | `pronavalha.lovable.app`                 |
| Application name        | `NAVALHA PRO`                            |
| Short name              | `NAVALHA PRO`                            |
| Application ID          | `app.lovable.pronavalha.twa`             |
| Display mode            | `standalone`                             |
| Orientation             | `portrait`                               |
| Status bar color        | `#0D0D10`                                |
| Start URL               | `/?source=pwa`                           |
| Icon URL                | `https://pronavalha.lovable.app/app-icon-512.png` |
| Maskable icon URL       | `https://pronavalha.lovable.app/app-icon-512.png` |
| Include support for Play Billing | `No`                            |
| Request geolocation permission | `No`                              |
| Signing key             | crie uma nova (guarde a senha!)          |

Depois:

```bash
bubblewrap build          # gera app-release-bundle.aab e app-release-signed.apk
```

> Alternativa sem terminal: https://www.pwabuilder.com → informe a URL, escolha **Android → Google Play**, mesmo Application ID acima.

## 3. Digital Asset Links (remove a barra do navegador)

1. No Play Console, após o primeiro upload: **Configuração → Integridade do app → Assinatura de apps** → copie a **impressão digital SHA-256** do *certificado de assinatura do app*.
2. Cole em `public/.well-known/assetlinks.json` no lugar de `SUBSTITUA_PELO_SHA256...`.
   Se também for testar o APK local, adicione a SHA-256 da sua chave de upload como segundo item da lista.
3. Publique o site novamente e valide em:
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://pronavalha.lovable.app&relation=delegate_permission/common.handle_all_urls`

## 4. Ficha do app (Play Console)

**Categoria:** Negócios · **Tipo:** App · **Gratuito**

**Descrição curta (80):** Agenda, agendamento online, Pix e assinaturas para barbearias.

**Descrição completa:** Sistema completo de gestão para barbearias: agenda por profissional, página de agendamento online para seus clientes, cadastro de serviços e clientes, planos de assinatura com controle de créditos, recebimento por Pix (chave + QR Code), controle financeiro e notificações de novos agendamentos.

**Recursos gráficos:** ícone 512×512 (`public/app-icon-512.png`), feature graphic 1024×500 e pelo menos 2 capturas de tela de celular (tire do app publicado: Dashboard, Agenda, Página do cliente).

**Detalhes de contato:** e-mail = `supportEmail` de `src/lib/legal.ts`; site = https://pronavalha.lovable.app/suporte.

**Política de Privacidade:** https://pronavalha.lovable.app/privacidade

## 5. Conteúdo do app — respostas

### Classificação de conteúdo (IARC)
- Categoria do questionário: **Utilitário, produtividade, comunicação ou outro**
- Violência / sexo / linguagem / drogas / apostas: **Não** para todos
- Interação entre usuários: **Não** (não há chat dentro do app)
- Compartilha localização: **Não**
- Compras digitais: **Não**
- Resultado esperado: **Livre (L)** / Everyone

### Público-alvo
- Faixa etária: **18 anos ou mais**
- O app não é direcionado a crianças; não exibe anúncios.

### Segurança dos dados (Data Safety)
- Coleta dados? **Sim** · Compartilha dados? **Não**
- Criptografia em trânsito: **Sim** · Usuário pode solicitar exclusão: **Sim**
- Link de exclusão de conta: https://pronavalha.lovable.app/excluir-conta

| Tipo de dado                         | Coletado | Finalidade                         | Obrigatório |
| ------------------------------------ | -------- | ---------------------------------- | ----------- |
| Nome                                 | Sim      | Funcionalidade do app, gestão da conta | Sim     |
| E-mail                               | Sim      | Funcionalidade do app, gestão da conta | Sim     |
| Número de telefone                   | Sim      | Funcionalidade do app              | Sim         |
| Endereço                             | Sim      | Funcionalidade do app              | Não         |
| Outras infos pessoais (CPF/CNPJ)     | Sim      | Funcionalidade do app              | Sim         |
| Informações de pagamento (chave Pix) | Sim      | Funcionalidade do app              | Não         |
| Histórico de compras (pagamentos registrados) | Sim | Funcionalidade do app          | Não         |
| Fotos (logo/capa)                    | Sim      | Funcionalidade do app              | Não         |
| Registros de falhas / diagnóstico    | Sim      | Análise (estabilidade)             | Sim         |
| IDs do dispositivo (token push)      | Sim      | Funcionalidade do app              | Não         |

Não coletados: localização, contatos, mensagens, áudio, saúde, histórico de navegação, arquivos.

### Outras declarações
- Anúncios: **Não contém anúncios**
- App de notícias / COVID / financeiro regulado / governo: **Não**
- Serviços de saúde: **Não**
- Login com Google: já configurado — o Play exige também login por e-mail (existe).

## 6. Requisitos técnicos atendidos

- `targetSdk` gerado pelo Bubblewrap atual (≥ 34) — atualize o Bubblewrap antes de buildar.
- AAB assinado com Play App Signing.
- Manifesto PWA com `id`, `start_url`, `scope`, ícones 192/512 `any` + `maskable`, `shortcuts`, `display: standalone`.
- Exclusão de conta dentro do app (**Configurações → Excluir minha conta**) e via web.
- Tela de login expõe Termos e Privacidade.
- Notificações push são opcionais e pedidas em contexto (não no primeiro acesso).

## 7. Teste antes de enviar

1. Instale o APK gerado num Android real; confirme que abre sem barra de URL (após assetlinks).
2. Faça login, crie um serviço, abra a página de agendamento, ative notificações.
3. Vá em Configurações → Excluir minha conta e confirme que a conta some.
4. Envie o AAB primeiro em **Teste interno**, depois **Produção**.
