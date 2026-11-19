// Verified Google accounts allowed to sign in.
// Supports a single address, a comma/space-separated list, or "*" for any verified Google account.
export function isAllowedEmail(
  profile: { email?: string | null; email_verified?: boolean | null } | null | undefined,
  allowed: string | undefined,
): boolean {
  if (!profile?.email || profile.email_verified !== true || !allowed) return false;
  const list = allowed
    .split(/[\s,;]+/)
    .map((s) => s.replace(/^["']+|["']+$/g, "").trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  if (list.includes("*")) return true;
  return list.includes(profile.email.trim().toLowerCase());
}
