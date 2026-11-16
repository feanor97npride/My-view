import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/allowed-email";

// AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and AUTH_SECRET are read from the environment by Auth.js.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    signIn: ({ profile }) => isAllowedEmail(profile, process.env.ALLOWED_EMAIL),
  },
});
