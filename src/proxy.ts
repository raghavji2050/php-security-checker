import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

/** Short links such as /8.3.12 redirect to the existing report. Other paths are unchanged. */
export function proxy(request: NextRequest) {
  let segment = request.nextUrl.pathname.slice(1);
  try {
    segment = decodeURIComponent(segment);
  } catch {
    return NextResponse.next();
  }
  const match = VERSION.exec(segment);
  if (!match) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/check/${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: "/:version(\\d{1,4}\\.\\d{1,4}\\.\\d{1,4})",
};
