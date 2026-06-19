import { assertFetchable } from "@/lib/resolve-card-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProxyBody {
  target: string;
  rpc: unknown;
  headers?: Record<string, string>;
}

// Forwards a single JSON-RPC call to the target agent (server-side, dodging CORS).
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

  const started = Date.now();
  try {
    const res = await fetch(body.target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(body.headers ?? {}),
      },
      body: JSON.stringify(body.rpc),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* leave json null; expose rawText */
    }
    return Response.json({
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      response: json,
      rawText: json === null ? text : undefined,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message, durationMs: Date.now() - started },
      { status: 502 },
    );
  }
}
