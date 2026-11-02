"use client";

// Last-resort fallback when the root layout itself fails. It renders its own <html>,
// so it uses plain inline styles that match the site's palette.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f0e6", color: "#1c1915" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 16px" }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Something went wrong</h1>
          <p role="alert" style={{ color: "#5e584e" }}>
            PHP Security Checker could not load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "10px 16px", borderRadius: 6, border: "1px solid #5e584e", background: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
