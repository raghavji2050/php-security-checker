import type { Metadata } from "next";
import { PasswordHashChecker } from "@/components/password-hash-checker";
import { PASSWORD_LESSON_URL } from "@/lib/password-hashing";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Password Hashing Check",
  description: "Paste PHP code to flag md5(), sha1(), hash() and crypt() password hashing and switch to password_hash() / password_verify().",
  alternates: { canonical: new URL("/password-hashing", SITE_URL).toString() },
};

export default function PasswordHashingPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Code check</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Password Hashing Check</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Flags fast or hand-rolled password hashing (md5, sha1, hash(&apos;sha256&apos;), crypt, == comparisons) and
        confirms when password_hash() and password_verify() are used. It is a pattern check, not a full audit.{" "}
        <a className="text-primary underline" href={PASSWORD_LESSON_URL}>Read the PHP Hub lesson</a>.
      </p>
      <PasswordHashChecker />
    </main>
  );
}
