import { describe, expect, it } from "vitest";
import type { Message } from "./a2a-types";
import {
  buildCompletedTask,
  extractText,
  makeArtifact,
  resolveSkill,
} from "./demo-agent";

const msg = (text: string, skillId?: string): Message => ({
  kind: "message",
  role: "user",
  messageId: "m1",
  parts: [{ kind: "text", text }],
  ...(skillId ? { metadata: { skillId } } : {}),
});

describe("demo agent", () => {
  it("extracts text from message parts", () => {
    expect(extractText(msg("hello world"))).toBe("hello world");
    expect(extractText(undefined)).toBe("");
  });

  it("resolves skill from explicit metadata", () => {
    expect(resolveSkill(msg("anything", "reverse"))).toBe("reverse");
  });

  it("infers skill from text when no metadata", () => {
    expect(resolveSkill(msg("shout this"))).toBe("shout");
    expect(resolveSkill(msg("reverse: abc"))).toBe("reverse");
    expect(resolveSkill(msg("just echo"))).toBe("echo");
  });

  it("transforms text per skill (and strips the skill prefix)", () => {
    expect((makeArtifact("shout", "shout: hi").parts[0] as { text: string }).text).toBe("HI");
    expect((makeArtifact("reverse", "abc").parts[0] as { text: string }).text).toBe("cba");
    expect((makeArtifact("echo", "ping").parts[0] as { text: string }).text).toBe("ping");
  });

  it("builds a completed task with an artifact", () => {
    const task = buildCompletedTask("t1", "c1", msg("loud please", "shout"));
    expect(task.status.state).toBe("completed");
    expect(task.artifacts?.[0].parts.length).toBe(1);
  });
});
