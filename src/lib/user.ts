import { cache } from "react";
import { auth } from "@/auth";

// Normalized e-mail of the signed-in user for per-account data isolation.
export const getCurrentUserEmail = cache(async (): Promise<string | null> => {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
});
