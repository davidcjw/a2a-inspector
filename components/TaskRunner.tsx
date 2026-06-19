"use client";

import { useRef, useState } from "react";
import type {
  AgentCard,
  Part,
  StreamEvent,
  Task,
  TaskState,
} from "@/lib/a2a-types";
import { buildUserMessage, sendMessage, streamMessage } from "@/lib/client";
import { IconBolt, IconPlay, IconSpinner, IconStop } from "./icons";
import { JsonBlock } from "./JsonBlock";
import { TaskTimeline } from "./TaskTimeline";

type Mode = "stream" | "send";
type Sev = "info" | "working" | "ok" | "error" | "artifact";

interface Logged {
  id: string;
  ts: string;
  kind: string;
  title: string;
  detail?: string;
  raw: unknown;
  sev: Sev;
}

const textOf = (parts?: Part[]) =>
  (parts ?? [])
    .filter((p): p is Extract<Part, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join("");

const sevColor: Record<Sev, string> = {
  info: "var(--color-sky)",
  working: "var(--color-amber)",
  ok: "var(--color-accent)",
  error: "var(--color-danger)",
  artifact: "var(--color-sky)",
};

export function TaskRunner({ card }: { card: AgentCard }) {
  const skills = card.skills ?? [];
  const canStream = !!card.capabilities?.streaming;

  const [skillId, setSkillId] = useState<string>(skills[0]?.id ?? "");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>(canStream ? "stream" : "send");
  const [running, setRunning] = useState(false);
  const [taskState, setTaskState] = useState<TaskState | null>(null);
  const [events, setEvents] = useState<Logged[]>([]);
  const [artifactText, setArtifactText] = useState("");
  const [tab, setTab] = useState<"result" | "raw">("result");
  const [request, setRequest] = useState<unknown>(null);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const rawEvents = useRef<unknown[]>([]);

  const log = (e: Omit<Logged, "id" | "ts">) =>
    setEvents((prev) => [
      ...prev,
      { ...e, id: crypto.randomUUID(), ts: new Date().toLocaleTimeString() },
    ]);

  const reset = () => {
    setEvents([]);
    setArtifactText("");
    setTaskState(null);
    setResponse(null);
    setError(null);
    rawEvents.current = [];
  };

  const onEvent = (event: StreamEvent) => {
    rawEvents.current.push(event);
    setResponse([...rawEvents.current]);
    switch (event.kind) {
      case "task":
        setTaskState(event.status.state);
        log({ kind: "task", title: "Task created", detail: event.id, raw: event, sev: "info" });
        break;
      case "status-update": {
        setTaskState(event.status.state);
        const msg = textOf(event.status.message?.parts);
        const terminal = event.final;
        log({
          kind: "status-update",
          title: `status → ${event.status.state}`,
          detail: msg,
          raw: event,
          sev: terminal
            ? event.status.state === "completed"
              ? "ok"
              : "error"
            : "working",
        });
        break;
      }
      case "artifact-update": {
        const chunk = textOf(event.artifact.parts);
        setArtifactText((prev) => (event.append ? prev + chunk : chunk));
        log({
          kind: "artifact-update",
          title: `artifact${event.lastChunk ? " (final)" : " chunk"}`,
          detail: event.artifact.name,
          raw: event,
          sev: "artifact",
        });
        break;
      }
      case "message":
        log({ kind: "message", title: "message", detail: textOf(event.parts), raw: event, sev: "info" });
        break;
    }
  };

  const run = async () => {
    if (!text.trim() || running) return;
    reset();
    setRunning(true);
    setTab("result");
    const message = buildUserMessage(text.trim(), skillId || undefined);

    if (mode === "send") {
      const { rpc, result } = await sendMessage(card.url, message);
      setRequest(rpc);
      setResponse(result.response ?? result.rawText ?? result);
      if (!result.ok || result.response?.error) {
        setError(result.error ?? result.response?.error?.message ?? "Request failed");
        setTaskState("failed");
      } else {
        const task = result.response?.result as Task | undefined;
        if (task?.kind === "task") {
          setTaskState(task.status.state);
          const art = task.artifacts?.[0];
          if (art) setArtifactText(textOf(art.parts));
          log({ kind: "message/send", title: `status → ${task.status.state}`, raw: task, sev: "ok" });
        }
      }
      setRunning(false);
      return;
    }

    // streaming
    const controller = new AbortController();
    abortRef.current = controller;
    const handle = streamMessage(
      card.url,
      message,
      onEvent,
      (m) => {
        setError(m);
        setTaskState((s) => s ?? "failed");
      },
      controller.signal,
    );
    setRequest(handle.rpc);
    await handle.done;
    setRunning(false);
    abortRef.current = null;
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setTaskState("canceled");
    log({ kind: "client", title: "stream aborted by client", raw: {}, sev: "error" });
  };

  return (
    <div className="space-y-4">
      {/* composer */}
      <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
        {skills.length > 0 && (
          <>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[--color-muted]">
              skill
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skills.map((s) => {
                const on = s.id === skillId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSkillId(s.id)}
                    title={s.description}
                    className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[12px] transition-colors"
                    style={{
                      borderColor: on ? "var(--color-accent)" : "var(--color-border)",
                      color: on ? "var(--color-accent)" : "var(--color-muted)",
                      background: on ? "var(--color-accent-dim)" : "transparent",
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
          }}
          rows={3}
          placeholder="Message to send to the agent…  (⌘/Ctrl + Enter to run)"
          className="mt-3 w-full resize-y rounded-lg border border-[--color-border] bg-[--color-bg]/60 p-3 font-mono text-[13px] text-[--color-fg] outline-none placeholder:text-[--color-faint] focus:border-[--color-border-strong]"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          {/* mode toggle */}
          <div className="flex rounded-lg border border-[--color-border] p-0.5">
            {(["stream", "send"] as Mode[]).map((m) => {
              const on = mode === m;
              const disabled = m === "stream" && !canStream;
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => setMode(m)}
                  title={disabled ? "Agent does not advertise streaming" : ""}
                  className="cursor-pointer rounded-md px-3 py-1 font-mono text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: on ? "var(--color-surface-2)" : "transparent",
                    color: on ? "var(--color-fg)" : "var(--color-muted)",
                  }}
                >
                  {m === "stream" ? "message/stream" : "message/send"}
                </button>
              );
            })}
          </div>

          {running ? (
            <button
              onClick={stop}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[--color-danger] px-4 py-2 font-mono text-[13px] text-[--color-danger] transition-colors hover:bg-[--color-danger-dim]"
            >
              <IconStop width={14} height={14} /> stop
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!text.trim()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-[13px] font-medium text-[--color-bg] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--color-accent)" }}
            >
              <IconPlay width={13} height={13} /> run task
            </button>
          )}
        </div>
      </div>

      {/* tabs */}
      {(events.length > 0 || taskState || error) && (
        <div className="rounded-xl border border-[--color-border] bg-[--color-surface]">
          <div className="flex border-b border-[--color-border]">
            {(["result", "raw"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="cursor-pointer px-4 py-2.5 font-mono text-[12px] uppercase tracking-wide transition-colors"
                style={{
                  color: tab === t ? "var(--color-fg)" : "var(--color-muted)",
                  borderBottom:
                    tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
                }}
              >
                {t === "result" ? "result" : "raw json-rpc"}
              </button>
            ))}
            {running && (
              <span className="ml-auto flex items-center gap-2 px-4 font-mono text-[11px] text-[--color-amber]">
                <IconSpinner width={12} height={12} /> live
              </span>
            )}
          </div>

          <div className="p-4">
            {tab === "result" ? (
              <div className="space-y-4">
                <TaskTimeline state={taskState} running={running} />

                {error && (
                  <div className="rounded-lg border border-[--color-danger] bg-[--color-danger-dim] px-3 py-2 font-mono text-[12.5px] text-[--color-danger]">
                    {error}
                  </div>
                )}

                {artifactText && (
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[--color-muted]">
                      artifact output
                    </span>
                    <div className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-[--color-sky] bg-[--color-sky-dim]/40 p-3 font-mono text-[13px] text-[--color-fg]">
                      {artifactText}
                    </div>
                  </div>
                )}

                {events.length > 0 && (
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[--color-muted]">
                      event stream · {events.length}
                    </span>
                    <ul className="mt-1.5 space-y-1">
                      {events.map((e) => (
                        <li
                          key={e.id}
                          className="row-in flex items-start gap-2.5 rounded-md border border-[--color-border] bg-[--color-bg]/40 px-2.5 py-1.5"
                        >
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: sevColor[e.sev] }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-mono text-[12px] text-[--color-fg]">
                                {e.title}
                              </span>
                              <span className="font-mono text-[10px] text-[--color-faint]">
                                {e.ts}
                              </span>
                            </div>
                            {e.detail && (
                              <p className="truncate font-mono text-[11.5px] text-[--color-muted]">
                                {e.detail}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <JsonBlock value={request} label="→ request" maxHeight="16rem" />
                <JsonBlock value={response} label="← response / events" maxHeight="22rem" />
              </div>
            )}
          </div>
        </div>
      )}

      {!events.length && !taskState && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-[--color-border] px-4 py-6 font-mono text-[12.5px] text-[--color-faint]">
          <IconBolt width={14} height={14} />
          Compose a message and run a task to watch the lifecycle stream in.
        </div>
      )}
    </div>
  );
}
