import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade do aplicativo MY-VIEW: coleta, uso, armazenamento e proteção de dados.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-medium text-mute hover:underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">MY-VIEW</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-mute">
          <Link href="/" className="hover:underline">Início</Link>
          <Link href="/termos" className="hover:underline">Termos de Serviço</Link>
          <Link href="/login" className="hover:underline">Entrar</Link>
        </nav>
      </header>

      <article className="card bento-card flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Política de Privacidade — MY-VIEW</h1>
          <p className="mt-1 text-sm text-mute">Última atualização: 24 de novembro de 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">1. Quem somos e escopo desta política</h2>
          <p>
            O <strong>MY-VIEW</strong> (<a href="https://my-view-rho.vercel.app/" className="underline">https://my-view-rho.vercel.app/</a>) é um painel pessoal de produtividade que reúne agenda, tarefas, e-mails e arquivos em um só lugar.
            Esta Política de Privacidade explica de forma transparente quais dados coletamos, por que os solicitamos, como os utilizamos, onde são armazenados e como você pode controlá-los ou excluí-los.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">2. Dados coletados e permissões Google OAuth</h2>
          <p>Ao autenticar-se com sua Conta Google, o MY-VIEW solicita apenas os escopos estritamente necessários para oferecer suas funcionalidades:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Perfil e identificação (<code>openid</code>, <code>email</code>, <code>profile</code>):</strong> coleta seu nome, endereço de e-mail e foto de perfil para autenticar sua sessão, validar acesso autorizado e isolar suas preferências por conta.
            </li>
            <li>
              <strong>Google Agenda (<code>calendar.readonly</code>, <code>calendar.events</code>):</strong> lê seus calendários e eventos do dia/semana para exibição da linha do tempo, alertas de reunião e criação ou remoção de blocos de foco solicitados por você.
            </li>
            <li>
              <strong>Gmail (<code>gmail.modify</code>, <code>gmail.settings.basic</code>):</strong> lê metadados de mensagens (remetente, assunto, data, marcadores de leitura e anexos) e trechos curtos (<em>snippets</em>) em memória para triagem, marcação de lido/não lido, arquivamento, criação de rascunhos de resposta e filtros solicitados pelo usuário.
            </li>
            <li>
              <strong>Google Drive (<code>drive.readonly</code>, <code>drive.file</code>):</strong> lista arquivos recentes para acesso rápido e cria documentos solicitados explicitamente por você no painel.
            </li>
          </ul>
          <p>
            <strong>Integrações opcionais de terceiros:</strong> caso você configure tokens pessoais de ClickUp ou GitHub na tela de Configurações, esses tokens são utilizados exclusivamente para consultar e atualizar suas tarefas e repositórios dentro do seu painel.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">3. Como usamos os dados e Política de Uso Limitado do Google</h2>
          <p>
            Todas as informações acessadas por meio das APIs do Google são utilizadas <strong>exclusivamente</strong> para fornecer e melhorar a experiência pessoal do próprio usuário autenticado dentro do MY-VIEW.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Não vendemos, alugamos ou comercializamos dados pessoais ou dados obtidos das APIs do Google.</li>
            <li>Não exibimos anúncios nem compartilhamos dados com corretores de dados ou plataformas de marketing.</li>
            <li>Não permitimos que humanos leiam seus dados sem seu consentimento explícito, exceto quando exigido por lei ou para segurança operacional.</li>
            <li>Não utilizamos dados do Google Workspace para treinar modelos generalizados de inteligência artificial ou aprendizado de máquina.</li>
          </ul>
          <p>
            O uso e a transferência de informações recebidas das APIs do Google pelo MY-VIEW para qualquer outro aplicativo estão em total conformidade com a{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de <strong>Uso Limitado</strong>.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">4. Armazenamento, segurança e retenção</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>O que é armazenado no banco de dados:</strong> apenas metadados mínimos de classificação de e-mails (ID da mensagem, remetente, assunto, data de recebimento, status de leitura e categoria) e suas preferências de configuração (regras de triagem, listas e notas rápidas), isolados por e-mail da conta. <strong>O corpo completo dos e-mails nunca é gravado em banco de dados.</strong>
            </li>
            <li>
              <strong>Sessão e criptografia:</strong> tokens OAuth da sessão Google permanecem em cookies HTTP-only criptografados (via Auth.js). Tokens opcionais de integrações salvos no banco (ClickUp, GitHub e chave TTS) são criptografados em repouso com AES-256-GCM.
            </li>
            <li>
              <strong>Comunicação segura:</strong> todo o tráfego entre seu navegador, o servidor da aplicação e as APIs do Google ocorre exclusivamente via HTTPS/TLS.
            </li>
            <li>
              <strong>Retenção:</strong> os metadados permanecem armazenados apenas enquanto você utilizar a conta no MY-VIEW, podendo ser removidos mediante solicitação ou encerramento da conta.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">5. Compartilhamento com provedores de infraestrutura</h2>
          <p>
            O MY-VIEW utiliza serviços essenciais de hospedagem web (Vercel) e banco de dados (Neon PostgreSQL) para operar a aplicação. Quando a classificação automática por assunto/remetente ou recursos de assistente estão ativos com chave configurada, apenas os trechos estritamente necessários à solicitação do usuário são processados em trânsito, sem uso para treinamento de modelos.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">6. Seus direitos, revogação de acesso e exclusão</h2>
          <p>
            Você tem controle total sobre seus dados e pode:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Revogar imediatamente o acesso do MY-VIEW à sua Conta Google em{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                https://myaccount.google.com/permissions
              </a>.
            </li>
            <li>Encerrar sua sessão a qualquer momento clicando em <strong>Sair</strong> no painel.</li>
            <li>Solicitar acesso, correção ou exclusão completa dos metadados e preferências associados à sua conta.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">7. Cookies e armazenamento local</h2>
          <p>
            O MY-VIEW utiliza apenas cookies estritamente necessários para autenticação e proteção contra CSRF (Auth.js), além de <code>localStorage</code> no navegador para salvar sua preferência de tema (claro ou escuro). Não utilizamos cookies de rastreamento ou publicidade de terceiros.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">8. Privacidade de menores e alterações nesta política</h2>
          <p>
            O MY-VIEW não é direcionado a menores de 13 anos e não coleta intencionalmente dados de crianças. Esta Política de Privacidade pode ser atualizada periodicamente; alterações relevantes serão refletidas na data de atualização no topo desta página.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">9. Contato</h2>
          <p>
            Para dúvidas sobre esta Política de Privacidade ou solicitações de acesso/exclusão de dados do MY-VIEW, entre em contato pelo repositório oficial do projeto em{" "}
            <a href="https://github.com/feanor97npride/My-view/issues" target="_blank" rel="noreferrer" className="underline">
              github.com/feanor97npride/My-view
            </a>.
          </p>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4 text-xs leading-relaxed text-mute">
          <h2 className="font-display text-sm font-semibold text-ink">English Summary — Google API User Data Disclosure</h2>
          <p>
            <strong>MY-VIEW</strong> (<a href="https://my-view-rho.vercel.app/" className="underline">https://my-view-rho.vercel.app/</a>) accesses Google user data (basic profile, Google Calendar events, Gmail metadata/drafts/filters, and Google Drive files) solely to provide personal productivity features to the signed-in user. Full email bodies are never stored in our database. We do not sell, rent, or share Google user data with third parties for advertising or AI model training. MY-VIEW&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Users can revoke access anytime at{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline">
              myaccount.google.com/permissions
            </a>.
          </p>
        </section>
      </article>
    </main>
  );
}
