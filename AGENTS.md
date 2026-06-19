<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A2A Inspector — agent guide

A "Postman for the Agent2Agent (A2A) protocol". Validates Agent Cards (spec **v0.2.5**) and
runs live tasks against any A2A agent. See `README.md` for the user-facing overview.

## Architecture

- **Protocol model** lives in `lib/a2a-types.ts` — the single source of truth for Agent Card,
  Task, Message/Part, stream events, and JSON-RPC envelopes. Keep it aligned with the spec
  constants (`A2A_SPEC_VERSION`, `WELL_KNOWN_PATH`).
- **Validator** (`lib/validate-card.ts`) is **pure and dependency-free** so it runs in the
  browser, on the server, and in tests. It returns a structured `ValidationResult` (per-field
  severity + score) designed for direct rendering — do not swap it for a generic schema lib
  without preserving that UI-friendly shape. Covered by `lib/validate-card.test.ts`.
- **Proxy** (`app/api/proxy/{card,rpc,stream}/route.ts`) is mandatory: the browser never calls a
  third-party agent directly (CORS + SSE relay). All three are `runtime = "nodejs"` +
  `dynamic = "force-dynamic"`. `lib/resolve-card-url.ts` holds the well-known resolution and the
  SSRF guard (`assertFetchable`).
- **Demo agent** (`app/api/demo-agent/*`, logic in `lib/demo-agent.ts`) is a real A2A server.
  Its card is served at `/.well-known/agent-card.json` via a **rewrite** in `next.config.ts`
  (App Router ignores dotfile route folders, so don't try `app/.well-known/...`). The card's
  `url` is derived from request headers (`lib/server-utils.ts#getOrigin`) so it works on any
  deployment without env vars.
- **Streaming** uses the Web `ReadableStream` API in route handlers (Vercel-native). SSE frames
  are JSON-RPC responses whose `result` is a `Task | TaskStatusUpdateEvent |
  TaskArtifactUpdateEvent`. The browser parses them in `lib/client.ts#streamMessage` (fetch +
  reader, not `EventSource`, since `EventSource` is GET-only).

## Conventions

- Theme tokens are CSS variables in `app/globals.css` (`--color-*`), consumed via Tailwind v4
  arbitrary values like `text-[--color-accent]`. OLED "operations console" aesthetic: status
  colors are green = ok/valid, amber = working/warning, red = failed/invalid, sky = info/artifact.
- Icons are hand-rolled SVGs in `components/icons.tsx` — no icon dependency, no emoji.

## Before you commit

Run all four — they all currently pass:

```bash
npm test && npm run lint && npx tsc --noEmit && npm run build
```

When changing anything in this file's project, also update `README.md` in the same pass.
