# Review Korrektur Mail-Eingang 01 + Der Tag 01/02/03 (Prüfer Claude, 28.10.2026 01:27 UTC)

Branch `kreile/s1-p2-eingang`, Commits 80c51dae (Mail-01), 5da5868a (Tag-01), e4b3cc07 (Tag-02), a962c123 (Tag-03). Erste Prüfung.

## Urteil

- **Mail-Eingang-01: PASS.** Eindeutiger Absender-Treffer bleibt Bestandskunde (keine Dublette); doppelte E-Mail → keine automatische Zuordnung. Kein Schema.
- **Tag-01: PASS.** Eine serverseitige Regel (`todayDashboardPolicy.ts`); erledigte Aufträge aus beiden Feldern raus.
- **Tag-02: PASS.** Nur Aktion „Ware raus“ sichtbar (2 Zeilen).
- **Tag-03: PASS.** Je Fall ein Grund + eine Hauptaktion; öffnet nur vorhandenen Auftragspfad, kein zweiter Schreibweg.

Keine Migration, keine Hex-Farben, kein verbotener Pfad. Owner-Klickwege offen.


## ABGABE_KORREKTUR_TAG_05 (K12, d60e8077) und TAG_06 (K13, 1a997d52) – Prüfer 28.10. 12:35 UTC

Umfang: im H8/H9-Rahmen (F2 Der Tag, baureif). Nur src/lib/server/todayDashboard.ts (+51), todayDashboardPolicy.ts (+34), RolfHomeClient.tsx (1 Zeile) + Tests. Keine Migration, keine CSS/Farbe, kein verbotener Pfad, Eingang/Login unberührt.

**TAG_05: PASS.** Geld einfordern nur fällige offene/teilbezahlte Rechnungen (Berliner Datum), offener Restbetrag statt Brutto, Vorkasse offen (inländisch, fertig, ohne Warenausgang) über v_goods_out_ui_state_v1 ergänzt. Rein lesend, nur bei perm_view_prices. Aktionsnamen Erinnern / Zahlung bestätigen, Ziel = bestehender Objektpfad (BAUPLAN-Abgrenzung belegt).
**TAG_06: PASS.** Bündel nur aus Stationen angenommen/wareneingang/eingang/galvanik; Ziel mit surface-Parameter URL-kodiert; ohne bundleSurface keine Aktion (kein Fehlklick, Element trägt sie immer).

Kein Blocker. Hinweis -> DEZEMBER_LISTE (Vorkasse-Auftrag mit überfälliger Rechnung außerhalb Station „fertig“ erscheint in keinem Geld-Eintrag).
Owner-Klick offen (je 6 Schritte in der Abgabe).


## ABGABE_KORREKTUR_TAG_07 (K14) – Prüfung 28.10. 13:37 UTC

Commit e5e52b30 (Kopf origin 21f82ad6). Urteil: **FAIL – 1 Blocker** (erste Prüfung).

Inhalt (Layout je Login, serverseitiger Rechtefilter beim Lesen und Schreiben, Constraint in DB, Lesen ohne Spalte kompatibel über `to_jsonb(preference)->'layout'`) ist in Ordnung. Keine Hex-Farben, kein verbotener Pfad, kein DROP/DELETE.

**Blocker 1 – Datenbank nicht synchron, Speichern geht auf der Preview nicht**
- Datei: `supabase/migrations/20261028115141_f2_today_layout.sql` ist auf origin, aber nicht auf `syhaigjhsbpjmtnggqka` (Remote 57, Repo 58). `src/lib/server/todayDashboard.ts` (`INSERT INTO private.today_preferences (…, layout)`) scheitert dort an fehlender Spalte → „Fertig“ in „Anpassen“ speichert nicht (Owner-Klickweg Schritt 5/6 nicht ausführbar).
- Die Abgabe sagt „keine ausdrückliche Freigabe“. Die Freigabe besteht: `_review/OWNER_ENTSCHEIDUNGEN.md:29` („Ab jetzt je Paket: … dieselbe Migration auf dieses Projekt einspielen, dann Preview prüfen“). Dev-DB ohne echte Daten (Zeile 27).
- Änderung: (a) Datei umbenennen auf einen Zeitstempel **nach** dem bereits angewandten `20261028115500`, z. B. `20261028124100_f2_today_layout.sql` (Inhalt unverändert; sie ist nirgends remote, also keine „alte Migration“). Sonst verweigert `supabase db push` wegen Einfügen vor letzter Remote-Migration. (b) `supabase migration list` vorher, `supabase db push` gegen syhaigjhsbpjmtnggqka, `migration list` nachher. (c) Klickweg Schritt 5/6 auf der Preview mit SQL-Zeile aus `private.today_preferences` (TEST-Login) belegen und in der Abgabe nachtragen. Kein Reset, nichts löschen.

Nicht Blocker (DEZEMBER_LISTE): 26 Tabellen in `public` ohne RLS (Advisor-Fund aus der Abgabe, vorbestehend).


## Prüfung 28.10. 14:30 UTC – KORREKTUR_TAG_08 (K15, b0213fe6) + Nachprüfung TAG_07

### TAG_08 (K15 Rechte nach Bereich): **PASS**

- authorization.ts:29 `hasAuthorizationArea` nutzt bei echten Sitzungen nur `areas` aus app_user_rights (resolveAuthorization setzt `areas` immer; Rollen-Fallback nur bei undefined = Test-Fixtures).
- orderTaskAssignmentCommand.ts:231 Server lehnt ohne `auftraege` ab (FORBIDDEN). today.actions.ts: Erinnerung erfordert `auftraege`, Layout mind. ein Bereich.
- page.tsx: alle Nicht-Admin-Rollen gehen zu HomeAppAdapter; RolfHome.tsx:33 ohne Bereiche -> `no_areas` mit Hinweis, keine Daten geladen. Keine Sackgasse.
- Keine Migration, keine verbotenen Dateien, keine neuen Farbwerte.
- Folgecommits 96fbafb8 (K16 zurückgestellt U-212, Anpassen/Bündeln grau „geplant"), 5b5a3c9b (Erinnerungsfristen Berlin; komponenten.css nur `opacity`), 6ca7ab84 (Login-Fehlerplatz) ohne eigene Abgabe – laut H10 kommt eine Sammelabgabe ABGABE_REPARATUR_ABSCHLUSS.md. Grobsicht: kein Blocker.

### TAG_07 zweite Prüfung (Blocker Migration 20261028115141)

- Nicht behoben: Remote weiter 57, Repo 58; Datei weiter mit Zeitstempel vor 20261028115500.
- Aber: Owner-Entscheid H10 (14:40) verschiebt „Der Tag anpassen" nach Stufe 2; RolfHomeClient.tsx:95 Knopf „Anpassen · geplant" disabled. Die Sackgasse ist damit für Nutzer weg, Datenverlust keiner.
- Urteil: **FAIL bleibt formal (DB nicht synchron), aber kein Korrekturauftrag an Codex** (H10: kein Commit außerhalb K16–K25). Owner/Planungschat entscheidet: Migration jetzt remote anwenden (additiv, ALTER private.today_preferences) **oder** Datei bis Stufe 2 aus dem Repo nehmen (umbenennen auf späteren Zeitstempel bei Wiederaufnahme). Bis dahin keine weitere Schleife darauf.


## H10 K19–K24 (Lauf 28.10. 15:34 UTC) – PASS

Kopf origin/kreile/s1-p2-eingang c049d02c (15:25 UTC). Abgabe = docs/delivery/KORREKTUREN_STAND.md (je K ein Commit, ~11-min-Takt, je eine Runde).
- K19 a43412ec: E-Mail-Login jetzt nach Bereich „wartung“ statt Rolle developer; Bereiche serverseitig aus app_user_rights, unbekannter Bereich -> AUTH_ERROR (fail-closed). Kein Blocker.
- K20 63e73e54: Login-Namen im Rechte-Kopf; Farben var(--gold-100/--gold-600) aus tokens.css. OK.
- K21 cd499e01 / K22 a61c0899 / K23 cbbff229 / K24 c049d02c: Der Tag Sortierung, Zählung, Tasten j/k/Enter, Leer-/Fehlerzustände. Keine Hex-/rgb-Farben, kein verbotener Pfad, keine Migration.
Blocker: keine. TAG_07-Migration 115141 weiter offen (Owner-Entscheid H10, unverändert).
