import { describe, expect, it } from "vitest";

import {
  checkAuthorityRepository,
  findActiveLegacyDesignBuildReferences,
  runAuthoritySelftest,
} from "../../scripts/quality/check-authoritative-sources.mjs";

const ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE = "ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE";

describe("D-GOV-001 authority gate", () => {
  it("accepts the repository authority and provider contract", () => {
    expect(checkAuthorityRepository(process.cwd())).toEqual([]);
  });

  it("fails closed for every isolated negative contract class", () => {
    expect(runAuthoritySelftest()).toEqual({ passed: 68, total: 68, validStates: 2 });
  }, 60_000);
});

describe("D-UI-DS-001 legacy aggregate mock build references", () => {
  it("rejects an active V5 build reference in plan, spec and mission text", () => {
    expect(findActiveLegacyDesignBuildReferences("V5 ergänzt die vier Seitenreferenzen um den Ablauf.", "plan")).not.toEqual([]);
    expect(findActiveLegacyDesignBuildReferences("Ablauf aus KREILE_GESAMTMOCK_V5_2026-09-14.html.", "spec")).not.toEqual([]);
    expect(findActiveLegacyDesignBuildReferences("path1_ui_convergence_next_product_build: V5_P3_HOMES\n", "mission")).not.toEqual([]);
    expect(findActiveLegacyDesignBuildReferences("D-UI-V5-001 legt V5 für den Ablauf fest.", "scope")).not.toEqual([]);
  });

  it("rejects active V5 flow claims in provenance form, after a historical heading and in mission comments", () => {
    expect(findActiveLegacyDesignBuildReferences("Der Ablauf folgt seit D-UI-V5-001 dem Gesamtmock.", "scope")).not.toEqual([]);
    expect(
      findActiveLegacyDesignBuildReferences(
        "### Historie — D-UI-V5-001\nText.\n### Aktive Regel\nAblauf aus KREILE_GESAMTMOCK_V5_2026-09-14.html.\n",
        "spec",
      ),
    ).not.toEqual([]);
    expect(
      findActiveLegacyDesignBuildReferences("allowlist:\n  # D-UI-V5-001: kanonische Ablaufreferenz\n  - docs/x.html\n", "mission"),
    ).not.toEqual([]);
  });

  it("rejects the module provenance parenthesis shape", () => {
    expect(
      findActiveLegacyDesignBuildReferences(
        "- **QUOTES/KV — Angebot vor Auftrag** (D-UI-V5-001, historischer Entscheidungsbezeichner; kein V5-Bauinput): eigenes Objekt.",
        "scope",
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining(ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE)]));
    expect(
      findActiveLegacyDesignBuildReferences("Quote (Herkunft: D-UI-V5-001, historischer Entscheidungsbezeichner; kein V5-Bauinput).", "scope"),
    ).toEqual(expect.arrayContaining([expect.stringContaining(ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE)]));
    expect(findActiveLegacyDesignBuildReferences("Quote-Modul (D-UI-V5-001): ein Auftrag.", "scope")).toEqual(
      expect.arrayContaining([expect.stringContaining(ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE)]),
    );
  });

  it("does not let a historical word in an active heading mask the section", () => {
    expect(
      findActiveLegacyDesignBuildReferences(
        "### Ablauf — historischer Kanon\nAblauf aus KREILE_GESAMTMOCK_V5_2026-09-14.html.\n",
        "spec",
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining(ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE)]));
  });

  it("rejects a partial D-UI-V5 classification", () => {
    expect(findActiveLegacyDesignBuildReferences("D-UI-V5-001 ist für die UI-Eingabe historisch.", "scope")).toEqual(
      expect.arrayContaining([expect.stringContaining(ACTIVE_LEGACY_DESIGN_BUILD_REFERENCE)]),
    );
  });

  it("accepts page names, the neutral classification sentence, historical sections and historical mission blocks", () => {
    expect(findActiveLegacyDesignBuildReferences("Phillip V4 und Kundenkarte V2 bleiben Seitenwahrheit.", "plan")).toEqual([]);
    expect(
      findActiveLegacyDesignBuildReferences(
        "D-UI-V5-001, D-UI-V5-002, D-UI-V5-003 und der V5-Gesamtmock sind durch D-UI-DS-001 vollständig supersediert und nicht ausführbar; kein Bauinput.",
        "scope",
      ),
    ).toEqual([]);
    expect(findActiveLegacyDesignBuildReferences("### Historie — D-UI-V5-001\nV5 legte den Ablauf fest.\n### Neu\nNur vier Seiten plus V1.1.\n", "spec")).toEqual([]);
    expect(
      findActiveLegacyDesignBuildReferences(
        "historical_v5_bindings:\n  classification: SUPERSEDED_NOT_EXECUTABLE_NOT_BUILD_INPUT\n  flow_reference: KREILE_GESAMTMOCK_V5_2026-09-14.html\n",
        "mission",
      ),
    ).toEqual([]);
  });
});
