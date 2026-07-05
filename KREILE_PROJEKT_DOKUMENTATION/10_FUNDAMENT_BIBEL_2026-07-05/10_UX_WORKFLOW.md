# 10 · UX-/Workflow-Audit (nachgeholt, Konduktor)

Ersetzt den ausgefallenen `ux-workflow-auditor`. Belege: `99_AUDIT_INPUT/sweep_B_ux.txt` + Code am HEAD. Abgeglichen mit den drei User Twins.

## Was UX-seitig GUT ist (fair benannt)

- **Login ist kurz** (gut für Michael): Startscreen → Nutzerkachel klicken → PIN eingeben → `loginWithPin`. 2–3 Schritte, keine Tastaturtexteingabe für den Kern. Alternativ `EmailLoginDialog`.
- **Empty-States existieren breit**: viele Cockpit-Kacheln (Aging, DbRanking, Engpass, Forecast, KpiKachel, TopKunden), Kunden, Items, Buchhaltung, Finanzen behandeln leere Zustände. Das ist reifer als die reinen Negativbefunde vermuten ließen.
- **Datenherkunft sichtbar**: `DatenherkunftZeile.tsx` + `LIVE/DEMO`-Badge zeigen, aus welcher Quelle ein Wert stammt — im Sinne des Acht-Fragen-Vertrags („Was ist belegt und aus welcher Quelle?") ein guter Ansatz.
- **Dashboard ist an echte Daten angebunden** (`getOrdersDb`), mit Engpass-/Handlungslogik („Kritische Aufträge zuerst entschärfen").

## Was UX-seitig BRICHT (nach Twin)

### Rolf (Desktop, Entlastung ohne Kontrollverlust)
- **Zahlenvertrauen untergraben**: Solange zwei Datenpfade + `LIVE/DEMO`-Mischung existieren, sieht Rolf teils Demo-Werte neben echten. Für einen Inhaber, dessen Kaufmotiv „verlässliche Zahlen" ist, ist das der Vertrauens-Killer (F-C1, F-A1).
- **Handlungsbedarf teils da, aber nicht durchgängig** als 8-Fragen-Karte mit DB-Wirkung + Rückkehrpfad ausformuliert.

### Philipp (Tablet, „lohnt sich das für mich?")
- **Client-Wasserfälle** (Kundenkarte 7 Tabs, F-G2) → spürbarer Jank genau auf dem Tablet, das Philipp bevorzugt. Widerspricht „muss besonders schnell funktionieren".
- **Gamification/Wochenbilanz** (Ideenkatalog 05: Hero-Score, Streaks, Stationen-Arena) nur rudimentär — Philipps Motivationshebel „sichtbare Wirkung meiner Arbeit" ist schwach eingelöst.

### Michael (Büro, geringe Digitalkompetenz, keine Mehrarbeit)
- **Capture-Fragmentierung** (4 Einstiege, Kap. 09) → kein einheitlicher, geführter „ein Knopf"-Weg. Michael braucht genau EINEN offensichtlichen Pfad.
- **Erfassungssheet** (`ErfassungSheet.tsx`) verlangt Zeit/Material mit Feldern (Minuten default 45, Kostensatz, Mitarbeiter, Mengen) — das ist genau die Art strukturierter Eingabe, die Michael meidet, wenn sie nicht extrem geführt/vorbefüllt ist.
- **Realistische Terminzusage** (Michaels zentrales Risiko „optimistische Zusage") ist **nicht umgesetzt** (I-14 DEFERRED) — die App schützt ihn heute nicht vor Fehlzusagen.
- **Original-Verlust bei Crash** (F-C4) trifft Michael/Rolf direkt: Foto weg = Arbeit doppelt = Michaels Abbruchkriterium.

## Acht-Fragen-Vertrag — Teilerfüllung

| Frage | Status im Code |
|---|---|
| 1 Warum entstand die Karte? | teils (Dashboard-Todos mit `reason`) |
| 2 Welches Objekt? | ja (Order/Customer-Bezug) |
| 3 Was ist belegt + Quelle? | **gut** (DatenherkunftZeile, LIVE/DEMO) |
| 4 Was fehlt? | schwach |
| 5 Konkrete App-Handlung? | teils (`action`/„Nächste Aktion") |
| 6 Wer darf handeln? | Rollen/Permissions vorhanden, in Karten selten sichtbar |
| 7 DB-/Eventwirkung? | schwach/unklar (durch Mock-Pfade verfälscht) |
| 8 Wohin kehrt der Vorgang zurück? | schwach |

→ Der 8-Fragen-Vertrag ist **begonnen, nicht vollendet**. Fragen 4/7/8 fehlen weitgehend.

## Tablet/Mobile

- Startscreen/Kacheln sind Touch-orientiert; `RightNav`/`TopWorkflowBar` haben `pointer: coarse`-Logik (aus TEST_MATRIX bekannt). Nicht per Laufzeittest verifiziert (kein Playwright-E2E) — bleibt offen.

## UX-Fazit

Die UX-**Substanz** ist besser als das Datenfundament: kurzer Login, breite Empty-States, Datenherkunft-Bewusstsein. Das eigentliche UX-Risiko ist **nicht fehlendes Design, sondern Unzuverlässigkeit + Fragmentierung**: gemischte LIVE/DEMO-Daten, 4 Capture-Wege, Original-Verlust, fehlender Terminschutz. Diese Punkte entscheiden über die Akzeptanz aller drei Twins und werden durch die Reparatur-Wellen 2 und 4 adressiert.
