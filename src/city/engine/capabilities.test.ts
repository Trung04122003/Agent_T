import { describe, expect, it } from "vitest";
import { decideTier, type Capabilities, type StartTier } from "./capabilities";

const base: Capabilities = { canvas2d: true, reducedMotion: false };

describe("capability check (ROADMAP-v4 P32.6)", () => {
  it.each<[string, Partial<Capabilities>, StartTier]>([
    ["no 2D canvas", { canvas2d: false, deviceMemory: 16, cores: 16 }, "lite"],
    ["the reader asked for Lite", { liteRequested: true, deviceMemory: 16, cores: 16 }, "lite"],
    ["save-data on", { saveData: true, deviceMemory: 16, cores: 16 }, "lite"],
    ["very low memory (1 GB)", { deviceMemory: 1, cores: 8 }, "lite"],
    ["2 GB phone", { deviceMemory: 2, cores: 8 }, "low"],
    ["two cores", { deviceMemory: 8, cores: 2 }, "low"],
    ["the reference i3-1115G4 (8 GB, 4 threads)", { deviceMemory: 8, cores: 4 }, "medium"],
    ["no memory or core hints (Safari, Firefox)", {}, "medium"],
    ["strong laptop (8 GB, 8 cores)", { deviceMemory: 8, cores: 8 }, "high"],
    ["strong laptop, reduced motion: capped at Medium", { deviceMemory: 8, cores: 12, reducedMotion: true }, "medium"],
    ["reduced motion alone does not force Lite or Low", { deviceMemory: 4, cores: 4, reducedMotion: true }, "medium"],
    ["save-data wins over a strong machine", { deviceMemory: 32, cores: 32, saveData: true }, "lite"],
  ])("%s -> %s", (_, caps, expected) => {
    expect(decideTier({ ...base, ...caps })).toBe(expected);
  });
});
