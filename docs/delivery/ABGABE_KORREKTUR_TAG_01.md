# Abgabe Korrektur Der Tag 01

## Befund

> Erledigte/abgeholte/überfällige Aufträge landen in „Heute fällig“ (kein Statusfilter, dueDate <= heute).

Beleg aus dem Bauplan: `src/lib/server/todayDashboard.ts:92–97`.

## Neu gemacht

- Die Zuordnung eines Auftrags zu „Heute fällig“, „Handlungsbedarf“ oder keinem Tagesfeld liegt jetzt in einer einzigen serverseitigen Regel (`src/lib/server/todayDashboardPolicy.ts:10`).
- „Heute fällig“ enthält nur noch Aufträge mit Liefertermin **genau heute**, die bereits als `fertig` gemeldet sind und keinen Risiko-/Konfliktfall haben.
- Nicht fertige Aufträge mit Termin heute sowie überfällige oder riskante Aufträge gehen in „Handlungsbedarf“ statt in „Heute fällig“.
- Abgeholte, versendete, herausgegebene, stornierte und anderweitig erledigte Aufträge werden aus beiden Tagesfeldern ausgeschlossen (`src/lib/server/todayDashboardPolicy.ts:1`, `:13`).
- Das bestehende reale Server-Readmodel bleibt die einzige Quelle; die Anzeige verwendet die neue Regel unmittelbar beim Aufbau der Tagesliste (`src/lib/server/todayDashboard.ts:93`).
- Der fokussierte Test belegt fertige/nicht fertige Aufträge heute, überfällige und riskante Aufträge, alle Abschlusszustände sowie einen gesunden Auftrag in der Zukunft (`src/lib/server/__tests__/todayDashboard.test.ts:16`).

## Datenbank-Nachweis

- Dieses Paket ändert kein Schema und keine Daten.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: lokale und entfernte Migrationen bleiben bis einschließlich `20261028014500` identisch.
- Die Owner-Prüfung vergleicht die sichtbaren Tagesfelder direkt mit `orders.station`, `orders.status` und dem Liefertermin der Dev-Datenbank; es gibt keinen Client-Fallback und keine Demodaten.

## Klickweg für den Owner

Branch-Preview: `https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app` · Rolle Rolf.

1. **Der Tag** öffnen. Im Feld **Heute fällig** dürfen ausschließlich Aufträge stehen, deren Liefertermin heute ist und deren Station/Status `fertig` ist.
2. Einen nicht fertigen Auftrag mit Termin heute oder einen überfälligen offenen Auftrag suchen. Er muss unter **Handlungsbedarf** erscheinen und darf nicht in **Heute fällig** stehen.
3. Einen Auftrag mit Station/Status `abgeholt`, `versendet`, `raus`, `storniert` oder erledigt gegenprüfen. Er darf in keinem der beiden Tagesfelder erscheinen.
4. Datenbank prüfen: Die Menge und IDs in **Heute fällig** entsprechen exakt den offenen Zeilen mit Liefertermin heute und Station/Status `fertig`; überfällige offene Zeilen stehen ausschließlich im Handlungsbedarf, Abschlusszustände in keinem der beiden Blöcke.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der drei betroffenen Server-/Testdateien: **0 Fehler**.
- Fokussierte Regelprüfung: **1 Datei / 3 Tests grün**.
- `node scripts/ui/spec-check.mjs --screens=tag`: **1 erwartet / 1 gefunden / 0 fehlend**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Dieses Paket behebt ausschließlich den ersten schweren F2-Daten-/Filterbefund. Der Knopf „Ware raus“, die vollständige Fallbegründung im Handlungsbedarf und der Mail-Einstieg „Zuordnen“ bleiben die getrennten folgenden BAUPLAN-Korrekturen.
- Keine Migration, keine Datenänderung, kein Merge und kein Production-Deploy.
