import { assertFetchable, candidateCardUrls } from "@/lib/resolve-card-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Attempt {
  url: string;
  status: number | null;
  note?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url)
    return Response.json({ ok: false, error: "Missing ?url" }, { status: 400 });

  let candidates: string[];
  try {
    candidates = candidateCardUrls(url);
    candidates.forEach(assertFetchable);
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 400 },
    );
  }

  const attempts: Attempt[] = [];

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });
      const text = await res.text();
      if (!res.ok) {
        attempts.push({ url: candidate, status: res.status });
        continue;
      }
      let card: unknown;
      try {
        card = JSON.parse(text);
      } catch {
        attempts.push({
          url: candidate,
          status: res.status,
          note: "Response was not valid JSON.",
        });
        continue;
      }
      return Response.json({
        ok: true,
        fetchedUrl: candidate,
        status: res.status,
        card,
        rawText: text,
        attempts,
      });
    } catch (e) {
      attempts.push({
        url: candidate,
        status: null,
        note: (e as Error).message,
      });
    }
  }

  return Response.json(
    {
      ok: false,
      error: "Could not retrieve an Agent Card from any known location.",
      attempts,
    },
    { status: 502 },
  );
}
