import { NextResponse } from "next/server";
import { auth } from "@/auth";

// /api/kb/status só expõe metadados (contagens e sha), nenhum texto de registro.
const PUBLIC_PATHS = ["/login", "/privacidade", "/termos", "/api/kb/status"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const sessionInvalid = !req.auth || req.auth.error === "RefreshAccessTokenError";
  if (sessionInvalid && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
