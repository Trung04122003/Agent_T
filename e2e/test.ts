import { test as base } from "@playwright/test";

export * from "@playwright/test";

/**
 * The entry gate (ROADMAP P25) shows once per session on a first visit, and every Playwright test
 * is a new session. Tests about the page itself open it as a reader who has already passed the
 * gate this session; e2e/entry.e2e.ts imports @playwright/test directly to meet the gate.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("gateSeen", "1");
      } catch {
        // opaque origins (about:blank) have no storage
      }
    });
    await use(context);
  },
});
