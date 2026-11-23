import { auth, signIn } from "@/auth";
import DriveBoard from "@/components/drive-board";
import Reconnect from "@/components/reconnect";
import { listDriveFiles, type DriveFile } from "@/lib/drive";

export const metadata = { title: "Google Drive" };

async function reconnectGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/drive" });
}

export default async function DrivePage() {
  const session = await auth();
  const token = session?.accessToken;

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-3 py-4 sm:p-4 md:px-8 md:py-8 xl:px-10">
        <Reconnect what="Google Drive" />
      </main>
    );
  }

  let initialFiles: DriveFile[] = [];
  let scopeMissing = false;
  let initialError: string | null = null;

  try {
    initialFiles = await listDriveFiles(token, { pageSize: 30 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao carregar Google Drive.";
    if (msg === "DRIVE_SCOPE_MISSING") {
      scopeMissing = true;
    } else {
      initialError = msg;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-3 py-4 sm:p-4 md:px-8 md:py-8 xl:px-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mute">Arquivos recentes, busca por texto e criação rápida de Google Docs</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Google Drive</h1>
        </div>
      </header>

      <DriveBoard
        initialFiles={initialFiles}
        initialScopeMissing={scopeMissing}
        initialError={initialError}
        reconnectAction={reconnectGoogle}
      />
    </main>
  );
}
