<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Entscheidungsverweise

Diese Datei kopiert keine Registertexte. Neuere Owner-Entscheidungen präzisieren oder ersetzen ältere Fundstellen nur in dem jeweils genannten Umfang.

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001 / `DOCUMENT_AUTHORITY.md` | Dokumentautorität und Vorrang des Kanons | 2026-09-10 | gilt |
| D-UI-V5-003 / Repo-Entscheidungsregister | V5 bleibt UI-Kanon; V6 ist verworfen | 2026-09-21 | gilt |
| `00_BIBEL`-Register ohne D-UI-V5-003 | Abweichende ältere Registerkopie | 2026-09 | überholt/Duplikat; OP-01 |
| D-RES-001 / Repo-Entscheidungsregister | Commands brauchen Receipt, unabhängigen Readback und sichere Recovery | 2026-08-28 | gilt |
| D-ARCH-012 / Repo-Entscheidungsregister | Zahlungsprovider ausschließlich hinter Accounting-Adapter | 2026-08-28 | gilt, präzisiert durch OE-2609-12 |
| D-F15-001 / D-F15-003 / Repo-Entscheidungsregister | Manuelle Zahlungsbestätigung und kanonischer Paymentstand | 2026-08-28 | gilt |
| D-AI-001 / D-AI-002 / Repo-Entscheidungsregister | KI/OCR liefert Vorschläge; privates Original bleibt führend | 2026-08-28 | gilt |
| D-UI-002 / Repo-Entscheidungsregister | Konflikte erscheinen als Handlungsbedarf statt KPI-Wand | 2026-08-28 | gilt, präzisiert durch OE-2609-26 |
| MODULKARTE, Zeile Accounting-minimal | Minimalumfang im Grundstamm | 2026-09-21 | teilweise gilt; Aussage „eigenständiges Modul entfällt“ durch OE-2609-05 überholt, OP-02 |
| Digest OWNER #3 | Dokumentoriginal, Bank-Inbox, Gutschrift und Refund additiv trennen | 2026-09-16 | gilt |
| Digest OWNER #14 | Universal Intake und aggregierte `PAYROLL_PREP`-Übergabe | 2026-09-16 | gilt |
| Digest OWNER #23 | Kein Hauptbuch, keine autonome Steuerlogik oder Lohnabrechnung in M01 | 2026-09-16 | gilt |
| Digest OWNER #31 | Runtime Truth zuerst; frühere Accounting-UI/Anforderungsversionen verworfen | 2026-09-16 | gilt |
| Digest OWNER #32 | D1–D4 bleiben gesperrt; keine weiteren UI-Mocks | 2026-09-16 | gilt |
| Digest OWNER #37 | Candidate.2 mit 55/55 Tests und gezieltem Opus-5-PASS bleibt off-repo | 2026-09-16 | gilt; keine Adoption |
| OE-2609-03 | Kreile-Designsystem aus V5, `kr-`, Fraunces/Inter, 48 px | 2026-09-25 | gilt |
| OE-2609-04 | Gebaute Grundstammelemente dürfen „In Aufbau“/„In Klärung“ zeigen | 2026-09-25 | gilt |
| OE-2609-05 | Grundstamm zuerst, Module hinten angestellt und seriell anbinden | 2026-09-25 | gilt; neuer als MODULKARTE |
| OE-2609-07 | Abholung bar oder Karte, sonst Vorkasse | 2026-09-25 | gilt |
| OE-2609-09 | Standardzugriff für alle; Admin sperrt/erweitert personenbezogen | 2026-09-25 | gilt |
| OE-2609-10 | Finanzkonflikte Rolf, Übergabe/Kassieren Phillip | 2026-09-25 | gilt |
| OE-2609-11 | Rechnung auf Ziel nur Kunden-Ausnahme; 2 %/10 Tage, netto 14 Tage | 2026-09-25 | gilt; ersetzt ältere netto-30-Angabe |
| OE-2609-12 | Terminal integriert; Terminal, Bank und Mollie als PaymentAdapter | 2026-09-25 | gilt; Provider/Kosten/Secrets bleiben Gate |
| OE-2609-14 | E-Rechnungsausstellung liegt in G07; Empfang liegt im M01-Belegeingang | 2026-09-25 | gilt |
| OE-2609-17 | Erst nach Modulabnahme ersetzt die echte Funktion das graue Element | 2026-09-25 | gilt |
| OE-2609-20 | 8-/6-Jahres-Aufbewahrung, Ablaufhemmung, Adminfreigabe, Aggregate bleiben | 2026-09-26 | gilt |
| OE-2609-23 | M02 kombiniert Termintreue und Liquidität 30 Tage | 2026-09-26 | gilt; M01 liefert Fakten |
| OE-2609-24 | Liquidität zuerst manuell, Bank später als bestätigter Vorschlag | 2026-09-26 | gilt |
| OE-2609-25 | Produktivumgebung im Kreile-eigenen Microsoft-365-Tenant/Azure-Abo; Dev nur synthetisch | 2026-09-26 | gilt; Anlage/Zustimmung bleibt Owner-Gate |
| OE-2609-26 | Konflikte, Warnungen und Entscheidungen oben; keine KPI-Wand | 2026-09-26 | gilt |
| Owner-Nachtrag „Trennung Kreile / andere Zielapps“ | Neutraler Core, Kreile nur im HostAdapter | 2026-09-26 | gilt; frühere Lerninselangaben für M01 überholt |
| `ACCOUNTING_RUNTIME_TRUTH_AND_VERTICAL_BUILD_PLAN_2026-09-16.md` | Runtime-Wahrheit, Blocker D1–D4 und serielle Slices A0–F | 2026-09-16 | gilt als Bauplan; durch Candidate.2-Stand fortgeschrieben |
