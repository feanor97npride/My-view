import { signIn } from "@/auth";

// Shown where a screen needs the Google session but it has expired (Test-mode logins last 7 days).
export default function Reconnect({ what }: { what: string }) {
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <p className="m-0 text-mute">{what} indisponível: o acesso ao Google expirou.</p>
      <button type="submit" className="btn btn-primary min-h-11">Entrar de novo</button>
    </form>
  );
}
