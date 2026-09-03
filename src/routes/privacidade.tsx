import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalSection, legalHead } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/privacidade")({
  head: () =>
    legalHead(
      "Política de Privacidade",
      "Como o NAVALHA PRO coleta, usa, armazena e protege os dados de barbearias e seus clientes, em conformidade com a LGPD e a Google Play.",
    ),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Política de Privacidade"
      intro={`Esta política explica quais dados o ${LEGAL.appName} coleta, por que coleta, como protege e quais são os seus direitos. Ela se aplica ao aplicativo Android, ao app instalável (PWA) e ao site.`}
    >
      <LegalSection title="1. Quem somos">
        <p>
          O {LEGAL.appName} é um sistema de gestão para barbearias: agenda, página de agendamento
          online, cadastro de clientes, serviços, profissionais, planos de assinatura e controle
          financeiro. O controlador dos dados é {LEGAL.developerName}, contato:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que coletamos">
        <h3>2.1 Da barbearia (usuário da conta)</h3>
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail e senha (criptografada) ou identificador do login
            com Google.
          </li>
          <li>
            <strong>Empresa:</strong> nome da barbearia, CPF/CNPJ, celular, endereço, Instagram,
            descrição, logotipo e capa.
          </li>
          <li>
            <strong>Pagamentos:</strong> chave Pix informada pelo barbeiro para receber dos seus
            clientes. Não armazenamos dados de cartão.
          </li>
          <li>
            <strong>Operação:</strong> serviços, preços, horários, profissionais, comissões,
            agendamentos, planos e lançamentos financeiros.
          </li>
        </ul>
        <h3>2.2 Dos clientes da barbearia</h3>
        <ul>
          <li>Nome, telefone/WhatsApp, CPF (opcional, usado para assinaturas), observações.</li>
          <li>Histórico de agendamentos, uso de créditos do plano e pagamentos registrados.</li>
        </ul>
        <p>
          Esses dados são inseridos pela barbearia ou pelo próprio cliente ao agendar pela página
          pública. A barbearia é a responsável pelo tratamento dos dados dos seus clientes; o{" "}
          {LEGAL.appName} atua como operador.
        </p>
        <h3>2.3 Dados técnicos</h3>
        <ul>
          <li>
            Registros de erro e diagnóstico (tipo de dispositivo, navegador, versão do app) para
            manter o serviço estável.
          </li>
          <li>
            Identificador de notificações push, apenas se você ativar as notificações no app.
          </li>
        </ul>
        <p>
          <strong>Não coletamos</strong> localização precisa, contatos do aparelho, fotos além das
          que você enviar, microfone, câmera, nem dados de outros apps. Não usamos publicidade nem
          rastreamento entre apps.
        </p>
      </LegalSection>

      <LegalSection title="3. Para que usamos os dados">
        <ul>
          <li>Prestar o serviço: agenda, agendamento online, assinaturas e financeiro.</li>
          <li>Autenticar o acesso e proteger a conta.</li>
          <li>Enviar notificações operacionais (novo agendamento, lembretes) se autorizadas.</li>
          <li>Prestar suporte e resolver problemas técnicos.</li>
          <li>Cumprir obrigações legais.</li>
        </ul>
        <p>Não vendemos dados pessoais e não os usamos para publicidade de terceiros.</p>
      </LegalSection>

      <LegalSection title="4. Compartilhamento">
        <ul>
          <li>
            <strong>Provedor de infraestrutura (Lovable Cloud):</strong> hospedagem do banco de
            dados, autenticação e armazenamento de imagens, com criptografia em trânsito e em
            repouso.
          </li>
          <li>
            <strong>Google:</strong> apenas se você optar por entrar com Google (recebemos nome,
            e-mail e foto).
          </li>
          <li>
            <strong>WhatsApp:</strong> mensagens são abertas no seu próprio aplicativo; não enviamos
            nada em seu nome.
          </li>
          <li>Autoridades, quando exigido por lei.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Segurança">
        <p>
          Todo o tráfego usa HTTPS/TLS. Os dados ficam em banco com controle de acesso por linha
          (cada barbearia só enxerga os próprios dados), senhas são armazenadas com hash e as chaves
          de serviço nunca são expostas ao aplicativo. Consulte a página{" "}
          <Link to="/seguranca-dados">Segurança dos Dados</Link> para o detalhamento.
        </p>
      </LegalSection>

      <LegalSection title="6. Retenção e exclusão">
        <p>
          Mantemos os dados enquanto a conta estiver ativa. Você pode excluir sua conta e todos os
          dados a qualquer momento em <strong>Configurações → Excluir minha conta</strong> dentro do
          app ou pela página <Link to="/excluir-conta">Excluir conta</Link>. A exclusão é
          definitiva e concluída em até {LEGAL.deletionDeadlineDays} dias, salvo dados que devamos
          guardar por obrigação legal.
        </p>
        <p>
          Clientes de uma barbearia podem solicitar a remoção dos seus dados diretamente à
          barbearia ou pelo e-mail <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection title="7. Seus direitos (LGPD)">
        <ul>
          <li>Confirmar a existência de tratamento e acessar seus dados.</li>
          <li>Corrigir dados incompletos ou desatualizados.</li>
          <li>Solicitar anonimização, bloqueio ou eliminação.</li>
          <li>Portabilidade e informação sobre compartilhamentos.</li>
          <li>Revogar consentimento (ex.: notificações) a qualquer momento.</li>
        </ul>
        <p>
          Para exercer qualquer direito, escreva para{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>. Respondemos em até 15
          dias.
        </p>
      </LegalSection>

      <LegalSection title="8. Crianças e adolescentes">
        <p>
          O {LEGAL.appName} é um app profissional destinado a maiores de {LEGAL.minimumAge} anos.
          Não coletamos intencionalmente dados de crianças. A barbearia pode cadastrar clientes
          menores (ex.: corte infantil) sob responsabilidade dos pais ou responsáveis.
        </p>
      </LegalSection>

      <LegalSection title="9. Permissões do aplicativo Android">
        <ul>
          <li>
            <strong>Internet:</strong> necessária para sincronizar a agenda.
          </li>
          <li>
            <strong>Notificações:</strong> opcional, para avisar de novos agendamentos.
          </li>
          <li>
            <strong>Fotos/arquivos:</strong> apenas quando você escolhe um logotipo ou capa.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Alterações e contato">
        <p>
          Podemos atualizar esta política; a data de revisão aparece no topo. Dúvidas:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a> ou{" "}
          <Link to="/suporte">página de suporte</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
