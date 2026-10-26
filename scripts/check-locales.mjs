// Report which languages are complete enough to show on the language switch (ROADMAP 10.3).
// Never fails the build: an incomplete language is simply hidden, and this says why.
// Usage: node scripts/check-locales.mjs
import { localeReport } from "../src/lib/locales.ts";
import { contentStrings } from "../src/lib/translations.ts";

const { strings, reviewed } = contentStrings();
const report = localeReport(strings, reviewed);
const shown = report.filter((r) => r.available).map((r) => r.locale);
console.log(`check-locales: shown ${shown.join(", ")} (${strings.length} displayed strings)`);
for (const r of report.filter((x) => !x.available)) {
  const why = [r.missing ? `${r.missing} of ${strings.length} strings untranslated` : "", r.reviewed ? "" : "codename not reviewed"];
  console.log(`  hidden ${r.locale}: ${why.filter(Boolean).join("; ")}`);
}
