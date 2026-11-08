"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { analyzeDockerfile, type DockerFinding, type ParsedPhpImage } from "@/lib/docker-php";

type TagResponse = {
  parsed: ParsedPhpImage;
  note: string;
  library: { source: string; retrievedAt: string; stale: boolean; branch: string | null; currentPatch: string | null };
  checkPath: string | null;
  exampleDockerfile: string;
  limitation: string;
  error?: string;
};

export function DockerChecker() {
  const [tag, setTag] = useState("php:8.3-fpm");
  const [dockerText, setDockerText] = useState("");
  const [tagState, setTagState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [tagMessage, setTagMessage] = useState<string | null>(null);
  const [tagResult, setTagResult] = useState<TagResponse | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileFindings, setFileFindings] = useState<DockerFinding[] | null>(null);
  const [fileImages, setFileImages] = useState<ParsedPhpImage[] | null>(null);

  async function checkTag() {
    setTagState("loading");
    setTagMessage(null);
    try {
      const response = await fetch(`/api/docker-tag?tag=${encodeURIComponent(tag.trim())}`);
      const body = (await response.json()) as TagResponse;
      if (!response.ok) {
        setTagResult(null);
        setTagState("error");
        setTagMessage(body.error ?? "The tag could not be checked.");
        return;
      }
      setTagResult(body);
      setTagState("done");
    } catch {
      setTagState("error");
      setTagMessage("Could not reach the checker.");
    }
  }

  function checkFile() {
    const analyzed = analyzeDockerfile(dockerText);
    if (!analyzed.ok) {
      setFileFindings(null);
      setFileImages(null);
      setFileError(analyzed.error);
      return;
    }
    setFileError(null);
    setFileFindings(analyzed.findings);
    setFileImages(analyzed.images);
  }

  return (
    <div className="mt-8 space-y-8">
      <Card>
        <CardHeader><CardTitle>Image tag</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void checkTag(); }}>
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium">Official PHP image tag</span>
              <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="php:8.3.26-fpm-bookworm" />
            </label>
            <Button type="submit" className="sm:self-end" disabled={tagState === "loading"}>{tagState === "loading" ? "Checking…" : "Resolve tag"}</Button>
          </form>
          <p className="text-sm text-muted-foreground">The patch map comes from docker-library/php versions.json. The image is not pulled and its packages are not scanned.</p>
          {tagState === "loading" && <p role="status" className="text-sm text-muted-foreground">Reading the official library file…</p>}
          {tagMessage && <p role="alert" className="text-sm text-danger">{tagMessage}</p>}
          {tagResult && (
            <div className="space-y-2 text-sm">
              <p>{tagResult.note}</p>
              <p className="text-muted-foreground">{tagResult.limitation}</p>
              {tagResult.checkPath && (
                <p>
                  Version check: <Link className="font-mono text-primary underline" href={tagResult.checkPath}>{tagResult.checkPath}</Link>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                <a className="underline" href={tagResult.library.source}>versions.json</a>
                {tagResult.library.stale ? " · stale cache" : ""} · {tagResult.library.retrievedAt}
                {tagResult.library.currentPatch ? ` · library patch ${tagResult.library.currentPatch}` : ""}
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{tagResult.exampleDockerfile}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dockerfile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={dockerText}
            onChange={(event) => setDockerText(event.target.value)}
            placeholder={"FROM php:8.3-fpm\nCOPY . /var/www\nUSER www-data"}
            className="min-h-40 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
          />
          <Button type="button" onClick={checkFile}>Analyze Dockerfile</Button>
          <p className="text-sm text-muted-foreground">The file stays in your browser. Instructions are read as text. Nothing is built or executed.</p>
          {fileError && <p role="alert" className="text-sm text-danger">{fileError}</p>}
          {fileFindings && fileFindings.length === 0 && <p className="text-sm">No notes for this Dockerfile.</p>}
          {fileImages && fileImages.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Images: {fileImages.map((image) => image.input).join(", ")}
            </p>
          )}
          {fileFindings && fileFindings.length > 0 && (
            <ul className="space-y-2">
              {fileFindings.map((finding) => (
                <li key={finding.id} className="rounded-md border border-border p-3 text-sm">
                  <Badge variant={finding.level === "review" ? "warning" : "secondary"}>{finding.level}</Badge>
                  {finding.line ? <span className="ml-2 text-muted-foreground">line {finding.line}</span> : null}
                  <p className="mt-2 font-medium">{finding.title}</p>
                  <p className="text-muted-foreground">{finding.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
