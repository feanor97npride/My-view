import Link from "next/link";
import { signIn } from "@/auth";
import { MvaBrand, MvaMark } from "@/components/mva-brand";
import { Reveal, SpotlightCard } from "@/components/mva-motion";

const FEATURES = [
  {
    num: "01",
    numClass: "mva-num",
    title: "Google Agenda integrada",
    desc: "Visualiza compromissos e reuniões do dia, calcula blocos livres de foco e cria eventos diretamente pelo painel.",
  },
  {
    num: "02",
    numClass: "mva-num mva-num-2",
    title: "Triagem inteligente no Gmail",
    desc: "Organiza mensagens por prioridade e categoria, destaca e-mails que exigem ação ou aguardam resposta e cria rascunhos sob demanda.",
  },
  {
    num: "03",
    numClass: "mva-num mva-num-3",
    title: "Google Drive e Base de Conhecimento",
    desc: "Consulta rápida de documentos recentes e registros estruturados de aprendizados e decisões de projetos.",
  },
  {
    num: "04",
    numClass: "mva-num mva-num-4",
    title: "Privacidade e controle total",
    desc: "O corpo completo dos e-mails nunca é salvo em banco de dados e você pode revogar as permissões da sua Conta Google a qualquer momento.",
  },
];

export default function PublicHome() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      {/* Cabeçalho fixo translúcido */}
      <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="no-underline" aria-label="MY-VIEW · MVA Solutions">
            <MvaBrand />
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm sm:gap-6">
            <Link href="/privacidade" className="font-medium text-mute no-underline transition-colors hover:text-ink">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="hidden font-medium text-mute no-underline transition-colors hover:text-ink sm:inline">
              Termos de Serviço
            </Link>
            <Link href="/login" className="btn btn-primary spring-btn min-h-10 px-4 text-sm no-underline">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero escuro (Tinta #0B1220) com símbolo MVA flutuante, spotlight, grade de pontos e linha de sinal */}
        <section className="theme-ink relative overflow-hidden py-14 sm:py-20">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
            <div className="spring-card flex flex-col items-start gap-5">
              <span className="kicker">Painel pessoal de produtividade</span>
              <h1 className="font-display text-3xl font-bold leading-[1.06] tracking-[-0.02em] sm:text-5xl">
                MY-VIEW: agenda, e-mails e decisões em um só painel.
              </h1>
              <p className="max-w-[58ch] text-base leading-relaxed text-mute sm:text-lg">
                O <strong className="text-ink">MY-VIEW</strong> é o ambiente executivo da{" "}
                <strong className="text-ink">MVA Solutions</strong> para consolidar sua rotina diária.
                Conecte sua Conta Google com segurança para acompanhar agenda, priorizar e-mails importantes,
                consultar arquivos do Drive e organizar suas entregas com método e clareza.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/" });
                  }}
                >
                  <button type="submit" className="btn btn-primary spring-btn min-h-12 px-6 text-[15px]">
                    Entrar com Google
                    <svg
                      className="arrow-nudge"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </form>
                <Link
                  href="/privacidade"
                  className="btn spring-btn min-h-12 border-line-strong bg-transparent px-5 text-[15px] text-ink no-underline hover:bg-card"
                >
                  Como seus dados são usados
                </Link>
              </div>
            </div>

            {/* Arte interativa do monitor de sinal MVA */}
            <SpotlightCard className="spring-card spring-d2 relative aspect-[5/4] w-full rounded-2xl border border-line bg-[#0E1626] shadow-[0_20px_48px_rgba(0,0,0,0.45)]">
              <div
                className="relative h-full w-full"
                role="img"
                aria-label="Símbolo MVA Solutions sobre grade de pontos atravessado por linha de sinal"
              >
                <div className="dot-grid absolute inset-0 opacity-55" />
                <div className="mva-float absolute left-1/2 top-[44%] w-[60%] drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]">
                  <MvaMark className="h-auto w-full" />
                </div>
                <svg
                  className="absolute inset-x-0 bottom-[16%] h-[68px] w-full text-[#3B82F6]"
                  viewBox="0 0 600 72"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    className="pulse-line"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    d="M0 56 H210 L222 46 L234 56 H262 L270 12 L284 40 L298 12 L312 56 L326 12 L340 56 H368 L380 44 L392 56 H600"
                  />
                </svg>
                <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-3 font-mono text-[11px] font-medium tracking-[0.08em] text-[#A7B3C6]">
                  <span>
                    AGENDA <strong className="text-white">›</strong> E-MAILS <strong className="text-white">›</strong> ENTREGA
                  </span>
                  <span className="hidden items-center gap-2 sm:inline-flex">
                    <span className="live-dot" aria-hidden="true" />
                    SINAL ESTÁVEL
                  </span>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </section>

        {/* Funcionalidades em sequência tonal com scroll reveal + spotlight */}
        <section aria-label="Funcionalidades do MY-VIEW" className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-8 sm:py-20">
          <Reveal className="mb-10 flex max-w-2xl flex-col gap-3">
            <span className="kicker">Funcionalidades</span>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Tudo o que exige sua atenção, sem ruído.
            </h2>
            <p className="text-sm leading-relaxed text-mute sm:text-base">
              Construído para manter a rotina sob controle com leitura rápida, atalhos de teclado e integração direta com o Google Workspace.
            </p>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">
            {FEATURES.map((f, idx) => (
              <Reveal key={f.num} delay={idx * 70}>
                <SpotlightCard className="card bento-card flex h-full flex-col gap-3 hover:-translate-y-0.5">
                  <span className={f.numClass}>{f.num}</span>
                  <h3 className="font-display text-lg font-semibold text-ink">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-mute">{f.desc}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      {/* Rodapé Tinta */}
      <footer className="theme-ink border-t border-line py-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-mute sm:px-8">
          <div className="flex items-center gap-3">
            <MvaMark className="h-4 w-auto" />
            <span>MY-VIEW · MVA Solutions · Painel pessoal de produtividade</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacidade" className="text-mute no-underline transition-colors hover:text-ink">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="text-mute no-underline transition-colors hover:text-ink">
              Termos de Serviço
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
