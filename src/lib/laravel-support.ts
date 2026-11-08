import { getOrLoad } from "@/lib/cache";
import { fetchText } from "@/lib/http";
import { parseComposerVersion } from "@/lib/composer-constraint";

const SOURCES = [
  "https://raw.githubusercontent.com/laravel/docs/master/releases.md",
  "https://raw.githubusercontent.com/laravel/docs/13.x/releases.md",
];

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export type LaravelSupportRow = {
  major: number;
  php: string;
  releaseText: string;
  releaseDate: string | null;
  bugFixesText: string;
  bugFixesDate: string | null;
  securityFixesText: string;
  securityFixesDate: string | null;
};

export type LaravelSupportState = "active" | "security" | "eol" | "unknown";

export function normalizeLaravelVersion(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 32) return null;
  const withoutV = trimmed.replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(withoutV)) return null;
  const parsed = parseComposerVersion(withoutV);
  if (!parsed || parsed.stability !== "stable") return null;
  return withoutV;
}

export function laravelMajor(version: string): number | null {
  const match = /^(\d+)\./.exec(version);
  return match ? Number(match[1]) : null;
}

/** Parse an exact Laravel docs date. "Q3 2027" and other non-days return null — they are not guessed. */
export function parseLaravelDocsDate(input: string): string | null {
  const match = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(
    input.trim(),
  );
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return iso;
}

function cells(line: string): string[] {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

/** Read the support table from official Laravel release notes markdown. Rows that are not a table are ignored. */
export function parseLaravelSupportTable(markdown: string): LaravelSupportRow[] {
  const rows: LaravelSupportRow[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const [version, php, release, bugs, security] = cells(line);
    if (!version || !/^\d+$/.test(version)) continue;
    if (!php || !release || !bugs || !security) continue;
    rows.push({
      major: Number(version),
      php,
      releaseText: release,
      releaseDate: parseLaravelDocsDate(release),
      bugFixesText: bugs,
      bugFixesDate: parseLaravelDocsDate(bugs),
      securityFixesText: security,
      securityFixesDate: parseLaravelDocsDate(security),
    });
  }
  return rows.sort((a, b) => a.major - b.major);
}

export function laravelSupportState(row: LaravelSupportRow, today: string): { state: LaravelSupportState; detail: string } {
  const bug = row.bugFixesDate;
  const security = row.securityFixesDate;
  if (!bug && !security) {
    return {
      state: "unknown",
      detail: `The official table lists bug fixes until “${row.bugFixesText}” and security fixes until “${row.securityFixesText}”. Neither is a specific day, so support is not calculated.`,
    };
  }
  if (security && today > security) {
    return {
      state: "eol",
      detail: `The official table lists security fixes until ${security}, which is before ${today}.`,
    };
  }
  if (bug && security && today <= bug) {
    return { state: "active", detail: `Bug fixes run through ${bug} and security fixes through ${security} in the official table.` };
  }
  if (bug && security && today > bug && today <= security) {
    return { state: "security", detail: `Bug fixes ended ${bug}. Security fixes run through ${security} in the official table.` };
  }
  if (security && !bug && today <= security) {
    return {
      state: "unknown",
      detail: `Security fixes run through ${security}. Bug fixes are published as “${row.bugFixesText}”, which is not a specific day, so active versus security-only is not calculated.`,
    };
  }
  if (bug && !security && today <= bug) {
    return {
      state: "active",
      detail: `Bug fixes run through ${bug}. Security end is published as “${row.securityFixesText}”, which is not a specific day.`,
    };
  }
  return {
    state: "unknown",
    detail: "The official dates that could be read do not decide a support state.",
  };
}

export async function loadLaravelSupport(): Promise<{ rows: LaravelSupportRow[]; source: string; retrievedAt: string; stale: boolean }> {
  const loaded = await getOrLoad({
    key: "laravel-releases-md",
    ttlMs: 12 * 60 * 60 * 1000,
    allowStale: true,
    load: async () => {
      let lastError: Error | null = null;
      for (const url of SOURCES) {
        try {
          const markdown = await fetchText(url, {}, { timeoutMs: 15_000, retries: 1, deadlineMs: 20_000 });
          const rows = parseLaravelSupportTable(markdown);
          if (rows.length === 0) throw new Error("Laravel release notes had no support table");
          return { markdown, source: url, rows };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Laravel docs fetch failed");
        }
      }
      throw lastError ?? new Error("Laravel docs fetch failed");
    },
  });
  return { rows: loaded.data.rows, source: loaded.data.source, retrievedAt: loaded.storedAt, stale: loaded.stale };
}
