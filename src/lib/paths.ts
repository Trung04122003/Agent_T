// CUPID_CLAIMS points at a test dataset (e2e fixtures); such builds go to test-results/, never dist/.
export const CLAIMS_FILE = process.env["CUPID_CLAIMS"] ?? "content/claims.json";
// Same for the owner's "Limits and risks" (ROADMAP 17.3): CUPID_RISKS swaps in a test list.
export const RISKS_FILE = process.env["CUPID_RISKS"] ?? "content/risks.json";
