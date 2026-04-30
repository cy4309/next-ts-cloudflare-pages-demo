import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return NextResponse.json({
    ok: true,
    message: "pong from api route",
    timestamp: new Date().toISOString(),
    path: url.pathname,
    userAgent: request.headers.get("user-agent") ?? "unknown",
  });
}
