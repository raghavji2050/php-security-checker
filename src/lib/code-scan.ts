export const COMMAND_INJECTION_LESSON_URL =
  "https://php-hub-rj.vercel.app/lessons/2026-11-27-php-command-injection-process-arrays";

export const MAX_CODE_BYTES = 256 * 1024;

export type FindingSeverity = "high" | "medium";

export type CodeScanFinding = {
  ruleId: string;
  severity: FindingSeverity;
  line: number;
  snippet: string;
  title: string;
  why: string;
  fix: string;
  safeExample: string;
  lessonUrl: string;
  lessonLabel: string;
};

export type CodeScanReport = {
  findings: CodeScanFinding[];
  scannedBytes: number;
};

export type Kind = "code" | "comment" | "string" | "interp";

export type CodeScanRule = {
  id: string;
  title: string;
  scan: (source: string, kinds: Kind[]) => CodeScanFinding[];
};

const SHELL_FUNCS = ["exec", "shell_exec", "system", "passthru", "popen", "proc_open"] as const;

const WHY_HIGH =
  "Request input reaches a shell command, so an attacker can run extra commands on the server (command injection). This is a heuristic pattern check, not a full static analyser.";
const WHY_CMDS =
  "escapeshellcmd() does not escape shell arguments safely, so request input can still inject extra commands. This is a heuristic pattern check, not a full static analyser.";
const FIX =
  "Do not send user input through the shell. Prefer Symfony Process or Laravel Process with an argument array. If you must use a shell function, wrap the value in escapeshellarg(). escapeshellcmd() alone is not enough.";
const SAFE_EXAMPLE = `use Symfony\\Component\\Process\\Process;

$process = new Process(['git', 'show', $commit]);
$process->run();
// Laravel: Process::run(['git', 'show', $commit]);`;
const LESSON_LABEL = "Command injection fix guide on PHP Hub";

type Span = { start: number; end: number };

function isIdent(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

function snippetAt(source: string, index: number): string {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const nl = source.indexOf("\n", index);
  const end = nl === -1 ? source.length : nl;
  return source.slice(start, end).trim().slice(0, 200);
}

function skipWsAndComments(kinds: Kind[], source: string, index: number, dir: 1 | -1): number {
  let i = index;
  while (i >= 0 && i < source.length) {
    if (kinds[i] === "comment" || (kinds[i] === "code" && /\s/.test(source[i]!))) {
      i += dir;
      continue;
    }
    break;
  }
  return i;
}

/** Classify each character: code, comment, raw string, or interpolating string/backtick body. */
export function classifyPhp(source: string): Kind[] {
  const kinds: Kind[] = Array.from({ length: source.length }, () => "code");
  const n = source.length;
  let i = 0;

  const paint = (from: number, to: number, kind: Kind) => {
    for (let j = from; j < to && j < n; j += 1) kinds[j] = kind;
  };

  const closeQuoted = (quote: string, kind: Kind) => {
    const start = i;
    i += 1;
    while (i < n) {
      if (source[i] === "\\" && i + 1 < n) {
        i += 2;
        continue;
      }
      if (source[i] === quote) {
        i += 1;
        break;
      }
      i += 1;
    }
    paint(start, i, kind);
  };

  const closeHeredoc = (identifier: string, kind: Kind, openEnd: number) => {
    paint(i, openEnd, kind);
    i = openEnd;
    const close = new RegExp(`^[^\\S\\n]*${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m");
    const rest = source.slice(i);
    const match = close.exec(rest);
    const end = match ? i + match.index + match[0].length : n;
    paint(i, end, kind);
    i = end;
  };

  while (i < n) {
    const c = source[i]!;
    const next = source[i + 1];

    if (c === "/" && next === "/") {
      const start = i;
      while (i < n && source[i] !== "\n") i += 1;
      paint(start, i, "comment");
      continue;
    }
    if (c === "#" && next !== "[") {
      const start = i;
      while (i < n && source[i] !== "\n") i += 1;
      paint(start, i, "comment");
      continue;
    }
    if (c === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      paint(start, i, "comment");
      continue;
    }
    if (c === "'" || c === '"') {
      closeQuoted(c, c === "'" ? "string" : "interp");
      continue;
    }
    if (c === "`") {
      kinds[i] = "code";
      i += 1;
      const start = i;
      while (i < n) {
        if (source[i] === "\\" && i + 1 < n) {
          i += 2;
          continue;
        }
        if (source[i] === "`") break;
        i += 1;
      }
      paint(start, i, "interp");
      if (i < n && source[i] === "`") {
        kinds[i] = "code";
        i += 1;
      }
      continue;
    }
    if (c === "<" && next === "<" && source[i + 2] === "<") {
      const marker = /<<<[ \t]*('?)(\"?[A-Za-z_][A-Za-z0-9_]*\"?)\1[ \t]*\r?\n/.exec(source.slice(i));
      if (marker && marker.index === 0) {
        const rawId = marker[2]!.replaceAll('"', "");
        const nowdoc = marker[1] === "'";
        closeHeredoc(rawId, nowdoc ? "string" : "interp", i + marker[0].length);
        continue;
      }
    }
    kinds[i] = "code";
    i += 1;
  }
  return kinds;
}

const TAINT_SPECS: { label: string; re: RegExp }[] = [
  { label: "request()->input()", re: /request\s*\(\s*\)\s*->\s*input\s*\(/iy },
  { label: "$request->input()", re: /\$request\s*->\s*input\s*\(/iy },
  { label: "$_GET", re: /\$_GET\s*\[/iy },
  { label: "$_POST", re: /\$_POST\s*\[/iy },
  { label: "$_REQUEST", re: /\$_REQUEST\s*\[/iy },
  { label: "$_COOKIE", re: /\$_COOKIE\s*\[/iy },
  { label: "request()", re: /request\s*\(/iy },
];

function canStartIdent(source: string, kinds: Kind[], index: number): boolean {
  if (index > 0 && kinds[index - 1] === "code" && (isIdent(source[index - 1]!) || source[index - 1] === "$")) {
    return false;
  }
  return true;
}

export function findTaintSpans(source: string, kinds: Kind[], from: number, to: number): Span[] {
  const spans: Span[] = [];
  let i = from;
  while (i < to) {
    const kind = kinds[i];
    if (kind !== "code" && kind !== "interp") {
      i += 1;
      continue;
    }
    if (kind === "code" && !canStartIdent(source, kinds, i)) {
      i += 1;
      continue;
    }
    let hit: Span | null = null;
    for (const spec of TAINT_SPECS) {
      if (kind === "interp" && spec.label.startsWith("$request")) {
        // Interpolation of $request->input() is unusual; still allow $_GET and $vars.
      }
      spec.re.lastIndex = i;
      const match = spec.re.exec(source);
      if (!match || match.index !== i || match.index >= to) continue;
      if (spec.label === "request()" || spec.label === "request()->input()") {
        if (!canStartIdent(source, kinds, i)) continue;
      }
      hit = { start: match.index, end: Math.min(to, match.index + match[0].length) };
      break;
    }
    if (hit) {
      spans.push(hit);
      i = hit.end;
      continue;
    }
    i += 1;
  }
  return spans;
}

function ancestorFunctions(source: string, kinds: Kind[], pos: number): string[] {
  const names: string[] = [];
  let depth = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    if (kinds[i] !== "code") continue;
    const c = source[i]!;
    if (c === ")") {
      depth += 1;
      continue;
    }
    if (c !== "(") continue;
    if (depth > 0) {
      depth -= 1;
      continue;
    }
    let j = skipWsAndComments(kinds, source, i - 1, -1);
    if (j < 0) continue;
    const end = j + 1;
    while (j >= 0 && kinds[j] === "code" && (isIdent(source[j]!) || source[j] === "\\")) j -= 1;
    const name = source
      .slice(j + 1, end)
      .replace(/^\\+/, "")
      .toLowerCase();
    if (name) names.push(name);
  }
  return names;
}

function isWrapped(source: string, kinds: Kind[], span: Span, fn: "escapeshellarg" | "escapeshellcmd"): boolean {
  return ancestorFunctions(source, kinds, span.start).includes(fn);
}

type Binding = { name: string; pos: number; status: "tainted" | "arg_escaped" | "cmd_escaped" | "clean" };

function findAssignments(source: string, kinds: Kind[]): Binding[] {
  const bindings: Binding[] = [];
  for (let i = 0; i < source.length; i += 1) {
    if (kinds[i] !== "code" || source[i] !== "$") continue;
    if (i + 1 >= source.length || !/[A-Za-z_]/.test(source[i + 1]!)) continue;
    let end = i + 2;
    while (end < source.length && kinds[end] === "code" && isIdent(source[end]!)) end += 1;
    const name = source.slice(i + 1, end);
    const j = skipWsAndComments(kinds, source, end, 1);
    if (j >= source.length || source[j] !== "=") continue;
    if (source[j + 1] === "=" || source[j + 1] === ">") continue;
    const rhsStart = j + 1;
    let depth = 0;
    let k = rhsStart;
    let rhsEnd = source.length;
    while (k < source.length) {
      if (kinds[k] !== "code") {
        k += 1;
        continue;
      }
      const c = source[k]!;
      if (c === "(" || c === "[" || c === "{") depth += 1;
      else if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) {
          rhsEnd = k;
          break;
        }
        depth -= 1;
      } else if ((c === ";" || c === ",") && depth === 0) {
        rhsEnd = k;
        break;
      }
      k += 1;
    }
    const taint = findTaintSpans(source, kinds, rhsStart, rhsEnd);
    let status: Binding["status"] = "clean";
    if (taint.length > 0) {
      if (taint.every((span) => isWrapped(source, kinds, span, "escapeshellarg"))) status = "arg_escaped";
      else if (taint.every((span) => isWrapped(source, kinds, span, "escapeshellcmd"))) status = "cmd_escaped";
      else status = "tainted";
    }
    bindings.push({ name, pos: i, status });
    i = end - 1;
  }
  return bindings;
}

function bindingAt(bindings: Binding[], name: string, pos: number): Binding["status"] {
  let found: Binding["status"] = "clean";
  for (const binding of bindings) {
    if (binding.name === name && binding.pos < pos) found = binding.status;
  }
  return found;
}

type Use = Span & { status: "tainted" | "arg_escaped" | "cmd_escaped" };

function findVarUses(
  source: string,
  kinds: Kind[],
  from: number,
  to: number,
  bindings: Binding[],
): Use[] {
  const uses: Use[] = [];
  for (let i = from; i < to; i += 1) {
    const kind = kinds[i];
    if ((kind !== "code" && kind !== "interp") || source[i] !== "$") continue;
    if (i + 1 >= to || !/[A-Za-z_]/.test(source[i + 1]!)) continue;
    if (i > 0 && kinds[i - 1] === "code" && source[i - 1] === "\\") continue;
    let end = i + 2;
    while (end < to && (kinds[end] === "code" || kinds[end] === "interp") && isIdent(source[end]!)) end += 1;
    const name = source.slice(i + 1, end);
    const status = bindingAt(bindings, name, i);
    if (status === "clean") continue;
    // Skip the `$request` in `$request->input(...)` — that is a taint source, not a one-hop use.
    const after = skipWsAndComments(kinds, source, end, 1);
    if (name === "request" && after + 1 < source.length && source.slice(after, after + 2) === "->") continue;
    uses.push({ start: i, end, status });
    i = end - 1;
  }
  return uses;
}

function firstCodeIndex(kinds: Kind[], source: string, from: number, to: number): number {
  let i = from;
  while (i < to) {
    if (kinds[i] === "code" && !/\s/.test(source[i]!)) return i;
    if (kinds[i] === "comment") {
      i += 1;
      continue;
    }
    if (kinds[i] === "code" && /\s/.test(source[i]!)) {
      i += 1;
      continue;
    }
    return i;
  }
  return from;
}

function extractCallArgs(
  source: string,
  kinds: Kind[],
  openParen: number,
): { args: Span[]; close: number } | null {
  if (source[openParen] !== "(") return null;
  const args: Span[] = [];
  let depth = 0;
  let i = openParen;
  let argStart = openParen + 1;
  while (i < source.length) {
    if (kinds[i] !== "code") {
      i += 1;
      continue;
    }
    const c = source[i]!;
    if (c === "(") {
      depth += 1;
      if (depth === 1) argStart = i + 1;
    } else if (c === ")") {
      depth -= 1;
      if (depth === 0) {
        args.push({ start: argStart, end: i });
        return { args, close: i };
      }
    } else if (c === "," && depth === 1) {
      args.push({ start: argStart, end: i });
      argStart = i + 1;
    }
    i += 1;
  }
  return null;
}

function looksLikeArrayArg(source: string, kinds: Kind[], span: Span): boolean {
  const i = firstCodeIndex(kinds, source, span.start, span.end);
  return source[i] === "[";
}

function isBareFunctionName(source: string, kinds: Kind[], nameStart: number): boolean {
  let i = nameStart - 1;
  while (i >= 0 && kinds[i] === "code" && source[i] === "\\") i -= 1;
  i = skipWsAndComments(kinds, source, i, -1);
  if (i < 0) return true;
  if (i >= 1 && source[i - 1] === "-" && source[i] === ">") return false;
  if (i >= 1 && source[i] === ":" && source[i - 1] === ":") return false;
  if (source[i] === "$" || isIdent(source[i]!)) {
    // Reject method calls and also `function exec(` declarations.
    let start = i;
    while (start >= 0 && kinds[start] === "code" && isIdent(source[start]!)) start -= 1;
    const prev = source.slice(start + 1, i + 1).toLowerCase();
    if (prev === "function" || prev === "fn") return false;
    return false;
  }
  return true;
}

function classifySink(
  source: string,
  kinds: Kind[],
  span: Span,
  bindings: Binding[],
): "high" | "medium" | null {
  const direct = findTaintSpans(source, kinds, span.start, span.end);
  const uses = findVarUses(source, kinds, span.start, span.end, bindings);
  const sites: { start: number; end: number; via: "tainted" | "arg_escaped" | "cmd_escaped" }[] = [
    ...direct.map((item) => ({ ...item, via: "tainted" as const })),
    ...uses.map((item) => ({ start: item.start, end: item.end, via: item.status })),
  ];
  if (sites.length === 0) return null;

  const remaining: typeof sites = [];
  for (const site of sites) {
    if (site.via === "arg_escaped") continue;
    if (isWrapped(source, kinds, site, "escapeshellarg")) continue;
    remaining.push(site);
  }
  if (remaining.length === 0) return null;

  const allCmd = remaining.every(
    (site) => site.via === "cmd_escaped" || isWrapped(source, kinds, site, "escapeshellcmd"),
  );
  return allCmd ? "medium" : "high";
}

function finding(
  source: string,
  ruleId: string,
  severity: FindingSeverity,
  pos: number,
  title: string,
  why: string,
): CodeScanFinding {
  return {
    ruleId,
    severity,
    line: lineAt(source, pos),
    snippet: snippetAt(source, pos),
    title,
    why,
    fix: FIX,
    safeExample: SAFE_EXAMPLE,
    lessonUrl: COMMAND_INJECTION_LESSON_URL,
    lessonLabel: LESSON_LABEL,
  };
}

function scanCommandInjection(source: string, kinds: Kind[]): CodeScanFinding[] {
  const findings: CodeScanFinding[] = [];
  const bindings = findAssignments(source, kinds);
  const lower = source.toLowerCase();

  for (const fn of SHELL_FUNCS) {
    let from = 0;
    while (from < source.length) {
      const idx = lower.indexOf(fn, from);
      if (idx === -1) break;
      from = idx + fn.length;
      if (kinds[idx] !== "code") continue;
      if (!canStartIdent(source, kinds, idx)) continue;
      const nameEnd = idx + fn.length;
      if (nameEnd < source.length && kinds[nameEnd] === "code" && isIdent(source[nameEnd]!)) continue;
      if (!isBareFunctionName(source, kinds, idx)) continue;
      const paren = skipWsAndComments(kinds, source, nameEnd, 1);
      if (paren >= source.length || source[paren] !== "(" || kinds[paren] !== "code") continue;
      const call = extractCallArgs(source, kinds, paren);
      if (!call || call.args.length === 0) continue;
      const first = call.args[0]!;
      if (fn === "proc_open" && looksLikeArrayArg(source, kinds, first)) continue;
      const severity = classifySink(source, kinds, first, bindings);
      if (!severity) continue;
      const label = `${fn}()`;
      findings.push(
        finding(
          source,
          "command-injection",
          severity,
          idx,
          severity === "medium" ? `${label} uses request input with only escapeshellcmd()` : `${label} uses request input`,
          severity === "medium" ? WHY_CMDS : WHY_HIGH,
        ),
      );
    }
  }

  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== "`" || kinds[i] !== "code") continue;
    let close = -1;
    for (let j = i + 1; j < source.length; j += 1) {
      if (source[j] === "`" && kinds[j] === "code") {
        close = j;
        break;
      }
    }
    if (close === -1) break;
    const body: Span = { start: i + 1, end: close };
    const severity = classifySink(source, kinds, body, bindings);
    if (severity) {
      findings.push(
        finding(
          source,
          "command-injection",
          severity,
          i,
          severity === "medium"
            ? "Backtick operator uses request input with only escapeshellcmd()"
            : "Backtick operator uses request input",
          severity === "medium" ? WHY_CMDS : WHY_HIGH,
        ),
      );
    }
    i = close;
  }

  findings.sort((a, b) => a.line - b.line || a.title.localeCompare(b.title));
  return findings;
}

export const COMMAND_INJECTION_RULE: CodeScanRule = {
  id: "command-injection",
  title: "Command injection",
  scan: scanCommandInjection,
};

export const DEFAULT_CODE_SCAN_RULES: CodeScanRule[] = [COMMAND_INJECTION_RULE];

export function scanPhpCode(source: string, rules: CodeScanRule[] = DEFAULT_CODE_SCAN_RULES): CodeScanReport {
  const kinds = classifyPhp(source);
  const findings = rules.flatMap((rule) => rule.scan(source, kinds));
  findings.sort((a, b) => a.line - b.line || a.ruleId.localeCompare(b.ruleId) || a.title.localeCompare(b.title));
  return { findings, scannedBytes: source.length };
}
