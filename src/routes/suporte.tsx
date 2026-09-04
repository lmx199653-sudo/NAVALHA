import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Mail, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { LegalLayout, LegalSection, legalHead } from "@/components/LegalLayout";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/suporte")({
  head: () =>
    legalHead(
      "Suporte e Contato",
      "Fale com o suporte do NAVALHA PRO: e-mail, perguntas frequentes e exclusão de conta.",
    ),
  component: SupportPage,
});

const FAQ: { q: string; a: string }[] = [
  {
    q: "Esqueci minha senha. E agora?",
    a: "Na tela de login toque em “Esqueci minha senha” e siga o link enviado ao seu e-mail. Se entrou com Google, basta tocar em “Continuar com Google”.",
  },
  {
    q: "Meus clientes conseguem agendar sozinhos?",
    a: "Sim. Compartilhe o seu link público (menu Link) — o cliente escolhe serviço, profissional, horário e forma de pagamento.",
  },
  {
    q: "Como recebo pagamentos?",
    a: "Cadastre sua chave Pix em Configurações. O cliente vê a chave e o QR Code e paga direto para você; o NAVALHA PRO não retém valores.",
  },
  {
    q: "Como excluo minha conta e meus dados?",
    a: "Em Configurações → Excluir minha conta, ou pela página Excluir conta. A remoção é definitiva.",
  },
];

function SupportPage() {
  const subject = encodeURIComponent(`Suporte ${LEGAL.appName}`);
  return (
    <LegalLayout
      eyebrow="Ajuda"
      title="Suporte e contato"
      intro="Estamos aqui para ajudar sua barbearia. Respondemos em até 1 dia útil."
      showUpdated={false}
    >
      <section className="grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${LEGAL.supportEmail}?subject=${subject}`}
          className="surface-card surface-card-hover flex items-start gap-3 p-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Mail className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">E-mail de suporte</span>
            <span className="block text-sm text-muted-foreground">{LEGAL.supportEmail}</span>
          </span>
        </a>
        <a
          href={`mailto:${LEGAL.privacyEmail}`}
          className="surface-card surface-card-hover flex items-start gap-3 p-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Privacidade e dados</span>
            <span className="block text-sm text-muted-foreground">{LEGAL.privacyEmail}</span>
          </span>
        </a>
      </section>

      <LegalSection title="Perguntas frequentes">
        <div className="divide-y divide-border/70">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:content-none">
                {f.q}
              </summary>
              <p className="mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Atalhos úteis">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/excluir-conta">
              <Trash2 className="size-4" /> Excluir conta
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/privacidade">
              <ShieldCheck className="size-4" /> Privacidade
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">
              <LifeBuoy className="size-4" /> Entrar na conta
            </Link>
          </Button>
        </div>
      </LegalSection>

      <LegalSection title="Informações do desenvolvedor">
        <ul>
          <li>
            <strong>Desenvolvedor:</strong> {LEGAL.developerName}
          </li>
          <li>
            <strong>Site:</strong> <a href={LEGAL.websiteUrl}>{LEGAL.websiteUrl}</a>
          </li>
          <li>
            <strong>Classificação indicativa:</strong> {LEGAL.contentRating}
          </li>
          <li>
            <strong>Público:</strong> profissionais e donos de barbearia (maiores de{" "}
            {LEGAL.minimumAge} anos)
          </li>
        </ul>
      </LegalSection>
    </LegalLayout>
  );
}
