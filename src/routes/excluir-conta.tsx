import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, Mail } from "lucide-react";
import { LegalLayout, LegalSection, legalHead } from "@/components/LegalLayout";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/excluir-conta")({
  ssr: false,
  head: () =>
    legalHead(
      "Excluir conta e dados",
      "Solicite a exclusão definitiva da sua conta NAVALHA PRO e de todos os dados da barbearia, pelo app ou por este formulário.",
    ),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setEmail(data.session?.user.email ?? null);
      setState(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
      setState(session ? "in" : "out");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const mailto = `mailto:${LEGAL.privacyEmail}?subject=${encodeURIComponent(
    `Solicitação de exclusão de conta — ${LEGAL.appName}`,
  )}&body=${encodeURIComponent(
    "Olá, solicito a exclusão definitiva da minha conta e de todos os dados.\n\nE-mail da conta: \nNome da barbearia: \n",
  )}`;

  return (
    <LegalLayout
      eyebrow="Conta"
      title="Excluir conta e dados"
      intro={`Você pode excluir sua conta do ${LEGAL.appName} e todos os dados associados a qualquer momento. A exclusão é definitiva e não pode ser desfeita.`}
      showUpdated={false}
    >
      <LegalSection title="O que será excluído">
        <ul>
          <li>Sua conta de acesso (e-mail/senha ou Google)</li>
          <li>Barbearias das quais você é dono, com logotipo e capa</li>
          <li>Agenda, clientes, serviços, profissionais e horários</li>
          <li>Planos, assinantes, créditos, pagamentos e histórico financeiro</li>
          <li>Inscrições de notificação e registros internos</li>
        </ul>
        <p>
          Todos os dados são apagados imediatamente do sistema; cópias de backup expiram em até{" "}
          {LEGAL.deletionDeadlineDays} dias. Não mantemos nenhum dado após esse prazo, exceto quando
          exigido por lei.
        </p>
      </LegalSection>

      <LegalSection title="Opção 1 — Pelo app ou site (imediato)">
        {state === "checking" && <p>Verificando sua sessão…</p>}
        {state === "in" && (
          <div className="space-y-3">
            <p>
              Você está conectado como <strong className="text-foreground">{email}</strong>. Ao
              confirmar abaixo, a conta e todos os dados serão removidos na hora.
            </p>
            <DeleteAccountDialog />
          </div>
        )}
        {state === "out" && (
          <div className="space-y-3">
            <p>
              Entre na sua conta e volte a esta página, ou vá em{" "}
              <strong className="text-foreground">Configurações → Excluir minha conta</strong>{" "}
              dentro do app.
            </p>
            <Button asChild>
              <Link to="/auth">
                <LogIn className="size-4" /> Entrar para excluir
              </Link>
            </Button>
          </div>
        )}
      </LegalSection>

      <LegalSection title="Opção 2 — Por e-mail (sem acesso à conta)">
        <p>
          Se não consegue mais entrar, envie um e-mail do endereço cadastrado para{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a> informando o nome da
          barbearia. Confirmaremos sua identidade e concluiremos a exclusão em até{" "}
          {LEGAL.deletionDeadlineDays} dias.
        </p>
        <Button asChild variant="outline">
          <a href={mailto}>
            <Mail className="size-4" /> Solicitar por e-mail
          </a>
        </Button>
      </LegalSection>

      <LegalSection title="Excluir apenas parte dos dados">
        <p>
          Dentro do app você pode apagar clientes, serviços, profissionais ou agendamentos
          individualmente, sem encerrar a conta. Clientes de uma barbearia que desejem remover seus
          próprios dados devem falar com a barbearia ou escrever para{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
