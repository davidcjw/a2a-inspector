import {
  buildCompletedTask,
  extractText,
  makeArtifact,
  resolveSkill,
} from "@/lib/demo-agent";
import { jsonRpcError, jsonRpcResult, sleep } from "@/lib/server-utils";
import type {
  Artifact,
  JsonRpcRequest,
  Message,
  Task,
  TaskState,
} from "@/lib/a2a-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ephemeral task store (best-effort; resets when the serverless instance recycles).
const tasks = new Map<string, Task>();

interface SendParams {
  message: Message;
}

export async function POST(request: Request) {
  let req: JsonRpcRequest;
  try {
    req = (await request.json()) as JsonRpcRequest;
  } catch {
    return Response.json(jsonRpcError(null, -32700, "Parse error"));
  }

  const id = req?.id ?? null;
  const method = req?.method;

  switch (method) {
    case "message/send": {
      const { message } = (req.params ?? {}) as SendParams;
      if (!message)
        return Response.json(jsonRpcError(id, -32602, "Missing `message`"));
      const taskId = crypto.randomUUID();
      const contextId = message.contextId ?? crypto.randomUUID();
      const task = buildCompletedTask(taskId, contextId, message);
      tasks.set(taskId, task);
      return Response.json(jsonRpcResult(id, task));
    }

    case "message/stream": {
      const { message } = (req.params ?? {}) as SendParams;
      if (!message)
        return Response.json(jsonRpcError(id, -32602, "Missing `message`"));
      return streamTask(id, message);
    }

    case "tasks/get": {
      const { id: taskId } = (req.params ?? {}) as { id?: string };
      const task = taskId && tasks.get(taskId);
      if (!task)
        return Response.json(jsonRpcError(id, -32001, "Task not found"));
      return Response.json(jsonRpcResult(id, task));
    }

    case "tasks/cancel": {
      const { id: taskId } = (req.params ?? {}) as { id?: string };
      const task = taskId && tasks.get(taskId);
      if (!task)
        return Response.json(jsonRpcError(id, -32001, "Task not found"));
      const canceled: Task = {
        ...task,
        status: { state: "canceled", timestamp: new Date().toISOString() },
      };
      tasks.set(task.id, canceled);
      return Response.json(jsonRpcResult(id, canceled));
    }

    default:
      return Response.json(
        jsonRpcError(id, -32601, `Method not found: ${method}`),
      );
  }
}

function streamTask(id: string | number | null, message: Message): Response {
  const encoder = new TextEncoder();
  const taskId = crypto.randomUUID();
  const contextId = message.contextId ?? crypto.randomUUID();
  const skillId = resolveSkill(message);
  const artifact = makeArtifact(skillId, extractText(message));

  const send = (
    controller: ReadableStreamDefaultController,
    event: unknown,
  ) => {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(jsonRpcResult(id, event))}\n\n`),
    );
  };

  const status = (state: TaskState, text?: string, final = false) => ({
    kind: "status-update" as const,
    taskId,
    contextId,
    final,
    status: {
      state,
      timestamp: new Date().toISOString(),
      ...(text
        ? {
            message: {
              kind: "message" as const,
              role: "agent" as const,
              messageId: crypto.randomUUID(),
              taskId,
              contextId,
              parts: [{ kind: "text" as const, text }],
            },
          }
        : {}),
    },
  });

  const stream = new ReadableStream({
    async start(controller) {
      // 1. initial Task
      const initial: Task = {
        kind: "task",
        id: taskId,
        contextId,
        status: { state: "submitted", timestamp: new Date().toISOString() },
        history: [message],
      };
      send(controller, initial);
      await sleep(300);

      // 2-3. working status updates
      send(controller, status("working", "Parsing your request…"));
      await sleep(450);
      send(controller, status("working", `Applying the "${skillId}" skill…`));
      await sleep(450);

      // 4. stream the artifact in chunks (demonstrates artifact-update append)
      const full = (artifact.parts[0] as { text: string }).text;
      const chunks = splitChunks(full, 3);
      for (let i = 0; i < chunks.length; i++) {
        const partial: Artifact = {
          ...artifact,
          parts: [{ kind: "text", text: chunks[i] }],
        };
        send(controller, {
          kind: "artifact-update",
          taskId,
          contextId,
          artifact: partial,
          append: i > 0,
          lastChunk: i === chunks.length - 1,
        });
        await sleep(250);
      }

      // 5. final completed status
      const final = status("completed", undefined, true);
      send(controller, final);

      tasks.set(taskId, {
        kind: "task",
        id: taskId,
        contextId,
        status: { state: "completed", timestamp: new Date().toISOString() },
        history: [message],
        artifacts: [artifact],
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function splitChunks(text: string, n: number): string[] {
  if (text.length <= n) return [text];
  const size = Math.ceil(text.length / n);
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
