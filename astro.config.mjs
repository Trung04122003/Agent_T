// @ts-check
import { defineConfig } from "astro/config";
import { DEFAULT_LOCALE, LOCALES } from "./src/lib/locales.ts";

/** Pages that exist only under `astro dev` (font specimen, later design trials). Never built. */
const devPages = {
  name: "dev-pages",
  hooks: {
    /** @param {{ command: string, injectRoute: (r: { pattern: string, entrypoint: string }) => void }} opts */
    "astro:config:setup": ({ command, injectRoute }) => {
      if (command !== "dev") return;
      injectRoute({ pattern: "/dev/fonts", entrypoint: "./src/dev/fonts.astro" });
      injectRoute({ pattern: "/dev/portrait", entrypoint: "./src/dev/portrait.astro" });
      injectRoute({ pattern: "/dev/name", entrypoint: "./src/dev/name.astro" });
      injectRoute({ pattern: "/dev/rtl", entrypoint: "./src/dev/rtl.astro" });
      injectRoute({ pattern: "/dev/cursor", entrypoint: "./src/dev/cursor.astro" });
    },
  },
};

export default defineConfig({
  output: "static",
  // Builds from a test dataset (CUPID_CLAIMS) must never land in dist/, which is what gets deployed.
  // Its content store is kept apart too (cacheDir), so the two datasets can never mix.
  outDir: process.env["CUPID_CLAIMS"] ? "test-results/dist-fixture" : "dist",
  cacheDir: process.env["CUPID_CLAIMS"] ? "test-results/cache-fixture" : "node_modules/.astro",
  // Also makes duplicate ids in content/*.json fail the build instead of warning.
  prerenderConflictBehavior: "error",
  devToolbar: { enabled: false },
  // /vi/ and /en/ (SPEC section 4); "/" is a small page that sends readers to /vi/.
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  integrations: [devPages],
  vite: {
    build: { sourcemap: false },
  },
});
