import { LEGACY_WELL_KNOWN_PATH, WELL_KNOWN_PATH } from "./a2a-types";

/**
 * Given whatever the user typed, return the ordered list of URLs to try when
 * fetching an Agent Card. If they already pointed at a concrete document we use
 * it as-is; otherwise we treat the input as a base and append the well-known
 * path, falling back to the legacy path.
 */
export function candidateCardUrls(input: string): string[] {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const lower = url.toLowerCase();
  if (lower.includes("/.well-known/") || lower.endsWith(".json")) return [url];
  const base = url.replace(/\/+$/, "");
  return [`${base}${WELL_KNOWN_PATH}`, `${base}${LEGACY_WELL_KNOWN_PATH}`];
}

/**
 * Minimal SSRF guard for a publicly deployed tool: only http/https, and block
 * cloud-metadata / link-local addresses. Localhost/private ranges are allowed
 * so the tool still works for local agent development.
 */
export function assertFetchable(rawUrl: string): void {
  const u = new URL(rawUrl);
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new Error("Only http(s) URLs are supported.");
  const host = u.hostname.toLowerCase();
  if (
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host.startsWith("169.254.")
  )
    throw new Error("Refusing to fetch link-local / cloud-metadata address.");
}
