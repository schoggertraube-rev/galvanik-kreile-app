# 00 · KREILE BIBEL-INDEX — START HIER (PL liest zuerst dies)
*Stand 2026-09-01 · Dieser Ordner `Kreile app\` ist die EINZIGE Bau-Wahrheit (PL-Inventar). Nichts ausserhalb ist Quelle. Nicht suchen — hier steht, wo alles liegt.*

## REGELN (Verfassung)
- Ein Bauplan/Vertrag ist wörtliches Gesetz — NIE interpretieren. Unklarheit = STOP `BLOCKED_PRODUCT_DECISION`, Beschluss in DIE LINIE, dann bauen.
- EIN Writer (Main→Claude) · PR statt Push · kein Mock (Demo-Daten Mustermann/300 SL nie als Produktdaten) · kein Merge/DB/RLS ohne Owner-Freigabe.
- Nichts überschreiben: neue Version = neue Datei mit Datum; alte bleiben als Historie.
- Alte Ordner (`..\KREILE_App_Website_Specs`, `..\ui oberfläche app`, Bibel-Zips) = ARCHIV, KEIN Bau-Input.

## WO LIEGT WAS (in diesem Ordner)
- **Beschluss-Autorität:** `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` — jede Entscheidung (D-…, B1/B2/B3, Gates). Bei Divergenz gilt die Linie.
- **UI / Startseiten (Design-Wahrheit):** `design und klickpfade UI\00_INDEX_UI_STAND_2026-08-20.md` + die HTML-Referenzen:
  - Startseite Rolf FINAL: `design und klickpfade UI\KREILE_STARTSEITE_ROLF_V8_2026-08-20.html`
  - Startseite Phillip FINAL: `design und klickpfade UI\KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html`
  - Auftragskarte FINAL: `design und klickpfade UI\KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html`
  - Kundenkarte FINAL: `design und klickpfade UI\KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html`
  - (Historie V1–V7 liegt daneben.)
- **Frontend-Umsetzung (Auftrag):** `KREILE_UEBERGABE_FRONTEND_UMSETZUNG_V1_2026-08-21.md`
- **Backend-Verträge:** `KREILE_F1_4_BAUVERTRAG_UNVERAENDERLICHE_RECHNUNG_V1_2026-08-21.md` · `KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1_2026-08-21.md`
- **Rollen/Autonomie:** `KREILE_AUTONOMIE_MANDAT_2026-08-27.md`
- **Gesamtstatus/Orientierung:** `KREILE_GESAMTUEBERSICHT_STATUS_2026-09-01.md` + `STARTSEITEN_UI_REFERENZ_SPEC_2026-09-01.md`

## UI-WAHRHEIT (Kurz — Details im UI-Index)
- **Startseite abstrahiert Galvanik:** keine Bäder/Bereiche auf der Startseite; „In Arbeit" = eine ruhige Menge; Held = Termintreue + Bündelung + Mehrarbeit/fertig. Bäder (falls überhaupt) nur eine Ebene tiefer.
- **Nummern-Struktur (stabil):** 1 Suche · 2 Tag · 3 Eingang · 4 Aufträge · 5 Kunden · 6 Kalender · 7 Rechnungen · 8 Admin · 9 Telefonnotiz[F2] · 10 Ware raus.
- **Personalisierung:** Rolf startet auf 2 (Tag), Phillip auf 4 (Aufträge/Galvanik); gleiche Funktionsmenge, andere Schwerpunkte. Desktop = App-Shell mit Sidebar; Tablet = Kachel.
- **Route-Mapping:** Rolf V8 → eine aus today/start/cockpit (konsolidieren) · Phillip V4 → warendurchlauf/station · Auftragskarte → orders/kunden-auftraege · Kundenkarte → customers.
- **D-ARCH-010:** Galvanik = 1 Step → `baeder`-Route entfernen/parken.

## GEBAUT / IN ARBEIT (Details: GESAMTUEBERSICHT-Status)
- Gebaut (main f1c34b8, live): F0 · F1.1 Wareneingang · F1.2 Werkstattdurchlauf · F1.3 Leistungsabschluss.
- In Arbeit: F1.4 Rechnung (Branch immutable-invoice-m4) · Frontend/Warendurchlauf Phillip (Worktree, Paket C `b3419d6`, Push/Draft-PR läuft nach GitHub-Egress-Fix).

## GEORDNETER PLAN
1. GitHub-Egress aktiv → Paket-C Push/Draft-PR/CI (läuft).
2. Design ist jetzt hier abgelegt (`design und klickpfade UI\`) → PL baut Startseiten Ist-gegen-Soll.
3. F1.4 Rechnung fertig → Merge (Owner).
4. F1.5 (nach F1.4-Merge, Owner-Start).
5. Frontend OTC-Pfad: Phase 0 → Phillip Proof → Rolf-Startseite + Karten (Rolf-Route & baeder darf PL selbst).

## OFFENE OWNER-ENTSCHEIDUNGEN
- B1 Event-ID vs Rechnungsnummer · B3 Nummernvergabe-Zeitpunkt.
- UI-Struktur-Flags (aus UI-Index): S-Scope (Bäder ganz raus?), S-Termin, S-Bündel, S-Mehrarbeit, S5 Warenausgang-Gate, Delegation Rolf↔Phillip.


---
## NACHTRAG 2026-09-05 (Orchestrator, im Owner-Auftrag)
- **F1.4 = complete** (PR #68 Merge `466e45ef`, PR #70 Merge `11e8757`). **F1.5 aktiv** auf `f1/bestaetigter-zahlungseingang-20260904` (Mission-Bindung `3864605`); Bauvertrag V1 gilt wörtlich; Owner-Antwort §9: Bank-Abgleich als Adapter 1, Mollie später, Teilzahlung ja, Skonto offen. Writer baut Einheit A (Daten-/Read-Port-Vertrag).
- **Repo-Kopie dieses Ordners:** PR #71 `gov/linie-import-20260905` → `docs/project/linie/` (SHA-256-Manifest), damit PL und Writer die Linie im Repo lesen. Bei Abweichung gilt dieser Ordner; Kopie per PR nachziehen.
- **Aufgeräumt:** `_reviews/`, `neuer chat zusammenführung/`, `struktur und ideen zum UI umsetzen/` → `_archiv_2026-09-05/`. Lerninsel-Dokument in den Lerninsel-Ordner verschoben. Kundenprojekt-Root `galvanik_kreile\` (58 Alt-Einträge) → `_ARCHIV_2026-09-05_vor_LINIE/` mit Manifest. `_parallel/suche/LIEFERUNG_V1` bleibt bis PL-Disposition.
- **Neuer PL-Chat:** Startup-Briefing `KREILE_PL_STARTUP_BRIEFING_2026-09-05.md` (in einen neuen PL-Chat einfügen).
- **Merge-Ausführung** an den Orchestrator übertragen (Owner 2026-09-05), nur bei CI grün + PL-Review ohne P0/P1.
