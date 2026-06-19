"use client";

import { useState } from "react";

export function JsonBlock({
  value,
  label,
  maxHeight = "20rem",
}: {
  value: unknown;
  label?: string;
  maxHeight?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg]/60">
      <div className="flex items-center justify-between border-b border-[--color-border] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[--color-muted]">
          {label ?? "json"}
        </span>
        <button
          onClick={copy}
          className="cursor-pointer font-mono text-[11px] text-[--color-muted] transition-colors hover:text-[--color-fg]"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre
        className="overflow-auto p-3 font-mono text-[12.5px] leading-relaxed text-[--color-fg]"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
}
