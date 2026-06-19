"use client";

import type { TaskState } from "@/lib/a2a-types";
import { TERMINAL_STATES } from "@/lib/a2a-types";

const PHASES = ["submitted", "working", "done"] as const;

function activeIndex(state: TaskState | null): number {
  if (!state) return -1;
  if (state === "submitted") return 0;
  if (TERMINAL_STATES.includes(state)) return 2;
  return 1; // working / input-required / auth-required
}

function terminalColor(state: TaskState | null): string {
  if (state === "completed") return "var(--color-accent)";
  if (state === "failed" || state === "rejected") return "var(--color-danger)";
  if (state === "canceled") return "var(--color-amber)";
  return "var(--color-border-strong)";
}

export function TaskTimeline({
  state,
  running,
}: {
  state: TaskState | null;
  running: boolean;
}) {
  const active = activeIndex(state);
  const isTerminal = !!state && TERMINAL_STATES.includes(state);

  const label = (i: number) => {
    if (i === 2) return isTerminal ? state! : "completed";
    if (i === 1)
      return state === "input-required" || state === "auth-required"
        ? state
        : "working";
    return PHASES[i];
  };

  return (
    <div className="flex items-center">
      {PHASES.map((p, i) => {
        const done = i < active;
        const isActive = i === active;
        const reached = i <= active;
        const isTerminalNode = i === 2 && isTerminal;
        const color = isTerminalNode
          ? terminalColor(state)
          : reached
            ? "var(--color-accent)"
            : "var(--color-border-strong)";

        return (
          <div key={p} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`grid h-3.5 w-3.5 place-items-center rounded-full ${
                  isActive && running && !isTerminal ? "pulse-dot" : ""
                }`}
                style={{
                  background: reached || isTerminalNode ? color : "transparent",
                  border: `2px solid ${reached || isTerminalNode ? color : "var(--color-border-strong)"}`,
                }}
              />
              <span
                className="font-mono text-[10.5px] uppercase tracking-wide"
                style={{
                  color: reached ? "var(--color-fg)" : "var(--color-faint)",
                }}
              >
                {label(i)}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className="mx-1 mb-4 h-[2px] flex-1 overflow-hidden rounded bg-[--color-border-strong]">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: done ? "100%" : isActive ? "50%" : "0%",
                    background: "var(--color-accent)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
