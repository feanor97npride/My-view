import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCalendarEvent, primaryTz, timeline } from "@/lib/calendar";
import { closingStatus, createClickupTask, getClickupTask, inScopeList, listStatuses, openTasks, updateClickupTask } from "@/lib/clickup";
import { createTemplateDraft, markEmailsRead, syncEmails } from "@/lib/gmail";
import {
  addAssistantMemory,
  getAssistantHistory,
  getAssistantMemory,
  getDefaultClickupList,
  getQuickNotes,
  getSelectedCalendars,
  setAssistantHistory,
  setAssistantMemory,
  setQuickNotes,
} from "@/lib/prefs";
import { dayKey, dueForKey, isDayKey, isPostpone, postponeKey } from "@/lib/task-dates";

type ChatMsg = { role: "user" | "assistant"; content: string };

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

const TOOLS = [
  {
    name: "create_clickup_task",
    description: "Cria uma nova tarefa no ClickUp para o usuário.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título objetivo da tarefa" },
        due: { type: "string", enum: ["today", "tomorrow", "none"], description: "Prazo da tarefa" },
        description: { type: "string", description: "Descrição opcional" },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_clickup_task",
    description: "Marca uma tarefa existente do ClickUp como concluída usando seu taskId.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID exato da tarefa no ClickUp" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "postpone_clickup_task",
    description: "Adia uma tarefa do ClickUp para amanhã, segunda-feira ou uma data YYYY-MM-DD.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID exato da tarefa no ClickUp" },
        when: { type: "string", description: "'tomorrow', 'monday' ou data 'YYYY-MM-DD'" },
      },
      required: ["taskId", "when"],
    },
  },
  {
    name: "create_calendar_event",
    description: "Cria um evento ou bloco de foco na Google Agenda do usuário.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título do evento/bloco" },
        startIso: { type: "string", description: "Data/hora início em ISO 8601 com fuso (ex: 2026-11-21T10:00:00-03:00)" },
        endIso: { type: "string", description: "Data/hora fim em ISO 8601 com fuso" },
        description: { type: "string", description: "Descrição opcional" },
      },
      required: ["title", "startIso", "endIso"],
    },
  },
  {
    name: "create_gmail_draft",
    description: "Cria um rascunho de resposta no Gmail dentro de uma conversa existente.",
    input_schema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "threadId do e-mail" },
        to: { type: "string", description: "E-mail do destinatário" },
        subject: { type: "string", description: "Assunto da conversa" },
        body: { type: "string", description: "Texto completo do rascunho em português" },
      },
      required: ["threadId", "to", "subject", "body"],
    },
  },
  {
    name: "mark_emails_read",
    description: "Marca um ou mais e-mails como lidos no Gmail.",
    input_schema: {
      type: "object",
      properties: {
        emailIds: { type: "array", items: { type: "string" }, description: "Lista de IDs de e-mail" },
      },
      required: ["emailIds"],
    },
  },
  {
    name: "append_quick_note",
    description: "Adiciona uma anotação ou lembrete nas Notas Rápidas desta conta.",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "Texto curto da anotação" },
      },
      required: ["note"],
    },
  },
  {
    name: "save_memory",
    description: "Salva uma preferência, regra pessoal ou fato duradouro na memória de longo prazo desta conta.",
    input_schema: {
      type: "object",
      properties: {
        fact: { type: "string", description: "Fato curto para lembrar no futuro" },
      },
      required: ["fact"],
    },
  },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const [memory, history] = await Promise.all([
    getAssistantMemory().catch(() => []),
    getAssistantHistory().catch(() => []),
  ]);
  return NextResponse.json({ memory, history });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("clear") === "history") {
    await setAssistantHistory([]);
    return NextResponse.json({ history: [] });
  }
  const idx = Number(url.searchParams.get("index"));
  const current = await getAssistantMemory().catch(() => []);
  if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
    return NextResponse.json({ error: "Índice inválido." }, { status: 400 });
  }
  const next = current.filter((_, i) => i !== idx);
  await setAssistantMemory(next);
  return NextResponse.json({ memory: next });
}

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || !session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente no portal." }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
  }

  let body: { messages?: ChatMsg[] };
  try {
    body = (await req.json()) as { messages?: ChatMsg[] };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const history = (body.messages ?? [])
    .filter((m): m is ChatMsg => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-12);
  if (history.length === 0) {
    return NextResponse.json({ error: "Envie uma mensagem." }, { status: 400 });
  }

  // Carrega o contexto vivo do usuário em paralelo
  const [tz, selected, tasks, mail, notes, memory] = await Promise.all([
    primaryTz(token).catch(() => "UTC"),
    getSelectedCalendars().catch(() => null),
    openTasks().catch(() => []),
    syncEmails(token).catch(() => null),
    getQuickNotes().catch(() => ""),
    getAssistantMemory().catch(() => []),
  ]);
  const cal = await timeline(token, new Date(), 2, selected).catch(() => null);
  const now = new Date();
  const nowLocal = now.toLocaleString("pt-BR", { timeZone: tz, dateStyle: "full", timeStyle: "short" });
  const todayIsoDate = dayKey(now, tz);

  const calSummary = (cal?.events ?? [])
    .slice(0, 15)
    .map((e) =>
      `- ${e.allDay ? "Dia inteiro" : `${e.start.toISOString()} até ${e.end.toISOString()}`}: ${e.title}`,
    )
    .join("\n") || "Nenhum evento hoje/amanhã.";

  const taskSummary = Array.isArray(tasks) && tasks.length
    ? tasks
        .slice(0, 20)
        .map((t) => `- [id:${t.id}] (${t.bucket}, ${t.list}, status:${t.status}) ${t.title}`)
        .join("\n")
    : "Nenhuma tarefa aberta no ClickUp.";

  const mailSummary = mail
    ? mail.emails
        .filter((e) => e.unread || e.category === "acao" || e.category === "financeiro")
        .slice(0, 15)
        .map((e) => `- [id:${e.id}, thread:${e.threadId}] (${e.category}${e.unread ? ", não lido" : ""}) De: ${e.sender} | Assunto: ${e.subject}`)
        .join("\n") || "Nenhum e-mail pendente."
    : "Gmail indisponível.";

  const system = `Você é o assistente pessoal integrado ao portal My View de ${session.user.name ?? session.user.email}.
Responda sempre em português do Brasil, de forma objetiva, calorosa e prática.
Use as ferramentas disponíveis sempre que o usuário pedir para criar, concluir, adiar, agendar, responder, anotar ou lembrar algo. Nunca invente que executou uma ação se não chamou a ferramenta.

Data/hora atual no fuso ${tz}: ${nowLocal} (hoje = ${todayIsoDate}).

Memória pessoal desta conta:
${memory.length ? memory.map((m, i) => `${i + 1}. ${m}`).join("\n") : "(vazia)"}

Agenda (hoje e amanhã):
${calSummary}

Tarefas ClickUp abertas:
${taskSummary}

E-mails relevantes recentes:
${mailSummary}

Notas rápidas atuais:
${notes.trim() ? notes.slice(0, 600) : "(vazio)"}`;

  const anthropicMessages: { role: "user" | "assistant"; content: unknown }[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const actionsDone: string[] = [];
  let currentMemory = memory;

  for (let step = 0; step < 4; step++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 1024,
        system,
        tools: TOOLS,
        messages: anthropicMessages,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Erro na IA (${res.status}).` }, { status: 502 });
    }
    const data = (await res.json()) as { content?: AnthropicBlock[]; stop_reason?: string };
    const blocks = data.content ?? [];
    const toolUses = blocks.filter((b): b is Extract<AnthropicBlock, { type: "tool_use" }> => b.type === "tool_use");

    if (toolUses.length === 0) {
      const replyText =
        blocks
          .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim() || "Pronto!";
      await setAssistantHistory([
        ...history,
        { role: "assistant", content: replyText, ...(actionsDone.length ? { actions: actionsDone } : {}) },
      ]).catch(() => {});
      return NextResponse.json({ reply: replyText, actions: actionsDone, memory: currentMemory });
    }

    anthropicMessages.push({ role: "assistant", content: blocks });
    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

    for (const tu of toolUses) {
      let resultText = "ok";
      try {
        if (tu.name === "create_clickup_task") {
          const title = String(tu.input.title ?? "").trim();
          const due = tu.input.due === "today" || tu.input.due === "tomorrow" ? tu.input.due : "none";
          const listId = await getDefaultClickupList().catch(() => "");
          if (!listId) throw new Error("Nenhuma lista padrão do ClickUp configurada.");
          let dueMs: number | null = null;
          if (due === "today" || due === "tomorrow") {
            const k = due === "today" ? todayIsoDate : postponeKey("tomorrow", now, tz);
            dueMs = dueForKey(k);
          }
          const created = await createClickupTask(listId, {
            name: title.slice(0, 200),
            description: String(tu.input.description ?? "Criada pelo Assistente Pessoal (My View)"),
            dueMs,
          });
          revalidateTag("tasks");
          actionsDone.push(`Tarefa criada: ${title}`);
          resultText = JSON.stringify({ ok: true, id: created.id, url: created.url });
        } else if (tu.name === "complete_clickup_task") {
          const taskId = String(tu.input.taskId ?? "").trim();
          const snap = await getClickupTask(taskId);
          if (!inScopeList(snap.listId)) throw new Error("Tarefa fora das listas configuradas.");
          const closing = closingStatus(await listStatuses(snap.listId));
          if (!closing) throw new Error("Lista sem status de conclusão.");
          await updateClickupTask(taskId, { status: closing });
          revalidateTag("tasks");
          actionsDone.push(`Tarefa concluída`);
          resultText = JSON.stringify({ ok: true, status: closing });
        } else if (tu.name === "postpone_clickup_task") {
          const taskId = String(tu.input.taskId ?? "").trim();
          const when = String(tu.input.when ?? "tomorrow").trim();
          const key = isDayKey(when) ? when : isPostpone(when) ? postponeKey(when, now, tz) : postponeKey("tomorrow", now, tz);
          const snap = await getClickupTask(taskId);
          if (!inScopeList(snap.listId)) throw new Error("Tarefa fora das listas configuradas.");
          await updateClickupTask(taskId, { dueMs: dueForKey(key) });
          revalidateTag("tasks");
          actionsDone.push(`Tarefa adiada para ${key}`);
          resultText = JSON.stringify({ ok: true, date: key });
        } else if (tu.name === "create_calendar_event") {
          const title = String(tu.input.title ?? "").trim();
          const startIso = String(tu.input.startIso ?? "").trim();
          const endIso = String(tu.input.endIso ?? "").trim();
          const created = await createCalendarEvent(token, {
            title,
            description: String(tu.input.description ?? "Agendado pelo Assistente Pessoal (My View)"),
            startIso,
            endIso,
          });
          actionsDone.push(`Evento agendado: ${title}`);
          resultText = JSON.stringify({ ok: true, id: created.id, link: created.link });
        } else if (tu.name === "create_gmail_draft") {
          const created = await createTemplateDraft(token, {
            threadId: String(tu.input.threadId ?? ""),
            to: String(tu.input.to ?? ""),
            subject: String(tu.input.subject ?? "(sem assunto)"),
            body: String(tu.input.body ?? ""),
          });
          actionsDone.push(`Rascunho criado no Gmail`);
          resultText = JSON.stringify({ ok: true, draftId: created.id });
        } else if (tu.name === "mark_emails_read") {
          const ids = Array.isArray(tu.input.emailIds) ? tu.input.emailIds.map(String).filter(Boolean) : [];
          await markEmailsRead(token, ids);
          actionsDone.push(`${ids.length} e-mail(s) marcado(s) como lido(s)`);
          resultText = JSON.stringify({ ok: true, count: ids.length });
        } else if (tu.name === "append_quick_note") {
          const note = String(tu.input.note ?? "").trim();
          if (note) {
            const cur = await getQuickNotes().catch(() => "");
            await setQuickNotes(cur.trim() ? `${cur.trim()}\n- ${note}` : `- ${note}`);
            actionsDone.push(`Nota adicionada`);
          }
          resultText = JSON.stringify({ ok: true });
        } else if (tu.name === "save_memory") {
          const fact = String(tu.input.fact ?? "").trim();
          if (fact) {
            currentMemory = await addAssistantMemory(fact);
            actionsDone.push(`Memória salva: ${fact}`);
          }
          resultText = JSON.stringify({ ok: true, memory: currentMemory });
        } else {
          resultText = JSON.stringify({ error: "Ferramenta desconhecida" });
        }
      } catch (err) {
        resultText = JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao executar ação" });
      }
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: resultText });
    }
    anthropicMessages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({
    reply: "Concluí as ações solicitadas.",
    actions: actionsDone,
    memory: currentMemory,
  });
}
