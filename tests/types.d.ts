import type { MockInstance } from "vitest";

declare module "../src/lib/auth.js" {
  export const __mocks: {
    getSession: MockInstance;
    getActiveMember: MockInstance;
  };
}