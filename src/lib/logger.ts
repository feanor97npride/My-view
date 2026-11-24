function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "unknown";
}

export function logWarn(scope: string, message: string, err?: unknown, meta?: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      level: "warn",
      scope,
      message,
      ...(err !== undefined ? { error: formatErr(err) } : {}),
      ...(meta ?? {}),
      ts: new Date().toISOString(),
    }),
  );
}

export function logError(scope: string, message: string, err?: unknown, meta?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      level: "error",
      scope,
      message,
      ...(err !== undefined ? { error: formatErr(err) } : {}),
      ...(meta ?? {}),
      ts: new Date().toISOString(),
    }),
  );
}
