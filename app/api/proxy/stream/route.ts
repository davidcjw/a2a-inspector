import { assertFetchable } from "@/lib/resolve-card-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProxyBody {
  target: string;
  rpc: unknown;
  headers?: Record<string, string>;
}

// Relays an SSE (message/stream) response from the target agent to the browser.
export async function POST(request: Request) {
  let body: ProxyBody;
  try {
    body = (await request.json()) as ProxyBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.target)
    return Response.json({ ok: false, error: "Missing `target`" }, { status: 400 });

  try {
    assertFetchable(body.target);
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(body.target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(body.headers ?? {}),
      },
      body: JSON.stringify(body.rpc),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return Response.json(
      { ok: false, status: upstream.status, error: text || "Upstream error" },
      { status: 502 },
    );
  }

  // Pass the upstream stream straight through.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
