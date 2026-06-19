"use client";

import { useState } from "react";
import type { AgentCard } from "@/lib/a2a-types";
import type { FieldResult, ValidationResult } from "@/lib/validate-card";
import { IconCheck, IconCross, IconWarn } from "./icons";
import { JsonBlock } from "./JsonBlock";

function ScoreRing({ score, valid }: { score: number; valid: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = valid
    ? "var(--color-accent)"
    : score >= 40
      ? "var(--color-amber)"
      : "var(--color-danger)";
  return (
    <div className="relative grid h-[78px] w-[78px] shrink-0 place-items-center">
      <svg width="78" height="78" className="-rotate-90">
        <circle cx="39" cy="39" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle
          cx="39"
          cy="39"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-mono text-xl font-semibold leading-none" style={{ color }}>
          {score}
        </div>
        <div className="font-mono text-[9px] uppercase text-[--color-muted]">score</div>
      </div>
    </div>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]"
      style={{
        borderColor: on ? "var(--color-accent)" : "var(--color-border)",
        color: on ? "var(--color-accent)" : "var(--color-faint)",
        background: on ? "var(--color-accent-dim)" : "transparent",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: on ? "var(--color-accent)" : "var(--color-faint)" }}
      />
      {label}
    </span>
  );
}

const sevIcon = (s: FieldResult["status"]) =>
  s === "ok" ? (
    <IconCheck className="text-[--color-accent]" width={14} height={14} />
  ) : s === "warning" ? (
    <IconWarn className="text-[--color-amber]" width={14} height={14} />
  ) : (
    <IconCross className="text-[--color-danger]" width={14} height={14} />
  );

export function CardReport({
  card,
  validation,
}: {
  card: AgentCard;
  validation: ValidationResult;
}) {
  const [showOk, setShowOk] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const { summary, valid } = validation;
  const visible = validation.results.filter(
    (r) => showOk || r.status !== "ok",
  );

  return (
    <div className="space-y-5">
      {/* score header */}
      <div className="flex items-center gap-4 rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
        <ScoreRing score={validation.score} valid={valid} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 font-mono text-[11px] font-medium"
              style={{
                color: valid ? "var(--color-accent)" : "var(--color-danger)",
                background: valid ? "var(--color-accent-dim)" : "var(--color-danger-dim)",
              }}
            >
              {valid ? "VALID CARD" : "INVALID CARD"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px]">
            <span className="text-[--color-accent]">{summary.passed} passed</span>
            <span className="text-[--color-amber]">{summary.warnings} warnings</span>
            <span className="text-[--color-danger]">{summary.errors} errors</span>
          </div>
        </div>
      </div>

      {/* identity */}
      <section className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
        <h3 className="text-base font-semibold">{card.name || "(unnamed agent)"}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[--color-muted]">
          {card.description}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[12px]">
          <Meta k="version" v={card.version} />
          <Meta k="protocol" v={card.protocolVersion} />
          <Meta k="transport" v={card.preferredTransport ?? "JSONRPC (default)"} />
          <Meta k="provider" v={card.provider?.organization ?? "—"} />
        </dl>
        <div className="mt-3 break-all rounded-md border border-[--color-border] bg-[--color-bg]/60 px-2.5 py-1.5 font-mono text-[12px] text-[--color-sky]">
          {card.url}
        </div>
      </section>

      {/* capabilities + modalities */}
      <section className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
        <Label>capabilities</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Pill on={!!card.capabilities?.streaming} label="streaming (SSE)" />
          <Pill on={!!card.capabilities?.pushNotifications} label="push notifications" />
          <Pill
            on={!!card.capabilities?.stateTransitionHistory}
            label="state history"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <Label>input modes</Label>
            <ModeList modes={card.defaultInputModes} />
          </div>
          <div>
            <Label>output modes</Label>
            <ModeList modes={card.defaultOutputModes} />
          </div>
        </div>
      </section>

      {/* skills */}
      <section className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
        <Label>skills · {card.skills?.length ?? 0}</Label>
        <ul className="mt-2 space-y-2">
          {(card.skills ?? []).map((s, i) => (
            <li
              key={s.id ?? i}
              className="rounded-lg border border-[--color-border] bg-[--color-bg]/40 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-[11px] text-[--color-faint]">{s.id}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-[--color-muted]">{s.description}</p>
              {!!s.tags?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded border border-[--color-border] px-1.5 py-0.5 font-mono text-[10.5px] text-[--color-muted]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* validation checklist */}
      <section className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
        <div className="flex items-center justify-between">
          <Label>validation · spec v0.2.5</Label>
          <button
            onClick={() => setShowOk((v) => !v)}
            className="cursor-pointer font-mono text-[11px] text-[--color-muted] hover:text-[--color-fg]"
          >
            {showOk ? "hide passing" : "show passing"}
          </button>
        </div>
        <ul className="mt-2 divide-y divide-[--color-border]">
          {visible.map((r, i) => (
            <li key={`${r.field}-${i}`} className="flex items-start gap-2.5 py-1.5">
              <span className="mt-0.5 shrink-0">{sevIcon(r.status)}</span>
              <div className="min-w-0">
                <span className="font-mono text-[12px] text-[--color-fg]">{r.field}</span>
                {r.required && (
                  <span className="ml-1.5 font-mono text-[10px] text-[--color-faint]">
                    required
                  </span>
                )}
                <p className="text-[12.5px] text-[--color-muted]">{r.message}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <button
        onClick={() => setShowRaw((v) => !v)}
        className="cursor-pointer font-mono text-[12px] text-[--color-muted] hover:text-[--color-fg]"
      >
        {showRaw ? "▾ hide raw card JSON" : "▸ show raw card JSON"}
      </button>
      {showRaw && <JsonBlock value={card} label="agent-card.json" maxHeight="28rem" />}
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[11px] uppercase tracking-wider text-[--color-muted]">
    {children}
  </span>
);

const Meta = ({ k, v }: { k: string; v?: string }) => (
  <div className="flex flex-col">
    <dt className="text-[10.5px] uppercase text-[--color-faint]">{k}</dt>
    <dd className="truncate text-[--color-fg]">{v || "—"}</dd>
  </div>
);

const ModeList = ({ modes }: { modes?: string[] }) => (
  <div className="mt-1 flex flex-wrap gap-1">
    {(modes ?? []).length === 0 ? (
      <span className="font-mono text-[12px] text-[--color-faint]">—</span>
    ) : (
      modes!.map((m) => (
        <span
          key={m}
          className="rounded border border-[--color-border] bg-[--color-bg]/50 px-1.5 py-0.5 font-mono text-[11px] text-[--color-sky]"
        >
          {m}
        </span>
      ))
    )}
  </div>
);
