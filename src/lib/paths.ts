// CUPID_CLAIMS points at a test dataset (e2e fixtures); such builds go to test-results/, never dist/.
export const CLAIMS_FILE = process.env["CUPID_CLAIMS"] ?? "content/claims.json";
