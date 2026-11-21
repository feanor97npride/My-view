import GithubLiveBoard from "@/components/github-live-board";
import { fetchGithubLiveRepos } from "@/lib/github";

export const metadata = { title: "GitHub Live" };

export default async function GithubPage() {
  const data = await fetchGithubLiveRepos();

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10">
      <header className="spring-card spring-d1">
        <p className="text-sm text-mute">Repositórios, últimos commits e status do GitHub Actions em tempo real</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">GitHub Live</h1>
      </header>

      <GithubLiveBoard
        initialConfigured={data.configured}
        initialRepos={data.repos}
        initialFetchedAt={data.fetchedAt}
        initialError={data.error}
      />
    </main>
  );
}
