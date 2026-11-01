// Entry-gate measurement (ROADMAP P25; owner exception to SPEC's "no analytics", DECISIONS-v3).
// Local only, as the owner chose: events stay in this browser (localStorage, last 200) and are
// also dispatched as a "cupid:gate" window event, so a lab script or, later (P30), a provider can
// read them. Nothing is sent anywhere and nothing identifies the reader.
export type GateEvent =
  | { type: "shown"; lang: string }
  | { type: "preview"; lens: string }
  | { type: "lang"; lang: string }
  /** lens null: entered with Skip or Esc, no lens applied (owner, 2026-11-01). */
  | { type: "enter"; via: "lens" | "skip" | "esc"; lens: string | null; ms: number }
  | { type: "leave"; ms: number };

export const METRICS_KEY = "gateMetrics";

export function track(event: GateEvent): void {
  const entry = { ...event, at: Date.now() };
  try {
    const log = JSON.parse(localStorage.getItem(METRICS_KEY) ?? "[]") as unknown[];
    log.push(entry);
    localStorage.setItem(METRICS_KEY, JSON.stringify(log.slice(-200)));
  } catch {
    // storage blocked: the window event below still carries it
  }
  dispatchEvent(new CustomEvent("cupid:gate", { detail: entry }));
}
