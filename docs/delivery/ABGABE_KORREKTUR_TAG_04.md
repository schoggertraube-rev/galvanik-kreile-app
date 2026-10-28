# Abgabe Korrektur Der Tag 04

## Befund

> „Zuordnen“ öffnet einen leeren Eingang statt Dialog 3.4 mit genau dieser Mail (stellt dabei einen Entwurf wieder her).

Beleg aus dem Bauplan: `src/components/home/RolfHomeClient.tsx:59`; `src/components/layout/GlobalCreateFlow.tsx:631,646–669`.

## Neu gemacht

- Der Tages-Eintrag übergibt beim Klick auf **Zuordnen** jetzt die vorhandene `graphMessageId` zusammen mit dem Mailmodus (`src/components/home/RolfHomeClient.tsx`).
- Der globale Öffnungsvertrag kann diese Nachrichten-ID transportieren (`src/components/layout/globalCreateRequest.ts`).
- Der direkte Mail-Einstieg lädt keinen gespeicherten Eingangsentwurf. Andere Einstiege behalten ihr bisheriges Entwurfsverhalten (`src/components/layout/GlobalCreateFlow.tsx`).
- Dialog 3.4 zeigt bei diesem Einstieg ausschließlich die angeklickte Mail. Ist sie nicht mehr im Postfach verfügbar, erscheint ein ehrlicher Fehler statt einer anderen Mail (`src/components/layout/F1SourceDialogs.tsx`).
- Bestehende Zuordnungswege zu Kunde und Auftrag bleiben unverändert und schreiben weiterhin über denselben serverseitigen Kommunikationsvertrag.

## Datenbank-Nachweis

- Dieses Paket ändert weder Schema noch Migrationen und führt selbst keine Datenmutation aus.
- Erst der Owner-Klick auf **Kunde zuordnen** oder **Auftrag zuordnen** schreibt über den vorhandenen atomaren Vertrag genau einen Thread mit Quelle `MS_GRAPH_IN:<graphMessageId>` und eine eingehende E-Mail in `communication_messages`.
- Ein erneuter Klick auf dieselbe Mail und dasselbe Ziel ist idempotent; ein abweichendes Ziel wird als Konflikt abgewiesen.

## Klickweg für den Owner

Branch-Preview: `https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app` · Rolle Rolf.

1. Auf **Der Tag** bei einer eingehenden Mail **Zuordnen** wählen. Dialog **Mail zuordnen** muss direkt öffnen und ausschließlich diese Mail zeigen; ein gespeicherter Eingangsentwurf darf nicht erscheinen.
2. Einen vorhandenen Kunden oder Auftrag wählen und **Kunde zuordnen** beziehungsweise **Auftrag zuordnen** klicken.
3. Die Meldung **Mail und unterstützte Anhänge sind am Vorgang abgelegt.** muss erscheinen.
4. In der Dev-Datenbank prüfen: `communication_threads.source = 'MS_GRAPH_IN:<ID der angeklickten Mail>'`, genau das gewählte `customer_id` oder `order_id`, und die zugehörige `communication_messages`-Zeile hat `direction = 'incoming'` sowie `channel = 'email'`.

## Prüfergebnis

- Fokussierte reale Render-Tests: **2 Dateien / 32 Tests grün**.
- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der sechs betroffenen Produkt-/Testdateien: **0 Fehler**.
- `npm run quality:module-gates`: **grün**.
- `git diff --check`: **grün**.
- `node scripts/ui/spec-check.mjs --screens=tag,mailein`: **9 erwartet / 5 gefunden / 4 fehlend**. Die beiden vorhandenen Zielaktionen `mailein.kunde-zuordnen` und `mailein.auftrag-zuordnen` sind gebunden; der Einstieg aus **Der Tag** ist durch den fokussierten Render-Test belegt. Die bereits vor diesem Paket fehlenden mittleren Mail-Aktionen `andere-mail`, `nicht-zuordnen`, `spaeter` und `uebernehmen` bleiben getrennte BAUPLAN-Korrekturen; es wurden keine Platzhalter ergänzt.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Fehler-/Erfolgsaktionen des Maildialogs außerhalb dieses schweren Einstiegsbefunds bleiben in ihrem eigenen BAUPLAN-Paket.
- Keine Migration, keine Echtdatenänderung, kein Merge und kein Production-Deploy.
