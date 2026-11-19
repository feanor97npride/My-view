import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  revalidateTag("tasks");
  revalidateTag("emails");
  revalidateTag("calendar");
  revalidateTag("prefs");
  return NextResponse.json({ ok: true });
}
