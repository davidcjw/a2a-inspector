"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { AgentCard } from "@/lib/a2a-types";
import { A2A_SPEC_VERSION } from "@/lib/a2a-types";
import { fetchCard, type CardFetchResult } from "@/lib/client";
import { validateAgentCard, type ValidationResult } from "@/lib/validate-card";
import { CardReport } from "@/components/CardReport";
import { TaskRunner } from "@/components/TaskRunner";
import {
  IconArrow,
  IconBook,
  IconGithub,
  IconMoon,
  IconSpinner,
  IconStar,
  IconSun,
  Logo,
} from "@/components/icons";

type Theme = "dark" | "light";

// The live theme lives on <html data-theme> (set pre-paint by the inline script
// in layout.tsx). Read it via useSyncExternalStore so there's no setState-in-
// effect and no hydration mismatch — the server snapshot defaults to "dark".
const subscribeTheme = (cb: () => void) => {
  window.addEventListener("themechange", cb);
  return () => window.removeEventListener("themechange", cb);
};
const getTheme = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CardFetchResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark");

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode / disabled storage — non-fatal */
    }
    window.dispatchEvent(new Event("themechange"));
  };

  const card = (result?.ok ? (result.card as AgentCard) : null) ?? null;
  const hasEndpoint =
    !!card && typeof card.url === "string" && /^https?:/.test(card.url);

  const inspect = useCallback(async (target: string) => {
    const value = target.trim();
    if (!value) return;
    setLoading(true);
    setResult(null);
    setValidation(null);
    const res = await fetchCard(value);
    setResult(res);
    if (res.ok) setValidation(validateAgentCard(res.card));
    setLoading(false);
  }, []);

  const loadDemo = () => {
    const origin = window.location.origin;
    setUrl(origin);
    inspect(origin);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-[--color-border] bg-[--color-bg]/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="text-[--color-accent]">
              <Logo />
            </span>
            <span className="font-semibold tracking-tight">A2A Inspector</span>
            <span className="rounded border border-[--color-border] px-1.5 py-0.5 font-mono text-[10.5px] text-[--color-muted]">
              spec v{A2A_SPEC_VERSION}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://a2a-protocol.org/v0.2.5/specification/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[--color-muted] transition-colors hover:text-[--color-fg]"
            >
              <IconBook width={14} height={14} /> spec
            </a>
            <a
              href="https://github.com/davidcjw/a2a-inspector"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 font-mono text-[12px] text-[--color-muted] transition-colors hover:text-[--color-fg]"
            >
              <IconGithub width={14} height={14} /> Star
              <IconStar
                width={13}
                height={13}
                className="text-amber-500 transition-transform group-hover:scale-110"
              />
            </a>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              aria-label="Toggle color theme"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-[--color-border] text-[--color-muted] transition-colors hover:border-[--color-border-strong] hover:text-[--color-fg]"
            >
              {theme === "dark" ? (
                <IconSun width={15} height={15} />
              ) : (
                <IconMoon width={15} height={15} />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* intro (only before first inspect) */}
        {!result && !loading && (
          <div className="mx-auto max-w-2xl pt-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Inspect any{" "}
              <span className="text-[--color-accent]">Agent2Agent</span> agent.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[--color-muted]">
              Paste an agent URL to validate its Agent Card against the A2A spec,
              then fire live tasks and watch the lifecycle stream — a Postman for
              AI agents.
            </p>
          </div>
        )}

        {/* url bar */}
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && inspect(url)}
              placeholder="https://your-agent.example.com"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-[--color-border] bg-[--color-surface] px-3.5 py-2.5 font-mono text-[13px] text-[--color-fg] outline-none placeholder:text-[--color-faint] focus:border-[--color-border-strong]"
            />
            <button
              onClick={() => inspect(url)}
              disabled={loading || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-mono text-[13px] font-medium text-[--color-bg] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--color-accent)" }}
            >
              {loading ? (
                <IconSpinner width={14} height={14} />
              ) : (
                <IconArrow width={15} height={15} />
              )}
              inspect
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-[--color-muted]">
            <span className="font-mono text-[--color-faint]">try:</span>
            <button
              onClick={loadDemo}
              className="cursor-pointer rounded-md border border-[--color-border] bg-[--color-surface] px-2 py-0.5 font-mono text-[12px] text-[--color-accent] transition-colors hover:border-[--color-accent]"
            >
              ▶ bundled demo agent
            </button>
            <span className="font-mono text-[11px] text-[--color-faint]">
              resolves /.well-known/agent-card.json
            </span>
          </div>
        </div>

        {/* error */}
        {result && !result.ok && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-[--color-danger] bg-[--color-danger-dim] p-4">
            <p className="font-mono text-[13px] text-[--color-danger]">
              {result.error ?? "Failed to fetch Agent Card."}
            </p>
            {!!result.attempts?.length && (
              <ul className="mt-2 space-y-1 font-mono text-[11.5px] text-[--color-muted]">
                {result.attempts.map((a, i) => (
                  <li key={i} className="break-all">
                    <span className="text-[--color-faint]">tried</span> {a.url} —{" "}
                    {a.status ? `HTTP ${a.status}` : (a.note ?? "no response")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* results */}
        {card && validation && (
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <SectionTitle index="01" title="Agent Card" />
              <CardReport card={card} validation={validation} />
            </div>
            <div>
              <SectionTitle index="02" title="Task Runner" />
              {hasEndpoint ? (
                <TaskRunner card={card} />
              ) : (
                <div className="rounded-xl border border-dashed border-[--color-border] p-6 font-mono text-[13px] text-[--color-faint]">
                  No valid `url` endpoint on this card — cannot send tasks.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[--color-border] py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 font-mono text-[11.5px] text-[--color-faint] sm:flex-row sm:items-center sm:justify-between">
          <span>A2A Inspector · validates Agent2Agent spec v{A2A_SPEC_VERSION}</span>
          <span>requests proxied server-side · no card data stored</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="font-mono text-[11px] text-[--color-accent]">{index}</span>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[--color-muted]">
        {title}
      </h2>
    </div>
  );
}
