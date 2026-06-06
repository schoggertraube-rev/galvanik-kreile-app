# 23 — Analytics & Entwickler-Telemetrie: Modul Marketing

**Version:** 1.0 · **Datum:** 2026-06-02
**Zweck:** zwei getrennte Ebenen — (A) Marketing-Analytics für den Inhaber, (B) Entwickler-Telemetrie, damit du als Developer Nutzung siehst und Verbesserungen veranlasst.

---

## 1. Ebene A — Marketing-Analytics (Inhaber)

| Kennzahl | Definition | Quelle |
|---|---|---|
| Reichweite/Klicks | je Touchpoint | Channel-Insights/Provider |
| Anfragen | Leads mit Marketing-Quelle | `lead` + UTM |
| Aufträge / Conversion | attribuierte Aufträge / Anfragen | `attribution` + Auftragsmodul |
| Umsatz / ROI | attribuierter Umsatz vs. Kosten | `attribution` + `kosten_posten` |
| Bestes Format/Fenster/Segment | Top-`lern_metrik` | Lern-Loop |
| Reaktivierungsquote | reaktivierte / angeschriebene | Reaktivierung |

Anzeige im Cockpit (Funnel) und in `/marketing/auswertung`, gespiegelt in den Performance-Kacheln (Datei 20 §10).

## 2. Ebene B — Entwickler-Telemetrie (für dich)

**Ziel:** sehen, ob das System angenommen wird und wo es hakt, um Vorschläge/UX zu verbessern.

| Event | Zweck |
|---|---|
| `vorschlag_angezeigt` / `vorschlag_angenommen` / `vorschlag_verworfen` | Annahmequote je Aktionstyp/Score |
| `aktion_abgebrochen` (Schritt) | wo Nutzer im Freigabe-Flow aussteigen |
| `sortiermodus_gewechselt` | welche Sortierung genutzt wird |
| `kanal_connect_versuch` / `_erfolg` / `_fehler` | Hürden beim Verbinden |
| `cold_start_vs_gelernt` | wie oft Vorschläge schon auf Historie beruhen |
| `time_to_first_action` | Bedienbarkeit (Onboarding-Reibung) |

**Pflichten:**
- Anonymisiert/pseudonymisiert; keine personenbezogenen Kundendaten in Telemetrie.
- Über Feature-Toggle abschaltbar (Inhaber-Entscheidung).
- Speicherung EU-Region; getrennt von Kundendaten.
- Developer-Dashboard (intern, Route `/admin/telemetrie` oder bestehende Anbieter-Admin-Konsole): Annahmequote-Trend, Abbruch-Hotspots, Kanal-Connect-Erfolg, Time-to-first-action.

## 3. Verbesserungsschleife

```
Telemetrie → Hotspots erkennen (z.B. 40 % brechen bei Kanal-Connect ab)
→ Hypothese → UX-/Default-Anpassung → A/B (Score-Gewichte oder Flow)
→ Wirkung an Annahmequote/Conversion messen → übernehmen oder verwerfen
```

- A/B-fähig: Score-Gewichte (`w1..w5`) und Default-Sortierung als konfigurierbare Varianten.
- Schwellen (z. B. Konfidenz für Lern-Badge) zentral steuerbar.

## 4. Akzeptanzkriterien

- [ ] Marketing-KPIs im Cockpit + Auswertung + gespiegelt in Performance.
- [ ] Telemetrie-Events erfasst, anonymisiert, EU-Region, abschaltbar.
- [ ] Developer-Dashboard zeigt Annahmequote, Abbruch-Hotspots, Kanal-Connect, time-to-first-action.
- [ ] Score-Gewichte/Default-Sortierung A/B-fähig konfigurierbar.
- [ ] Keine personenbezogenen Kundendaten in der Telemetrie.
