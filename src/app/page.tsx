import { auth, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <p>Olá, {session?.user?.name ?? "usuário"}.</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="underline">Sair</button>
      </form>
    </main>
  );
}
