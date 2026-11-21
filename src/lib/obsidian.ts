export function buildObsidianUri(input: { title: string; content: string; vault?: string }): string {
  const params = new URLSearchParams();
  if (input.vault?.trim()) params.set("vault", input.vault.trim());
  params.set("name", input.title.trim() || "My View");
  params.set("content", input.content);
  return `obsidian://new?${params.toString()}`;
}

export function openInObsidian(input: { title: string; content: string; vault?: string }): void {
  if (typeof window === "undefined") return;
  const uri = buildObsidianUri(input);
  window.location.href = uri;
}
