# KREILE VERKAUFSSTUFE 1 — verbindlicher Lieferplan

Status: `OWNER_AUTHORIZED`  
Autorisiert durch: Siglinder, 25.10.2026  
Lieferziel: verkaufbarer, realer Kernweg bis zum ownerfreigegebenen Livegang  
Arbeitsweise: genau ein Writer, ein Branch und ein aktiver Block zur Zeit

## 1. Autorität und Ablösung

Dieser Plan ist ab dem 25.10.2026 der einzige ausführbare Lieferplan.
`docs/delivery/KREILE_LIVE_PLAN_V1.json` und D-GOV-004 bleiben ausschließlich
historischer Nachweis und sind nicht mehr ausführbar. Es gibt keinen parallelen
Live-Plan und keinen Ersatzplan bei Verzug.

Merge nach `main`, Production-Effekte, Remote-Migrationen, Echtdatenänderungen,
kostenpflichtige Dienste und neue Provider bleiben ausdrückliche Owner-Grenzen.
`merge`, `production` und `cost` gelten jeweils als
`OWNER_EXPLICIT_AUTHORITY_ONLY`.

## 2. Arbeitsregeln

- Genau ein Writer und ein Arbeitsbranch zur Zeit. Keine zweite Session und kein
  zweiter Client auf derselben Codex-Datenbank.
- Kein Governance-, Checker- oder Planpaket außerhalb von Schritt 0.
- Fehlt eine fachliche Festlegung, wird die konkrete Stelle mit `In Klärung`
  gekennzeichnet, die übrige Arbeit fortgesetzt und die Abweichung in der
  blockbezogenen Änderungsliste gemeldet.
- Bestehender Code bleibt erhalten, wenn er der gebundenen Vorlage und den realen
  Fachverträgen entspricht. Die sichtbare UI-Shell wird nach Vorlage ersetzt und
  nicht als Alt-Shell umgestylt.
- Keine HTML-Demo-, Mock-, Fake- oder synthetischen Daten im Produktpfad. Leere
  reale Quellen ergeben einen ehrlichen Leerzustand mit einer real verfügbaren
  Primäraktion.
- Jeder Block folgt: Branch → Preview → Änderungsliste → Prüfung → Owner-Merge.
- Ein verfehlter Block kürzt am Folgetag Umfang aus B5, niemals aus dem Kernweg.
  Es wird kein neuer Plan eröffnet.

## 3. Sichtbare Produkt- und Routengrenze

Verkaufsstufe 1 umfasst ausschließlich die sichtbaren Kernziele:

- `/start` — Login
- `/` — rollenrichtiges Home
- `/warendurchlauf` und seine gebundenen Intake-Aktionspfade
- `/orders` und `/orders/[id]`
- `/customers` und `/customers/[id]`
- `/buchhaltung/rechnungen`
- `/settings` für berechtigte Rollen
- `/kalender` erst mit B5 und nur nach realem M365-Zugang

Nicht zu Verkaufsstufe 1 gehörende Produktrouten verschwinden aus der Navigation
und liefern bei direktem Aufruf 404. API-, Auth-, Callback-, Download- und andere
technisch erforderliche Endpunkte sind keine sichtbaren Produktrouten und bleiben
erhalten, soweit der reale Kernweg sie benötigt.

Ausgegraute Anschluss-Stellen sind ausschließlich für die in B4 gebundene Liste
zulässig. Sie dürfen keine Aktion, Route, Erfolgsbehauptung oder Fake-Funktion
auslösen. Die exakte Liste ist derzeit `In Klärung` und wird in
`docs/delivery/AENDERUNGEN_B4.md` vollständig benannt, bevor sie sichtbar wird.

## 4. Schritt 0 — Rebaseline und CI, maximal 2 Stunden

1. Diesen Plan unter `docs/delivery/` binden, `AGENTS.md` Abschnitt 2 und die
   Mission auf diesen Plan umstellen.
2. Die Ursachen der roten Checks `quality` und `ratchet` aus PR #151 gegen den
   aktuellen Main-Stand beheben. Ist das innerhalb von zwei Stunden nicht
   belastbar möglich, wird die Ursache in `AENDERUNGEN_B1.md` festgehalten und
   B1 ohne Checker- oder Governance-Ausweitung fortgesetzt.

## 5. B1 — Shell, Rollen-Home und Navigation

Zeitrahmen: sichtbar innerhalb von 24 Stunden  
Branch: `kreile/b1-shell`  
Geräteumfang nach 24 Stunden: Desktop  
Tablet und Handy: spätestens innerhalb von 48 Stunden

### Ziel

- `/start` ist Login. Erfolgreiche Anmeldung führt auf `/`.
- `/` zeigt rollenrichtig:
  - `werkstatt` → Phillip V4
  - `meister` und `buero` → Rolf V8
  - `admin` → Einstellungen
- Die Rolf-V8-Shell navigiert zu Der Tag, Werkstatt, Aufträge, Kunden,
  Geld & Rechnungen und Einstellungen.
- Homes lesen echte Quellen. Leere Quellen zeigen einen ehrlichen Leerzustand
  mit einer real verfügbaren Primäraktion.
- HTML-Demodaten gelangen nicht in den Produktpfad.
- Alle sichtbaren Nicht-Stufe-1-Ziele verschwinden aus der Navigation; ihre
  Produktrouten liefern bei direktem Aufruf 404.

### Pflichtabgabe nach 24 Stunden — auch bei unvollständigem Stand

`docs/delivery/AENDERUNGEN_B1.md` enthält:

1. Preview-URL und exakten Kandidaten-SHA
2. Testzugänge je Rolle
3. `neu gemacht`: je Zeile Was, Datei oder Route und sichtbarer Ort
4. `weicht von Vorlage ab`: ehrliche Abweichungen, je Zeile
5. `nicht geschafft + warum`
6. CI-Status am exakten SHA

Der PR wird geöffnet, aber nicht gemergt.

## 6. Folgeblöcke

### B2 — 02.11.–08.11.2026

Kunden-CSV-Import, Kundenkarte V2, KV → Auftrag, Foto/Dokument sowie reale
Suche und Filter.

### B3 — 09.11.–15.11.2026

Auftragskarte V8 vollständig, Werkstattdurchlauf bis `fertig`/`abgeholt` und
Mobile-Abnahme.

### B4 — 16.11.–22.11.2026

Rechnung-PDF, Zahlung, Warenausgang/Lieferschein, CSV/DATEV und die ausdrücklich
gebundene Liste passiver ausgegrauter Anschluss-Stellen.

### B5 — 23.11.–29.11.2026

M365-Mail rein/raus, Kalender, OCR-Eingang und Stabilisierung. Externe
Capability-Arbeit beginnt nur, wenn der jeweilige reale Zugang spätestens am
08.11.2026 vorliegt. Andernfalls wird dieser Umfang zuerst gekürzt. Feature-Stopp
ist der 29.11.2026.

### Pilot — 30.11.–06.12.2026

Pilot mit benannten Kreile-Nutzern. Ab Feature-Stopp werden ausschließlich
belegte Fehler korrigiert. Ein Livegang erfolgt nur nach gesonderter ausdrücklicher
Owner-Freigabe und den gebundenen Sicherheits-, Smoke- und Rückfallnachweisen.
