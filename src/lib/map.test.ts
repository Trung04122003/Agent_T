import { describe, expect, it } from "vitest";
import places from "../../content/places.json";
import topo from "../assets/map/region.topo.json";
import { buildMap, LABEL, labelRect, VIEW } from "./map";
import type { Topology } from "topojson-specification";

const points = places.map((p) => ({ id: p.id, lat: p.approx.lat, lon: p.approx.lon, text: p.label.vi }));
const map = buildMap(topo as unknown as Topology, points);
const at = (id: string) => map.points.find((p) => p.id === id)!;
const inView = ([x, y]: [number, number]) => x >= 0 && x <= VIEW.width && y >= 0 && y <= VIEW.height;

describe("map geometry (ROADMAP 6.2-6.3)", () => {
  it("draws Viet Nam and its neighbours, keyed by code only", () => {
    expect(map.countries.some((c) => c.code === "VNM" && c.d.length > 100)).toBe(true);
    expect(map.countries.length).toBeGreaterThan(3);
  });

  it("finds islands of Hoang Sa and Truong Sa inside the Viet Nam feature, all in view", () => {
    for (const a of [map.archipelagos.hoangSa, map.archipelagos.truongSa]) {
      expect(a.dots.length).toBeGreaterThan(0);
      for (const d of a.dots) expect(inView(d)).toBe(true);
      expect(inView(a.label)).toBe(true);
    }
    // Hoang Sa lies north of Truong Sa.
    const meanY = (ds: [number, number][]) => ds.reduce((s, d) => s + d[1], 0) / ds.length;
    expect(meanY(map.archipelagos.hoangSa.dots)).toBeLessThan(meanY(map.archipelagos.truongSa.dots));
  });

  it("places the four points in the right relative positions", () => {
    for (const p of map.points) expect(inView([p.x, p.y])).toBe(true);
    const [thuongTin, thaiNguyen, daNang, dienBan] = ["thuong-tin", "thai-nguyen", "da-nang", "dien-ban"].map(at);
    expect(thaiNguyen!.y).toBeLessThan(thuongTin!.y); // Thai Nguyen is north of Thuong Tin
    expect(thuongTin!.y).toBeLessThan(daNang!.y); // the north is above central Viet Nam
    expect(daNang!.y).toBeLessThan(dienBan!.y); // Dien Ban is just south of Da Nang
    expect(dienBan!.x).toBeGreaterThan(daNang!.x); // and slightly east
    expect(daNang!.x).toBeGreaterThan(thuongTin!.x); // central coast is east of Ha Noi
  });

  it("20.4: no point label covers another label or another dot (vi and en)", () => {
    for (const locale of ["vi", "en"] as const) {
      const m = buildMap(
        topo as unknown as Topology,
        places.map((p) => ({ id: p.id, lat: p.approx.lat, lon: p.approx.lon, text: p.label[locale] })),
      );
      const rects = m.points.map((p) => labelRect({ ...p, text: places.find((q) => q.id === p.id)!.label[locale] }, p.label));
      const hit = (a: (typeof rects)[number], b: (typeof rects)[number]) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      m.points.forEach((p, i) => {
        m.points.forEach((q, j) => {
          if (i === j) return;
          expect(hit(rects[i]!, rects[j]!), `${locale}: ${p.id} label over ${q.id} label`).toBe(false);
          const dot = { x0: q.x - LABEL.dot, y0: q.y - LABEL.dot, x1: q.x + LABEL.dot, y1: q.y + LABEL.dot };
          expect(hit(rects[i]!, dot), `${locale}: ${p.id} label over ${q.id} dot`).toBe(false);
        });
      });
    }
  });

  it("keeps the inline SVG small", () => {
    const bytes = map.countries.reduce((s, c) => s + c.d.length, 0);
    expect(bytes).toBeLessThan(150_000);
  });
});

describe("map projection", () => {
  it("fits the frame, not the globe: Da Nang sits mid-width, Truong Sa in the lower right", () => {
    const daNang = map.points.find((p) => p.id === "da-nang")!;
    expect(daNang.x).toBeGreaterThan(VIEW.width * 0.3);
    expect(daNang.x).toBeLessThan(VIEW.width * 0.5);
    const ts = map.archipelagos.truongSa.dots;
    expect(Math.min(...ts.map((d) => d[0]))).toBeGreaterThan(VIEW.width * 0.5);
    expect(Math.min(...ts.map((d) => d[1]))).toBeGreaterThan(VIEW.height * 0.55);
  });
});
