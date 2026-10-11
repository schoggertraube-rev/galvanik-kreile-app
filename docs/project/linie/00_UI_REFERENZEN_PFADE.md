# Kreile — einzige geschichtete UI-Wahrheit

Stand: 2026-10-11, D-UI-DS-001.

Keine Datei ist alleinige Gesamtvorlage. Die drei Schichten haben getrennte Aufgaben und
duerfen einander nicht ueberschreiben.

## 1. Designsystem V1.1

- Pfad: `docs/project/linie/ui/designsystem_v1_1`
- Manifest: `docs/project/linie/ui/designsystem_v1_1/SHA256SUMS.txt`
- Manifest-SHA-256: `71B0CB01F484BEEF042CFD04D31F951D2DB2D441C427F8212F35A8D41A8041E5`
- Rolle: `TOKENS_TYPOGRAPHY_COMPONENTS_RESPONSIVE`

Nur diese Schicht bestimmt Farben, Typografie, Komponentenform, Abstaende und responsives
Verhalten. Designsystem V1 und V2 sind kein Bauinput.

## 2. Seitenkomposition und Rollenlayout

Ordner: `docs/project/linie/ui/`

- `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html`
- `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html`
- `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html`
- `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html`

Diese vier Dateien bestimmen `FOUR_UI_REFERENCES_ONLY`: Seitenaufbau, Informationsgewicht
und Rollenkomposition. Ihre Demodaten sind niemals Produktdaten.

## 3. Ablauf und Zwischenschritte

- Datei: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Rolle: `FLOW_AND_INTERMEDIATE_STEPS_ONLY`

V5 bestimmt nur Navigation, Rueckwege und Zwischenzustaende. Es darf weder V1.1-Tokens
noch die vier Seitenkompositionen ersetzen.

## Verworfen oder historisch

Gesamtmocks V2, V3, V4 und V6, Screenshots ausserhalb der gebundenen V1.1-Pruefbilder,
alte CSS-Mockschichten und sonstige Designdateien sind kein Bau- oder Abnahmeinput.

Die maschinenlesbare Bindung steht in `ui/CURRENT_DESIGN_REFERENCE.json` und
`docs/delivery/KREILE_LIVE_PLAN_V1.json`. Jede Aenderung erfordert eine konkrete
Owner-autorisierte Planamendierung.
