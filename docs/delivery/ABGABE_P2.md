# Abgabe P2 – Owner-Korrektur Abschnitt F

Stand: 26.10.2026, 21:12 Uhr (Europe/Berlin)

## Kandidat

- Branch: `kreile/s1-p2-eingang`
- Exakter geprüfter Produkt-SHA: `f8fed7cee7130c9ce8a3879adac28af1163888c7`
- Preview: <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>
- Pull Request: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154> (Draft, nicht gemergt)
- Vercel: erfolgreich für den exakten SHA; Preview Functions in Region `fra1`
- GitHub: `agentur-gate`, Vercel und Vercel Preview Comments grün
- Datenbank: Entwicklungsprojekt `syhaigjhsbpjmtnggqka`; lokale und verknüpfte Remote-Migrationshistorie bis `20261026194956` gleich. Keine Änderung an der Live-Datenbank.

## Abschnitt F – sichtbar korrigiert

1. Die sichtbaren Grundfarben kommen jetzt einmal zentral aus `src/styles/tokens.css`: `ground #F4F2EE`, `surface #FFFFFF`, `line #E4E0D8`, `rand #D5D0C7`, `flaeche #F7F6F3`. Die beiden alten Mock-Shell-CSS-Dateien besitzen diese Werte nicht mehr. Größen und Dichte bleiben gemäß V8.
2. `+ Anlegen` und `Neuer Eingang` öffnen denselben dreistufigen Ablauf: Kunde und Vereinbarung → Positionen → Prüfung und Belege. Es gibt keinen vorgeschalteten Auswahldialog mehr. Offene KVs bleiben über Aufträge und Suche erreichbar.
3. Neukunde startet mit leeren Kundendaten. Das Speichern verwendet den bestehenden echten Schreibweg, bestätigt das Ergebnis per Readback und kann einen unklaren Transportausgang mit derselben Anfragekennung sicher prüfen beziehungsweise wiederholen.
4. Die zuvor fehlende sichtbare Formatierung der Schritt- und Kundenauswahl ist ergänzt; aktive Auswahl, Rand, Fläche und Oberfläche verwenden ausschließlich die zentralen V1.1-Tokens.
5. Der bestehende Datenbankvertrag für `CUSTOMER_CREATED_V1` akzeptiert das bereits vom P1b-Schreibweg erzeugte optionale Feld `completeForOrder`. Die Migration `20261026194956_allow_customer_created_completeness_flag.sql` wurde zuerst vollständig lokal replayt und danach genau auf das freigegebene Entwicklungsprojekt angewendet.

## Sichtvergleich gegen V1.1

| Preview am exakten SHA | Gebundene V1.1-Referenz |
|---|---|
| [Der Tag, 1914×917](../../output/playwright/p2-f8fed7ce-der-tag-1914x917.png) | [Rolf Desktop, 1914×917](../project/linie/ui/designsystem_v1_1/_pruefbilder/v11_rolf_desktop_1914x917.png) |
| [Neuer Eingang, 1914×917](../../output/playwright/p2-f8fed7ce-neuer-eingang-1914x917.png) | [Neuer Eingang, V1.1](../project/linie/ui/designsystem_v1_1/_pruefbilder/v11_rolf_tablet_neuer_eingang_eine_seite.png) |

Die Preview zeigt echte Entwicklungsdaten und deshalb bewusst nicht die Demodaten des Prototyps. Die neutrale Grundfläche, weißen Oberflächen, Linien, segmentierten Schritte und Größenhierarchie entsprechen der freigegebenen Kombination V1.1/V8.

Berechnete Farben im Preview:

- `body`: `rgb(244, 242, 238)` (`#F4F2EE`)
- Hauptfläche: `rgb(244, 242, 238)` (`#F4F2EE`)
- `--surface`: `#FFFFFF`
- `--line`: `#E4E0D8`
- `--rand`: `#D5D0C7`
- `--flaeche`: `#F7F6F3`

## Warmmessung als Rolf

| Nutzerschritt | Messwert | Ziel |
|---|---:|---:|
| Login absenden → Der Tag sichtbar | 922 ms | < 1.000 ms |
| `+ Anlegen` → Dialog sichtbar | 45 ms | < 1.000 ms |
| Neukunde speichern → Position 1 sichtbar | 884 ms | < 1.000 ms |

Für die Speichermessung wurde genau ein vollständig ausgefüllter Abnahmekunde im Entwicklungsprojekt angelegt; es entstand kein Auftrag. Es wurden keine Testnutzer angelegt und keine Live-Daten verändert.

## P2-Umfang

| ID | Stand | Sichtbar / Nachweis |
|---|---|---|
| S04 Stufen-Schalter | gebaut | `/settings` → „Stufen-Schalter“; Stufe 1 an, Stufen 2–4 aus |
| A07 Angebot/KV | gebaut | echter Leistungskatalog, gespeicherter KV, PDF, Zuschlag mit bestätigtem Liefertermin |
| E03 Foto/Dokument | gebaut | private Ablage, sicherer Download, ehrliche Leer- und Fehlerzustände |
| E04 Dokument lesen | gebaut, Zugang offen | Vorschläge mit Seite, Polygon und Sicherheit; ohne Azure-Zugang „In Klärung“ |
| E05 Outlook-Mail rein | gebaut, Zugang offen | Mail und unterstützte Anhänge am Vorgang; ohne Graph-Zugang „In Klärung“ |
| R02 Mail raus | gebaut, Zugang offen | Empfänger aus Kundendaten, optional echtes KV-PDF; kein stiller Doppelversand |
| A08 Anbieter-Register | gebaut | Kunden, Aufträge, Angebote, Rechnungen, Dokumente, Mails und Termine registriert |

## Prüfung am Kandidaten-SHA

- Gezielter Real-Render-Test des Anlegewegs: 13/13 grün.
- TypeScript am unmittelbar vorherigen, funktional identischen Korrekturstand: grün; letzter Commit ändert nur CSS.
- `git diff --check`: grün.
- Geschützter Browsernachweis als Rolf auf der Vercel-Preview: Der Tag, direkter Dialog, leere Neukundenfelder, sichtbare drei Schritte und sichtbare Kundenauswahl funktionieren.
- Screenshots haben jeweils exakt 1914×917 Pixel und wurden nach Neuladen des finalen Deployments aufgenommen.
- PR #154 bleibt Draft. Kein Merge nach `main`, kein Production-Deployment und kein P3-Push.

## Ehrliche Abweichungen und offene Voraussetzungen

- Microsoft Graph und Azure sind fail-closed angebunden, aber ohne reale Providerwerte nicht als echter Versand, Inbox oder OCR-Erfolg belegt. Der sichtbare Zustand bleibt „In Klärung“.
- In der geschützten Vercel-Preview kann der Service Worker wegen des vorgelagerten Auth-Redirects nicht registriert werden. Der geprüfte Desktop-Kernweg funktioniert; Offline/PWA ist damit in dieser geschützten Preview nicht belegt.
- Die Supabase-Prüfung meldet 26 bereits bestehende öffentliche Legacy-Tabellen ohne RLS. Abschnitt F hat diese Altstruktur nicht verändert; sie bleibt als Sicherheitsbefund offen und wird nicht still erweitert.
- Rechnung und Lieferschein werden erst mit den kanonischen P4-Dokumenten als Mailanhang angeboten.
- Die nicht von Codex stammende Änderung an `_review/DEZEMBER_LISTE.md` blieb ungestaged und unverändert.

## Owner-Abnahme in höchstens fünf Schritten

1. Preview als Rolf öffnen und anmelden. Erwartet: `Der Tag` auf neutralem `#F4F2EE`, weiße Karten und die reale Tageslage.
2. `+ Anlegen` wählen. Erwartet: sofort `Neuer Eingang`, Schritt `1/3`, segmentierte Schritte und leere Neukundenfelder – kein Auswahl-Zwischenschritt.
3. Dialog schließen und links `Neuer Eingang` wählen. Erwartet: exakt derselbe dreistufige Ablauf.
4. Einen eindeutig benannten Neukunden vollständig ausfüllen und `Weiter zu Positionen` wählen. Erwartet: in unter einer Sekunde erscheint `Position 1`; kein Auftrag wird dadurch bereits erzeugt.
5. Dialog schließen und über Aufträge beziehungsweise Suche einen offenen KV aufrufen. Erwartet: Offene KVs sind dort erreichbar, aber nicht als zweiter Anlegeweg.

## Ergebnis

Abschnitt F ist auf dem exakten Preview-SHA sichtbar umgesetzt und die vorgeschriebenen Warmmessungen liegen jeweils unter einer Sekunde. P3 bleibt bis zur Owner-Abnahme und zum Merge von PR #154 angehalten.
