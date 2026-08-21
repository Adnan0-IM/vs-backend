// Minimal test setup for Vitest
import "node:process";

// Ensure a predictable secret for crypto service tests
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-secret-for-crypto-service-setup";

// Provide global fetch if not present (some tests may use fetch)
if (typeof globalThis.fetch !== "function") {
  // Use undici fetch if available, otherwise a noop that throws.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetch } = await import("undici");
    // @ts-ignore
    globalThis.fetch = fetch;
  } catch (e) {
    // leave fetch undefined; individual tests can mock it as needed
  }
}
