import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import LangSwitch from "../components/LangSwitch.astro";
import { dirFor, localeReport } from "./locales";
import { localized } from "./schema";
import { contentStrings } from "./translations";

const full = (s: string) => ({ vi: s, en: s, es: s });

describe("language completeness (ROADMAP 10.3)", () => {
  it("vi and en always show; es shows only when every string has it and its codename is reviewed", () => {
    const strings = [full("a"), full("b")];
    expect(localeReport(strings, ["es"]).filter((r) => r.available).map((r) => r.locale)).toEqual(["vi", "en", "es"]);
  });

  it("one string missing es hides es, and says how many are missing", () => {
    const strings = [full("a"), { vi: "b", en: "b" }];
    const es = localeReport(strings, ["es"]).find((r) => r.locale === "es")!;
    expect(es).toMatchObject({ available: false, missing: 1 });
  });

  it("a complete es with an unreviewed codename stays hidden (SPEC section 7)", () => {
    expect(localeReport([full("a")], []).find((r) => r.locale === "es")!.available).toBe(false);
  });

  it("real content today: only vi and en", () => {
    const { strings, reviewed } = contentStrings();
    expect(strings.length).toBeGreaterThan(20);
    expect(localeReport(strings, reviewed).filter((r) => r.available).map((r) => r.locale)).toEqual(["vi", "en"]);
  });

  it("the schema accepts candidate languages and rejects unknown ones", () => {
    expect(localized.safeParse(full("a")).success).toBe(true);
    expect(localized.safeParse({ vi: "a", en: "a", xx: "a" }).success).toBe(false);
  });
});

describe("LangSwitch (ROADMAP 10.2-10.3)", () => {
  const render = async (locales: string[]) =>
    (await AstroContainer.create()).renderToString(LangSwitch, { props: { locale: "vi", path: "/", locales } });

  it("renders exactly the languages it is given, es absent when not complete", async () => {
    const html = await render(["vi", "en"]);
    expect([...html.matchAll(/data-lang-switch="(\w+)"/g)].map((m) => m[1])).toEqual(["vi", "en"]);
    expect(html).not.toContain('hreflang="es"');
  });

  it("each link: real URL, hreflang, lang, code + full name, current marked; flag as SVG image, not emoji", async () => {
    const html = await render(["vi", "en"]);
    expect(html).toMatch(/href="\/vi\/"[^>]*hreflang="vi"[^>]*lang="vi"[^>]*aria-current="page"[\s\S]*?>VI<[\s\S]*?visually-hidden[^>]*>Tiếng Việt</);
    expect(html).toMatch(/href="\/en\/"[^>]*hreflang="en"[^>]*lang="en"[\s\S]*?>EN<[\s\S]*?visually-hidden[^>]*>English</);
    expect(html).not.toContain("aria-label");
    expect(html).toContain(">VI<");
    expect(html).toContain(">EN<");
    expect((html.match(/<img class="lang-switch__flag"[^>]*src="[^"]*svg[^"]*"/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/\u{1F1E6}|\u{1F1FB}|\u{1F1EC}/u); // no regional-indicator (emoji flag) characters
  });
});

describe("RTL (ROADMAP 10.4)", () => {
  it("only Arabic-script languages are right-to-left", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(["vi", "en", "es", "ja"].map(dirFor)).toEqual(["ltr", "ltr", "ltr", "ltr"]);
  });
});
