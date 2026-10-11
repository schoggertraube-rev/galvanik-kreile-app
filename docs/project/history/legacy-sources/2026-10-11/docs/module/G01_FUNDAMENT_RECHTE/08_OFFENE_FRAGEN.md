<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Offene Fragen

| Q-ID | Frage | Optionen | Empfehlung | wer klärt (Owner/PL/Designphase) | bis dahin in der App | gesucht in: | Status |
|---|---|---|---|---|---|---|---|
| Q-G01-001 | Wie lauten und wirken alle finalen Texte/Layouts der fehlenden Gregor-, Personenrechte-, Audit-, Konflikt- und Commandzustände auf drei Geräten? | A: Alt-Admin-UI weitergestalten; B: neue `kr-`-Screens aus Inhaltsliste | B: Designphase 1b baut aus `03_OPTIKVORLAGE.md` eine vollständige responsive Zielvorlage; vorhandene Komponenten liefern nur Inhalt. | Designphase, danach Owner-UX | Nicht klickbares Element „Personen & Rechte“ mit Status „In Aufbau“; keine Route, kein `NOT_AVAILABLE`. | OE-2609-03/-04/-09/-27; Plan Phase 1b/T-05; Red-Team RT-21…25; V5; PL-/KOORD-Digests; `RoleMatrix.tsx`; `UserManagement.tsx` | FEHLT |
| Q-G01-002 | Welche Device-Challenge ergänzt den vierstelligen PIN vor Livegang? | A: Geräte-Enrolment mit Gregor-Freigabe; B: WebAuthn; C: bestehender PIN-Vertrag ohne Challenge beibehalten | A: Enrolment, Verlust-/Wechselweg, maximale Gerätezahl und Recovery als eigene Security-Mission entscheiden; keine Challenge in G01 erfinden. | Owner/PL Security | PIN mit bcrypt, serialisiertem Rate-Limit und Sitzungswiderruf bleibt aktiv; Administration zeigt „Gerätebindung · In Klärung“. | DECISION_PIN_SECURITY; MASTERPLAN SEC-PIN-002B; CURRENT_STATE Advisor/Go-live-Gates; OWNER_ENTSCHEIDUNGEN; Offene Punkte; alle drei Digests | FEHLT |
| Q-G01-003 | Wie wird der in der importierten Projektsteuerung genannte Pfad `missions/MISSION_TEMPLATE.yml` behandelt, der auf `origin/main` absichtlich gelöscht ist? | A: Vorlage wiederherstellen; B: Steuerung auf die aktive Mission verweisen | B: `missions/F1_ORDER_TO_CASH_PILOT_001.yml` bleibt für aktive Ausführung maßgeblich; AGENTS-/Projektpointer bei nächstem Governance-Docs-PR korrigieren. | PL | Keine App-Auswirkung; Builder folgt aktiver Mission und diesem Dossier. | `origin/main:AGENTS.md`; `DOCUMENT_AUTHORITY.md`; aktive Mission; deren `r0_allowlist` (MISSION_TEMPLATE als stale deletion); OP-01/OP-12 | GEPLANT |

## Als geklärt übernommen, nicht erneut fragen

- Rechte gelten je Person und standardmäßig sind alle 13 vorhandenen Rechte erlaubt: OE-2609-09.
- Rechteänderungen gehören ausschließlich Gregor/Admin: OE-2609-09 in Verbindung mit D-UI-V5-002.
- Sichtbar sind Rolf, Phillip und Gregor; Michael bleibt historischer Prozess-Twin: OE-2609-02 und D-UI-V5-002.
- Jede Rechteänderung braucht Audit, Command-Receipt und Readback: Auftrag-Nachtrag, MODULKARTE FUNDAMENT und D-RES-001.
- Löschen/Anonymisieren geschieht nie still und nur nach Admin-Freigabe: OE-2609-20.
- Keine Anforderungen anderer Zielapps; Übertragbarkeit nur über Kern/HostAdapter: Owner-Nachtrag 2026-09-26.
