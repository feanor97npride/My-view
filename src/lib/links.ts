// Which e-mail a ClickUp task came from. Kept in Neon (table `email_links`), isolated by user_email.
import { neon } from "@neondatabase/serverless";
import { getCurrentUserEmail } from "./user";

export type TaskOrigin = { taskId: string; emailId: string; threadId: string; subject: string };

let ready: Promise<unknown> | null = null;
const ensure = () => {
  const sql = neon(process.env.DATABASE_URL ?? "");
  ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS email_links (
        task_id text PRIMARY KEY,
        email_id text NOT NULL,
        thread_id text NOT NULL,
        subject text NOT NULL,
        user_email text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`ALTER TABLE email_links ADD COLUMN IF NOT EXISTS user_email text NOT NULL DEFAULT ''`;
  })().catch((e) => {
    ready = null; // try again on the next call
    throw e;
  });
  return ready;
};

export async function saveTaskOrigin(o: TaskOrigin): Promise<void> {
  const email = (await getCurrentUserEmail()) ?? "";
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO email_links (task_id, email_id, thread_id, subject, user_email)
    VALUES (${o.taskId}, ${o.emailId}, ${o.threadId}, ${o.subject}, ${email})
    ON CONFLICT (task_id) DO UPDATE SET
      email_id = EXCLUDED.email_id,
      thread_id = EXCLUDED.thread_id,
      subject = EXCLUDED.subject,
      user_email = EXCLUDED.user_email`;
}

export async function deleteTaskOrigin(taskId: string): Promise<void> {
  const email = (await getCurrentUserEmail()) ?? "";
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`DELETE FROM email_links WHERE task_id = ${taskId} AND (user_email = ${email} OR user_email = '')`;
}

export async function originsByTask(taskIds: string[]): Promise<Record<string, Omit<TaskOrigin, "taskId">>> {
  if (taskIds.length === 0) return {};
  const email = (await getCurrentUserEmail()) ?? "";
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`
    SELECT task_id, email_id, thread_id, subject
    FROM email_links
    WHERE task_id = ANY(${taskIds}) AND (user_email = ${email} OR user_email = '')`;
  return Object.fromEntries(
    rows.map((r) => [r.task_id as string, { emailId: r.email_id as string, threadId: r.thread_id as string, subject: r.subject as string }]),
  );
}

export async function tasksByEmail(emailIds: string[]): Promise<Record<string, string>> {
  if (emailIds.length === 0) return {};
  const email = (await getCurrentUserEmail()) ?? "";
  await ensure();
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`
    SELECT email_id, task_id
    FROM email_links
    WHERE email_id = ANY(${emailIds}) AND (user_email = ${email} OR user_email = '')`;
  return Object.fromEntries(rows.map((r) => [r.email_id as string, r.task_id as string]));
}
