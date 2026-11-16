import { signIn } from "@/auth";

export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="rounded-lg bg-black px-5 py-3 text-white dark:bg-white dark:text-black">
          Entrar com Google
        </button>
      </form>
    </main>
  );
}
