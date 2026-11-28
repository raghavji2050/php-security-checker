import { describe, expect, it } from "vitest";
import {
  COMMAND_INJECTION_LESSON_URL,
  scanPhpCode,
  type CodeScanFinding,
} from "./code-scan";

function findings(code: string): CodeScanFinding[] {
  return scanPhpCode(code).findings;
}

describe("command-injection rule", () => {
  it.each([
    ["exec", "exec($_GET['cmd']);"],
    ["shell_exec", "shell_exec($_GET['cmd']);"],
    ["system", "system($_GET['cmd']);"],
    ["passthru", "passthru($_GET['cmd']);"],
    ["popen", "popen($_GET['cmd'], 'r');"],
    ["proc_open", "proc_open($_GET['cmd'], $descriptors, $pipes);"],
  ] as const)("flags %s() with $_GET", (fn, code) => {
    const result = findings(code);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe(`${fn}() uses request input`);
    expect(result[0]?.severity).toBe("high");
    expect(result[0]?.line).toBe(1);
    expect(result[0]?.snippet).toContain(fn);
    expect(result[0]?.lessonUrl).toBe(COMMAND_INJECTION_LESSON_URL);
    expect(result[0]?.why).toMatch(/heuristic pattern check/i);
    expect(result[0]?.safeExample).toContain("new Process(['git', 'show', $commit])");
    expect(result[0]?.fix).toMatch(/escapeshellarg/i);
  });

  it("flags backtick operator with $_GET", () => {
    const result = findings("echo `ls {$_GET['dir']}`;");
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Backtick operator uses request input");
    expect(result[0]?.severity).toBe("high");
    expect(result[0]?.lessonUrl).toBe(COMMAND_INJECTION_LESSON_URL);
  });

  it.each([
    ["$_GET", "exec($_GET['cmd']);"],
    ["$_POST", "exec($_POST['cmd']);"],
    ["$_REQUEST", "exec($_REQUEST['cmd']);"],
    ["$_COOKIE", "exec($_COOKIE['cmd']);"],
    ["$request->input()", "exec($request->input('cmd'));"],
    ["request()", "exec(request('cmd'));"],
    ["request()->input()", "exec(request()->input('cmd'));"],
  ])("flags exec() with %s", (_label, code) => {
    expect(findings(code)).toHaveLength(1);
    expect(findings(code)[0]?.severity).toBe("high");
  });

  it("flags a one-hop tainted variable", () => {
    const result = findings(`$cmd = $_GET['cmd'];\nexec($cmd);`);
    expect(result).toHaveLength(1);
    expect(result[0]?.line).toBe(2);
    expect(result[0]?.snippet).toContain("exec($cmd)");
  });

  it("flags backticks with a one-hop tainted variable", () => {
    const result = findings(`$cmd = request()->input('command');\necho \`$cmd\`;`);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toMatch(/Backtick operator/);
    expect(result[0]?.line).toBe(2);
  });

  it("flags interpolation of a one-hop variable in a double-quoted argument", () => {
    const result = findings(`$dir = $_POST['dir'];\nsystem("ls $dir");`);
    expect(result).toHaveLength(1);
    expect(result[0]?.line).toBe(2);
  });

  it("does not flag input wrapped in escapeshellarg()", () => {
    expect(findings("exec(escapeshellarg($_GET['cmd']));")).toHaveLength(0);
    expect(findings(`$file = $_GET['file'];\nexec('cat ' . escapeshellarg($file));`)).toHaveLength(0);
    expect(findings(`$safe = escapeshellarg($_GET['file']);\nexec('cat ' . $safe);`)).toHaveLength(0);
  });

  it("flags escapeshellcmd() alone at medium severity", () => {
    const result = findings("exec(escapeshellcmd($_GET['cmd']));");
    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("medium");
    expect(result[0]?.title).toMatch(/escapeshellcmd/);
    expect(result[0]?.why).toMatch(/escapeshellcmd/i);
  });

  it("does not flag constant strings", () => {
    expect(findings(`exec('ls -la');\nsystem("id");\necho \`uptime\`;`)).toHaveLength(0);
  });

  it("ignores matches in comments", () => {
    expect(
      findings(`// exec($_GET['cmd'])\n# system($_POST['x'])\n/* passthru($_REQUEST['x']) */\nexec('ls');`),
    ).toHaveLength(0);
  });

  it("ignores matches in single-quoted strings", () => {
    expect(findings(`$help = 'do not run exec($_GET[\\'cmd\\'])';`)).toHaveLength(0);
  });

  it("does not flag Symfony/Laravel Process with array args", () => {
    const code = `use Symfony\\Component\\Process\\Process;
$process = new Process(['git', 'show', $_GET['commit']]);
$process->run();
\\Illuminate\\Support\\Facades\\Process::run(['ls', request('dir')]);`;
    expect(findings(code)).toHaveLength(0);
  });

  it("does not flag proc_open() with an argument array", () => {
    expect(findings("proc_open(['git', 'show', $_GET['c']], $descriptors, $pipes);")).toHaveLength(0);
  });

  it("does not flag method calls such as PDO::exec()", () => {
    expect(findings(`$pdo->exec($_GET['sql']);\nDB::system($_POST['x']);`)).toHaveLength(0);
  });

  it("is case-insensitive for PHP function names", () => {
    const result = findings("Shell_Exec($_GET['cmd']);");
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("shell_exec() uses request input");
  });

  it("does not flag a two-hop variable (heuristic, not a full analyser)", () => {
    expect(findings(`$a = $_GET['cmd'];\n$b = $a;\nexec($b);`)).toHaveLength(0);
  });
});
