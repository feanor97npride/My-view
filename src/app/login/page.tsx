import Link from "next/link";
import { signIn } from "@/auth";
import { MvaBrand } from "@/components/mva-brand";

export const metadata = { title: "Entrar" };

export default function Login() {
  return (
    <main className="theme-ink relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
      <section className="card bento-card spring-card relative z-10 flex w-full max-w-sm flex-col items-start gap-6 p-8">
        <MvaBrand />
        <div className="flex flex-col gap-2">
          <span className="kicker">Acesso restrito</span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Entrar no MY-VIEW</h1>
          <p className="text-sm leading-relaxed text-mute">
            Seu dia em um só lugar: agenda, tarefas, e-mails e base de conhecimento.
          </p>
        </div>
        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-primary spring-btn min-h-12 w-full text-[15px]">
            Entrar com Google
          </button>
        </form>
        <footer className="flex w-full items-center justify-between border-t border-line pt-4 text-xs text-mute">
          <Link href="/" className="text-mute no-underline hover:text-ink">Início</Link>
          <div className="flex items-center gap-3">
            <Link href="/privacidade" className="text-mute no-underline hover:text-ink">Privacidade</Link>
            <span aria-hidden="true">·</span>
            <Link href="/termos" className="text-mute no-underline hover:text-ink">Termos</Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
