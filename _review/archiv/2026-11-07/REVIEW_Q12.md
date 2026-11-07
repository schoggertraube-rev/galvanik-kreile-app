# Review Q12 · Kleinigkeiten aus der Abnahme

Prüfer: Claude · 27.10.2026 21:27 Berlin (20:27 UTC)
Branch: origin/kreile/s1-p2-eingang · Produkt-SHA af98afa8

## Urteil: **PASS**

Keine Blocker.

- `GlobalCreateFlow.tsx`: Altkunde ohne Zahlungsbedingung → `""` + Option `Bitte auswählen`, `Auswahl required` → Pflichtfeld kann nicht leer durchrutschen (vorher stiller Fallback `rechnung_14`, jetzt behoben).
- Neukunde Standard `vorkasse`; Übergabe-Wechsel überschreibt freigeschaltete Rechnungs-Kunden nicht.
- Ein Namensfeld (`Firmenname`/`Name`), `companyName` wird abgeleitet (Privat → null). Pflichtfelder Ansprechpartner, Telefon, E-Mail, Anschrift unverändert required.
- Keine Migration, kein neuer Schreibweg, keine Hex-Farben.
