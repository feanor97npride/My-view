// Centralized Anthropic model configuration; override via ANTHROPIC_MODEL env var if needed.
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001";
