# CURRENT_STATE — Galvanik-Kreile WerkstattCockpit

Letzter vor Aktivierung dieser Baulinie verifizierter Liefer-Base:
`origin/main@67f98f6e30ee91c1f042dbe0b10e53e208b85f6e`.

Diese Datei beschreibt nur belegten Main-Stand. Kandidaten, lokale Diffs, Preview-URLs und
Reviews sind keine Lieferung. Die Aktivierung aus
`docs/delivery/KREILE_LIVE_PLAN_V1.json` gilt erst, wenn ihr exakter Kandidat in
`origin/main` enthalten ist.

## Sichtbare Produktwahrheit am verifizierten Base

| Bereich | Stand |
|---|---|
| Login | real vorhanden, vom Owner als deutlich zu langsam gemeldet; KR-L01 offen |
| Designsystem V1.1 | als gebundene Quelle vorhanden, noch nicht Produktbasis; KR-L02 offen |
| Rollen-Homes und Zielnavigation | Zieloberflaeche nicht geliefert; KR-L03 offen |
| Auftragsliste/-karte | fachliche Teile vorhanden, Zielkomposition und Gesamtweg nicht geliefert |
| Kundenliste/-karte | fachliche Teile vorhanden, Zielkomposition und Gesamtweg nicht geliefert |
| Intake bis Zahlung | nicht als zusammenhaengender Zielweg geliefert |
| Suche und Kalender | nicht als vollstaendiger, ehrlicher Zielweg geliefert |
| Gesamtapp | nicht verkaufs- oder livebereit |

## Bereits belegte Basis

- `main` ist kanonische Code-Lieferwahrheit.
- Sicherheits-, No-Fake- und Modulgrenzen existieren und bleiben aktiv.
- Reale Backend-/Fachvertraege sind teilweise vorhanden; ein interner Vertrag ist kein
  sichtbarer Produktfortschritt.
- Production, Vercel-Status und Remote-Supabase sind getrennt zu belegen.

## Naechster festgelegter Schritt

Nach Aktivierung der Baulinie startet KR-L01. Es gibt keine erneute Paketwahl. Aktives
Paket, Phase und Nachfolger stehen ausschliesslich in
`missions/F1_ORDER_TO_CASH_PILOT_001.yml`; die vollstaendige Reihenfolge steht
ausschliesslich im Live-Plan.
