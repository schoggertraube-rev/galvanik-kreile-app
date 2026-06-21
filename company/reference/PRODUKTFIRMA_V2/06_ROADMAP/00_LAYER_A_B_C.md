# DIE DREI EBENEN — A / B / C

Wichtigste Trennung im ganzen System. Nicht vermischen.

## Ebene A — Du (Stakeholder)
USP festlegen · Ideen einbringen · Produkt/Design endabnehmen · Twins liefern. Du entscheidest, die Firma liefert.

## Ebene B — Build-Team (die Agentur)
Claude.ai Project + Claude Code + (Übergang: Antigravity für Galvanik). Baut, prüft, bringt live. Das ist alles in diesem Paket beschriebene Personal. **Existiert nur während der Entwicklung.** Verursacht Entwicklungskosten, keine laufenden Produktkosten.

## Ebene C — In-App-Assistent (Produktfunktion)
Die Claude-API **in** der fertigen App. Das ist deine Vision vom „allwissenden Mitarbeiter": hilft Endnutzern täglich, beantwortet „wo ist Auftrag X", warnt bei leerem Bad, schlägt Kundenantworten vor, führt durch die App.

**Warum getrennt von B:**
- andere Kostenstelle: API-Call pro Nutzerfrage (laufend, skaliert mit Nutzung)
- andere DSGVO-Pflichten: verarbeitet Endnutzer-/Kundendaten im Betrieb
- andere Modellwahl: oft reicht T1 (Haiku) + Regeln, viel billiger als der Verifier
- anderer Zeitpunkt: wird als eigene Mission gebaut, NACH Galvanik-Stabilisierung

**Konsequenz:** Wir bauen C nicht im ersten Wurf. Erst Galvanik stabil und live, dann der In-App-Assistent als große eigene Mission (Architekt: AI Product Architect). So vermeidest du laufende KI-Kosten, bevor das Fundament steht.
