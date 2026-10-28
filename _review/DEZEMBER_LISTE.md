# Dezember-Liste

- Service-Worker-Registrierung auf zugriffsgeschützten Vercel-Previews ohne zwei Redirect-Fehler in der Browserkonsole behandeln. Kein Kernweg-Blocker; die Anwendung und der OIDC-geschützte Preview-Zugriff funktionieren, betroffen ist nur die PWA-Registrierung hinter dem Vercel-Schutz.

- (Claude 26.10., P1b) Eingangsart-Auswahl in „Neuer Eingang“ Schritt 1 an Zustand binden und speichern (`GlobalCreateFlow.tsx`, `<select defaultValue="anruf">`).
- (Claude 26.10., P1b) Ladezeit Auftragskarte auf der Preview messen und belegen.
- (Claude 26.10., P2) `tenant_features`: neue Mandanten erhalten Standardzeilen (heute nur bei Migration angelegt).
- (Claude 26.10., P2) Feste Hex-Farben in `SearchDialog.module.css` (38) und `StartScreenClient.module.css` (36) auf Tokens umstellen.
- (Claude 26.10., P2) Zahlungsdialog-Overlay `orders.module.css` `rgb(18 22 31/0.56)` durch `var(--scrim)` ersetzen.
- (Claude 26.10., P2) `src/lib/pdf/QuoteDocument.tsx`: Farben aus Token-Werten als Konstanten ableiten; `#182033` ist kein Token (→ `--navy-900 #12161F`).- (Claude 26.10., P2) E04/E05/R02 nach Eintrag der 6 Graph/Azure-Preview-Werte live belegen (echte Mail rein/raus, echte OCR-Antwort) – Screenshot je Schritt.

- (26.10. P2-F, f8fed7ce) Seitenleiste: Einträge als helle Kacheln auf Navy statt V1.1 (Text direkt auf Navy, nur aktiver Eintrag hell). `TargetShell.module.css`.
- (26.10. P2-F, f8fed7ce) Suchfeld und Logo-Feld im Kopf leicht beige getönt statt weiß/neutral wie V1.1.
- (26.10. P2-F, f8fed7ce) „+ Anlegen“ als oranger Schwebeknopf unten rechts; V1.1 hat runden Plus-Knopf im Kopf neben Datum.
- (26.10. P2-F, f8fed7ce) Neuer Eingang Schritt 1: Felder „Firma / Name“ und „Firmenname“ doppelt sichtbar – eines streichen oder je nach Kundentyp zeigen.
- (Claude 26.10., P3) Ablauf: Migration erst nach Push auf gemeinsame Entwicklungs-DB anwenden (P3 20261026200000 remote vor origin).

- (Claude 27.10., UI_V11) Ladezeit am V1.1-SHA neu messen (Login→Der Tag, Plus→Eingang, Neukunde speichern).
- (Claude 27.10., UI_V11) Neuer Eingang Neukunde: Feldreihenfolge wie Prototyp (Name, Straße/PLZ, Ort/Telefon, E-Mail/Wunschtermin).
- (Claude 27.10., UI_V11) Paar-Seite `output/v11-paare` für den Owner erreichbar machen (z. B. als Preview-Artefakt), statt nur lokal.

- 27.10. 08:28 UTC (Q01): „Auftragskarte öffnen“ direkt nach erfolgreicher Buchung zeigt „Auftragskarte nicht verfügbar“ (Codex-Fund, ans Queue-Ende; spätestens Q10 grün).

- 27.10. (Q03): ABGABE_Q03 nennt Produkt-SHA 57592c54, Commit wurde per Amend zu 892eafe8 ersetzt (Migration fehlte im Erstcommit). Kuenftig kein Amend nach Abgabe, SHA aktuell halten.
- 27.10. (Q03-Fund): Advisor meldet 26 Legacy-Tabellen ohne RLS. Owner-/Sicherheitsentscheidung, eigenes Paket nach Q10.

- 27.10. 10:27 UTC (Q04): ABGABE_Q04 nennt Produkt-SHA 0b024bcc, im Branch steht nach Amend 1cb4385d -> SHA-Angabe in Abgaben am Branch-Commit ausrichten. Abgabe sagt invoices=1, Prüfer-Notiz 10:55 sah invoices 2 am Auftrag -> klären, ob Doppelrechnung oder Storno+Neu.
- 27.10. 10:27 UTC (Q05): Zahlungsart wird aus Kunden-Zahlungsbedingung abgeleitet (bar -> abholung, rechnung_* -> rechnung, alles andere -> vorkasse); andere Werte (z. B. Karte/Überweisung) fallen still auf Vorkasse -> Zuordnung prüfen bzw. sichtbar machen.

- 27.10. 13:36 UTC (Q07): updateManagedUser erlaubt einem Verwalter (Meister/Admin), die eigene Rolle oder andere auf `developer` zu setzen; nur Selbst-Deaktivierung ist gesperrt. Owner entscheiden, ob `developer` nur von `developer` vergeben werden darf (systemSettingsPort.ts, Prüfung vor UPDATE).
- 27.10. 13:36 UTC (Q07): Zählung aktive Nutzer/Verwalter läuft ohne Sperre auf alle Zeilen (nur Ziel FOR UPDATE) -> zwei gleichzeitige Deaktivierungen könnten den letzten Verwalter entfernen. Gering, Sperre auf Tenant-Nutzer nachziehen.
- 27.10. 13:36 UTC (Q06b/Q07-Q09): Abgaben nennen Produkt-SHAs (e6b89154, 9ecc67ba, f1a68edf, bcca55f2), Branch-Commits heißen c94f2b53, 05c4ca03, fdacd37a, 5aece709 (Rebase/Amend). SHA-Angabe am Branch-Commit ausrichten.

- 27.10. 17:27 UTC (F0): Werkstatt-Vorlage (`auftraege`) darf jetzt Termin und Inhalt der Auftragskarte bearbeiten (OrderCardAppAdapter editDueDate/editContent = perm_op_status); vorher nur Büro/Meister/Admin. Owner bestätigen.
- 27.10. 17:27 UTC (F0): Rechnungsstorno (immutableInvoiceCommand cancelInvoice) jetzt für jeden mit `geld`, vorher nur Meister/Admin. Owner bestätigen.
- 27.10. 17:27 UTC (F0): createManagedUser/setManagedUserArea prüfen nur `context.canManage` (in settingsContext immer true); Schutz hängt allein an der Action-Prüfung `logins`. Port soll `canManageLogins` prüfen.
- 27.10. 17:27 UTC (F0): 4-stelliger Login-Code mit Auto-Anmeldung; Fehlversuch-Sperre/Drosselung nicht nachgewiesen.

- 27.10. 19:27 (Prüfer, H1): 0e8d432b mit Hook-Ausnahme committet (48/1052 Unit-Tests rot, F0-Rechtestand). Vor Merge PR #154 CI am Kopf grün belegen.
- 27.10. 19:27 (Prüfer, fix(ci) 465482b6): `quality/module-gates-baseline.json` Eintrag `src/app/buchhaltung/rechnungen/page.tsx` entfernt (verschärfend, weil Logik nach InvoicesAppAdapter verschoben). quality ist sonst gesperrt – Owner kurz bestätigen lassen.
- 27.10. 19:27 (Prüfer, LOGIN): E-Mail-Login nur noch Rolle `developer`. DB-Rolle Gregor nicht vom Prüfer gelesen – Owner-Klick Schritt 3 bestätigt es.
- 27.10. 20:27 (Prüfer, F1): „KV gültig bis“ nur in KV-Notiz gespeichert, Terminstatus Wunsch/bestätigt teilt sich das Auftrags-Datumsfeld. Später strukturierte Felder.
- 27.10. 20:27 (Prüfer, F1/F2): Kein CI-/Testnachweis am Kopf 7af94e99 in der Abgabe (nur fokussierte Tests); vor Merge PR #154 CI grün belegen. Uncommitted Settings-Arbeit + src/lib/client/ liegt lokal.
- 27.10. 21:27 (Prüfer, Q13): Sieben verwaiste TEST-Kunden (Kunde ohne Auftrag, Altfehler vor Q13) bleiben in der Dev-DB. Bereinigung nur mit Owner-Freigabe.
- 27.10. 21:27 (Prüfer, H3/Q12/Q13): Abgaben ohne CI-/Vercel-Nachweis am Kopf 2d00386e (Regel 4c). Vor Merge PR #154 CI grün belegen.
- 27.10. 22:27 Berlin (Prüfer, Q6b Rest 69e7ff7c): `communicationPort.canRead/canWrite` hängen jetzt allein an Fläche `mails` (vorher perm_view_customers / perm_data_*). Wer Kundenkarte sieht, aber keine Fläche `mails` hat, sieht keine Kommunikation mehr am Kunden. Mit F0-Rechteplan abgleichen.
- 27.10. 22:27 Berlin (Prüfer, V-F3 a2381463): Backend-Vorarbeit F3 (22:05 Berlin) liegt vor H5 (22:30, „keine Backend-Vorarbeit für F3–F7“). Kein Rückbau nötig, aber ab jetzt keine weitere V-F4…F7 ohne `baureif: true`. `changedAt` der Aufträge = createdAt (nicht Änderungszeit).
- 27.10. 22:27 Berlin (Prüfer, H4/Q6b/V-F3): kein CI-/Vercel-Nachweis am Kopf 807fbd55. Vor Merge PR #154 CI grün belegen.
- 27.10. 23:27 Berlin (Prüfer, Eingang-03 b61ba21a): Werkstatt-Login ohne `geld` wählt Altkunden ohne Zahlungsbedingung -> nur Meldung „Bitte Kunde … vollständig angeben“, kein Feld sichtbar. Fachlich richtig (Büro muss Bedingung setzen), Meldung sollte „Zahlungsbedingung fehlt – Büro“ sagen.
- 27.10. 23:27 Berlin (Prüfer, F0-01/02, Eingang-01..03): kein CI-/Vercel-Nachweis am Kopf b61ba21a. Vor Merge PR #154 CI grün belegen.
- 28.10. 02:27 Berlin (Prüfer, Kunde-02 cc23cf8c): `updateCustomerCommercialCommand.ts` neue Fehlermeldungen mit kaputter Kodierung („verfÃ¼gbar“, „dÃ¼rfen nur … geÃ¤ndert“, „Ã¼ber … Ã¤ndern“) – Nutzer sieht Zeichensalat. Als UTF-8 neu schreiben.
- 28.10. 02:27 Berlin (Prüfer, Kunde-01 f604b114): Migration 20261028010000 ändert Bestandsdaten (`type institution → business`, 0 Zeilen laut Nachweis). Künftig Datenänderungen in Migrationen vorher beim Owner ankündigen.
- 28.10. 02:27 Berlin (Prüfer, Eingang-05 513592eb): Kundensuche nur an Bereich `eingang` gebunden, liefert vollständige Stammdaten inkl. Zahlungsbedingung ohne Kundenansichts-Recht. Mit F0-Rechteplan abgleichen.
- 28.10. 02:27 Berlin (Prüfer, Eingang-04..Tag-03): kein CI-/Vercel-Nachweis am Kopf a962c123. Vor Merge PR #154 CI grün belegen.

- 28.10. 08:28 UTC (F0_04, 1d5c5915): Kürzel jetzt max. 3 Zeichen im Server, DB-Check `app_users_kuerzel_format_chk` und `varchar(8)` erlauben weiter 8. Bestehende Logins mit >3 Zeichen (falls je angelegt) könnten nicht mehr bearbeitet werden, weil `updateManagedUser` das unveränderte Kürzel mitprüft. Später DB-Check angleichen bzw. Bestand prüfen.
