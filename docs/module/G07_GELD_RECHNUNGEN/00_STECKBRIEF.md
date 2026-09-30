<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G07 — Geld & Rechnungen

**Zweck:** G07 schließt den Kreile-Auftrag fachlich und technisch von der eingefrorenen Abrechnungsgrundlage über Rechnung, Zahlung und Warenausgang bis Storno, E-Rechnung und Ausgangs-Export. Der vorhandene F1.4/F1.5-Kern bleibt die einzige Rechnungs- und Zahlungswahrheit; noch ungeklärte oder nicht gebaute Fähigkeiten bleiben sichtbar gesperrt und erzeugen weder Fake-Erfolg noch eine zweite Datenwahrheit.
**Stufe:** Grundstamm
**Dossier-Status:** BAUBEREIT
**Modul-Status:** ADOPTIERT
**zuständige Session:** Grundstamm-PL, Session `01a0ce4b`
**Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`, Lieferwahrheit `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`
**Code-Pfad:** `src/modules/accounting` (`accounting.manifest.json`, SHA-256 `7EE97CA50867`); vorhandener Fachcode außerhalb des Moduls ist in `11_IST_CODE_UMBAU.md` vollständig disponiert. Der lokale Branch `path1/v2-k4-geld@e477e6b2314d5a97575a32dc35ca0d16b55625d7` ist nur ein ungemergter UI-Kandidat, nicht Lieferwahrheit.
**braucht:** G01 Fundament/Rechte für Identität, Tenant, persönliche Rechte, Commands/Receipts/Audit; G04 Orders für Auftrag, Freeze, Lifecycle und Auftragskarte; G05 Customers für Rechnungsadresse und Zielrechnungs-Freigabe; G09 für Konfliktprojektion; G10 für Firmenstammdaten, Nummernkreis und Zahlungsparameter; später M01 ausschließlich über `PaymentAdapter` für das Kartenterminal.
**wird gebraucht von:** G02 Shell/Startseiten für Geld-Navigation und Handlungsbedarf; G04 Auftragskarte für Rechnung, Zahlung und Warenausgang; G08 Suche für lesende Rechnungsprojektionen; G09 Konflikte/Sperren; M01 für spätere Buchhaltungsfunktionen ohne Übernahme der G07-Wahrheit.
**Anbindungszeitpunkt + Gate:** Der vorhandene Backend-Kern ist auf `origin/main` adoptiert. Die sichtbare G07-Konvergenz erfolgt nach Designsystem-Phase 1 und den G01/G04/G05/G10-Portverträgen; das Live-Gate bleibt geschlossen, bis P0-Storno auf DB-Ebene, ZUGFeRD, Steuerberater-Freigabe der Rechnung/Exportformate, reale Rollen-/Tenant-Negativtests und Owner-UX bestanden sind. M01 wird erst nach fertigem Grundstamm, eigener Modulabnahme und Owner-Transfergate angebunden.
**Bis dahin im Grundstamm:** `Kartenterminal — In Aufbau` (gedämpft, nicht klickbar, keine Route); `E-Rechnung — In Klärung`; `Export Ausgangsrechnungen — In Klärung`; `Rechnung auf Ziel — In Klärung`; `Aufbewahrung — In Klärung`; `Mahnwesen — In Aufbau`. Der manuelle Rechnungs-, Zahlungs- und Warenausgangskern bleibt real nutzbar, soweit seine Sperren erfüllt sind.
**Übertragbarkeit:** Kern app-neutral: ja — Rechnungs-, Zahlungs-, Receipt-, Readback-, Export- und Payment-Port-Verträge dürfen keine Kreile-Rollen, Tenant-Literale, Texte, Konten oder Ressourcen enthalten. Kreile-spezifische Regeln und Texte liegen ausschließlich im Kreile-HostAdapter; Anpassungen anderer Zielapps gehören nicht in dieses Dossier.
**Rate-Stellen aus Red-Team:** `RT-01, RT-02, RT-04, RT-13, RT-14, RT-17, RT-19, RT-22, RT-23, RT-28, RT-30`; durch OE-2609-07/11 sind RT-01/02/04 fachlich aufgelöst, die übrigen sind als Anforderungen, Umbau oder sichere Klärungsgates erfasst.
**Stand:** 2026-09-26
**Bearbeiter:** Codex, Writer dieses Staging-Dossiers

## Verbindliche Scope-Grenze

G07 besitzt ausschließlich die Kreile-Wahrheit für Ausgangsrechnung, Zahlung und zugehörigen Warenausgang. Eingangsbelege, Mahnwesen, Bankabgleich, Gutschriften und das Buchhaltungs-Kontrollzentrum gehören zu M01; sie dürfen in G07 höchstens als ausgegrautes Element erscheinen. Es werden keine Anforderungen, Zeitmodelle, Daten, Secrets, Konten oder Ressourcen anderer Zielapps übernommen.
