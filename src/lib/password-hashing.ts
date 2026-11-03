export const PASSWORD_LESSON_URL =
  "https://php-hub-rj.vercel.app/lessons/2026-11-03-password-hashing-in-php-password-hash-verify-rehash";

export type Severity = "high" | "medium" | "ok";

export interface HashFinding {
  id: string;
  severity: Severity;
  line: number;
  snippet: string;
  title: string;
  advice: string;
}

export interface HashReport {
  findings: HashFinding[];
  weak: number;
  usesPasswordHash: boolean;
  usesPasswordVerify: boolean;
  verdict: "weak" | "good" | "unknown";
}

interface Rule {
  id: string;
  severity: Severity;
  re: RegExp;
  title: string;
  advice: string;
  /** only flag when the line looks password-related */
  needsPasswordContext?: boolean;
}

const PW = /pass(word|wd)?|pwd|secret|credential/i;

const RULES: Rule[] = [
  { id: "md5", severity: "high", re: /\bmd5\s*\(/i, needsPasswordContext: true,
    title: "md5() used for a password", advice: "MD5 is a fast hash and is not suitable for passwords. Use password_hash($password, PASSWORD_DEFAULT)." },
  { id: "sha1", severity: "high", re: /\bsha1\s*\(/i, needsPasswordContext: true,
    title: "sha1() used for a password", advice: "SHA-1 is a fast hash and is not suitable for passwords. Use password_hash()." },
  { id: "hash-fast", severity: "high", re: /\bhash\s*\(\s*['"](md5|sha1|sha224|sha256|sha384|sha512|crc32b?)['"]/i, needsPasswordContext: true,
    title: "hash() with a fast algorithm on a password", advice: "General-purpose hashes (even SHA-256/512) are too fast for passwords. Use password_hash()." },
  { id: "crypt", severity: "medium", re: /\bcrypt\s*\(/i,
    title: "crypt() used directly", advice: "crypt() needs manual salt and algorithm handling. password_hash()/password_verify() wrap it safely." },
  { id: "compare", severity: "medium", re: /(==|===|strcmp\s*\()[^;]*\b(md5|sha1|hash|crypt)\s*\(/i, needsPasswordContext: true,
    title: "Manual hash comparison", advice: "Compare with password_verify($input, $hash), which is timing-safe, instead of == or strcmp." },
];

export function analyzePasswordHashing(code: string): HashReport {
  const lines = code.split(/\r?\n/);
  const findings: HashFinding[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || /^(\/\/|#|\*|\/\*)/.test(line)) return;
    const ctx = PW.test(line);
    for (const rule of RULES) {
      if (rule.re.test(line) && (!rule.needsPasswordContext || ctx)) {
        if (rule.id === "crypt" && /password_hash|password_verify/.test(line)) continue;
        findings.push({ id: rule.id, severity: rule.severity, line: i + 1, snippet: line.slice(0, 160), title: rule.title, advice: rule.advice });
      }
    }
  });
  const usesPasswordHash = /\bpassword_hash\s*\(/.test(code);
  const usesPasswordVerify = /\bpassword_verify\s*\(/.test(code);
  const weak = findings.length;
  const verdict = weak > 0 ? "weak" : usesPasswordHash || usesPasswordVerify ? "good" : "unknown";
  return { findings, weak, usesPasswordHash, usesPasswordVerify, verdict };
}
