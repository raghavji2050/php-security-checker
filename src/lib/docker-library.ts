import { getOrLoad } from "@/lib/cache";
import { DOCKER_LIBRARY_URL, parseDockerLibraryPhp, type LibraryBranch } from "@/lib/docker-php";
import { fetchJson } from "@/lib/http";

export async function loadDockerLibrary(): Promise<{ branches: LibraryBranch[]; retrievedAt: string; stale: boolean }> {
  const loaded = await getOrLoad({
    key: "docker-library-php-versions",
    ttlMs: 6 * 60 * 60 * 1000,
    allowStale: true,
    load: async () => parseDockerLibraryPhp(await fetchJson<unknown>(DOCKER_LIBRARY_URL, {}, { timeoutMs: 15_000, retries: 1, deadlineMs: 20_000 })),
  });
  if (loaded.data.length === 0) throw new Error("docker-library versions.json had no PHP branches");
  return { branches: loaded.data, retrievedAt: loaded.storedAt, stale: loaded.stale };
}
