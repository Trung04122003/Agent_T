// Capability check (ROADMAP-v4 P32.6, UX-v4 sections 12-13): decides the starting tier once, before
// any canvas exists. Lite (no canvas world: the static city map and the same panels) whenever the
// world cannot or should not run; otherwise High, Medium or Low from memory and cores. Reduced
// motion does not lower the picture; it switches motion off elsewhere (UX-v4 section 3), and caps at
// Medium so no weather starts. The reader can still change the tier in the HUD.

export type StartTier = "high" | "medium" | "low" | "lite";

export type Capabilities = {
  /** A 2D canvas context could be created. */
  canvas2d: boolean;
  reducedMotion: boolean;
  /** navigator.deviceMemory (GB, coarse), when the browser tells it. */
  deviceMemory?: number | undefined;
  /** navigator.connection.saveData, when present. */
  saveData?: boolean | undefined;
  /** navigator.hardwareConcurrency, when present. */
  cores?: number | undefined;
  /** The reader asked for the Lite view (?lite). */
  liteRequested?: boolean | undefined;
};

export function decideTier(c: Capabilities): StartTier {
  if (!c.canvas2d || c.liteRequested || c.saveData) return "lite";
  if (c.deviceMemory !== undefined && c.deviceMemory < 2) return "lite"; // very low memory
  if ((c.deviceMemory !== undefined && c.deviceMemory < 4) || (c.cores !== undefined && c.cores < 4)) return "low";
  const strong = (c.deviceMemory ?? 0) >= 8 && (c.cores ?? 0) >= 8;
  if (strong && !c.reducedMotion) return "high";
  return "medium";
}

/** Reads the browser. `win` is passed in so tests and the Lite page can call decideTier directly. */
export function readCapabilities(win: Window & { navigator: Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } } }): Capabilities {
  let canvas2d = false;
  try {
    canvas2d = !!win.document.createElement("canvas").getContext("2d");
  } catch {
    canvas2d = false;
  }
  return {
    canvas2d,
    reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
    deviceMemory: win.navigator.deviceMemory,
    saveData: win.navigator.connection?.saveData,
    cores: win.navigator.hardwareConcurrency,
    liteRequested: new URLSearchParams(win.location.search).has("lite"),
  };
}
