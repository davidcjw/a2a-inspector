// Validates an Agent Card against A2A spec v0.2.5.
// Pure + dependency-free so it runs in the browser, on the server, and in tests.

export type Severity = "ok" | "error" | "warning";

export interface FieldResult {
  field: string;
  status: Severity;
  required: boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean; // true when there are zero errors
  score: number; // 0-100, weighted toward required fields
  results: FieldResult[];
  summary: { passed: number; warnings: number; errors: number };
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

const isHttpUrl = (v: unknown): boolean => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export function validateAgentCard(input: unknown): ValidationResult {
  const r: FieldResult[] = [];
  const ok = (field: string, required: boolean, message = "Present") =>
    r.push({ field, status: "ok", required, message });
  const err = (field: string, required: boolean, message: string) =>
    r.push({ field, status: "error", required, message });
  const warn = (field: string, message: string) =>
    r.push({ field, status: "warning", required: false, message });

  if (!isObject(input)) {
    return {
      valid: false,
      score: 0,
      results: [
        {
          field: "(root)",
          status: "error",
          required: true,
          message: "Agent Card must be a JSON object.",
        },
      ],
      summary: { passed: 0, warnings: 0, errors: 1 },
    };
  }

  const c = input;

  // --- required scalar fields ---
  const reqStr = (key: string) => {
    if (!(key in c)) err(key, true, "Missing required field.");
    else if (typeof c[key] !== "string" || (c[key] as string).length === 0)
      err(key, true, `Must be a non-empty string (got ${typeof c[key]}).`);
    else ok(key, true);
  };
  reqStr("protocolVersion");
  reqStr("name");
  reqStr("description");
  reqStr("version");

  // url (required, must be a valid http(s) URL)
  if (!("url" in c)) err("url", true, "Missing required field.");
  else if (!isHttpUrl(c.url))
    err("url", true, "Must be a valid http(s) URL to the A2A endpoint.");
  else ok("url", true, String(c.url));

  // capabilities (required object)
  if (!("capabilities" in c)) {
    err("capabilities", true, "Missing required field.");
  } else if (!isObject(c.capabilities)) {
    err("capabilities", true, "Must be an object.");
  } else {
    ok("capabilities", true);
    const cap = c.capabilities as Json;
    for (const k of ["streaming", "pushNotifications", "stateTransitionHistory"]) {
      if (k in cap && typeof cap[k] !== "boolean")
        err(`capabilities.${k}`, false, "Must be a boolean.");
    }
  }

  // defaultInputModes / defaultOutputModes (required string[])
  for (const key of ["defaultInputModes", "defaultOutputModes"]) {
    if (!(key in c)) err(key, true, "Missing required field.");
    else if (!isStringArray(c[key]))
      err(key, true, "Must be an array of media-type strings.");
    else if ((c[key] as string[]).length === 0)
      warn(key, "Declared but empty — agent accepts/produces no modalities.");
    else ok(key, true, (c[key] as string[]).join(", "));
  }

  // skills (required, >=1)
  if (!("skills" in c)) {
    err("skills", true, "Missing required field.");
  } else if (!Array.isArray(c.skills)) {
    err("skills", true, "Must be an array.");
  } else if (c.skills.length === 0) {
    err("skills", true, "At least one skill is required.");
  } else {
    ok("skills", true, `${c.skills.length} skill(s)`);
    c.skills.forEach((s, i) => {
      const base = `skills[${i}]`;
      if (!isObject(s)) {
        err(base, true, "Skill must be an object.");
        return;
      }
      for (const k of ["id", "name", "description"]) {
        if (typeof (s as Json)[k] !== "string" || !(s as Json)[k])
          err(`${base}.${k}`, true, "Required non-empty string.");
      }
      if (!isStringArray((s as Json).tags))
        err(`${base}.tags`, true, "Required array of strings.");
      else if (((s as Json).tags as string[]).length === 0)
        warn(`${base}.tags`, "Empty tags reduce discoverability.");
    });
  }

  // --- optional but recommended fields ---
  if (!("provider" in c))
    warn("provider", "Recommended: identifies the publishing organization.");
  else if (
    !isObject(c.provider) ||
    typeof (c.provider as Json).organization !== "string" ||
    typeof (c.provider as Json).url !== "string"
  )
    err("provider", false, "Must include `organization` and `url` strings.");
  else ok("provider", false);

  if (!("documentationUrl" in c))
    warn("documentationUrl", "Recommended: link to human-readable docs.");
  else if (!isHttpUrl(c.documentationUrl))
    err("documentationUrl", false, "Must be a valid http(s) URL.");

  if (!("preferredTransport" in c))
    warn(
      "preferredTransport",
      "Defaults to JSONRPC when omitted; declare it explicitly.",
    );

  if (
    "supportsAuthenticatedExtendedCard" in c &&
    typeof c.supportsAuthenticatedExtendedCard !== "boolean"
  )
    err("supportsAuthenticatedExtendedCard", false, "Must be a boolean.");

  // protocolVersion sanity check (warning only — clients should interoperate)
  if (
    typeof c.protocolVersion === "string" &&
    !/^\d+\.\d+/.test(c.protocolVersion)
  )
    warn("protocolVersion", `Unrecognized format "${c.protocolVersion}".`);

  // --- score + summary ---
  const errors = r.filter((x) => x.status === "error");
  const warnings = r.filter((x) => x.status === "warning");
  const passed = r.filter((x) => x.status === "ok");

  // Required-field errors weigh 3x, optional/warnings weigh 1x.
  const weight = (x: FieldResult) => (x.required ? 3 : 1);
  const totalWeight = r.reduce((acc, x) => acc + weight(x), 0) || 1;
  const lostWeight = r
    .filter((x) => x.status !== "ok")
    .reduce((acc, x) => acc + (x.status === "error" ? weight(x) : 0.5), 0);
  const score = Math.max(0, Math.round((1 - lostWeight / totalWeight) * 100));

  return {
    valid: errors.length === 0,
    score: errors.length === 0 ? score : Math.min(score, 60),
    results: r,
    summary: {
      passed: passed.length,
      warnings: warnings.length,
      errors: errors.length,
    },
  };
}
