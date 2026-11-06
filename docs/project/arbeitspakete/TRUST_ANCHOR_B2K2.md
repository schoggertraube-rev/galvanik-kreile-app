# TA-B2k2 – Bindung Runde 53 + Pfade Folge-PRs und AP-ABS (Planungschat, 06.11. 02:20)

Ein PR auf Branch `codex/ta-b2k2` von main (nach Merge #180), Owner merged. Ratchet-Rot nur nach Regel 20a.

## 1. Bindung (wie TRUST_ANCHOR_B2F „Fassung Runde 53“)
- `docs/project/endversion/codex/BAUPLAN.json` := `BAUPLAN.next.json` bytegleich, SHA `9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA` (spec `b6132498f47a`).
- `e2e/generated/**` neu erzeugen; Rot-Liste je Teil wie bisher; Fälle neuer Seiten (`absprache`) auf Rot-Liste `AP-ABS` bis zu dessen PR.
- DESIGN_POINTER-Neupin, eslint-ratchet-Pins; UI-Ordner `docs/project/endversion/ui/**` und `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` (12288CE7) unverändert aus dem Arbeitsbaum.

## 2. Branch-Namen (Scope-Checker)
`kreile/b2-ein-*` (Folge-PRs 2b/3b/4b, frei benennbar, z. B. `kreile/b2-ein-3b-druck`) und `kreile/b3-*` (AP-ABS: `kreile/b3-abs`). Bestehende Sicherungsrefs nicht überschreiben.

## 3. Pfade
- **3b Druck:** `src/app/actions/pdf.actions.ts`, `src/lib/pdf/OrderLabel.tsx`, `src/lib/pdf/__tests__/w2cB2m5u.orderLabelDateTruth.test.tsx`, `src/app/actions/__tests__/w2cCompanySettings.failClosed.test.ts`, `src/modules/eingang/ui/GoodsReceiptDialog.tsx`; dazu für `pdf.laufzettel` (Verlauf je Druck, Nachdruck an der Auftragskarte, Auslöser beim Buchen in 3): die Dateien der Auftragskarte 4.1 und des **bestehenden** Auftrags-Ereignis-Schreibwegs aus deiner Inventur (Ereignistyp `laufzettel_gedruckt` im vorhandenen Ereignisweg, keine neue Tabelle).
- **4b Nacharbeit:** wie TA-B2k1 + `supabase/migrations/*_ein4b_*.sql` (bereits durch TA-B2j-Glob gedeckt).
- **Entwurfsschutz (#179):** seine Pfade, falls #179 sie noch braucht.
- **AP-ABS:** `supabase/migrations/*_abs_*.sql` und alle Pfade aus deiner lesenden Inventur von `paket_folge.AP-ABS` (5.4-Dialog, Befehle `absprache.speichern/widerrufen`, `sammelrechnung.erstellen`, `recordGoodsOutCommand` + Leser 10.1/4.1/5.1/5.2, Der-Tag-Zeile, 7.1-Entwurf) als Globs wie TA-B2j; vollständige Liste in der Abgabe.
Danach braucht kein offener Folge-PR und AP-ABS einen weiteren Anker.
