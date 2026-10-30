# Abgabe Q06b · M365/Azure live

Status: **BLOCKED_EXTERNAL_PERMISSION** für Microsoft Graph; Azure Document Intelligence **PASS**. Gemäß Warteschlangen-Ausnahme geht die Arbeit mit Q7 weiter.

Branch: `kreile/s1-p2-eingang`

Geprüfter Produkt-SHA: `e6b891543a78cb22edb719bc31ba4c28b98eb980`

Preview: <https://galvanik-kreile-werkstatt-eqlmxemhf.vercel.app>

Vercel-Deployment: `dpl_2GuSMSoz9c8fbnm3yfHm8MoQWtyT` · Ready · Funktionen `fra1`

## Geändert

- Microsoft-Graph-Fehler werden serverseitig auf HTTP-Status und Provider-Code begrenzt. Beschreibungen, IDs und Zugangswerte gelangen nicht in die Oberfläche.
- Der echte Preview-Aufruf zeigt damit den exakten wertfreien Anmeldefehler `GRAPH_TOKEN_401_invalid_client`.
- Der erforderliche Owner-Schritt steht in `docs/delivery/OWNER_TODO.md`.

## Echter Preview-Durchlauf

1. Als Rolf angemeldet und Kundenkarte `TEST Q4 Durchlauf 202610270956` geöffnet.
2. Microsoft 365 wurde als konfiguriert erkannt; der Posteingangsaufruf endete am Token-Endpunkt mit `GRAPH_TOKEN_401_invalid_client`.
3. Deshalb wurden weder Mail zugeordnet noch Versand behauptet. SQL: `communication_messages = 0`.
4. Ein eindeutig als `TEST Q6b Anfrage` gekennzeichnetes Bild wurde über dieselbe Kundenkarte hochgeladen und mit Azure Document Intelligence ausgelesen.
5. Sichtbare Vorschläge: Kunde, Ansprechpartner, Leistung, Menge, Material und Oberfläche.

## SQL-Nachweis

```text
scan_uploads.id=3e481615-165c-467e-9cc7-54ab6113577e
status=ocr_review
ocr_provider=azure_document_intelligence
suggestion_count=6
linked_customer_id=f910ad55-3ed3-4287-89f4-53b010147745
communication_messages=0
```

## Screenshot

- [Preview · exakter Graph-Anmeldefehler](../evidence/queue/Q06B_GRAPH_FEHLER.png)

## Checks

- Microsoft-Graph-Port: 6/6 gezielte Tests PASS.
- GitHub `agentur-gate`: PASS am Produkt-SHA.
- Vercel: PASS / Ready am Produkt-SHA.
- TypeScript-Lauf lokal nach 34 Sekunden ohne Ausgabe zeitbegrenzt; das GitHub-Gate am Produkt-SHA ist anschließend grün durchgelaufen.

## Owner-Abnahme (5 Minuten)

1. In Vercel Preview das Client Secret der bereits konfigurierten Entra-Anwendung korrigieren oder neu ausstellen; danach die Preview neu deployen. Erwartung: `GRAPH_TOKEN_401_invalid_client` erscheint nicht mehr.
2. Preview als Rolf öffnen → Kunden & Kontakt → `TEST Q4 Durchlauf 202610270956`. Erwartung: Unter „Microsoft 365“ erscheinen Outlook-Mails statt „Nicht verfügbar“.
3. Eine Testmail am Vorgang ablegen. Erwartung: Erfolgsmeldung und anschließend mindestens eine Zeile in `communication_messages`.
