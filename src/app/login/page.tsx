import Link from "next/link";
import { signIn } from "@/auth";

export const metadata = { title: "Entrar" };

export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="card bento-card spring-card flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">My View</h1>
          <p className="mt-1 text-mute">Seu dia em um só lugar: agenda, tarefas e e-mails.</p>
        </div>
        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-primary spring-btn w-full py-3 text-base">Entrar com Google</button>
        </form>
        <footer className="flex items-center justify-center gap-3 text-xs text-mute">
          <Link href="/privacidade" className="hover:underline">Política de Privacidade</Link>
          <span aria-hidden="true">·</span>
          <Link href="/termos" className="hover:underline">Termos de Serviço</Link>
        </footer>
      </section>
    </main>
  );
}
