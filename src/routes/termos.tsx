import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalSection, legalHead } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  head: () =>
    legalHead(
      "Termos de Uso",
      "Condições de uso do NAVALHA PRO para barbearias e seus clientes: conta, responsabilidades, pagamentos e cancelamento.",
    ),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Termos de Uso"
      intro={`Ao criar uma conta ou usar o ${LEGAL.appName}, você concorda com estes termos. Leia com atenção.`}
    >
      <LegalSection title="1. O serviço">
        <p>
          O {LEGAL.appName} oferece ferramentas de gestão para barbearias: agenda, página pública de
          agendamento, cadastro de clientes, serviços, profissionais, planos de assinatura, Pix e
          relatórios financeiros. O serviço é fornecido “como está”, podendo evoluir com novas
          funções.
        </p>
      </LegalSection>

      <LegalSection title="2. Conta e elegibilidade">
        <ul>
          <li>É preciso ter pelo menos {LEGAL.minimumAge} anos e informar dados verdadeiros.</li>
          <li>Você é responsável por manter sua senha em sigilo e por tudo que ocorre na conta.</li>
          <li>Uma conta pode administrar uma ou mais barbearias das quais seja responsável.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Responsabilidades da barbearia">
        <ul>
          <li>
            Obter autorização dos seus clientes para cadastrar nome, telefone e CPF, e usá-los
            apenas para a prestação do serviço.
          </li>
          <li>Manter preços, horários e disponibilidade atualizados.</li>
          <li>Honrar agendamentos e pagamentos combinados com os clientes.</li>
          <li>Não usar o sistema para spam, fraude ou conteúdo ilegal.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Pagamentos entre cliente e barbearia">
        <p>
          O {LEGAL.appName} <strong>não intermedeia pagamentos</strong>. A chave Pix e o QR Code
          exibidos pertencem à barbearia; o valor é transferido diretamente do cliente para ela.
          Cobranças, estornos e disputas devem ser resolvidos entre cliente e barbearia.
        </p>
      </LegalSection>

      <LegalSection title="5. Planos de assinatura da barbearia">
        <p>
          Os planos criados pela barbearia para seus clientes (créditos de cortes, barbas e
          benefícios) são de inteira responsabilidade da barbearia, incluindo regras, preços e
          renovações. O sistema apenas registra e controla o uso desses créditos.
        </p>
      </LegalSection>

      <LegalSection title="6. Propriedade intelectual">
        <p>
          A marca, o layout e o código do {LEGAL.appName} são protegidos. Os dados inseridos pela
          barbearia (clientes, serviços, imagens) continuam sendo dela; você nos concede licença
          apenas para exibi-los dentro do serviço.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilidade e limitação de responsabilidade">
        <p>
          Trabalhamos para manter o serviço no ar, mas podem ocorrer manutenções ou falhas.
          Recomendamos manter contato alternativo com seus clientes. Na máxima extensão permitida
          por lei, não respondemos por lucros cessantes ou danos indiretos decorrentes do uso.
        </p>
      </LegalSection>

      <LegalSection title="8. Cancelamento e exclusão">
        <p>
          Você pode encerrar sua conta a qualquer momento em Configurações ou pela página{" "}
          <Link to="/excluir-conta">Excluir conta</Link>. Podemos suspender contas que violem estes
          termos, mediante aviso quando possível.
        </p>
      </LegalSection>

      <LegalSection title="9. Privacidade">
        <p>
          O tratamento de dados segue nossa <Link to="/privacidade">Política de Privacidade</Link>,
          que integra estes termos.
        </p>
      </LegalSection>

      <LegalSection title="10. Legislação e contato">
        <p>
          Aplica-se a legislação brasileira, incluindo o Código de Defesa do Consumidor e a LGPD.
          Dúvidas: <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
