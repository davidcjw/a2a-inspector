// Logic for the bundled demonstration A2A agent.
// Kept framework-free so the route handlers stay thin.
import {
  A2A_SPEC_VERSION,
  type AgentCard,
  type Artifact,
  type Message,
  type Part,
  type Task,
} from "./a2a-types";

export const DEMO_SKILLS = [
  {
    id: "echo",
    name: "Echo",
    description: "Repeats your message back verbatim.",
    tags: ["text", "demo"],
    examples: ["Say hello back to me", "Echo: testing 1 2 3"],
  },
  {
    id: "shout",
    name: "Shout",
    description: "Returns your message in UPPERCASE.",
    tags: ["text", "transform"],
    examples: ["make this loud", "shout the announcement"],
  },
  {
    id: "reverse",
    name: "Reverse",
    description: "Reverses the characters of your message.",
    tags: ["text", "transform"],
    examples: ["reverse: stressed"],
  },
] as const;

export function buildDemoCard(origin: string): AgentCard {
  return {
    protocolVersion: A2A_SPEC_VERSION,
    name: "Echo Agent (Demo)",
    description:
      "A bundled demonstration agent shipped with A2A Inspector. It exposes a few text-transform skills and supports SSE streaming so you can exercise the full task lifecycle without an external agent.",
    url: `${origin}/api/demo-agent`,
    version: "1.0.0",
    provider: { organization: "A2A Inspector", url: origin },
    iconUrl: `${origin}/icon.svg`,
    documentationUrl: `${origin}`,
    preferredTransport: "JSONRPC",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: DEMO_SKILLS.map((s) => ({
      ...s,
      tags: [...s.tags],
      examples: [...s.examples],
    })),
  };
}

function transform(skillId: string, text: string): string {
  switch (skillId) {
    case "shout":
      return text.toUpperCase();
    case "reverse":
      return [...text].reverse().join("");
    case "echo":
    default:
      return text;
  }
}

export function extractText(message: Message | undefined): string {
  if (!message?.parts) return "";
  return message.parts
    .filter((p): p is Extract<Part, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/** Pick the skill to run from explicit metadata, else infer from the text. */
export function resolveSkill(message: Message | undefined): string {
  const metaSkill = message?.metadata?.skillId;
  if (typeof metaSkill === "string" && DEMO_SKILLS.some((s) => s.id === metaSkill))
    return metaSkill;
  const text = extractText(message).toLowerCase();
  if (text.startsWith("shout") || text.includes("loud")) return "shout";
  if (text.startsWith("reverse")) return "reverse";
  return "echo";
}

export function makeArtifact(skillId: string, input: string): Artifact {
  const cleaned = input.replace(/^(echo|shout|reverse)\s*:?\s*/i, "");
  return {
    artifactId: crypto.randomUUID(),
    name: `${skillId}-result`,
    description: `Output of the "${skillId}" skill.`,
    parts: [{ kind: "text", text: transform(skillId, cleaned || input) }],
  };
}

export function buildCompletedTask(
  taskId: string,
  contextId: string,
  userMessage: Message,
): Task {
  const skillId = resolveSkill(userMessage);
  const input = extractText(userMessage);
  return {
    kind: "task",
    id: taskId,
    contextId,
    status: { state: "completed", timestamp: new Date().toISOString() },
    history: [userMessage],
    artifacts: [makeArtifact(skillId, input)],
  };
}
