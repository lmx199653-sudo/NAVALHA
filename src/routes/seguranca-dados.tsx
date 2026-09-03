import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalSection, legalHead } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/seguranca-dados")({
  head: () =>
    legalHead(
      "Segurança dos Dados",
      "Declaração de Segurança dos Dados do NAVALHA PRO: o que é coletado, compartilhado, criptografia e exclusão — conforme a seção Data Safety da Google Play.",
    ),
  component: DataSafetyPage,
});

const ROWS: { cat: string; data: string; why: string; shared: string; optional: string }[] = [
  {
    cat: "Informações pessoais",
    data: "Nome, e-mail, CPF/CNPJ, telefone, endereço da barbearia",
    why: "Funcionalidade do app, gerenciamento da conta",
    shared: "Não",
    optional: "Obrigatório para criar conta",
  },
  {
    cat: "Informações financeiras",
    data: "Chave Pix da barbearia; registros de pagamentos (valor, forma)",
    why: "Funcionalidade do app (recebimento e controle financeiro)",
    shared: "Não",
    optional: "Opcional",
  },
  {
    cat: "Fotos",
    data: "Logotipo e capa enviados pela barbearia",
    why: "Personalização da página de agendamento",
    shared: "Não",
    optional: "Opcional",
  },
  {
    cat: "Dados de clientes da barbearia",
    data: "Nome, telefone, CPF (opcional), agendamentos",
    why: "Funcionalidade do app (agenda e assinaturas)",
    shared: "Não",
    optional: "Inseridos pela barbearia/cliente",
  },
  {
    cat: "Identificadores do dispositivo",
    data: "Token de notificação push",
    why: "Notificações de novos agendamentos",
    shared: "Não",
    optional: "Opcional (só se ativar notificações)",
  },
  {
    cat: "Diagnóstico",
    data: "Registros de erro e desempenho",
    why: "Estabilidade e correção de falhas",
    shared: "Não",
    optional: "Automático",
  },
];

function DataSafetyPage() {
  return (
    <LegalLayout
      eyebrow="Google Play · Data Safety"
      title="Segurança dos Dados"
      intro="Resumo transparente do que o app coleta, para quê, se compartilha e como você controla seus dados. As mesmas respostas são declaradas na ficha do app na Google Play."
    >
      <LegalSection title="Resumo">
        <ul>
          <li>
            <strong>Dados criptografados em trânsito:</strong> sim (HTTPS/TLS).
          </li>
          <li>
            <strong>Dados criptografados em repouso:</strong> sim, no provedor de nuvem.
          </li>
          <li>
            <strong>Você pode solicitar a exclusão:</strong> sim, dentro do app e pela página{" "}
            <Link to="/excluir-conta">Excluir conta</Link>.
          </li>
          <li>
            <strong>Compartilhamento com terceiros:</strong> não. Nenhum dado é vendido ou
            compartilhado para publicidade ou análise de terceiros.
          </li>
          <li>
            <strong>Publicidade e rastreamento:</strong> o app não exibe anúncios nem usa SDKs de
            rastreamento.
          </li>
          <li>
            <strong>Segurança independente:</strong> controle de acesso por linha no banco, senhas
            com hash, chaves administrativas exclusivamente no servidor.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Dados coletados">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Dados</th>
                <th>Finalidade</th>
                <th>Compartilhado</th>
                <th>Opcional</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.cat}>
                  <td className="font-medium text-foreground">{r.cat}</td>
                  <td>{r.data}</td>
                  <td>{r.why}</td>
                  <td>{r.shared}</td>
                  <td>{r.optional}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Dados que NÃO coletamos">
        <ul>
          <li>Localização precisa ou aproximada</li>
          <li>Contatos, SMS, chamadas ou calendário do aparelho</li>
          <li>Microfone, câmera (exceto ao escolher uma foto manualmente)</li>
          <li>Histórico de navegação, apps instalados ou dados de saúde</li>
          <li>Dados de cartão de crédito</li>
        </ul>
      </LegalSection>

      <LegalSection title="Práticas de segurança">
        <ul>
          <li>Autenticação por e-mail/senha ou Google, com tokens de curta duração.</li>
          <li>
            Isolamento por barbearia: políticas no banco garantem que cada conta só leia e altere os
            próprios registros.
          </li>
          <li>Operações sensíveis (ex.: exclusão de conta) só rodam no servidor após validação.</li>
          <li>Funções internas do banco não são executáveis por usuários anônimos.</li>
          <li>Backups automáticos do provedor de nuvem.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Exclusão de dados">
        <p>
          A exclusão da conta remove barbearia, agenda, clientes, serviços, profissionais,
          assinaturas, pagamentos, imagens e a conta de acesso. Concluída em até{" "}
          {LEGAL.deletionDeadlineDays} dias. Também é possível apagar somente parte dos dados (um
          cliente, um serviço, etc.) diretamente no app.
        </p>
      </LegalSection>

      <LegalSection title="Contato">
        <p>
          Segurança ou privacidade: <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>
          . Política completa em <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
