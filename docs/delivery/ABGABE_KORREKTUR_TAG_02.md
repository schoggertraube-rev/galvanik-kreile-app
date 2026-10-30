# Abgabe Korrektur Der Tag 02

## Befund

> „Heute fällig“ hat nur „Auftrag öffnen“ statt der Handlung nach Status.

Beleg aus dem Bauplan: `src/components/home/RolfHomeClient.tsx:59–64`.

## Neu gemacht

- Für einen Auftrags-Eintrag im Feld `today` wird die Hauptaktion jetzt als **„Ware raus“** abgeleitet; andere Auftragsfälle behalten **„Auftrag öffnen“** (`src/components/home/RolfHomeClient.tsx:60`).
- Der Klick verwendet weiterhin die bestehende, objektgebundene Auftrags-Ebene und übergibt genau die `orderId`. Das entspricht `verhalten_appweit.ziele_bestand`, solange der neue Ziel-Dialog `rauspruefen` mit F3/F4 noch gesperrt ist.
- Der reale Render-Test prüft den sichtbaren Knopf „Ware raus“ und belegt, dass er die bestehende Auftrags-Ebene mit genau dem heute fälligen Auftrag öffnet (`src/components/home/__tests__/RolfHome.realRender.test.tsx:57`, `:66`).

## Datenbank-Nachweis

- Dieses Paket ändert weder Schema noch Daten.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: lokale und entfernte Migrationen bleiben bis einschließlich `20261028014500` identisch.
- Das Öffnen der Hauptaktion erzeugt noch keinen Warenausgang. Eine Datenzeile entsteht erst nach der ausdrücklichen Bestätigung im vorhandenen Auftragsweg; dadurch gibt es keinen stillen Schreibvorgang.

## Klickweg für den Owner

Branch-Preview: `https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app` · Rolle Rolf.

1. **Der Tag → Heute fällig** öffnen. Bei jedem dort gezeigten fertigen Auftrag muss der primäre Knopf **Ware raus** heißen; **Auftrag öffnen** darf dort nicht die Hauptaktion sein.
2. Bei einem Eintrag **Ware raus** wählen. Es muss die vorhandene Auftrags-Ebene genau dieses Auftrags öffnen, nicht eine allgemeine Liste oder ein anderer Auftrag.
3. Die Ebene ohne Bestätigung schließen. In der Datenbank darf für den Auftrag dadurch weder ein Warenausgangsereignis entstehen noch Station/Status wechseln.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der beiden betroffenen UI-/Testdateien: **0 Fehler**.
- Gezielter realer Render-Test: **1 Datei / 9 Tests grün**.
- `node scripts/ui/spec-check.mjs --screens=tag`: **1 erwartet / 1 gefunden / 0 fehlend**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Der neue Ziel-Dialog `rauspruefen` gehört laut BAUPLAN zu F3/F4 und bleibt bis zu deren Baureife gesperrt. Dieses Paket verwendet deshalb ausdrücklich den vorhandenen Auftragsweg mit demselben Objekt.
- Handlungsbedarfs-Gründe/-Aktionen und der Mail-Einstieg „Zuordnen“ bleiben die nächsten getrennten F2-Korrekturen.
- Keine Migration, keine Datenänderung, kein Merge und kein Production-Deploy.
