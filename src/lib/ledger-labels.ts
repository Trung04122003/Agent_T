// The ledger's labels in one language, for every place that renders ledger rows: the dossier's
// Ledger and Agent T City's briefings (ROADMAP-v4 37.3), so both read the same words.
import type { LedgerLabels } from "../components/Ledger.astro";
import { t, type Locale } from "./i18n";

export async function ledgerLabels(locale: Locale): Promise<LedgerLabels> {
  return {
    heading: await t("ledgerHeading", locale),
    tiers: {
      T1: await t("tierT1", locale),
      T2: await t("tierT2", locale),
      T3: await t("tierT3", locale),
    },
    viewDeclassified: await t("viewDeclassified", locale),
    classifiedClosed: await t("classifiedClosed", locale),
    redacted: await t("redactedLabel", locale),
    present: await t("periodPresent", locale),
    evidence: await t("evidenceHeading", locale),
  };
}
