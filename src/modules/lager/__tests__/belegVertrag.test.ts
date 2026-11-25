import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { belegSchluessel, kennungNormal } from "../belegVertrag";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("Kennungen für Lagerbelege (U1)", () => {
  it("normalisiert Lieferantennummern und Belegnummern", () => {
    expect(kennungNormal(" pp 500 ")).toBe("PP500");
    expect(kennungNormal(" a\u0308-1 ", "lieferant")).toBe("Ä-1");
  });

  it("faltet Zeilentext und begrenzt die Kennung auf 128 Zeichen", () => {
    expect(kennungNormal("Polierpaste  GRÜN 500g", "lieferant_text")).toBe("polierpaste gruen 500g");
    expect(kennungNormal("g".repeat(129), "lieferant_text")).toBe("g".repeat(128));
    expect(kennungNormal(`${"g".repeat(127)}😀x`, "lieferant_text")).toBe(`${"g".repeat(127)}😀`);
  });

  it("lässt bei der EAN nur Ziffern einschließlich führender Nullen stehen", () => {
    expect(kennungNormal("0 1234-567", "ean")).toBe("01234567");
  });
});

describe("Dublettenschlüssel für Lagerbelege (U5)", () => {
  const beleg = {
    art: "beleg",
    belegart: "lieferschein",
    lieferantId: "TEST-L1",
    belegnummer: "LS 1",
    dokumentSha256: sha256("TEST Lagerbeleg"),
  } as const;

  it("bildet für gleiche Lieferanten, Arten und normalisierte Nummern den gleichen Schlüssel", () => {
    const erwartet = sha256("n|TEST-L1|lieferschein|LS1");
    expect(belegSchluessel(beleg)).toBe(erwartet);
    expect(belegSchluessel({ ...beleg, belegnummer: "ls1" })).toBe(erwartet);
    expect(belegSchluessel({ ...beleg, belegart: "lieferantenrechnung" })).not.toBe(erwartet);
  });

  it("verwendet den Dokument-Hash solange Lieferant oder Nummer fehlen", () => {
    const erwartet = sha256(`d|${beleg.dokumentSha256}`);
    expect(belegSchluessel({ ...beleg, lieferantId: null })).toBe(erwartet);
    expect(belegSchluessel({ ...beleg, belegnummer: null })).toBe(erwartet);
    expect(belegSchluessel({ ...beleg, belegnummer: "  " })).toBe(erwartet);
  });

  it("trennt offene Dublettenfragen und eigenständige Belege über den Eingangsbezug", () => {
    const itemId = "00000000-0000-4000-8000-000000000001";
    expect(belegSchluessel({ art: "frage_offen", itemId })).toBe(sha256(`f|${itemId}`));
    expect(belegSchluessel({ art: "eigener_beleg", itemId })).toBe(sha256(`e|${itemId}`));
  });
});
