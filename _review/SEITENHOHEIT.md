# SEITENHOHEIT – welche Quelle gilt für welche Seite (Planungschat pflegt; eine Wahrheit je Seite)

Gebunden ist nur, was auf `origin/main` liegt. Diese Liste sagt, **woher** die Vorgabe für eine Seite kommt. Codex, Sichtprüfung und ein späterer Endversion-Chat richten sich danach; eine Seite hat genau eine Quelle.

| Seite / Bereich | Quelle der Vorgabe | Stand |
|---|---|---|
| Eingang (rotes Plus, `rein`, 3.0) | Vorschau-Modul `_review/quellen/vorschau_module/Eingang/` (Basis V04) + Paket `_review/pakete/` | Modul in Arbeit – bis Freigabe nichts an der Oberfläche bauen |
| KV (anlegen, Karte, Versand, Zusage, Umwandeln) | Vorschau-Modul `…/vorschau_module/KV/` + `_review/pakete/AP-KV-V04.md` | Server-Teil A frei; Oberfläche nach Freigabe |
| Nachrichten – Reiter „Anliegen“ | Vorschau-Modul `…/vorschau_module/Nachrichten/` | Modul in Arbeit |
| Nachrichten – Mailansicht | Bauplan V43 (unverändert, U-244) | gebunden |
| Werkstatt-Übersicht (Kacheln) | Vorschau-Modul `…/vorschau_module/Werkstatt/` | Modul in Arbeit |
| Reklamation 4.8 | Bauplan V43 `screens[reklamation]` + PL-Entscheidungen BAULOG 17:50 | gebunden, Bau läuft (4c) |
| Mail in den Eingang 3.4 | Bauplan V43 `screens[mailein]` + PL 17:50 (4) | gebunden |
| Alle übrigen Seiten, Karten, Dialoge, Der Tag | Bauplan V43 (Runde 53, spec b6132498f47a) | gebunden |

Regeln:
- Wird ein Modul freigegeben und gebaut, prüft die Sichtprüfung diese Seite gegen das freigegebene Modul, nicht mehr gegen den Sichtvertrag V43 (dortige Fälle der Seite → Rot-Liste `Seitenhoheit Modul <Name>`).
- Ein späterer Endversion-Chat arbeitet nur auf Basis V43 (spec b6132498f47a) und fasst keine Seite an, deren Quelle ein Vorschau-Modul ist. V44/V45 sind verworfen (`_review/lieferung_V44_verworfen/`).
- Neue Seiten oder Änderungen kommen zuerst in diese Liste (Planungschat), dann gebaut.
