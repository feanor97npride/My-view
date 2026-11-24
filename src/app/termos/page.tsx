import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço",
  description: "Termos de Serviço do aplicativo My View.",
};

export default function TermosPage() {
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
          <Link href="/privacidade" className="hover:underline">Política de Privacidade</Link>
          <Link href="/login" className="hover:underline">Entrar</Link>
        </nav>
      </header>

      <article className="card bento-card flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Termos de Serviço</h1>
          <p className="mt-1 text-sm text-mute">Última atualização: 24 de novembro de 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">1. Aceitação dos termos</h2>
          <p>
            Ao acessar ou utilizar o <strong>My View</strong>, você concorda com estes Termos de Serviço e com a nossa{" "}
            <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
            Caso não concorde com qualquer condição aqui descrita, não utilize o aplicativo.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">2. Descrição do serviço</h2>
          <p>
            O My View é uma aplicação de produtividade pessoal que consolida eventos de agenda, tarefas, mensagens de e-mail, arquivos e integrações configuradas pelo usuário em uma interface unificada.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">3. Acesso e conta</h2>
          <p>
            O acesso ao aplicativo é restrito a usuários autorizados por meio de autenticação Google OAuth. Você é responsável por manter a segurança da sua conta Google e de quaisquer tokens de integração pessoal configurados na sua instância.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">4. Uso permitido</h2>
          <p>Você concorda em utilizar o My View apenas para fins legítimos e pessoais/profissionais autorizados, abstendo-se de:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Tentar contornar mecanismos de autenticação, controle de acesso ou limites das APIs integradas.</li>
            <li>Utilizar o aplicativo para envio de spam, abuso de APIs ou qualquer atividade ilícita.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">5. Serviços de terceiros</h2>
          <p>
            O My View depende de APIs de terceiros (como Google, ClickUp e GitHub). A disponibilidade e o comportamento dessas integrações estão sujeitos aos termos e políticas dos respectivos provedores.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">6. Isenção de garantias e responsabilidade</h2>
          <p>
            O aplicativo é fornecido &ldquo;no estado em que se encontra&rdquo; (<em>as is</em>), sem garantias expressas ou implícitas de disponibilidade contínua ou adequação a um propósito específico. Na extensão máxima permitida por lei, o desenvolvedor não se responsabiliza por perdas de dados ou interrupções decorrentes de falhas em serviços de terceiros.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 className="font-display text-lg font-semibold">7. Alterações e encerramento</h2>
          <p>
            Estes Termos de Serviço podem ser atualizados periodicamente para refletir melhorias no aplicativo ou exigências legais. Você pode interromper o uso do My View e revogar as permissões concedidas a qualquer momento.
          </p>
        </section>
      </article>
    </main>
  );
}
