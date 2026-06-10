"use client";

import { useMemo } from "react";
import { smartMatchText, MatchResult } from "@/app/kommunikation/smartMatcher";

export type TileKey =
  | "zahlung" | "auftraege" | "historie" | "reklas"
  | "komm" | "stamm" | "notizen"
  | "kalender" | "anhaenge" | "ware";

/**
 * Maps smartMatcher results to the set of relevant tile keys.
 * Uses the SAME matching engine as the Telefonnotiz — no duplicated code.
 */
export function useTopicRelevance(
  messages: string[],
  existingMatch?: MatchResult | null
): { relevantKeys: Set<TileKey>; matchResult: MatchResult } {
  const matchResult = useMemo(() => {
    if (existingMatch) return existingMatch;
    const combined = messages.join(" ");
    return smartMatchText(combined, [], []);
  }, [messages, existingMatch]);

  const relevantKeys = useMemo(() => {
    const keys = new Set<TileKey>();
    const kw = matchResult.matchedKeywords;

    // Keyword → tile mapping
    if (kw.includes("Buchhaltung/Zahlung")) keys.add("zahlung");
    if (kw.includes("Termin/Logistik")) {
      keys.add("kalender");
      keys.add("auftraege");
    }
    if (kw.includes("Reklamation")) keys.add("reklas");
    if (kw.includes("Angebot")) keys.add("auftraege");

    // Entity matches
    if (matchResult.matchedCustomer) keys.add("stamm");
    if (matchResult.matchedOrder) {
      keys.add("auftraege");
      keys.add("ware");
    }

    // If payment is mentioned, always highlight zahlung
    if (matchResult.matchedKeywords.some(k => k.includes("Zahlung"))) {
      keys.add("zahlung");
    }

    return keys;
  }, [matchResult]);

  return { relevantKeys, matchResult };
}
