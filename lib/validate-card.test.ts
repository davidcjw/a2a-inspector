import { describe, expect, it } from "vitest";
import { validateAgentCard } from "./validate-card";
import { buildDemoCard } from "./demo-agent";

describe("validateAgentCard", () => {
  it("accepts the bundled demo card with zero errors", () => {
    const r = validateAgentCard(buildDemoCard("https://example.com"));
    expect(r.valid).toBe(true);
    expect(r.summary.errors).toBe(0);
    expect(r.score).toBeGreaterThan(90);
  });

  it("rejects a non-object", () => {
    const r = validateAgentCard("not a card");
    expect(r.valid).toBe(false);
    expect(r.score).toBe(0);
  });

  it("flags every missing required field", () => {
    const r = validateAgentCard({});
    const missing = r.results.filter((x) => x.status === "error").map((x) => x.field);
    for (const f of [
      "protocolVersion",
      "name",
      "description",
      "version",
      "url",
      "capabilities",
      "defaultInputModes",
      "defaultOutputModes",
      "skills",
    ]) {
      expect(missing).toContain(f);
    }
    expect(r.valid).toBe(false);
  });

  it("requires at least one skill", () => {
    const card = { ...buildDemoCard("https://example.com"), skills: [] };
    const r = validateAgentCard(card);
    expect(r.valid).toBe(false);
    expect(r.results.some((x) => x.field === "skills" && x.status === "error")).toBe(true);
  });

  it("rejects an invalid url", () => {
    const card = { ...buildDemoCard("https://example.com"), url: "not-a-url" };
    const r = validateAgentCard(card);
    expect(r.results.find((x) => x.field === "url")?.status).toBe("error");
  });

  it("flags wrong types on capabilities", () => {
    const card = {
      ...buildDemoCard("https://example.com"),
      capabilities: { streaming: "yes" },
    };
    const r = validateAgentCard(card);
    expect(
      r.results.find((x) => x.field === "capabilities.streaming")?.status,
    ).toBe("error");
  });

  it("warns (not errors) on a missing provider", () => {
    const card = buildDemoCard("https://example.com");
    delete (card as { provider?: unknown }).provider;
    const r = validateAgentCard(card);
    expect(r.valid).toBe(true);
    expect(r.results.find((x) => x.field === "provider")?.status).toBe("warning");
  });

  it("caps the score at 60 when any required field errors", () => {
    const card = { ...buildDemoCard("https://example.com"), url: "bad" };
    const r = validateAgentCard(card);
    expect(r.score).toBeLessThanOrEqual(60);
  });
});
