# AP-R · 3.0 „Neu erfassen“ als einziger Einstieg des Plus (U-233)

Status: **bereit nach TA-B2d** – Voraussetzung: #158 gemergt; Pfade über TA-B2d. Fassung 1 vom 02.11.
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block B2, Branch `kreile/b2-eingang` frisch von main. Lieferung **im selben PR wie AP-G** (zwei Abgaben), weil die AP-01-Fälle des Testmodells erst mit 3.0 grün werden können.
WAS: BAUPLAN spec `a887ece362f4` (SHA `5E7B880B…1F70`, kommt mit TA-B2d auf main): `screens[rein]` (3.0), `navigation.kopf[plus]`, `werkbank.interaktion`, `bausteine_vertraege.werkbank.geraete`, Testfälle `eingang` E01, E02, E17 und `kundeneu` K01 (Einstieg).

## Ziel (ein Satz)
Plus und Taste N öffnen immer 3.0 „Neu erfassen“; von dort führen „Auftrag oder KV erfassen“ (Taste A) leer in die Erfassung 3 und „Kunde anlegen“ (Taste K) in 3.1 – der direkte Sprung des Plus in 3 entfällt.

## Bauen
1. **3.0 im Modul** `src/modules/eingang/` nach `screens[rein]`: Titel „Neu erfassen“, Symbol `plus`, Recht `eingang`, Schließen/×/Esc nach `werkbank.interaktion`. Stufe-1-Schnitt: nur der Bereich `ohne_vorlage` mit genau zwei Kacheln `auftrag-erfassen` und `kunde-anlegen` (Text, Symbol, Taste aus dem Bauplan).
2. **Ziele:** `auftrag-erfassen` → 3 leer (`aufruf-leer`, wie heute nach dem Plus). `kunde-anlegen` → der bestehende Dialog 3.1 (Schreibweg `createCustomerAction`; das Formular ersetzt AP-K1). Ebenen und Ersetzen von 3.0 genau nach `werkbank.interaktion` und den Fällen E01/K01 (Erwartung `oben`, `dialoge`).
3. **Einstieg:** `requestGlobalCreate()` ohne Kontext und Taste N öffnen 3.0. Aufrufe **mit** Herkunft bleiben direkt (Kundenkarte „Neuer Auftrag“ → 3 mit Kunde, `aufruf-kunde`). Plus mit offener Karte als Kontext ist AP-C.
4. **Ohne Recht `eingang`:** kein Plus, Taste N öffnet nichts (E17), Server und Oberfläche gleich.
5. **Kennungen** nach `testmodell.konventionen`: `rein`, `rein.auftrag-erfassen`, `rein.kunde-anlegen`, `navigation.plus`.

## Nicht in AP-R (nicht andeuten, kein „geplant“-Knopf)
Aufnahme (Foto, Datei, Fotos vom Handy) → AP-F/AP-O; Notiz in 3.0 mit „Lesen“ und Zustand `erkannt` → AP-N (B5). „Schnell erfassen“ bleibt in 3 unverändert.

## Ersetzt / Entfernt (im selben Paket)
Der direkte Sprung Plus/Taste N → 3 (heute `src/ui/kr/GlobalesPlus.tsx` bzw. `requestGlobalCreate` im Modul). Kein zweiter Einstieg daneben.

## Gate
- AP-G-Fälle E01, E02, E17 und der Einstieg von K01 grün in CI gegen die Replay-DB; die Markierung „Konflikt P3“ entfällt für alle `eingang`-Fälle – jeder dieser Fälle ist danach grün oder steht mit Fall-ID, Soll, Ist in der Abgabe.
- realRender: Plus → 3.0 mit genau zwei Kacheln; A → 3 leer; K → 3.1; ohne Recht kein Plus.
- Keine Migration, keine neue Server-Action (H18 unverändert). A11 inkl. `git diff --check origin/main`.
- Abgabe `docs/delivery/ABGABE_AP-R.md`: SHA, READY-Preview genau dieses SHA, Fälle grün/rot.

## Abnahme (Owner-Klickweg)
1. Als Rolf: Plus → „Neu erfassen“ mit „Auftrag oder KV erfassen“ und „Kunde anlegen“. 2. „Auftrag oder KV erfassen“ → leere Erfassung, Kundensuche hat den Fokus. 3. × → wieder auf der Startseite; Taste N → „Neu erfassen“, Taste K → „Kunde anlegen“. 4. Kundenkarte „Neuer Auftrag“ → Erfassung direkt mit Kunde (ohne 3.0).

## Nachtrag 02.11. (Planungschat): Prüfliste der Erfassung 3, Fälle E45–E47
6. **Prüfliste** nach `screens[eingang].rail.pruefliste.pflicht` (Runde 26) und `bausteine_vertraege.pruefliste` (interaktion, regeln, rechte): Zeilen Art (nur mit Recht `geld`), Termin ist, Eingangsart und Einheit je Position („Position {n} fehlt“). Hauptknopf springt bei offener Zeile zum Feld und meldet „Noch offen: {Label}“ (wie AP-01 4.2 Punkt 6). Einheit ohne Vorbelegung nach `formulare.position.felder[einheit].vorbelegung`. Gate zusätzlich: E45, E46, E47 grün. Damit ist auch der Übergabe-Nachtrag 5 (Prüfliste Art, Eingangsart, Termin ist, Einheit) erledigt.
