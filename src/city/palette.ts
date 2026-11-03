// Colours of Agent T City (UX-v4 section 4): the dossier's own tokens (src/styles/tokens.css), one set
// per mode, and shades mixed between them. No new hue family: every colour below is a token or a mix
// of two tokens. palette.test.ts checks the tokens against tokens.css.

export type Mode = "mat" | "giai-mat";

/** The dossier tokens the city uses, copied from tokens.css (a test keeps them equal). */
export const TOKENS = {
  mat: { bg: "#0a0a0b", surface: "#131316", ink: "#e8e6e1", inkMuted: "#9c9a94", line: "#26262b", accent: "#b8975a" },
  "giai-mat": { bg: "#f3f1ea", surface: "#ffffff", ink: "#111111", inkMuted: "#55534e", line: "#d9d6cc", accent: "#7a5f2a" },
} as const;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const hex = ([r, g, b]: Rgb): string => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
/** `a` mixed toward `b` by `t` (0..1), in sRGB. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as Rgb);
}
export function alpha(color: string, a: number): string {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${a})`;
}

/** A tone's darkest (face turned from the light) and lightest (facing it) colour. */
export type Ramp = { dark: string; light: string };
export type Palette = {
  mode: Mode;
  ground: string;
  street: string;
  plaza: string;
  canal: string;
  alley: string;
  marking: string;
  body: Ramp;
  glass: Ramp;
  trim: Ramp;
  dark: Ramp;
  window: string;
  edge: string;
  lamp: string;
};

export function palette(mode: Mode): Palette {
  const t = TOKENS[mode];
  if (mode === "mat") {
    // Night: dark masses, a brass rim, the canal the darkest thing on the ground.
    return {
      mode,
      ground: mix(t.bg, t.surface, 0.55),
      street: mix(t.surface, t.line, 0.45),
      plaza: mix(t.surface, t.line, 0.7),
      canal: t.bg,
      alley: t.bg,
      marking: alpha(t.accent, 0.22),
      body: { dark: mix(t.bg, t.surface, 0.5), light: mix(t.line, t.inkMuted, 0.22) },
      glass: { dark: t.bg, light: mix(t.line, t.accent, 0.3) },
      trim: { dark: mix(t.bg, t.accent, 0.18), light: mix(t.bg, t.accent, 0.62) },
      dark: { dark: t.bg, light: mix(t.bg, t.line, 0.7) },
      window: mix(t.surface, t.inkMuted, 0.12),
      edge: alpha(t.accent, 0.4),
      lamp: mix(t.line, t.inkMuted, 0.3),
    };
  }
  // Dawn: warm paper, ink outlines, gold trim.
  return {
    mode,
    ground: t.bg,
    street: mix(t.bg, t.line, 0.6),
    plaza: mix(t.bg, t.surface, 0.6),
    canal: mix(t.line, t.inkMuted, 0.3),
    alley: mix(t.line, t.inkMuted, 0.45),
    marking: alpha(t.accent, 0.3),
    body: { dark: mix(t.line, t.inkMuted, 0.3), light: t.surface },
    glass: { dark: mix(t.line, t.accent, 0.35), light: mix(t.surface, t.accent, 0.12) },
    trim: { dark: t.accent, light: mix(t.accent, t.surface, 0.45) },
    dark: { dark: t.ink, light: mix(t.ink, t.inkMuted, 0.6) },
    window: mix(t.line, t.inkMuted, 0.35),
    edge: alpha(t.inkMuted, 0.5),
    lamp: t.inkMuted,
  };
}
