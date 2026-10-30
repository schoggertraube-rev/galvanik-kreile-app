# Abgabe Oberfläche V1.1

Stand: 27.10.2026, Abschnitt I/J aus `_review/AKTUELLE_ANWEISUNG.md`

## Kandidat

- Branch: `kreile/s1-p2-eingang`
- Exakter geprüfter Produkt-SHA: `263aa72b282a51d8e9b5bc04421acc47554f5ab6`
- Preview: <https://galvanik-kreile-werkstatt-csquq7hyq.vercel.app>
- Vercel-Deployment: `dpl_95C2zWtu8Kkd8QuCvdDMQy5qo7jH`, Status `READY`, Functions-Region `fra1`
- Pull Request: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154> (Draft, nicht gemergt)
- CI am Produkt-SHA: `agentur-gate`, Vercel und Vercel Preview Comments grün
- [Lokale Paar-Seite](../../output/v11-paare/index.html): 33/33 App-/Prototyp-Paare, 0 ausgelassen; erzeugt gegen exakt die oben genannte Preview

Die Paar-Seite ist ein generiertes, durch `/output/` bewusst von Git ausgeschlossenes Prüfartefakt. Sie liegt im kanonischen Checkout, wird aber nicht als Produktdatei oder öffentlich gehostete Seite ausgegeben.

## Erledigte Bildschirme

| Reihenfolge | Bildschirm | Stand | Produktcommit |
|---:|---|---|---|
| 1 | Shell + Globales Plus | gebaut; V1.1-Shell und ein gemeinsamer Eingang | `fa45f432` |
| 2 | Neuer Eingang | gebaut; Desktop/Tablet als Seite, Handy in drei Schritten; drei gebundene Zustände | `52d499db` |
| 3 | Der Tag | gebaut; echte Tagesdaten, ehrliche Leer- und Fehlerzustände | `66c8ab3c` |
| 4 | Auftragskarte | gebaut; V1.1-Seitenblatt mit Schnellaktionen, Teilbearbeitung, Teilanlage und bearbeitbarer Notiz auf den bestehenden Rechte- und Schreibwegen | `b083476b`, Korrektur `8f883513`, Modulnaht `263aa72b` |
| 5 | Werkstatt | gebaut; V1.1-Komposition mit echten Aufträgen | `118ee680` |
| 6 | Aufträge | gebaut; V1.1-Liste, Woche und Monat an echte Ansicht gebunden | `1a8c5c79` |
| 7 | Kunden und Kundenkarte | gebaut; reale Kontaktdaten, aktive Auftragszahlen und Aktionen | `d8ab263f`, Korrektur `417438c6` |
| 8 | Befehlspalette | gebaut; reale Suche und erlaubte Aktionen | `d506f47e` |

Alle genannten Ansichten verwenden die nach `src/ui/kr/` übertragenen V1.1-Bauteile. Die vorhandene Fachlogik, Rechte und Schreibwege wurden angeschlossen; Prototyp-Demodaten wurden nicht in Produktpfade übernommen.

## Bildnachweis

Die Paar-Seite enthält für 1914×917, 1220×880 und 390×844 jeweils:

- Shell + Plus
- Neuer Eingang: frisch geöffnet
- Neuer Eingang: Neukunde gewählt
- Neuer Eingang: bestehender Kunde mit Lücke
- Der Tag
- Auftragskarte
- Werkstatt
- Aufträge
- Kunden
- Kundenkarte
- Befehlspalette

Der letzte vollständige Lauf gegen die oben gebundene Preview endete mit `pairs: 33` und `skipped: 0`. Die Auftragskarte zeigt in allen drei Größen die Schnellaktionen, die Teilaktionen, `Teil hinzufügen` und die bearbeitbare Notiz.

## Prüfung

- GitHub-CI am Produkt-SHA: 134/134 Testdateien und 1049/1049 Tests grün; TypeScript, Mojibake- und Delivery-Checks ebenfalls grün.
- Gezielt lokal geprüft: 63/63 Modulnaht-Tests, `quality:module-gates`, TypeScript und ESLint grün.
- Vercel-Preview am exakten Produkt-SHA: `Ready` in `fra1`.
- GitHub-Checks am exakten Produkt-SHA: vollständig grün.
- Geschützter Preview-Klickweg und Bildpaarlauf: 33/33, ohne ausgelassenen Zustand.
- Keine Testnutzer angelegt und keine Datenzeile in der Live-Datenbank verändert.

## Abweichungen

- Die App zeigt reale Entwicklungsdaten oder ehrliche Leerzustände. Statische Namen, Treffer und Kennzahlen des V1.1-Prototyps wurden nicht kopiert.
- Die leere Befehlspalette zeigt nur wirklich erlaubte Aktionen. Reale Suchtreffer erscheinen ab zwei Zeichen; die statischen Demo-Treffer des Prototyps fehlen absichtlich.
- Die Paar-Seite ist lokal generiert und nicht öffentlich gehostet. Die zugehörige App-Preview ist dagegen exakt und erreichbar.
- Einstellungen besitzen keine eigene V1.1-Referenzansicht; sie bleiben gemäß Abschnitt I innerhalb derselben Bauteil- und Tokenlinie, waren aber kein eigener Bildschirm der vorgeschriebenen Reihenfolge.

## Ladezeit

Die zuletzt gebundene Warmmessung des unveränderten Kernwegs aus P2 ergab Login → Der Tag 922 ms, Plus → Eingang 45 ms und Neukunde speichern → Position 1 884 ms. Abschnitt I hat danach die Oberfläche ausgetauscht; eine neue belastbare Nutzerzeitmessung am aktuellen SHA wurde nicht durchgeführt. Deshalb werden die P2-Werte hier nur als letzte Referenz und nicht als neuer Messclaim geführt.

## Datenbank = Repo

Nein, offen ausgewiesen: `supabase migration list --linked` zeigt alle Migrationen dieses P2-Zweigs bis `20261027003617` lokal und remote gleich, zusätzlich aber remote `20261026200000` ohne lokale Entsprechung. Das ist die bereits remote angewandte P3-Migration; sie bleibt bis zum Owner-Merge von PR #154 außerhalb dieses P2-Zweigs. Im UI-Paket wurde keine Migration ausgeführt und keine Datenzeile verändert.

## Owner-Abnahme (5 Minuten)

1. Preview als Rolf öffnen. Erwartet: `Der Tag` in der V1.1-Shell mit neutraler Fläche, weißen Karten und Globalem Plus.
2. Globales Plus und danach `Neuer Eingang` in der Seitenleiste öffnen. Erwartet: beide öffnen denselben Eingang; Desktop/Tablet als gegliederte Seite, Handy als Drei-Schritt-Fluss.
3. Einen vorhandenen Auftrag über `Aufträge` und `Werkstatt` öffnen. Erwartet: V1.1-Liste und Auftragskarte mit `Status-Mail`, `Anrufen`, `Foto`, `Mehr`, den drei Teilaktionen, `Teil hinzufügen` und bearbeitbarer Notiz; alles nur gemäß den realen Rechten verfügbar.
4. `Kunden` öffnen und Sabrina Schmidt wählen. Erwartet: echte aktive Auftragszahl in der Liste und V1.1-Kundenkarte mit Kontakt und Schnellaktionen.
5. Die Kopfsuche öffnen und mindestens zwei Zeichen eingeben. Erwartet: V1.1-Befehlspalette mit erlaubten Aktionen und realen Treffern; keine statischen Demo-Treffer.

## Nächster Schritt

Owner prüft den exakten Produkt-SHA und merged ausschließlich bei Freigabe PR #154. P3 bleibt bis zu diesem Merge lokal und wird vorher weder gepusht noch als eigener PR geöffnet.
