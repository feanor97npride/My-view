// Which e-mail a ClickUp task came from. Kept in Neon (table `email_links`, created on first use),
// so the task can point back to the conversation and the e-mail can show its task.
import { neon } from "@neondatabase/serverless";

export type TaskOrigin = { taskId: string; emailId: string; threadId: string; subject: string };

let ready: Promise<unknown> | null = null;
const ensure = () => {
  const sql = neon(process.env.DATABASE_URL ?? "");
  ready ??= sql`
    CREATE TABLE IF NOT EXISTS email_links (
      task_id text PRIMARY KEY,
      email_id text NOT NULL,
      thread_id text NOT NULL,
      subject text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.catch((e) => {
    ready = null; // try again on the next call
    throw e;
  });
  return ready;
};

export async function saveTaskOrigin(o: TaskOrigin): Promise<void> {
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO email_links (task_id, email_id, thread_id, subject) VALUES (${o.taskId}, ${o.emailId}, ${o.threadId}, ${o.subject.slice(0, 300)})
    ON CONFLICT (task_id) DO UPDATE SET email_id = EXCLUDED.email_id, thread_id = EXCLUDED.thread_id, subject = EXCLUDED.subject`;
}

export async function deleteTaskOrigin(taskId: string): Promise<void> {
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`DELETE FROM email_links WHERE task_id = ${taskId}`;
}

// Origins of the given tasks, keyed by task id.
export async function originsByTask(taskIds: string[]): Promise<Record<string, TaskOrigin>> {
  if (taskIds.length === 0) return {};
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT task_id, email_id, thread_id, subject FROM email_links WHERE task_id = ANY(${taskIds})`;
  return Object.fromEntries(
    rows.map((r) => [r.task_id as string, { taskId: r.task_id as string, emailId: r.email_id as string, threadId: r.thread_id as string, subject: r.subject as string }]),
  );
}

// Task created from each of the given e-mails, keyed by e-mail id.
export async function tasksByEmail(emailIds: string[]): Promise<Record<string, string>> {
  if (emailIds.length === 0) return {};
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT email_id, task_id FROM email_links WHERE email_id = ANY(${emailIds}) ORDER BY created_at`;
  return Object.fromEntries(rows.map((r) => [r.email_id as string, r.task_id as string]));
}
