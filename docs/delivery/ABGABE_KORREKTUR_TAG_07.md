# Abgabe Korrektur Tag 07 — K14

## Befund

> „Anpassen“ ist ein Häkchen-Dialog; gespeichert nur sichtbare Felder; Standard für alle gleich; Server prüft Rechte nicht (U-182).

## Neu gemacht

- `src/components/home/RolfHomeClient.tsx`: „Felder zuordnen“ arbeitet direkt auf „Der Tag“. Erlaubte Felder lassen sich hinzufügen, entfernen, verschieben und am Desktop einer Spalte zuordnen.
- `src/lib/server/todayDashboardPolicy.ts`: vollständiger Layoutvertrag aus Feld, Spalte und Reihenfolge; rollenbezogene Vorschläge für Meister/Büro/Admin, Werkstatt, Developer und Profile ohne Bereiche.
- `src/lib/server/todayDashboard.ts`: gespeichertes Layout wird je Login gelesen, gegen die tatsächlich freigegebenen Bereiche gefiltert und beim Schreiben serverseitig abgelehnt, sobald ein Feld nicht erlaubt ist.
- `supabase/migrations/20261028115141_f2_today_layout.sql`: neue nullable JSONB-Spalte mit Datenbank-Constraint. Bestehende Zeilen bleiben unverändert und verwenden bis zur ersten Speicherung den Rollenvorschlag.
- `src/app/actions/today.actions.ts`: die Server-Action nimmt nur den vollständigen Layoutvertrag entgegen.

## Fundstellen

- Rollen- und Rechtevorlagen: `src/lib/server/todayDashboardPolicy.ts:12`
- Strikte Layoutvalidierung: `src/lib/server/todayDashboardPolicy.ts:32`
- Rechtefilter beim Lesen und Schreiben: `src/lib/server/todayDashboard.ts:49`, `src/lib/server/todayDashboard.ts:170`
- Inline-Bearbeitung und Speichern: `src/components/home/RolfHomeClient.tsx:69`, `src/components/home/RolfHomeClient.tsx:95`
- Persistenzvertrag: `supabase/migrations/20261028115141_f2_today_layout.sql:2`

## Owner-Klickweg (maximal 6 Schritte)

1. Als Rolf anmelden und „Der Tag“ öffnen; der Vorschlag zeigt Handlungsbedarf/Zuordnen links und Heute fällig/Geld einfordern rechts, soweit die Bereiche freigegeben sind.
2. „Anpassen“ wählen; der Bearbeitungsmodus erscheint auf der Seite und nicht als Häkchen-Dialog.
3. Ein erlaubtes Feld hinzufügen oder entfernen, mit „Hoch/Runter“ verschieben und am Desktop mit „Nach links/Nach rechts“ die Spalte ändern.
4. „Vorschlag übernehmen“ wählen; die rollenbezogene Standardanordnung wird wiederhergestellt, aber noch nicht gespeichert.
5. Die gewünschte Anordnung erneut herstellen und „Fertig“ wählen; die Meldung „Der Tag gespeichert“ erscheint. Seite neu laden und prüfen, dass die Anordnung erhalten bleibt.
6. Datenbank-Nachweis: In `private.today_preferences` steht für Rolfs `actor_id` genau eine Zeile; `layout` ist ein JSON-Array mit `action` an Position 0 und je Eintrag genau `field`, `column`, `order`. Keine andere Fachtabelle wird verändert.

## Nachweise

- Fokustests: 22/22 grün.
- TypeScript und gezieltes ESLint: grün.
- `quality:no-fake-production`, `quality:module-gates`, `quality:authority-gate`, `quality:delivery-contracts`: grün.
- `scripts/ui/spec-check.mjs --screens=tag`: `expected=1 found=1 missing=0`.
- Lokale Supabase-Migration, Datenbank-Lint und Security-Advisor auf Fehlerstufe: grün.
- Lokaler Vertragsnachweis: gültiges Action-Layout wird angenommen; ein Layout ohne `action` an Position 0 wird abgelehnt.

## Datenbank-/Preview-Grenze

Die Migration wurde nur in der lokalen Replay-Datenbank angewendet und geprüft. Sie wurde nicht auf die verknüpfte Dev- oder Live-Datenbank ausgerollt, weil dafür keine ausdrückliche Freigabe vorliegt. Lesen bleibt vor der Migration kompatibel; das Speichern des neuen Layouts ist in einer Preview erst nach autorisiertem Ausrollen dieser Migration möglich. Es wurden keine Live-Daten geändert.

## Separater Sicherheitsfund

Der lokale Supabase-Advisor meldet 26 bereits vorhandene Tabellen im Schema `public` ohne aktivierte RLS. Diese Tabellen gehören nicht zu K14. Es wurde keine automatische RLS-Änderung vorgenommen, weil Aktivieren ohne passende Policies den Zugriff sperren kann und H8 keine solche Strukturänderung autorisiert.
