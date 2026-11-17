import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCalendars, pickCalendars } from "@/lib/calendar";
import { getSelectedCalendars, setSelectedCalendars } from "@/lib/prefs";

async function save(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  // Only ids that really belong to this Google account are accepted.
  const available = await listCalendars(session.accessToken);
  const ids = formData.getAll("cal").map(String).filter((id) => available.some((c) => c.id === id));
  if (ids.length === 0) redirect("/configuracoes?erro=vazio");
  await setSelectedCalendars(ids);
  revalidatePath("/", "layout");
  redirect("/configuracoes?salvo=1");
}

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ salvo?: string; erro?: string }> }) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.accessToken) {
    return <main className="p-6">Entre de novo para reconectar o Google Calendar.</main>;
  }

  const [all, selected] = await Promise.all([
    listCalendars(session.accessToken).catch((e: Error) => e),
    getSelectedCalendars().catch(() => null),
  ]);
  const shown = Array.isArray(all) ? new Set(pickCalendars(all, selected).map((c) => c.id)) : new Set<string>();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-10">
      <header>
        <p className="text-sm text-mute">Preferências</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Configurações</h1>
      </header>

      <form action={save} className="card flex flex-col gap-4">
        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="mb-1 font-display text-xl font-semibold">Calendários exibidos</legend>
          <p className="mb-2 text-sm text-mute">Vale para as telas Hoje e Semana. Marque ao menos um.</p>
          {all instanceof Error && <p className="text-sm text-mute">Agenda indisponível: {all.message}</p>}
          {Array.isArray(all) &&
            all.map((c) => (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-primary-soft">
                <input type="checkbox" name="cal" value={c.id} defaultChecked={shown.has(c.id)} className="h-5 w-5 accent-[var(--primary)]" />
                <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                {c.primary && <span className="chip chip-slate">Principal</span>}
              </label>
            ))}
        </fieldset>

        {params.erro === "vazio" && (
          <p role="alert" className="chip chip-red m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">Marque ao menos um calendário.</p>
        )}
        {params.salvo && (
          <p role="status" className="chip chip-green m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">Preferências salvas.</p>
        )}

        <div>
          <button type="submit" className="btn btn-primary">Salvar</button>
        </div>
      </form>
    </main>
  );
}
