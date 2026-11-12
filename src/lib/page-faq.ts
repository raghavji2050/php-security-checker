import { supportLabel } from "@/lib/lifecycle";
import type { CheckResult, PhpBranch } from "@/lib/types";
import { compareBranches } from "@/lib/version";

// Visible on /check/{version} and /php-versions and published there as FAQPage JSON-LD.

export type QA = { question: string; answer: string };

/** FAQPage JSON-LD from visible question/answer pairs (keep both identical). */
export function faqPageJsonLd(items: QA[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
  };
}

/** Questions for /check/{version}, answered only from the computed report. */
export function versionFaq(r: CheckResult): QA[] {
  const c = r.counts;
  const out: QA[] = [];
  if (r.securityStatus === "unable_to_verify") {
    out.push({ question: `Is PHP ${r.version} vulnerable?`, answer: `The official data needed to answer this for PHP ${r.version} could not be verified right now.` });
  } else {
    out.push({
      question: `Is PHP ${r.version} vulnerable?`,
      answer:
        c.confirmed > 0
          ? `Yes. ${c.confirmed} confirmed known PHP runtime vulnerabilities match PHP ${r.version} (${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low), based on NVD, php.net and GitHub advisory data.`
          : `No confirmed known PHP runtime vulnerability matches PHP ${r.version} in NVD, php.net and GitHub advisory data.${c.potential > 0 ? ` ${c.potential} possible matches still need verification.` : ""} This is a version-based check, not a full audit.`,
    });
  }
  out.push({
    question: `Is PHP ${r.support.branch} still supported?`,
    answer: `PHP ${r.support.branch} status on php.net: ${r.support.label}.${r.support.securitySupportEnd ? ` Security support ends ${r.support.securitySupportEnd}.` : ""}`,
  });
  if (r.recommendedVersion || r.minimumFixedVersion) {
    out.push({
      question: `Which PHP version should I upgrade to from ${r.version}?`,
      answer: [
        r.minimumFixedVersion ? `The minimum release on the ${r.support.branch} branch that fixes the confirmed issues is PHP ${r.minimumFixedVersion}.` : "",
        r.recommendedVersion ? `The recommended upgrade is PHP ${r.recommendedVersion}.` : "",
      ].filter(Boolean).join(" "),
    });
  }
  return out;
}

/** Questions for /php-versions, answered only from php.net branch data. */
export function branchesFaq(branches: PhpBranch[]): QA[] {
  const sorted = [...branches].sort((a, b) => compareBranches(b.branch, a.branch));
  const supported = sorted.filter((b) => b.state === "active" || b.state === "security");
  if (supported.length === 0) return [];
  const active = supported.filter((b) => b.state === "active");
  const newest = supported[0];
  const out: QA[] = [
    {
      question: "Which PHP versions are still supported?",
      answer: `${supported.map((b) => `PHP ${b.branch} (${supportLabel(b.state).toLowerCase()}${b.securitySupportEnd ? `, until ${b.securitySupportEnd}` : ""})`).join(", ")}, per php.net.`,
    },
    {
      question: "What is the latest PHP version?",
      answer: newest.latestPatch ? `The newest supported branch is PHP ${newest.branch}; its latest release is PHP ${newest.latestPatch}.` : `The newest supported branch is PHP ${newest.branch}.`,
    },
  ];
  const nextEol = [...supported].filter((b) => b.securitySupportEnd).sort((a, b) => (a.securitySupportEnd ?? "").localeCompare(b.securitySupportEnd ?? ""))[0];
  if (nextEol?.securitySupportEnd) {
    out.push({ question: "Which PHP version reaches end of life next?", answer: `PHP ${nextEol.branch} stops getting security fixes on ${nextEol.securitySupportEnd}.` });
  }
  if (active.length > 0) {
    out.push({ question: "Which PHP versions get bug fixes, not only security fixes?", answer: `${active.map((b) => `PHP ${b.branch}`).join(" and ")} ${active.length === 1 ? "is" : "are"} in active support.` });
  }
  return out;
}
