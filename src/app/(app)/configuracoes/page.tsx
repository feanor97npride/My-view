import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Reconnect from "@/components/reconnect";
import { listCalendars, pickCalendars } from "@/lib/calendar";
import { CLICKUP_LISTS, normalizeClickupList } from "@/lib/clickup";
import { CATEGORIES, MAX_RULES, normalizeRule } from "@/lib/email-rules";
import { CATEGORY_CHIP, CATEGORY_LABEL, PRAZOS_AGUARDANDO, normalizeAwaitingDays } from "@/lib/email-view";
import { JANELAS_REUNIAO, normalizeWindow } from "@/lib/day-summary";
import { getAwaitingDays, getDefaultClickupList, getEmailRules, getMeetingWindow, getSelectedCalendars, setAwaitingDays, setDefaultClickupList, setEmailRules, setMeetingWindow, setSelectedCalendars } from "@/lib/prefs";

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

async function saveWindow(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setMeetingWindow(normalizeWindow(formData.get("janela")));
  revalidatePath("/", "layout");
  redirect("/configuracoes?aviso=ok");
}

async function saveAwaitingDays(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setAwaitingDays(normalizeAwaitingDays(formData.get("prazo")));
  revalidatePath("/", "layout");
  redirect("/configuracoes?prazo=ok");
}

async function saveClickupList(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setDefaultClickupList(normalizeClickupList(formData.get("lista")));
  revalidatePath("/", "layout");
  redirect("/configuracoes?lista=ok");
}

async function addRule(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  const rule = normalizeRule({ match: String(formData.get("match") ?? ""), category: String(formData.get("category") ?? "") });
  if (!rule) redirect("/configuracoes?regra=invalida");
  const others = (await getEmailRules()).filter((r) => r.match !== rule.match); // same sender again replaces its category
  if (others.length >= MAX_RULES) redirect("/configuracoes?regra=cheia");
  await setEmailRules([...others, rule]);
  revalidatePath("/", "layout");
  redirect("/configuracoes?regra=ok");
}

async function removeRule(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  const match = String(formData.get("match") ?? "");
  await setEmailRules((await getEmailRules()).filter((r) => r.match !== match));
  revalidatePath("/", "layout");
  redirect("/configuracoes?regra=removida");
}

export const metadata = { title: "Configurações" };

const RULE_MESSAGE: Record<string, [string, string]> = {
  ok: ["chip-green", "Regra salva. Vale para os e-mails da lista na próxima abertura."],
  removida: ["chip-green", "Regra removida."],
  invalida: ["chip-red", "Use um domínio (empresa.com) ou um e-mail (pessoa@empresa.com)."],
  cheia: ["chip-red", `Limite de ${MAX_RULES} regras atingido. Remova alguma antes de adicionar.`],
};

export default async function Configuracoes({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string; erro?: string; regra?: string; aviso?: string; prazo?: string; lista?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.accessToken) {
    return (
      <main className="p-6">
        <Reconnect what="Configurações" />
      </main>
    );
  }

  const [all, selected, rules, windowMin, awaitingDays, clickupList] = await Promise.all([
    listCalendars(session.accessToken).catch((e: Error) => e),
    getSelectedCalendars().catch(() => null),
    getEmailRules().catch(() => []),
    getMeetingWindow().catch(() => 30),
    getAwaitingDays().catch(() => 2),
    getDefaultClickupList().catch(() => CLICKUP_LISTS[0].id),
  ]);
  const shown = Array.isArray(all) ? new Set(pickCalendars(all, selected).map((c) => c.id)) : new Set<string>();
  const ruleMsg = params.regra ? RULE_MESSAGE[params.regra] : undefined;

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

      <form action={saveWindow} className="card flex flex-wrap items-end gap-3">
        <div className="w-full">
          <h2 className="font-display text-xl font-semibold">Aviso de reunião</h2>
          <p className="text-sm text-mute">Quanto tempo antes de uma reunião o aviso aparece (em Hoje e na faixa das outras telas).</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-mute">
          Avisar com antecedência de
          <select name="janela" defaultValue={String(windowMin)} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
            {JANELAS_REUNIAO.map((m) => (
              <option key={m} value={m}>{m} minutos</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary min-h-11">Salvar aviso</button>
        {params.aviso && (
          <p role="status" className="chip chip-green m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">Aviso salvo. A faixa das outras telas pode levar até 1 minuto para refletir.</p>
        )}
      </form>

      <form action={saveAwaitingDays} className="card flex flex-wrap items-end gap-3">
        <div className="w-full">
          <h2 className="font-display text-xl font-semibold">Aguardando resposta</h2>
          <p className="text-sm text-mute">Depois de quantos dias sem resposta uma conversa enviada por você entra na lista e no alerta de Hoje.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-mute">
          Prazo
          <select name="prazo" defaultValue={String(awaitingDays)} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
            {PRAZOS_AGUARDANDO.map((d) => (
              <option key={d} value={d}>{d} {d === 1 ? "dia" : "dias"}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary min-h-11">Salvar prazo</button>
        {params.prazo && (
          <p role="status" className="chip chip-green m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">Prazo salvo.</p>
        )}
      </form>

      <form action={saveClickupList} className="card flex flex-wrap items-end gap-3">
        <div className="w-full">
          <h2 className="font-display text-xl font-semibold">ClickUp</h2>
          <p className="text-sm text-mute">Lista padrão ao transformar um e-mail em tarefa na tela de E-mails.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-mute">
          Lista padrão
          <select name="lista" defaultValue={clickupList} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
            {CLICKUP_LISTS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary min-h-11">Salvar lista</button>
        {params.lista && (
          <p role="status" className="chip chip-green m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">Lista padrão salva.</p>
        )}
      </form>

      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Regras de e-mail</h2>
          <p className="text-sm text-mute">
            Fixe a categoria de um remetente. Um domínio (empresa.com) também vale para os subdomínios. Suas regras vencem as
            automáticas e a IA, e valem para os e-mails da lista de E-mails.
          </p>
        </div>

        {ruleMsg && (
          <p role={params.regra === "invalida" || params.regra === "cheia" ? "alert" : "status"} className={`chip ${ruleMsg[0]} m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm`}>
            {ruleMsg[1]}
          </p>
        )}

        {rules.length === 0 && <p className="text-sm text-mute">Nenhuma regra ainda.</p>}
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {rules.map((r) => (
            <li key={r.match} className="flex min-h-11 items-center gap-3 border-t border-line first:border-0">
              <span className="min-w-0 flex-1 truncate font-medium">{r.match}</span>
              <span className={`chip ${CATEGORY_CHIP[r.category]}`}>{CATEGORY_LABEL[r.category]}</span>
              <form action={removeRule}>
                <input type="hidden" name="match" value={r.match} />
                <button type="submit" className="btn px-3 py-1.5 text-[13px]" aria-label={`Remover a regra de ${r.match}`}>Remover</button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addRule} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-mute">
            Domínio ou e-mail
            <input
              name="match"
              required
              maxLength={100}
              placeholder="empresa.com ou pessoa@gmail.com"
              className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-mute">
            Categoria
            <select name="category" defaultValue="trabalho" className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary min-h-11">Adicionar regra</button>
        </form>
      </section>
    </main>
  );
}
