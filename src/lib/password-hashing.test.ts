import { describe, expect, it } from "vitest";
import { analyzePasswordHashing } from "./password-hashing";

describe("analyzePasswordHashing", () => {
  it("flags md5 and sha1 password hashing", () => {
    const r = analyzePasswordHashing(`$hash = md5($password);\n$h2 = sha1($_POST['pass']);`);
    expect(r.verdict).toBe("weak");
    expect(r.findings.map((f) => f.id)).toEqual(["md5", "sha1"]);
  });
  it("flags hash('sha256') and manual comparison", () => {
    const r = analyzePasswordHashing(`if ($row['password'] === hash('sha256', $pwd)) {}`);
    expect(r.findings.map((f) => f.id)).toContain("hash-fast");
    expect(r.findings.map((f) => f.id)).toContain("compare");
  });
  it("flags crypt()", () => {
    expect(analyzePasswordHashing(`$x = crypt($input, $salt);`).findings[0].id).toBe("crypt");
  });
  it("passes password_hash / password_verify", () => {
    const r = analyzePasswordHashing(`$h = password_hash($password, PASSWORD_DEFAULT);\nif (password_verify($password, $h)) {}`);
    expect(r.verdict).toBe("good");
    expect(r.weak).toBe(0);
  });
  it("ignores md5 unrelated to passwords and comments", () => {
    const r = analyzePasswordHashing(`$etag = md5($fileContents);\n// md5($password)`);
    expect(r.weak).toBe(0);
    expect(r.verdict).toBe("unknown");
  });
});
