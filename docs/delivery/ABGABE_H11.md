# ABGABE H11 – Eine Rechte-Wahrheit

Stand: 28.10.2026

Branch: `kreile/s1-p2-eingang`

Dev-Datenbank geändert: ja, ausschließlich Migration `20261028163707_h11_align_access_rights.sql`

Production-/Live-Daten geändert: nein

## Umgesetzt

1. Inaktive Logins stehen grau in einem eigenen eingeklappten Bereich. Sie haben keine Spalte in der Rechtematrix; der Server liefert für sie keine wirksamen Bereiche aus und lehnt Rechteänderungen ab.
2. Die Rolle `developer` ist zentral auf Systempflege begrenzt. Gregors Spalte kennzeichnet „Einsicht & Systempflege“, hält Einstellungen, Logins und Wartung fest und sperrt alle sechs Geschäftsbereiche sichtbar mit „Entwickler, keine Geschäftsvorgänge“.
3. Die Meister-Vorlage enthält `logins`. Die additive Migration ergänzt dieses Recht für aktive Meister/Rolf; `wartung` bleibt developer vorbehalten.
4. Die fünf bisher abweichenden Geschäftsbefehle prüfen jetzt denselben Bereichsvertrag wie die Matrix. Der H11-Gate-Test vergleicht für jede aktive Rollenvorlage jeden Matrix-Haken mit `hasAuthorizationArea`; eine Abweichung macht den Test rot.
5. Neue und geänderte Rechte speichern `granted_by` mit der ID des handelnden Logins. Ein Port-Test hält diese Zuordnung fest.

Migration: `supabase/migrations/20261028163707_h11_align_access_rights.sql`. Sie löscht ausschließlich die in H11 genannten Geschäftsrechte von developer-Logins, ergänzt deren feste Systemrechte und fügt `logins` für aktive Meister hinzu.

### Rest a – Dev-Datenbank

- Befund: Die Dev-Datenbank hatte noch die alte Rechtebelegung; Gregor besaß die sechs Geschäftsbereiche, Rolf kein `logins`.
- Fundstelle: `supabase/migrations/20261028163707_h11_align_access_rights.sql:1`.
- Ausgeführt auf dem verknüpften Dev-Projekt `syhaigjhsbpjmtnggqka`; Migration und Migrationshistorie führen Version `20261028163707` als angewendet.
- DB-Soll belegt: Gregor (`developer`, aktiv) hat genau `einstellungen`, `logins`, `wartung`; Rolf (`meister`, aktiv) hat zusätzlich `logins`. Production blieb unangetastet.

### Rest b – Zweite Rechtematrix entfernt

- Befund: `ROLE_PERMISSIONS` hielt eine zweite, von den gespeicherten Bereichen abweichende Liste von `perm_*`-Fähigkeiten vor.
- Fundstelle vor der Bereinigung: `src/lib/auth/authorizationContract.ts:128`, `:191` und `:199`.
- Änderung: `ROLE_PERMISSIONS` und `getPermissionsForRole` sind entfernt. Rollenvalidierung nutzt nur noch die reine Rollenliste `APP_ROLES`; Fähigkeiten entstehen ausschließlich über `getPermissionsForAreas` aus den wirksamen Bereichen.
- DB-Soll: unverändert zu Rest a; dieser Unterpunkt ändert keine Datenbankzeile.
- Prüfung: fokussierte Rechte-/Provider-Tests 34/34 grün; TypeScript, gezieltes ESLint und Spec-Check `expected=5 found=5 missing=0` grün; `rg ROLE_PERMISSIONS|getPermissionsForRole src` ohne Treffer.

## Owner-Klickweg

1. Als Gregor anmelden und **Einstellungen → Logins & Rechte** öffnen.
2. Prüfen: drei aktive Logins stehen oben; **Inaktive Logins** ist grau abgetrennt und enthält keine Matrix-Spalten.
3. In Gregors Spalte prüfen: Geschäftsbereiche sind leer, gesperrt und mit „Entwickler, keine Geschäftsvorgänge“ erklärt; Einstellungen, Logins und Wartung stehen fest.
4. Als Rolf anmelden und dieselbe Seite öffnen; Rolf kann die Rechtematrix bedienen.
5. Bei Phillip einen erlaubten Haken setzen und auf die Meldung **„Recht ist sofort wirksam.“** warten.
6. In der Dev-Datenbank prüfen: Gregor hat kein `geld`, `kassieren` oder `auftraege`; Rolf hat `logins`; Phillips neue Rechte-Zeile hat `granted_by = Rolf-ID`.

## Statische und lokale Prüfung

- `node scripts/ui/spec-check.mjs --screens=rechte,meincode`: `expected=5 found=5 missing=0`.
- Fokussierte H11-Tests: 104/104 grün.
- Lokale Migration: angewendet; `supabase db lint --local --level error`: 0 Fehler.
- Dev-DB H11a: Migration `20261028163707` angewendet und per anschließender SQL-Abfrage gegen `app_users`/`app_user_rights` belegt.
- TypeScript, gezieltes ESLint, Modulgrenzen, No-Fake-Gate und Produktions-Build: grün.
- `lint:full`: 0 Fehler; 8 bereits bestehende Warnungen außerhalb H11.
- Die vollständige serielle Unit-Suite lieferte innerhalb der lokalen 10-Minuten-Grenze keinen Abschlusscode. Die acht H11-betroffenen Dateien liefen separat mit 104/104 Tests grün; der vollständige CI-Lauf bleibt maßgeblich.
