# KREILE — PL-Prüfung (Prüfer ≠ Autor) + Owner-Entscheidungen · 2026-09-06

*Erstellt vom PL-Aufsichts-Chat, unabhängig vom Aufräum-/Autor-Chat. Zweck: die offenen Probleme lösen, wo es logisch geht, und dir NUR die echten Owner-Entscheidungen klar vorlegen. Nichts hierin ist „Owner-entschieden", bis du unten abhakst.*

---

## A — Wahrheitsstand (kurz, ehrlich)

**Doku-Ebene: gut.** Entscheidungen sind im Register §7 eingetragen (inkl. **Skonto #5**), 12 Legacy-Ordner gelöscht, UI-Referenzen im Repo eingefroren, Suchleiste als Lieferung (`_lieferungen/suche/`) hereingeholt, ABC-Einstieg vollständig.

**Code-Ebene: 0 %.** Die fünf CI-Nähte sind Prosa, nicht Code:

| Naht | Soll (Path 1) | Ist am HEAD `35722b4` |
|---|---|---|
| Modul-Ordner `src/modules/` | existiert | **fehlt** |
| Tenant injiziert, Literal verboten | `TenantProvider` + Lint | **65× Literal** in `src`, kein Provider, kein Lint |
| Manifest je Modul | ~6 | **1** |
| Deep-Import-Verbot | `dependency-cruiser` build-fail | **nicht installiert** |
| UI-Contract-CI | Stationsband = FAIL | **nicht vorhanden** |

**Zwei Ehrlichkeits-Befunde:**
1. **False-Green:** Die abgelegte Prüfung behauptet „S0 (Tenant-Bann) gebaut (PR #75)". Real existiert nur ein Teil-Refactor `src/lib/tenant.ts` — die 65 Literale bleiben, keine Injektion, kein Lint. S0-Abnahme **nicht erfüllt**. Das ist die „Erfolgsattrappe", die AGENTS verbietet.
2. **„Unabhängige" Prüfung nicht unabhängig:** Sie liegt auf demselben Autor-Branch; sie gibt das selbst zu. Diese Datei hier ist die eigentliche unabhängige Prüfung.

**Fazit:** Als **Bauplan/Spec** tragfähig, um **S1 zu starten**. NICHT „fertig/perfekt": der einzige Determinismus-Hebel (S1-Gates) ist ungebaut, S0 nicht wirksam.

---

## B — Von mir gelöst (logisch eindeutig, KEINE Owner-Frage)

**B1 · Skonto-Mechanik** (Satz #5 ist schon entschieden): Skonto wird bei `confirmPayment` angewandt. Die unveränderliche Rechnung (F1.4) bleibt unberührt; bei Zahlung ≤ 10 Tagen ist `amount = brutto − 2 %`, offener Betrag → 0, ein **Entgeltminderungs-/Skonto-Ereignis** korrigiert die USt nach **§17 UStG** zum Zahlungszeitpunkt. Keine Rechnungsänderung, kein Konflikt mit der Unveränderlichkeit.

**B2 · Skonto-Restzahlung/Teilzahlung:** Teilzahlung = ja (PL-Briefing). Offener Betrag = Brutto − Summe bestätigter Zahlungen (Skonto als eigene Minderung gebucht). `confirmPayment` ist idempotent (`clientEventId`) + `expectedVersion`.

**B3 · `lager`/`lieferanten`:** löschen wie #9 — aber „Material & Einkauf" (Rolf-Mock, dim/„Modul folgt") **als künftiges Modul in Quarantäne** vermerken, damit die geplante Nav nicht verwaist. Reine PL-Disposition.

**B4 · Zu bereinigende veraltete Zeilen** (Inkonsistenzen, die „alles klar" stören — Register §7 gilt, diese sind zu überschreiben):
- „Skonto offen" in `KREILE_PL_STARTUP_BRIEFING_2026-09-05.md` und in `KREILE_F1_5_BAUVERTRAG…` §9-Offenliste → **entschieden per #5**.
- „Teilzahlung … Skonto-Behandlung (offen)" im F1.5-Bauvertrag §9 → **entschieden** (Teilzahlung ja, Skonto #5).
- Konsolidierungs-„offene Owner-Entscheidung" (Register §10) → durch Repo-als-Wahrheit + Ordnerlöschung **erledigt**.

**B5 · Code-Rückstand (kein Owner-Thema, sondern Bau):** S0 sauber nachziehen (65 Literale → `useTenant()`/Server-Context, Literal-Lint) und S1 (die fünf Gates) als Writer-Pakete bauen. Das ist der nächste **Bau**-Schritt, kein Aufräumen. Die „S0 gebaut"-Zeile in der alten Prüfung ist zu korrigieren.

---

## C — ECHTE Owner-Entscheidung (löst sich NICHT logisch) — bitte entscheiden

### C1 · Nummern-Modell (KONFLIKT — muss aufgelöst werden)

**Problem:** Register **#2/#4** legt fest: *eine* Nummer, vergeben **bei Annahme**, die **zugleich die Rechnungsnummer** ist. Das widerspricht drei ratifizierten/gebauten Wahrheiten:
- **F1.4-Bauvertrag** (wörtliches Gesetz, bereits in `public.invoices` gebaut): `R-JJJJ-NNNN` wird **erst bei `createInvoice` (Auftrag = fertig)** lückenlos vergeben.
- **Kanonische Mocks:** sichtbare Identität ist `A-2026-0042` = **Auftragsnummer**, nicht `R-…`.
- **GoBD/§14 UStG:** Rechnungsnummer bei Annahme → Lücken für nie berechnete Aufträge (Storno vor Rechnung, Rückzug).

**Optionen:**

- **Option 1 — „Zwei Nummern, eine sichtbare Identität" (PL-Empfehlung).** `A-JJJJ-NNNN` bei Annahme (kundenseitig, im ganzen Betrieb sichtbar, Lücken erlaubt). `R-JJJJ-NNNN` erst bei Rechnung, lückenlos (GoBD). Vorteil: Bauvertrag + Mocks bleiben unverändert, GoBD-sicher, Standard. Kosten: #2/#4 im Register von „eine Nummer" auf „zwei Nummern" korrigieren.
- **Option 2 — „Eine Nummer, bei Annahme" (Register-Ist).** Erfordert: Rechnungsnummer entsteht schon bei Annahme; jeder nicht berechnete Auftrag ist eine dokumentierte Lücke. Kosten: F1.4-Bauvertrag **umbauen** (createInvoice vergibt nicht mehr), Mocks ändern (R- statt A-), Steuerberater-Freigabe für die Lückenlogik. Höheres Risiko, gegen Standard.

**Meine Empfehlung: Option 1.** Sie ist die einzige, die deine schon gebaute Rechnung, deine Mocks und GoBD gleichzeitig respektiert.

> **Deine Entscheidung:** ☐ Option 1 (empfohlen)  ☐ Option 2  ☐ anders: __________

### C2 · Zahlungs-Adapter zuerst (kostenpflichtiger Dienst — nur du)

Mollie (Karte/Abholung) vs. Bank-Abgleich (Vorkasse/Rechnung). PL-Briefing notiert **Bank zuerst** — bitte bestätigen, dann ins Register spiegeln. Nicht blockierend (bis dahin manueller „bezahlt"-Schalter).

> ☐ Bank zuerst (wie notiert)  ☐ Mollie zuerst  ☐ beide

---

## D — Bestätigung der bereits als „Owner" eingetragenen Punkte

Diese stehen im Register als „[ENTSCHIEDEN 2026-09-06, Owner]". Damit die STOP-Liste ehrlich „0 offen" sein darf, bitte einmal bestätigen, dass sie **wirklich deine** sind (nicht vom Chat vermutet):

- ☐ **#2/#4 Nummern** → wird durch **C1** ersetzt/bestätigt.
- ☐ **#5 Skonto** 2 % ≤ 10 Tage, netto 30.
- ☐ **#6 Galvanik = eine Blackbox-Stufe**, `baeder` entfällt.
- ☐ **#7 genau eine personalisierte Startseite pro Login**, Admin = Einstellungen.
- ☐ **#8 Kill-Liste** (reine Mock-Routen löschen; `archive`/`feedback` vorher prüfen).
- ☐ **#9 AMBIG-Routen:** `items` behalten, `telefonnotiz` → Customers/Intake, `lager` + `lieferanten` löschen.

Was **nicht** bestätigt wird, geht zurück auf die STOP-Liste (offen), statt als dein Gesetz zu gelten.

---

## E — Nächste Schritte (nach deiner Entscheidung)

1. Deine Antworten zu **C1/C2** + Häkchen **D** → ich formuliere die Register-Korrektur (#2/#4) und die B4-Bereinigungen als **einen** Governance-PR-Auftrag (der Writer setzt um, nicht ich).
2. **S1 (fünf CI-Gates)** als Writer-Pakete spezifizieren — das ist der eigentliche Determinismus-Hebel und der erste echte Bau-Schritt.
3. Danach erneute **unabhängige** §5-Prüfung gegen den Abnahmetest der ABC.

*Diese Datei ist Vorlage zur Entscheidung, kein ratifizierter Beschluss. Erst nach deinem Häkchen wird sie in die Linie überführt.*
