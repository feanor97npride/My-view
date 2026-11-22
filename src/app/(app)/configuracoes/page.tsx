import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Reconnect from "@/components/reconnect";
import { listCalendars, pickCalendars } from "@/lib/calendar";
import { CLICKUP_LISTS, normalizeClickupList } from "@/lib/clickup";
import { CATEGORIES, MAX_RULES, normalizeRule } from "@/lib/email-rules";
import { CATEGORY_CHIP, CATEGORY_LABEL, PRAZOS_AGUARDANDO, normalizeAwaitingDays } from "@/lib/email-view";
import { DEFAULT_PLAN, normalizePlanPrefs } from "@/lib/task-dates";
import { JANELAS_REUNIAO, normalizeWindow } from "@/lib/day-summary";
import {
  DEFAULT_AUTOMATIONS,
  getAutomationPrefs,
  getAwaitingDays,
  getDefaultClickupList,
  getEmailRules,
  getKeyboardShortcutsEnabled,
  getMeetingWindow,
  getPlanPrefs,
  getReplyTemplates,
  getSelectedCalendars,
  getUserClickupToken,
  getUserGithubToken,
  getUserGoogleTtsKey,
  setAutomationPrefs,
  setAwaitingDays,
  setDefaultClickupList,
  setEmailRules,
  setKeyboardShortcutsEnabled,
  setMeetingWindow,
  setPlanPrefs,
  setReplyTemplates,
  setSelectedCalendars,
  setUserClickupToken,
  setUserGithubToken,
  setUserGoogleTtsKey,
} from "@/lib/prefs";

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

async function saveAutomations(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setAutomationPrefs({
    autoBriefing: formData.get("autoBriefing") === "1",
    autoReplan: formData.get("autoReplan") === "1",
    autoFollowupTask: formData.get("autoFollowupTask") === "1",
  });
  revalidatePath("/", "layout");
  redirect("/configuracoes?auto=ok");
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

async function saveClickupToken(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setUserClickupToken(String(formData.get("token") ?? ""));
  revalidatePath("/", "layout");
  redirect("/configuracoes?token=ok");
}

async function saveGithubToken(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setUserGithubToken(String(formData.get("ghToken") ?? ""));
  revalidatePath("/", "layout");
  redirect("/configuracoes?gh=ok");
}

async function saveGoogleTtsKey(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setUserGoogleTtsKey(String(formData.get("ttsKey") ?? ""));
  revalidatePath("/", "layout");
  redirect("/configuracoes?tts=ok");
}

async function saveShortcuts(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  await setKeyboardShortcutsEnabled(formData.get("atalhos") === "1");
  revalidatePath("/", "layout");
  redirect("/configuracoes?atalhos=ok");
}

async function savePlan(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  const input = {
    perDay: formData.get("porDia"),
    start: formData.get("inicio"),
    end: formData.get("fim"),
    taskMin: formData.get("minutos"),
  };
  const prefs = normalizePlanPrefs(input);
  // An end before the start is rejected instead of silently replaced, so the owner sees what happened.
  if (String(input.start) >= String(input.end)) redirect("/configuracoes?plano=horario");
  await setPlanPrefs(prefs);
  revalidatePath("/", "layout");
  redirect("/configuracoes?plano=ok");
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

async function addTemplate(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  const label = String(formData.get("tplLabel") ?? "").trim();
  const body = String(formData.get("tplBody") ?? "").trim();
  if (!label || !body) redirect("/configuracoes?tpl=invalido");
  const current = await getReplyTemplates();
  await setReplyTemplates([...current, { id: `tpl-${Date.now()}`, label, body }]);
  revalidatePath("/", "layout");
  redirect("/configuracoes?tpl=ok");
}

async function removeTemplate(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.accessToken) throw new Error("Não autenticado");
  const id = String(formData.get("tplId") ?? "");
  const current = await getReplyTemplates();
  await setReplyTemplates(current.filter((t) => t.id !== id));
  revalidatePath("/", "layout");
  redirect("/configuracoes?tpl=removido");
}

export const metadata = { title: "Configurações" };

import { BentoCard, SectionHeader } from "@/components/ui";
import ConfigTabs from "./config-tabs";

const RULE_MESSAGE: Record<string, [string, string]> = {
  ok: ["chip-green", "Regra salva. Vale para os e-mails da lista na próxima abertura."],
  removida: ["chip-green", "Regra removida."],
  invalida: ["chip-red", "Use um domínio (empresa.com) ou um e-mail (pessoa@empresa.com)."],
  cheia: ["chip-red", `Limite de ${MAX_RULES} regras atingido. Remova alguma antes de adicionar.`],
};

export default async function Configuracoes({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string; erro?: string; regra?: string; tpl?: string; aviso?: string; auto?: string; prazo?: string; lista?: string; token?: string; gh?: string; tts?: string; aba?: string; atalhos?: string; plano?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.accessToken) {
    return (
      <main className="p-6">
        <Reconnect what="Configurações" />
      </main>
    );
  }

  const [all, selected, rules, templates, windowMin, awaitingDays, clickupList, clickupToken, githubToken, googleTtsKey, shortcutsEnabled, planPrefs, automationPrefs] = await Promise.all([
    listCalendars(session.accessToken).catch((e: Error) => e),
    getSelectedCalendars().catch(() => null),
    getEmailRules().catch(() => []),
    getReplyTemplates().catch(() => []),
    getMeetingWindow().catch(() => 30),
    getAwaitingDays().catch(() => 2),
    getDefaultClickupList().catch(() => CLICKUP_LISTS[0].id),
    getUserClickupToken().catch(() => null),
    getUserGithubToken().catch(() => null),
    getUserGoogleTtsKey().catch(() => null),
    getKeyboardShortcutsEnabled().catch(() => true),
    getPlanPrefs().catch(() => DEFAULT_PLAN),
    getAutomationPrefs().catch(() => DEFAULT_AUTOMATIONS),
  ]);
  const shown = Array.isArray(all) ? new Set(pickCalendars(all, selected).map((c) => c.id)) : new Set<string>();
  const ruleMsg = params.regra ? RULE_MESSAGE[params.regra] : undefined;

  const initialTab =
    params.aba === "clickup" || params.lista || params.token || params.gh || params.tts || params.atalhos
      ? "clickup"
      : params.prazo || params.regra || params.tpl
        ? "emails"
        : "agenda";

  const toastMessage =
    params.salvo ? "Calendários salvos."
    : params.aviso ? "Aviso de reunião salvo."
    : params.auto ? "Automações do dia salvas."
    : params.plano === "ok" ? "Plano do dia salvo."
    : params.prazo ? "Prazo de aguardando resposta salvo."
    : params.regra === "ok" ? "Regra de e-mail salva."
    : params.regra === "removida" ? "Regra removida."
    : params.tpl === "ok" ? "Template salvo."
    : params.tpl === "removido" ? "Template removido."
    : params.lista ? "Lista padrão do ClickUp salva."
    : params.token ? "Token do ClickUp desta conta salvo."
    : params.gh ? "Token do GitHub desta conta salvo."
    : params.tts ? "Chave do Google Cloud TTS salva."
    : params.atalhos ? "Preferência de atalhos salva."
    : null;

  const agendaSection = (
    <>
      <BentoCard as="div">
        <form action={save} className="flex flex-col gap-4">
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

          <div>
            <button type="submit" className="btn btn-primary spring-btn">Salvar calendários</button>
          </div>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={saveWindow} className="flex flex-wrap items-end gap-3">
          <SectionHeader
            className="w-full"
            title="Aviso de reunião"
            subtitle="Quanto tempo antes de uma reunião o aviso aparece (em Hoje e na faixa das outras telas)."
          />
          <label className="flex flex-col gap-1 text-sm text-mute">
            Avisar com antecedência de
            <select name="janela" defaultValue={String(windowMin)} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
              {JANELAS_REUNIAO.map((m) => (
                <option key={m} value={m}>{m} minutos</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar aviso</button>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={saveAutomations} className="flex flex-col gap-3">
          <SectionHeader
            title="Automações do dia"
            subtitle="Rotinas executadas automaticamente na primeira abertura do dia (em Hoje)."
          />
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-primary-soft">
            <input type="checkbox" name="autoBriefing" value="1" defaultChecked={automationPrefs.autoBriefing} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
            <span className="text-sm">
              <span className="block font-medium text-ink">Gerar Briefing IA automaticamente</span>
              <span className="block text-xs text-mute">Salva o briefing do dia na nuvem para abrir instantaneamente no PC e no celular.</span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-primary-soft">
            <input type="checkbox" name="autoReplan" value="1" defaultChecked={automationPrefs.autoReplan} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
            <span className="text-sm">
              <span className="block font-medium text-ink">Replanejar tarefas atrasadas automaticamente</span>
              <span className="block text-xs text-mute">Move tarefas vencidas para os próximos dias úteis livres (1x por dia).</span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-primary-soft">
            <input type="checkbox" name="autoFollowupTask" value="1" defaultChecked={automationPrefs.autoFollowupTask} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
            <span className="text-sm">
              <span className="block font-medium text-ink">Criar tarefa de follow-up para e-mails &ldquo;Aguardando&rdquo;</span>
              <span className="block text-xs text-mute">Quando uma conversa passar do prazo sem resposta, cria tarefa no ClickUp (sem duplicar).</span>
            </span>
          </label>
          <div>
            <button type="submit" className="btn btn-primary spring-btn">Salvar automações</button>
          </div>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={savePlan} className="flex flex-col gap-4">
          <SectionHeader
            title="Plano do dia"
            subtitle="Expediente usado para sugerir blocos na agenda e limite de atrasadas por dia ao replanejar."
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-mute">
              Início do expediente
              <input type="time" name="inicio" required defaultValue={planPrefs.start} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-mute">
              Fim do expediente
              <input type="time" name="fim" required defaultValue={planPrefs.end} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-mute">
              Minutos por tarefa
              <input type="number" name="minutos" min={15} max={240} step={5} defaultValue={planPrefs.taskMin} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-mute">
              Atrasadas por dia
              <input type="number" name="porDia" min={1} max={10} defaultValue={planPrefs.perDay} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar plano</button>
            {params.plano === "horario" && <p role="alert" className="chip chip-red m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">O fim do expediente precisa ser depois do início.</p>}
          </div>
        </form>
      </BentoCard>
    </>
  );

  const emailsSection = (
    <>
      <BentoCard as="div">
        <form action={saveAwaitingDays} className="flex flex-wrap items-end gap-3">
          <SectionHeader
            className="w-full"
            title="Aguardando resposta"
            subtitle="Depois de quantos dias sem resposta uma conversa enviada por você entra na lista e no alerta de Hoje."
          />
          <label className="flex flex-col gap-1 text-sm text-mute">
            Prazo
            <select name="prazo" defaultValue={String(awaitingDays)} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
              {PRAZOS_AGUARDANDO.map((d) => (
                <option key={d} value={d}>{d} {d === 1 ? "dia" : "dias"}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar prazo</button>
        </form>
      </BentoCard>

      <BentoCard className="flex flex-col gap-4">
        <SectionHeader
          title="Regras de e-mail"
          subtitle="Fixe a categoria de um remetente ou domínio (empresa.com). Suas regras vencem as automáticas e a IA."
        />

        {ruleMsg && (params.regra === "invalida" || params.regra === "cheia") && (
          <p role="alert" className={`chip ${ruleMsg[0]} m-0 whitespace-normal rounded-xl px-3.5 py-2.5 text-sm`}>
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
                <button type="submit" className="btn spring-btn px-3 py-1.5 text-[13px]" aria-label={`Remover a regra de ${r.match}`}>Remover</button>
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
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Adicionar regra</button>
        </form>
      </BentoCard>

      <BentoCard className="flex flex-col gap-4">
        <SectionHeader
          title="Templates de resposta rápida"
          subtitle="Respostas prontas exibidas na tela de E-mails para criar rascunho no Gmail em 1 clique."
        />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-bg px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-semibold text-ink">{t.label}</p>
                <p className="mt-0.5 mb-0 line-clamp-2 whitespace-pre-wrap text-xs text-mute">{t.body}</p>
              </div>
              <form action={removeTemplate}>
                <input type="hidden" name="tplId" value={t.id} />
                <button type="submit" className="btn spring-btn min-h-9 shrink-0 px-3 py-1 text-xs">Remover</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addTemplate} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-mute">
            Nome do botão
            <input name="tplLabel" type="text" required maxLength={50} placeholder="Ex: Recebido, retorno sexta" className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-mute">
            Texto do e-mail
            <textarea name="tplBody" required rows={3} maxLength={2000} placeholder="Olá,&#10;&#10;Recebi sua mensagem..." className="rounded-xl border border-line-strong bg-card p-3 text-sm text-ink" />
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11 self-start">Adicionar template</button>
        </form>
      </BentoCard>
    </>
  );

  const clickupSection = (
    <>
      <BentoCard as="div">
        <form action={saveClickupList} className="flex flex-wrap items-end gap-3">
          <SectionHeader
            className="w-full"
            title="ClickUp"
            subtitle="Lista padrão ao transformar um e-mail em tarefa na tela de E-mails."
          />
          <label className="flex flex-col gap-1 text-sm text-mute">
            Lista padrão
            <select name="lista" defaultValue={clickupList} className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink">
              {CLICKUP_LISTS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar lista</button>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={saveClickupToken} className="flex flex-wrap items-end gap-3">
          <SectionHeader
            className="w-full"
            title="Token do ClickUp (desta conta)"
            subtitle="Permite usar um workspace ClickUp separado para esta conta Google. Deixe em branco para desativar."
          />
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm text-mute">
            Token pessoal (pk_...)
            <input
              type="password"
              name="token"
              placeholder={clickupToken ? "•••••••• (token configurado)" : "pk_..."}
              className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink"
            />
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar token</button>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={saveGithubToken} className="flex flex-wrap items-end gap-3">
          <SectionHeader
            className="w-full"
            title="Token do GitHub (desta conta)"
            subtitle="Permite acompanhar seus repositórios, commits e Actions em tempo real na aba GitHub Live."
          />
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm text-mute">
            Personal Access Token (ghp_... / github_pat_...)
            <input
              type="password"
              name="ghToken"
              placeholder={githubToken ? "•••••••• (token configurado)" : "ghp_..."}
              className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink"
            />
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar GitHub</button>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={saveGoogleTtsKey} className="flex flex-wrap items-end gap-3">
          <SectionHeader
            className="w-full"
            title="Voz neural — Google Cloud TTS (opcional)"
            subtitle="Ativa voz neural pt-BR no Assistente e em Ouvir meu dia (1M caracteres/mês grátis). Deixe vazio para usar a voz do navegador."
          />
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm text-mute">
            API Key do Google Cloud Text-to-Speech
            <input
              type="password"
              name="ttsKey"
              placeholder={googleTtsKey ? "•••••••• (chave configurada)" : "AIza..."}
              className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink"
            />
          </label>
          <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar voz</button>
        </form>
      </BentoCard>

      <BentoCard as="div">
        <form action={saveShortcuts} className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            title="Atalhos de teclado"
            subtitle="Teclas rápidas (A, G, T, J, K, U, /, 1–7) na mesa de triagem de E-mails."
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="atalhos" value="1" defaultChecked={shortcutsEnabled} className="h-5 w-5 accent-[var(--primary)]" />
              Ativar atalhos
            </label>
            <button type="submit" className="btn btn-primary spring-btn min-h-11">Salvar</button>
          </div>
        </form>
      </BentoCard>
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10">
      <header>
        <p className="text-sm text-mute">Preferências</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Configurações</h1>
      </header>

      <ConfigTabs
        initialTab={initialTab}
        toastMessage={toastMessage}
        agenda={agendaSection}
        emails={emailsSection}
        clickup={clickupSection}
      />
    </main>
  );
}
