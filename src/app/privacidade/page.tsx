import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade do aplicativo My View.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/login" className="inline-flex items-center gap-2.5 text-sm font-medium text-mute hover:underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">My View</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-mute">
          <Link href="/termos" className="hover:underline">Termos de Serviço</Link>
          <Link href="/login" className="hover:underline">Entrar</Link>
        </nav>
      </header>

      <article className="card bento-card flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Política de Privacidade</h1>
          <p className="mt-1 text-sm text-mute">Última atualização: 24 de novembro de 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">1. Visão geral</h2>
          <p>
            O <strong>My View</strong> é um painel pessoal de produtividade que reúne sua agenda, tarefas, e-mails e arquivos em um único lugar.
            Esta Política de Privacidade descreve como suas informações são acessadas, utilizadas e protegidas ao utilizar o aplicativo.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">2. Dados acessados via Google OAuth</h2>
          <p>Ao entrar com sua conta Google, o My View solicita permissão apenas para os escopos necessários ao funcionamento das telas do painel:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Perfil básico (openid, email, profile):</strong> identificação da sua conta autorizada e exibição do seu nome e e-mail.</li>
            <li><strong>Google Agenda (calendar.readonly, calendar.events):</strong> leitura e gerenciamento de eventos da sua agenda.</li>
            <li><strong>Gmail (gmail.modify, gmail.settings.basic):</strong> leitura, triagem, organização e ações sobre seus e-mails e filtros.</li>
            <li><strong>Google Drive (drive.readonly, drive.file):</strong> listagem e acesso aos arquivos exibidos no painel.</li>
          </ul>
          <p>
            Integrações opcionais configuradas pelo próprio usuário (como ClickUp e GitHub) utilizam exclusivamente os tokens configurados no ambiente da aplicação para consultar e atualizar seus próprios itens.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">3. Uso e compartilhamento de dados</h2>
          <p>
            Os dados obtidos pelas APIs do Google são utilizados <strong>exclusivamente</strong> para exibir e executar as ações solicitadas por você dentro do My View.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Não vendemos, alugamos ou comercializamos seus dados pessoais.</li>
            <li>Não compartilhamos seus dados com terceiros para fins de publicidade, marketing ou perfilamento.</li>
            <li>Não utilizamos seus dados do Google Workspace para treinar modelos generalizados de inteligência artificial ou aprendizado de máquina.</li>
          </ul>
          <p>
            O uso e a transferência de informações recebidas das APIs do Google pelo My View seguem a{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de Uso Limitado.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">4. Armazenamento, segurança e retenção</h2>
          <p>
            Os tokens de autenticação OAuth são armazenados em cookies de sessão criptografados (via Auth.js) para manter seu acesso autenticado enquanto você utiliza o aplicativo.
            As preferências locais da interface (como tema) podem ser salvas no armazenamento local do seu navegador.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">5. Seus direitos e revogação de acesso</h2>
          <p>
            Você pode revogar o acesso do My View à sua conta Google a qualquer momento na página de{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Permissões da Conta Google
            </a>
            , bem como encerrar sua sessão diretamente no aplicativo.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">6. Contato</h2>
          <p>
            Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de dados no My View, entre em contato com o administrador da aplicação através do repositório oficial do projeto.
          </p>
        </section>
      </article>
    </main>
  );
}
