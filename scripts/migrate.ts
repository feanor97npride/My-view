import { neon } from "@neondatabase/serverless";

async function migrate() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL não configurada.");
  }
  const sql = neon(url);

  await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS user_email text NOT NULL DEFAULT ''`;
  await sql`CREATE INDEX IF NOT EXISTS emails_user_idx ON emails (user_email, received_at DESC)`;

  console.log("Migrations applied successfully.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
