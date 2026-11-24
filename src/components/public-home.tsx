import Link from "next/link";
import { signIn } from "@/auth";

export default function PublicHome() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-between gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-ink">MY-VIEW</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-mute">
          <Link href="/privacidade" className="hover:underline">Política de Privacidade</Link>
          <Link href="/termos" className="hover:underline">Termos de Serviço</Link>
          <Link href="/login" className="btn spring-btn px-3.5 py-2 text-sm no-underline">Entrar</Link>
        </nav>
      </header>

      <div className="flex flex-col gap-6">
        <section className="card bento-card flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <span className="w-fit rounded-full border border-line px-3 py-1 text-xs font-medium text-mute">
              Painel Pessoal de Produtividade
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              MY-VIEW: sua agenda, seus e-mails e suas tarefas em um só lugar
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-mute">
              O <strong>MY-VIEW</strong> é uma aplicação web de produtividade pessoal criada para centralizar o planejamento do seu dia.
              Conecte sua conta Google de forma segura para visualizar compromissos, priorizar e-mails importantes,
              consultar arquivos do Drive e acompanhar suas tarefas diárias em uma única tela.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button type="submit" className="btn btn-primary spring-btn px-5 py-3 text-base">
                Entrar com Google
              </button>
            </form>
            <Link href="/privacidade" className="btn spring-btn px-4 py-3 text-sm no-underline">
              Como seus dados são usados
            </Link>
          </div>
        </section>

        <section aria-label="Funcionalidades do MY-VIEW" className="grid gap-4 sm:grid-cols-2">
          <div className="card bento-card flex flex-col gap-2 p-5">
            <h2 className="font-display text-lg font-semibold">Google Agenda integrada</h2>
            <p className="text-sm leading-relaxed text-mute">
              Exibe os eventos e reuniões do dia, calcula blocos livres de foco e permite agendar novos compromissos diretamente pelo painel.
            </p>
          </div>
          <div className="card bento-card flex flex-col gap-2 p-5">
            <h2 className="font-display text-lg font-semibold">Triagem inteligente no Gmail</h2>
            <p className="text-sm leading-relaxed text-mute">
              Organiza mensagens por prioridade e categoria, destaca e-mails que exigem ação ou aguardam resposta e cria rascunhos sob demanda.
            </p>
          </div>
          <div className="card bento-card flex flex-col gap-2 p-5">
            <h2 className="font-display text-lg font-semibold">Acesso rápido ao Google Drive</h2>
            <p className="text-sm leading-relaxed text-mute">
              Lista documentos e arquivos recentes para consulta rápida sem precisar sair do seu fluxo de trabalho diário.
            </p>
          </div>
          <div className="card bento-card flex flex-col gap-2 p-5">
            <h2 className="font-display text-lg font-semibold">Privacidade e controle total</h2>
            <p className="text-sm leading-relaxed text-mute">
              O corpo completo dos e-mails nunca é armazenado em banco de dados e você pode revogar as permissões da sua Conta Google a qualquer momento.
            </p>
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-mute">
        <span>MY-VIEW · Painel pessoal de produtividade</span>
        <div className="flex items-center gap-4">
          <Link href="/privacidade" className="hover:underline">Política de Privacidade</Link>
          <Link href="/termos" className="hover:underline">Termos de Serviço</Link>
        </div>
      </footer>
    </main>
  );
}
