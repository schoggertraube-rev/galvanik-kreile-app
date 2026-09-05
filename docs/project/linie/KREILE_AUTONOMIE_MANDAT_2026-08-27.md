# AUTONOMIE-MANDAT — Projektleitung arbeitet selbstständig · 2026-08-27

**Von:** Owner + Orchestrator (Cowork/Claude) · **An:** ChatGPT-Projektleitung („Kreileapp projektleiter") · **Gültig:** ab sofort, bis zur nächsten ECHTEN Owner-Entscheidung (trifft der Owner gemeinsam mit dem Orchestrator). Ziel: Der Owner geht vom Rechner; bei Rückkehr ist das Besprochene umgesetzt — sauber, ohne Müll, ohne Mock, ohne Sackgassen.

## 1 — FESTGEZURRT (ratifiziert — dazu KEINE erneuten Owner-Rückfragen)
D-USP-001 (Entlastung, Prüf-Checkliste an jedem Entwurf) · D-ARCH-002 (Zwei-Achsen) · **D-ARCH-010 (Galvanik = EIN Step, keine Bäder — nirgends)** · D-F12-003 (Rollen) · D-F13-001 (Mehrarbeit-Katalog) · D-F15-001 (Zahlungs-Gate) · Geld-Auslagerung (Buchhaltung/Analyse später) · **F1.4-Bauvertrag komplett ratifiziert** (EVOLVE_PUBLIC_INVOICES additiv-rückwärtskompatibel, 19 % only, R-JJJJ-NNNN lückenlos, Storno+Neuausstellung, Stammdaten aus Mandanten-Config mit fail-closed Rechnungsstellung, PAYMENT_TERM_DAYS=14, PDF-Download-Übergang) · **Frontend = Parallel-Paket JETZT** (Konsolidieren statt forken, echte Ports, Proof-Screen zuerst) · UI-Referenzen: Rolf V8, Phillip V4, Auftragskarte MACHART_V8, Kundenkarte MACHART_V2 · Lieferfolge F1.4 → F1.5 → F1.6. Wer eine dieser Fragen erneut stellt, erzeugt Schleifen — nicht tun.

## 2 — DELEGIERT an die Projektleitung (evidenzbasiert entscheiden, dokumentieren, NICHT fragen)
- **Rolf-Routen-Konsolidierung** (today/start/cockpit/kontrolle → eine kanonische Startseite; im Git reversibel).
- **baeder-Disposition** (entfernen oder parken; im Git reversibel; Ergebnis dokumentieren).
- Test-/Observability-/Locator-Fixes; Reihenfolge und Zuschnitt der PRs INNERHALB der ratifizierten Pakete; Zusammenführen von Frontend-Übergabe + Red-Team-Gates zu EINEM kanonischen Liefervertrag (die Gates der Projektleitung gelten).

## 3 — ARBEITSAUFTRAG bis zur Rückkehr des Owners
1. Vereinten **Frontend-Liefervertrag** finalisieren (Owner-Dokumente bytegenau gebunden).
2. **Writer starten** (genau EINER): Frontend Phase 0 (Inventar/Reconcile) + Phase 1 (Proof-Screen Phillip Werkstatt gegen echte F1.2/F1.3-Ports) und **F1.4** gemäß ratifiziertem Vertrag. Parallel nur, wenn sauber getrennt; sonst sequenziell.
3. Je Paket alle Gates: reale E2E-Prüfung · CI grün am exakten SHA · unabhängiges Review am identischen SHA · keine offenen P0/P1 · ehrliche Status-Trennung (FUNCTIONAL_SLICE_PASS / DATA_TRUTH_PASS / UI_REFERENCE_PASS / OWNER_UX_PASS / PRODUCT_READY).
4. **MERGE-FREIGABE HIERMIT STEHEND ERTEILT** — ausschließlich für Pakete, die ALLE Gates bestehen UND vollständig im ratifizierten Scope liegen. Kein Gate wird übersprungen oder abgeschwächt. Nach Merge: kanonische Doku nachziehen, Branch löschen, sauber auf main.
5. **OWNER_UX_PASS bleibt offen** markiert (echte Nutzer-Abnahme durch Rolf/Phillip-Twin kommt bei Rückkehr) — er blockiert Merges nicht, darf aber nie als erteilt behauptet werden.

## 4 — HARTE LEITPLANKEN (unverändert, nicht verhandelbar)
Kein Mock/Fake/Platzhalter im Produkt- oder Abnahmepfad (Design-Demodaten wie Mustermann/300 SL nie als Daten) · keine neuen Tabellen außer der additiven invoices-Evolution · keine Provider, Credentials, Remote-DB-/RLS-Mutation, keine manuelle Production-Promotion · genau EIN Writer, PR statt Push · keine PASS-Behauptung ohne aktuellen Nachweis · nach 2 technisch identischen Fehlversuchen STOPP + Ursachenanalyse statt drittem Blindversuch · kein Scope-Creep, keine neuen Dashboards, keine Bäder-UI (D-ARCH-010) · Tenant fail-closed · Demo-/Altbestände (alte Routen) nur gemäß delegierter Disposition anfassen.

## 5 — ECHTE OWNER-GRENZEN (dann NICHT raten: in das ENTSCHEIDUNGSREGISTER einreihen und — wo möglich — an anderer Stelle weiterarbeiten statt zu blockieren)
Neue Datenwahrheit/Tabelle/Statusmaschine außerhalb der Verträge · Auth-/Rollen-/Session-Modell · neuer Provider oder kostenpflichtiger Dienst · Credentials/Secrets · destruktive Löschung außerhalb der delegierten Disposition · E-Rechnungs-Strategie · **F1.5-BAUSTART** (Vertrag liegt bereit, Ratifikation + Start erst nach F1.4-Merge durch Owner+Orchestrator) · F1.6/Pilot · Echtdatenfreigabe · wesentliche neue UI-/Produktentscheidungen außerhalb der Referenzen.

## 6 — RÜCKKEHR-BERICHT (liegt bei Rückkehr des Owners bereit)
Maximal eine Seite: PLAN_TREU-Status je Paket · gemergte SHAs mit Gate-Nachweisen · Screenshot-Belege Ziel/Ist des Proof-Screens · Entscheidungsregister der aufgelaufenen Owner-Fragen (je: Thema, Empfehlung, Nachteil) · ehrlich, was NICHT erreicht wurde und warum. Keine Erfolgsprosa ohne Beleg.

---
*Autonomie-Mandat · 2026-08-27 · Owner + Orchestrator · gilt bis zur nächsten gemeinsamen Owner-Entscheidung · Ablage: Kreile app\ (kanonisch für PL-Inventar)*
