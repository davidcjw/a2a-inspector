// Browser-side helpers that talk to our server proxy (never the agent directly).
import type { JsonRpcResponse, Message, Part, StreamEvent } from "./a2a-types";

export interface CardFetchResult {
  ok: boolean;
  fetchedUrl?: string;
  status?: number;
  card?: unknown;
  rawText?: string;
  error?: string;
  attempts?: { url: string; status: number | null; note?: string }[];
}

export interface RpcResult {
  ok: boolean;
  status?: number;
  durationMs?: number;
  response?: JsonRpcResponse;
  rawText?: string;
  error?: string;
}

let rpcCounter = 1;
export const nextRpcId = () => `req-${rpcCounter++}`;

export function buildUserMessage(text: string, skillId?: string): Message {
  const parts: Part[] = [{ kind: "text", text }];
  return {
    kind: "message",
    role: "user",
    messageId: crypto.randomUUID(),
    parts,
    ...(skillId ? { metadata: { skillId } } : {}),
  };
}

export async function fetchCard(url: string): Promise<CardFetchResult> {
  const res = await fetch(`/api/proxy/card?url=${encodeURIComponent(url)}`);
  return (await res.json()) as CardFetchResult;
}

export async function sendMessage(
  target: string,
  message: Message,
): Promise<{ rpc: unknown; result: RpcResult }> {
  const rpc = {
    jsonrpc: "2.0" as const,
    id: nextRpcId(),
    method: "message/send",
    params: { message },
  };
  const res = await fetch("/api/proxy/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, rpc }),
  });
  return { rpc, result: (await res.json()) as RpcResult };
}

export interface StreamHandle {
  rpc: unknown;
  done: Promise<void>;
}

/** POST message/stream through the proxy and yield each parsed A2A event. */
export function streamMessage(
  target: string,
  message: Message,
  onEvent: (event: StreamEvent) => void,
  onError: (message: string) => void,
  signal?: AbortSignal,
): StreamHandle {
  const rpc = {
    jsonrpc: "2.0" as const,
    id: nextRpcId(),
    method: "message/stream",
    params: { message },
  };

  const done = (async () => {
    const res = await fetch("/api/proxy/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, rpc }),
      signal,
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      onError((err as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        if (!dataLines.length) continue;
        const payload = dataLines.join("");
        try {
          const parsed = JSON.parse(payload) as JsonRpcResponse<StreamEvent>;
          if (parsed.error) onError(parsed.error.message);
          else if (parsed.result) onEvent(parsed.result);
        } catch {
          /* ignore keep-alive / non-JSON frames */
        }
      }
    }
  })().catch((e) => {
    if ((e as Error).name !== "AbortError") onError((e as Error).message);
  });

  return { rpc, done };
}
