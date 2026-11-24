import { NextResponse, type NextRequest } from "next/server";

const USERNAME = "admin";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Optional HTTP Basic Auth for the dashboard; enabled only when DASHBOARD_PASSWORD is set. */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const encoded = header.match(/^Basic\s+(.+)$/i)?.[1];
  if (encoded) {
    try {
      const decoded = atob(encoded);
      const separator = decoded.indexOf(":");
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      if (separator > 0 && user === USERNAME && constantTimeEqual(pass, password)) {
        return NextResponse.next();
      }
    } catch {
      // Malformed base64 falls through to 401.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Income Tracker", charset="UTF-8"' },
  });
}

export const config = {
  // API routes use their own bearer-token auth.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
