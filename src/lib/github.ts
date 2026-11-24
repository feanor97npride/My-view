import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getUserGithubToken } from "./prefs";
import { getCurrentUserEmail } from "./user";

export type GithubRepoView = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  url: string;
  language: string | null;
  defaultBranch: string;
  stars: number;
  openIssues: number;
  pushedAt: string;
  deployUrl: string | null;
  openPrs: {
    number: number;
    title: string;
    url: string;
    draft: boolean;
  }[];
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  } | null;
  lastRun: {
    name: string;
    status: string;
    conclusion: string | null;
    url: string;
  } | null;
};

type RawRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  default_branch: string;
  stargazers_count: number;
  open_issues_count: number;
  pushed_at: string;
};

async function ghGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}`);
  }
  return res.json();
}

async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

const cachedRepos = unstable_cache(
  async (userEmail: string, tokenKey: string, token: string) => {
    void userEmail;
    void tokenKey;
    const raw = await ghGet<RawRepo[]>("/user/repos?sort=pushed&per_page=18&affiliation=owner,collaborator", token);

    const enriched: GithubRepoView[] = await mapConcurrent(
      raw,
      4,
      async (r, idx) => {
        let lastCommit: GithubRepoView["lastCommit"] = null;
        let lastRun: GithubRepoView["lastRun"] = null;
        let openPrs: GithubRepoView["openPrs"] = [];
        let deployUrl: string | null = r.homepage && /^https?:\/\//i.test(r.homepage.trim()) ? r.homepage.trim() : null;

        if (idx < 12) {
          const [commits, runs, pulls, deps] = await Promise.all([
            ghGet<{ sha: string; html_url: string; commit: { message: string; author?: { name?: string; date?: string } } }[]>(
              `/repos/${r.full_name}/commits?per_page=1`,
              token,
            ).catch(() => []),
            ghGet<{ workflow_runs?: { name?: string; status?: string; conclusion?: string | null; html_url?: string }[] }>(
              `/repos/${r.full_name}/actions/runs?per_page=1`,
              token,
            ).catch(() => ({ workflow_runs: [] })),
            ghGet<{ number: number; title: string; html_url: string; draft?: boolean }[]>(
              `/repos/${r.full_name}/pulls?state=open&per_page=3`,
              token,
            ).catch(() => []),
            ghGet<{ id: number }[]>(`/repos/${r.full_name}/deployments?per_page=1`, token).catch(() => []),
          ]);
          const c = commits[0];
          if (c) {
            lastCommit = {
              sha: c.sha.slice(0, 7),
              message: c.commit.message.split("\n")[0].slice(0, 100),
              author: c.commit.author?.name ?? "",
              date: c.commit.author?.date ?? r.pushed_at,
              url: c.html_url,
            };
          }
          const run = runs.workflow_runs?.[0];
          if (run && run.status) {
            lastRun = {
              name: run.name ?? "Workflow",
              status: run.status,
              conclusion: run.conclusion ?? null,
              url: run.html_url ?? `${r.html_url}/actions`,
            };
          }
          openPrs = pulls.map((p) => ({
            number: p.number,
            title: p.title,
            url: p.html_url,
            draft: !!p.draft,
          }));
          if (deps[0]?.id) {
            const statuses = await ghGet<{ environment_url?: string; state?: string }[]>(
              `/repos/${r.full_name}/deployments/${deps[0].id}/statuses?per_page=1`,
              token,
            ).catch(() => []);
            const envUrl = statuses[0]?.environment_url;
            if (envUrl && /^https?:\/\//i.test(envUrl)) {
              deployUrl = envUrl;
            }
          }
        }
        return {
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          description: r.description,
          url: r.html_url,
          language: r.language,
          defaultBranch: r.default_branch,
          stars: r.stargazers_count,
          openIssues: r.open_issues_count,
          pushedAt: r.pushed_at,
          deployUrl,
          openPrs,
          lastCommit,
          lastRun,
        };
      },
    );

    return { repos: enriched, fetchedAt: new Date().toISOString() };
  },
  ["github-live-repos"],
  { revalidate: 60, tags: ["github"] },
);

export const fetchGithubLiveRepos = cache(async (): Promise<{
  configured: boolean;
  repos: GithubRepoView[];
  fetchedAt: string;
  error?: string;
}> => {
  const [userEmail, token] = await Promise.all([
    getCurrentUserEmail().then((e) => e ?? ""),
    getUserGithubToken().catch(() => null),
  ]);
  if (!token) {
    return { configured: false, repos: [], fetchedAt: new Date().toISOString() };
  }
  try {
    const tokenKey = token.slice(-6);
    const data = await cachedRepos(userEmail, tokenKey, token);
    return { configured: true, ...data };
  } catch (err) {
    return {
      configured: true,
      repos: [],
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Falha ao consultar GitHub.",
    };
  }
});
