import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/allowed-email";

// AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and AUTH_SECRET are read from the environment by Auth.js.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent", // forces a refresh token on every sign-in
        },
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn: ({ profile }) =>
      isAllowedEmail(profile, process.env.ALLOWED_EMAILS?.trim() || process.env.ALLOWED_EMAIL?.trim()),
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: (account.expires_at ?? 0) * 1000,
        };
      }
      if (token.expiresAt && Date.now() < token.expiresAt - 60_000) return token;
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.AUTH_GOOGLE_ID ?? "",
          client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
          grant_type: "refresh_token",
          refresh_token: token.refreshToken ?? "",
        }),
      });
      if (!res.ok) return { ...token, error: "RefreshAccessTokenError" };
      const j = await res.json();
      return { ...token, accessToken: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
