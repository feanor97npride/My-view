"use client";

import Link from "next/link";

// Replaces the blank "Application error" page with a message and a way out.
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main role="alert" className="mx-auto flex max-w-xl flex-col gap-4 p-6 md:p-10">
      <h1 className="font-display text-2xl font-bold tracking-tight">Não deu para carregar esta tela</h1>
      <p className="m-0 text-mute">
        Costuma ser uma falha passageira do Google, do ClickUp ou do banco. Se continuar, entre de novo para renovar o acesso.
        {error.digest && <span className="mt-2 block text-xs">Código do erro: {error.digest}</span>}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary min-h-11">Tentar de novo</button>
        <Link href="/login" className="btn min-h-11 no-underline">Entrar de novo</Link>
      </div>
    </main>
  );
}
