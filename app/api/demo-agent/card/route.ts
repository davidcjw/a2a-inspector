import { buildDemoCard } from "@/lib/demo-agent";
import { getOrigin } from "@/lib/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Served at /.well-known/agent-card.json via a rewrite (see next.config.ts).
export async function GET(request: Request) {
  const card = buildDemoCard(getOrigin(request));
  return Response.json(card, {
    headers: { "Cache-Control": "no-store" },
  });
}
