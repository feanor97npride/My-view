// Only the owner's verified Google account may sign in.
export function isAllowedEmail(
  profile: { email?: string | null; email_verified?: boolean | null } | null | undefined,
  allowed: string | undefined,
): boolean {
  if (!profile?.email || !allowed) return false;
  return profile.email_verified === true && profile.email.toLowerCase() === allowed.trim().toLowerCase();
}
