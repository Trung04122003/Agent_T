// Build flags. Agent T City (ROADMAP-v4 P31.3): on in `pnpm dev`, off in every build unless the
// environment sets PUBLIC_CITY=1 (the owner turns it on for release, P52). When off, the city route
// is not injected (astro.config.mjs, same rule) and nothing links to it. MODE, not DEV: DEV is true in any build run with
// NODE_ENV other than "production" (a test runner's, say), which must not switch the city on.
export const CITY_ENABLED = import.meta.env.MODE === "development" || process.env["PUBLIC_CITY"] === "1";
