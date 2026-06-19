// Small server-only helpers shared by route handlers.

/** Resolve the public origin of the deployment from request headers. */
export function getOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export const jsonRpcError = (
  id: string | number | null,
  code: number,
  message: string,
) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });

export const jsonRpcResult = (id: string | number | null, result: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  result,
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
