import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchGithubLiveRepos } from "@/lib/github";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("fresh") === "1") {
    revalidateTag("github");
  }
  const data = await fetchGithubLiveRepos();
  return NextResponse.json(data);
}
