import type { Metadata } from "next";
import { DockerChecker } from "@/components/docker-checker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docker PHP image and Dockerfile check",
  description:
    "Resolve a PHP image tag with docker-library/php versions.json, and review a Dockerfile for floating tags, root and copied secrets. Images are not pulled.",
  alternates: { canonical: new URL("/docker", SITE_URL).toString() },
};

export default function DockerPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Containers</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Docker / PHP image check</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Map an official <span className="font-mono text-sm">php</span> tag to the patch in docker-library/php, then
        read a Dockerfile as text. This is not a malware or package scan of the image.
      </p>
      <DockerChecker />
    </main>
  );
}
