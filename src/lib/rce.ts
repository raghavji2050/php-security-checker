import type { RceClassification } from "@/lib/types";

const CWE_CATEGORIES: Record<string, { category: string; detail: string }> = {
  "CWE-77": {
    category: "Command injection",
    detail: "CWE-77 (Command Injection) is listed on the record",
  },
  "CWE-78": {
    category: "Command injection",
    detail: "CWE-78 (OS Command Injection) is listed on the record",
  },
  "CWE-88": {
    category: "CGI argument injection",
    detail: "CWE-88 (Argument Injection) is listed on the record",
  },
  "CWE-94": {
    category: "Code execution",
    detail: "CWE-94 (Code Injection) is listed on the record",
  },
};

const DESCRIPTION_SIGNALS: { category: string; pattern: RegExp; detail: string }[] = [
  {
    category: "Remote code execution",
    pattern: /remote code execution|\bRCE\b/i,
    detail: "Description says remote code execution",
  },
  {
    category: "Command injection",
    pattern: /command injection|os command injection/i,
    detail: "Description says command injection",
  },
  {
    category: "Shell execution",
    pattern: /shell exec|shell_exec|arbitrary shell|execute(?: an? | arbitrary )?shell command/i,
    detail: "Description says shell execution",
  },
  {
    category: "CGI argument injection",
    pattern: /cgi argument injection|argument injection/i,
    detail: "Description says CGI or argument injection",
  },
  {
    category: "Code execution",
    pattern: /arbitrary code|code injection|execute arbitrary php|run arbitrary php/i,
    detail: "Description says arbitrary code execution",
  },
  {
    category: "Unsafe runtime behavior",
    pattern: /unsafe runtime|runtime behavior that can lead to code execution/i,
    detail: "Description says unsafe runtime behavior",
  },
];

export function classifyRce(weaknesses: string[], description: string): RceClassification | null {
  const categories: string[] = [];
  const basis: RceClassification["basis"] = [];

  for (const weakness of weaknesses) {
    const known = CWE_CATEGORIES[weakness.toUpperCase()];
    if (!known) continue;
    if (!categories.includes(known.category)) categories.push(known.category);
    basis.push({ kind: "cwe", detail: known.detail });
  }

  for (const signal of DESCRIPTION_SIGNALS) {
    if (!signal.pattern.test(description)) continue;
    if (!categories.includes(signal.category)) categories.push(signal.category);
    basis.push({ kind: "description", detail: signal.detail });
  }

  if (basis.length === 0) return null;
  return { categories, basis };
}
