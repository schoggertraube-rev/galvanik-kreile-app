# Meldungen des Endversion-Chats an Planungschat und Codex

Laufendes Protokoll (neueste oben). Der Endversion-Chat pflegt spec.json und erzeugt daraus `docs/project/endversion/codex/BAUPLAN.json`. Er schreibt nicht in den App-Code.

## 05.11. 15:30 · Endversion → PL · AP-ABS bereit · Paketfolge vollständig · V43 · spec b6132498f47a

Stand: spec **b6132498f47a** · Bauplan `codex/BAUPLAN.next.json` 9491009f79e3 (neuer Abschnitt „AP-ABS Absprachen“, bau-frei, Gegenprüfung ok) · css 338AEEE0 · Sichtvertrag 0E1049FD · pruefe_sicht.cjs cdec8b69b6c4 (unverändert) · routen.beispiel.json 1f6a8c3a2c05. Archiv V43. Keine AP-EIN-Seite geändert (Regel 0.2).

**(a) Status**
- AP-ABS (Prüfbericht Nr. 1–2): bestätigt, vollständig nach 0.3 → bitte als P-Eintrag an Codex.
- Paketfolge: AP-KV, Picker, Der Tag R36, 8.11, AP-PROT, AP-OCR, AP-DK „vorgemerkt“ (Kern, Seiten, Abhängigkeit, Reihenfolge); AP-MSG/AP-KOST Stufe 4, nur Anforderung. K3 (Mehrarbeit-Satz festschreiben) liegt in AP-KV.
- Vorschau „Was ist neu?“: Zahl ≠ Liste behoben (nur Vorschau, nicht für Codex).

**(b) Lösung im Kontext** (eine Quelle: `baustand.paket_folge.AP-ABS`)
- Neue Seite 5.4 „Absprache festlegen“ (Dialog, Recht geld): Typ (Übergabe ohne Zahlung · Rechnung folgt / Sammelrechnung monatlich / Zahlungsziel in Tagen), Geltung (ganzer Kunde / nur Auftrag), Tage (Zahlungsziel und Sammelrechnung), gilt bis, Grund. Modi `aendern` (neue Zeile, alte widerrufen) und `widerruf` (Grund Pflicht). Tor nur „Typ wählen“.
- Wirkung 10.1 (`eingriffe.rauspruefen`): nur typisierte, gültige Absprache wirkt; Auftrag vor Kunde. Sammelrechnung → „Übergeben · Sammelrechnung {monat}“ ohne Einzelrechnung; sonst „Übergeben · Rechnung folgt“ (erzeugt Rechnung) bzw. „… · Ziel {tage} Tage“. Bar/Karte bleiben Hauptwege bei „Bar oder Karte bei Abholung“. Versand: gleiche Kennungen, Text „Versendet · …“. Ohne Absprache „Zahlung fehlt“ + „Absprache festlegen“ (Recht geld).
- Freitext (5.2 „Absprachen & Eigenheiten“, geld = true ohne Typ) hebt nie eine Sperre auf – Runde-48-Erkennung abgelöst. Keine automatische Typisierung von Altbeständen; 5.1 bietet „Typ festlegen“.
- Sammelrechnung: Liste je Kunde+Monat (Warenausgang, Europe/Berlin), ziel_tage an der Liste festgeschrieben; Der Tag ab 1. des Folgemonats „Sammelrechnung {kunde} {monat} erstellen · {n} Aufträge“ → 7.1 Entwurf; abgerechnet beim Festschreiben.
- Datenmodell additiv: customer_agreements + typ, order_id, ziel_tage, widerrufen_am/_von, grund, widerruf_grund, version, client_key; neu invoice_collections, invoice_collection_orders. RLS, Prüfreihenfolge Recht → Version → Felder, Fehlertexte je Code.
- Einstiege: 5.1 Fuß „Zahlungsabsprache festlegen“ + Geld-Bereich (Ändern/Widerrufen/Frühere/Typ festlegen), 4.1 Geld-Bereich, 10.1, Der Tag – mit Kennungen.
- **Unverändert:** alle AP-EIN-Seiten inkl. 5.2; Runde 48 „Zahlung fehlt“-Weg; Runde 52 Bar/Karte-Hauptwege; Rechte geld/auftraege.

**(c) Belegwege**
- Testfälle `testmodell.seiten.absprache` ABS-01 … ABS-20: Leer/Tor, Speichern + Rückkehr, Feldfehler (Tage, Datum, Grund), Rechte Oberfläche + Server (FORBIDDEN), Widerruf, Ändern/Ersetzen, Vorrang, Knopf je Typ, Freitext, Ablauf, Rückkehr aus 10.1, Server-Recheck nach Widerruf (neuer Schritt `db_setzen`), Sammelrechnung erstellen/festschreiben, Versand. Neue Konventionen: Schritte `befehl`, `db_setzen`; Platzhalter `{monat:±n}`, `|TT.MM.JJJJ`.
- Sichtvertrag + Prüfbilder: absprache (leer), absprache@beispiel, #aendern, #widerruf je Desktop/Tablet/Handy (12 neu, gesamt 162).
- Gegenprüfung (unabhängiger Agent, nur Bauplan-Auszug): Runde 1 – 5 blockierend, Runde 2 – 2 blockierend, alle geschlossen.
- Gates grün: Was-ist-neu, Stand, Referenz, UI 162, Seiten 62×2 (neu: Was-ist-neu-Zahl = Liste), Selbsttest 162/162, Musterdaten, Klick 1385 (1 Ledger: A-2026-0105 Knopftext), Floskel, Baureife 6 Abschnitte.

**(d) Owner-Entscheidungen**
- Owner-Haken 5.4 auf Owner-Auftrag 05.11. gesetzt (meta.owner_haken.protokoll) – nur widersprechen, falls nicht gewollt.

Nächstes Paket: AP-KV (vollständige Lieferung, sobald AP-ABS gebunden ist).

## 05.11. 13:20 · Endversion → PL · Runde 53 · eine SHA · V42 · spec 3de0a1d995b8

Stand: spec **3de0a1d995b8** · Bauplan `codex/BAUPLAN.next.json` 5563ab711253 · css E934666E · Sichtvertrag CDBAED07 · pruefe_sicht.cjs cdec8b69b6c4 · routen.beispiel.json 0de6c84db45b. Archiv V42. Nur AP-EIN-Inhalte aus Auftrag Abschnitt 0.2 (U-241, U-242, Nr. 7); sonst nichts geändert.

**(a) Status**
- U-241 „Was ist das?“: bestätigt, umgesetzt.
- U-242 konkrete Texte: bestätigt, umgesetzt (48 Einträge Änderungsliste).
- Nr. 7 Erkennung: bestätigt, umgesetzt.
- Leer-Zustand im Sichtvertrag (PL 04.11. 13:30): umgesetzt.
- E09 präzisiert: umgesetzt.

**(b) Lösung im Kontext**
- U-241: 3.0 Modus `unklar` (Unterzeile „Was ist das? · Art unklar“, Route `rein#unklar`). Rechte Spalte: Kopf → 4 Kacheln Auftrag oder KV → 3 · Ware → 3.7 · Eingangsrechnung → 3.8 · Dokument oder Notiz → 3.4 (2 je Reihe) → „Später zuordnen“ → „Original ansehen“. Gelesene Teilangaben werden im Ziel vorbelegt. `screens[rein].runde53_unklar` (+ `aufbau`), `elemente_runde53`, Seitenkatalog-Modus.
- U-242: `verhalten_appweit.texte_konkret` (verboten allein, Muster, Ausnahmen, Prüfliste). Der Tag: blockiert · wird knapp · wartet auf dich (Zähler Singular/Plural). Knöpfe/Chips: z. B. „KV-Preis freigeben“, „Mit Bestellung abgleichen“, „Ergebnis festlegen“, „Eingangsrechnung erfassen“, „Zahlung zuordnen“, „Nächste Seite fotografieren“, „Heute zu tun“. Prüfliste: „{feld} {wert} · erkannt, bestätigen“ / „{feld} eintragen|wählen“. U-216 `fehlt` verfeinert: nie allein, sondern „{feld} eintragen/wählen“ oder „{gegenstand} fehlt · {folge}“. Vollständige Liste alt → neu: `baustand.paket_eingang.runde53.aenderungsliste`.
- Nr. 7: `eingang.erkennung.runde53` – Verneinung („nicht X, nur Y“ → Y), Zahlwörter, Wunschdatum statt Mail-/Briefdatum, > 20 Positionen → Hinweis + zweiter Beleg, Mailbilder = Foto-Kandidaten.
- Leer-Zustand: je Paket-Seite Sichtvertrag `zustand: leer` (Route = Seiten-ID, Pflicht) und `zustand: beispiel` (Route `{id}@beispiel`, optional, sonst gelb). Ausgenommen 3.0, 3.6, M6. Prüfbilder `{screen}__leer_*`.
- E09: Enter springt Feld für Feld; erst im letzten Pflichtfeld `eingang.eingangsart` löst Enter den Hauptknopf mit Tor aus.
- Owner 05.11. (in `paket_folge.entscheide_05_11` und `verhalten_appweit.nachrichten_ein_eingang`): AP-MSG (Instagram, WhatsApp) und AP-KOST → Stufe 4. Alle Nachrichten jetzt und später in **einer** Oberfläche; Kanal nur Filter, gleiche Aufbereitung und Verarbeitung.
- **Unverändert:** Seitennamen (Runde 51, z. B. 3.8 „Rechnung prüfen“), Namen von Rechten, alle Ziele und Wege von V41 (Klick-Gate 1383/1383), Größenregel U-240, PIN-Prüfskript.

**(c) Belegwege**
- Testfälle: eingang RT04-11 … RT04-15 (Verneinung, Zahlwort, „ein paar“ ohne Menge → „Menge eintragen“, Wunschdatum, > 20 Positionen), rein U241-01 … 03 (nichts gelesen → 4 Kacheln; Kachel Rechnung → 3.8; Kachel Auftrag → 3 vorbelegt), E09.
- Fehler/Unterbrechung/Rückkehr: „Später zuordnen“ legt den Eingang unter „Später“ ab; „Original ansehen“ und Zurück kehren nach 3.0 `unklar` zurück; Abbruch verwirft nichts (Original gesichert).
- Gates vor Lieferung alle grün: Was-ist-neu, Stand, Referenz, UI (150), Seiten (56×2), Selbsttest pruefe_sicht 150/150, Musterdaten (auch im Bauplan), Klick (1383 Wege V41), **neu Floskel-Gate** (Sichtvertrag + Klick-Inventar, U-242), Baureife.

**(d) Owner-Entscheidungen**
- keine offen.

Nächstes Paket: AP-ABS (nur `paket_folge`, keine AP-EIN-Seite).

## 03.11. 19:00 – Runde 52 · Freigabe (ersetzt den Eintrag 17:40; enthält U-240 aus 18:30 und das PIN-Prüfskript aus 16:30) · bitte einmal binden (TA-B2f)

### 1 · Gültiger Stand (eine Wahrheit)
| Was | Wert |
|---|---|
| spec.json | `ee64f8882bb7` |
| `docs/project/endversion/codex/BAUPLAN.next.json` | **SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4** (ersetzt 6734399A… und 888114C6…) |
| UI `docs/project/endversion/ui/` | endversion_design.css **35146E45**B96F84D7CB30D38F403F1DC0AE9D9232B7F1F7B4C5ED8D950B4537AB · SICHTVERTRAG.json **B1A53EA6**75F52B999CD034C5C5D6D0F4D4B1CC131AB40E818DF3BDD138B6EB4C (117, mit Fokusreihenfolge) · pruefe_sicht.cjs **FDA7C59C**0E3EF9FEC0C0F81B98975F712D8438DE7236D75D0B8D03897F6A052C · CURRENT_DESIGN_REFERENCE.endversion.json **1509BE93**E71B486728A49D1786CD60826943C6CBE954FC7BFF2EE1D3120A8FCE · 117 Prüfbilder neu · LIESMICH Abschnitt „Runde 52“ |
| Vorschau | https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC – oben „Stand V41 · spec ee64f8882bb7“, nach Veröffentlichung gegengeprüft |
| Archiv | V41 (`VERSIONEN/`) |

**Zum Freeze von 18:05:** Die freigegebenen Runde-51-Dateien (888114C6 / 061AF6F3 / 509BE267 / 03F4E0AA) habe ich um 17:40 ersetzt – deine Freeze-Notiz kam danach. Die alten Dateien liegen im Archiv V39 und in der git-Historie. Ab jetzt ändere ich BAUPLAN.next und ui/* erst wieder nach deinem TA-B2f-Merge, und dann nur mit einer neuen Runde.

### 2 · U-240 Größenregel (18:30), umgesetzt
1. **Desktop kompakt:** V1.1, `--touch` 40 px. Werkbank-Dialoge sind höchstens ca. 1100 px breit (vorher 1680 px), Formulare zweispaltig, Prüfliste rechts mit 320 px.
2. **Tablet 1220 × 880:**
   - `data-groesse="dicht"`: Schrift wie V1.1, Knöpfe und Felder mindestens 44 px.
   - Formulare zweispaltig über die volle Breite; „Prüfliste & Hinweise“ oben einklappbar.
   - Die Hauptaktion steht immer im Fuß. Pflichtfelder erreicht man per Enter der Reihe nach; das aktive Feld rollt ins Bild und ist markiert.
3. **Handy:** V8 wie bisher.
4. **Enter = nächstes Feld**, überall:
   - Im letzten Pflichtfeld löst Enter die Hauptaktion aus, mit Tor. Fehlt noch ein Pflichtfeld, springt der Fokus dorthin und es erscheint „Pflicht fehlt: …“.
   - Die Fokusreihenfolge steht je Seite in `SICHTVERTRAG.json → seiten[].fokus` (Felder, `enter_bis`).
   - `pruefe_sicht.cjs` drückt Enter vom ersten Feld bis zum letzten Pflichtfeld. Weicht die Reihenfolge ab, ist das Ergebnis rot.
5. **Prüfskript (16:30):**
   - PIN-Anmeldung über `login.schritte` mit Platzhaltern auch im Selektor: `{rolle_person}` = `<ROLLE>_NAME`, `{passwort_ziffer_n}`. Alternativ Schritt `tippen` mit `{ziffer}`.
   - Deine `routen.json` (Ziffernklicks) läuft damit unverändert; die temporäre Kopie entfällt.
   - Vercel-Freigabe aus `VERCEL_SHARE` (oder `routen.share_env`) beim ersten Aufruf.
   - `pfad: null` + `grund` erscheint gelb mit dem Grund.
   - Kein `require()` mehr, sondern `import()`; Pfad und Dateiname bleiben. ESLint (recommended + no-unused-vars) läuft ohne Fehler.
   - Getestet mit einer PIN-Attrappe: Person, PIN und Freigabe-Parameter kommen korrekt an.

Spec dazu: `verhalten_appweit.groessenregel`, `verhalten_appweit.tastatur_enter`, `geraete` und `tastatur` angepasst. Im Bauplan steht der Inhalt vollständig unter `paket.runde52` (`groessenregel`, `tastatur_enter`, `pruefskript`). `korrekturen_ausserhalb_runde52.liste` ist um zwei Einträge für die ganze App ergänzt.

### 3 · Inhalt Runde 52 (unverändert aus 17:40, steht weiter unten im Protokoll)
- `zahlung_wahrheit`
- 10 Ware raus: Reiter „Fertig im Haus“ und „Rausgegangen“
- 10.1: Kopf-Links, Zahlung, Belege, Übergabe vorbereiten, Ansicht für rausgegangene Ware
- Teil → 4.2 in Werkstatt und Auftragskarte
- Ledger: 19 Punkte bewusst entfernt, 9 zurückgeholt
- Objektkarten zeigen im Kopf den Objektnamen

### 4 · Prüfstand (Endversion, vor dieser Meldung)
- **UI-Gate:** grün, 117 Seiten, 0 gelb. Prüft Desktop-Dialoge ≤ 1120 px, Knöpfe am Desktop ≥ 38 px, auf Tablet/Handy ≥ 44 px, und dass die Fokusreihenfolge im Vertrag steht.
- **Neu: Selbsttest des Prüfskripts gegen die Vorschau:** 117/117 grün, jetzt fester Teil der Baukette. In V40 hätte er 12 rote Kopfzeilen gefunden: Objektkarten und 4.4, inzwischen im Sichtvertrag korrigiert.
- **Seiten-Gate:** 54 × 2.
- **Musterdaten-Gate.**
- **Klick-Gate:** gegen die letzte Lieferung V40 und alle Archivstände.
- **Referenz-Hash-Gate.**
- **Neu: Stand-Gate.** Ein neuer Spec-Stand braucht eine neue V-Nummer.
- **Baureife.**

### 5 · Was der PL tut
1. **Einmal binden per TA-B2f:**
   - Bauplan DF3E1AFE…, UI 35146E45 / B1A53EA6 / FDA7C59C, Referenz 1509BE93.
   - Runde 46–52 vollständig.
   - Die Korrekturliste `paket.korrekturen_ausserhalb_runde52.liste` in die Teil-PRs übernehmen.
2. **Prüfung vor dem Merge:**
   - `MEISTER_NAME/…_PASSWORT`, `WERKSTATT_NAME/…_PASSWORT` und `VERCEL_SHARE` als Umgebungsvariablen setzen.
   - Aufruf: `node docs/project/endversion/ui/pruefe_sicht.cjs --app <preview> --routen docs/project/endversion/ui/routen.json`. Rot = kein Merge.
3. **Keine Migration nötig.** `data-geraet`/`data-groesse` setzt der KrApp-Client nach Breite.

Antwort bitte in `_review/MELDUNG_PLANUNGSCHAT.md`.

### (Teil der Freigabe 19:00) 03.11. 17:40 – Runde 52 · Zahlung/Ware eine Wahrheit · Warenausgang · Zurückgeholtes · keine stillen Löschungen (ersetzt den Stand 888114C6…) · bitte prüfen, dann an Codex

### 1 · Stand 17:40 (überholt – gültig ist der Eintrag 19:00)
| Was | Wert |
|---|---|
| spec.json | `515b98d18e32` |
| `docs/project/endversion/codex/BAUPLAN.next.json` | ~~6734399A…~~ **überholt – gültig ist DF3E1AFE… (Eintrag 19:00)** |
| UI-Wahrheit `docs/project/endversion/ui/` | endversion_design.css D3D77E83… · SICHTVERTRAG.json 3E148DC8… (117) · pruefe_sicht.cjs 03F4E0AA… (unverändert) · 117 Prüfbilder neu · `CURRENT_DESIGN_REFERENCE.endversion.json` trägt jetzt dieselben Hashes (stand vorher noch auf V39) |
| Vorschau (Owner-Referenz) | https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC – oben „Stand V40 · spec 515b98d18e32“, nach Veröffentlichung gegengeprüft |
| Archiv | V40 (`VERSIONEN/`) |

### 2 · Owner-Befund 03.11. (Kunde K-2026-0012) und Ursache (bei mir, nicht bei Codex)
- Vorkasse und gleichzeitig überfällige Rechnung bei schon abgeholter Ware: Die Beispieldaten haben den eigenen Regeln widersprochen, und die Vorschau hat den Zahlstand aus dem Text „Vorkasse“ abgeleitet statt aus Rechnung und Zahlung.
- 10 Ware raus und 10.1 Warenausgang hatten keine Links zu Kunde und Auftrag, keine Rechnung, keine vorbereiteten Belege und keine Liste der rausgegangenen Ware.
- Stille Löschungen: Klickwege sind ohne Owner-Entscheidung weggefallen. Kein Gate hat gegen frühere Fassungen geprüft.

### 3 · Inhalt (alles im Bauplan; Seiten außerhalb des Pakets vollständig unter `paket.runde52`)
- **`verhalten_appweit.zahlung_wahrheit`**: Der Zahlstand kommt nur aus Rechnung und Zahlung, nie aus dem Text des Zahlungsmodus. Festgelegte Bedingungen, die immer gelten müssen:
  - Vorkasse und Ware raus heißt: Die Rechnung ist bezahlt, oder es gibt eine Sondervereinbarung. Sonst lehnt recordGoodsOutCommand ab.
  - Jede Stelle, die „überfällig“ zeigt, führt zu Auftrag und Rechnung.
- **10 Ware raus**: Zwei Reiter, „Fertig im Haus“ und „Rausgegangen · 30 Tage“. Kunde und Auftrag sind Links. Jede Zeile zeigt Zahlstand und Belege.
- **10.1 Warenausgang**:
  - Kopf mit Links zu Auftrag und Kunde, dazu Block Zahlung (Rechnung ansehen, Zahlung bestätigen, Erinnern, weitere offene Posten) und Block Belege.
  - **„Übergabe vorbereiten / Belege drucken“** druckt Lieferschein und Rechnung vorab. Die Ware bleibt gesperrt, bis gezahlt ist.
  - Bei Sondervereinbarung bleiben „Bar/Karte bezahlt · übergeben“ erhalten.
  - **Rausgegangene Ware** zeigt eine Ansicht: Datum, Abholer bzw. Versand, Rechnung, Lieferschein – ohne Übergabe-Knopf.
- **Werkstatt / 4.1**: Jedes Teil öffnet seine Teilkarte 4.2, in jeder Station. „Ware raus“ ist nur aktiv, wenn `orders.ausgabe_frei` gesetzt ist. Sonst steht der Knopf gesperrt mit Grund da.
- **„Korrektur“ / „Fertigmeldung zurücknehmen“**: Gibt es eine festgeschriebene Rechnung, stehen beide gesperrt mit Grund da („Erst Rechnung … stornieren (7.4)“) – sie verschwinden nicht.
- **5.1 Kundenkarte**: Jede offene Rechnung zeigt ihren Auftrag und wo die Ware ist („Ware im Haus“ bzw. „abgeholt am …“). Ein Tipp öffnet 7.2. Neu ist der Block „Rausgegangen“.
- **Objektkarten**: Der Kopf zeigt den Objektnamen (`verhalten_appweit.seitenname.objektkarten`).

### 4 · Keine stillen Löschungen (`verhalten_appweit.keine_stillen_loeschungen`, `baustand.entfernt_ledger`)
- Ich habe alle Archivstände V07–V39 abgeglichen, sowohl die Spec als auch das Klick-Inventar der Vorschau.
- **Bewusst entfernt**: 19 Einträge, jeder mit Owner-Entscheidung und Quelle.
- **Zurückgeholt**: 9 Klickwege, die ohne Entscheidung weggefallen waren:
  - 4.2 Formular-Fuß
  - Teil-Details in der Werkstatt und in der Auftragskarte
  - 10.1 Bar/Karte bei Sondervereinbarung
  - 10.1 Rechnung ansehen und Zahlung bestätigen
  - 10.1 Ansicht für rausgegangene Ware
  - Kopf der Objektkarten
  - Kundenkarte: Tipp auf eine Rechnung öffnet 7.2
  - Der Tag: „Erinnern“
- **Regel für Codex/Prüfchat**: Teil-PRs dürfen keine Knöpfe oder Wege der Zielseite entfernen, die nicht im Ledger stehen. Vor dem Merge gegen die Soll-Bilder prüfen.
- **Meine Gates, laufen vor jeder Lieferung**:
  - Musterdaten-Gate: Die Beispieldaten erfüllen zahlung_wahrheit.
  - Klick-Gate gegen die letzte Lieferung und gegen alle Archivstände.
  - Referenz-Hash-Gate.

### 5 · Was der PL tut (keine Rückfrage nötig)
1. Bauplan-Anker 6734399A… in `AP-EIN-eingang-komplett/PAKET.md` binden. Er ersetzt 888114C6…; Runde 46–51 gilt weiter.
2. Die Liste `paket.korrekturen_ausserhalb_runde52.liste` als „korrekturen“ in die Teil-PRs der Zielseiten übernehmen (10, 10.1, 11, 5.1, 4.1, 4.2, appweit).
3. Keine Migration nötig; alles läuft über vorhandene Felder (invoices, payments, orders.ausgabe_frei, prozesse.abschluss). Falls im Code der Zahlstand aus `payment_terms`-Text abgeleitet wird: auf invoices/payments umstellen (Korrektur appweit).
4. Prüfung vor dem Merge unverändert: `pruefe_sicht.cjs` gegen die neuen Prüfbilder.

Antwort bitte in `_review/MELDUNG_PLANUNGSCHAT.md`.

## 03.11. 17:30 – Runde 51 · Freigabe Oberfläche Eingang (ersetzt STOPP 16:10) · bitte prüfen, dann an Codex

### 1 · Gültiger Stand (eine Wahrheit, ersetzt 20F41503…)
| Was | Wert |
|---|---|
| spec.json | `a9474e3f73c3` |
| `docs/project/endversion/codex/BAUPLAN.next.json` | **SHA-256 888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8** |
| UI-Wahrheit `docs/project/endversion/ui/` | endversion_design.css 061AF6F3… · SICHTVERTRAG.json 509BE267… (117 Einträge inkl. Modi) · pruefe_sicht.cjs 03F4E0AA… · `pruefbilder/` 117 Soll-Bilder neu (gleiche Hashes in `bauplan.ui` und `ui/CURRENT_DESIGN_REFERENCE.endversion.json`) |
| Vorschau (Owner-Referenz) | https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC |
| Archiv | V39 (`VERSIONEN/`) |

**Alte Soll-Bilder und SICHTVERTRAG 8204C911… sind ungültig** (6 Seiten zeigten einen Sondermodus statt Normalfall). Wer daraus schon UI gebaut oder abgeglichen hat: gegen die neuen Bilder neu prüfen.

### 2 · Ursachen (bei mir, nicht bei Codex) und Behebung im Prozess
| Befund Owner | Ursache | Behebung |
|---|---|---|
| Rotes Plus ≠ „3.0“ in der Seitenwahl; Seitennamen passen nicht | Vorschau öffnete den ersten Modus statt Normalfall | Seitenwahl öffnet immer den Normalfall mit echtem Aufruf; Modi als eigene Unterpunkte `id#modus` |
| Doppelte/abweichende Namen je Seite | Titel aus mehreren Spec-Stellen | **`paket.seitenkatalog`** = verbindliche Liste der 13 Seiten: Name, Einstieg, Modi (Unterzeile + Aufruf). Kopf = Name, Modus nur als Unterzeile. `paket.namen` angeglichen |
| M6 Anliegen wählen = Kachelwand | Regel „nur passende“ nicht umgesetzt | M6 neu: Liste nur passende Anliegen, eine Zeile „Weitere Anliegen“, Fuß „Nur Info“/„Kein Geschäftsvorgang“, Handy als Blatt von unten (`screens[anliegenwahl].aufbau_runde51`) |
| Was ist neu zeigte Änderungen nicht | Punkt-ID blieb gleich | Inhalts-Hash je Punkt → geänderter Punkt erscheint wieder |
| – (damit es nicht wiederkommt) | kein Gate prüfte Kopf/Modus | **`paket.seiten_gate`**: jede Seite und jeder Modus über echten Aufruf, Desktop + Handy: Kopf = Name (+ Unterzeile), keine Roh-Platzhalter, kein Knopf doppelt, ≤ 1 Hauptknopf im Fuß, 3.0 leer ohne Zuordnen. Rot = keine Lieferung. Läuft bei mir vor jeder Lieferung (54 × 2 grün) |

Weitere Kleinkorrekturen aus dem Durchgang: 3.4 Knöpfe aus dem Banner in den Fuß; Modus „Kein Geschäftsvorgang“ Fuß nur „Zurück“; 3.8 Platzhalter `{datum}`/`{datei}` belegt, „bezahlt“ in den Fuß; 3.0 Fuß leer ohne Inhalt; „Wem gehört das?“ einheitlich statt „Zuordnen“.

### 3 · Was der PL tut (keine Rückfrage nötig)
1. Bauplan-Anker 888114C6… in `AP-EIN-eingang-komplett/PAKET.md` binden (ersetzt 20F41503…). Inhalt Runde 46–50 aus dem Eintrag 15:00 gilt unverändert weiter.
2. UI-Arbeit an den 13 Eingang-Seiten **darf wieder laufen** – Namen/Einstiege/Modi nur aus `paket.seitenkatalog`, Bilder nur aus `ui/pruefbilder/` (neu).
3. `routen.json` der App um die Modus-Einträge `id#modus` ergänzen (Format `ui/routen.beispiel.json`), sonst meldet `pruefe_sicht.cjs` sie als fehlend. Zugang nur per Umgebungsvariablen.
4. Prüfung vor Merge unverändert: `node docs/project/endversion/ui/pruefe_sicht.cjs --app <preview> --routen …` – Rot = kein Merge.

Antwort bitte in `_review/MELDUNG_PLANUNGSCHAT.md`.

## 03.11. 15:00 – GESAMTMELDUNG Runde 46–50 (Stand 15:40) (ersetzt die Einträge 12:40 / 13:40 / 14:20) · bitte prüfen, dann an Codex

### 1 · Gültiger Stand (eine Wahrheit)
| Was | Wert |
|---|---|
| spec.json | `78d330a00a20` |
| `docs/project/endversion/codex/BAUPLAN.next.json` | **SHA-256 20F41503CD908FD63048ED9776375A02909EA03FA0F54E7880A8405198296422** (ersetzt 361F8085… aus V34 und alle Zwischenstände von heute) |
| UI-Wahrheit `docs/project/endversion/ui/` | endversion_design.css BEC708B4… · SICHTVERTRAG.json 8204C911… · pruefe_sicht.cjs 98D1C21C… (gleiche Hashes in `bauplan.ui` und in `ui/CURRENT_DESIGN_REFERENCE.endversion.json`) |
| Vorschau (Owner-Referenz) | https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC |
| Archiv | V35–V38 (`VERSIONEN/`) |
| Paket Eingang | 13 Seiten, 306 Testfälle (alle grün erwartet), Gates grün: Testmodell, UI (3 Größen), Was-ist-neu, Baureife |

### 2 · Was der PL tut (Reihenfolge, keine Rückfrage nötig)
1. **UI-Wahrheit binden:** `ui/LIESMICH.md` lesen; `CURRENT_DESIGN_REFERENCE.endversion.json` → nach Owner-Haken als `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` übernehmen (alte Bindung V1.1/August-HTML/V5 → superseded). Codex bindet `endversion_design.css` ein (ersetzt designsystem_v1_1/komponenten.css und eigene kr-*-Nachbauten in globals.css), setzt `data-spec-id` nach Sichtvertrag.
2. **Bauplan-Anker:** 20F41503… in `AP-EIN-eingang-komplett/PAKET.md` (TA-B2f) binden; Teil-PR-Schnitt bleibt, plus Korrekturliste aus 3.
3. **Prüfung vor jedem Merge (Prüfchat):** `node docs/project/endversion/ui/pruefe_sicht.cjs --app <preview> --routen docs/project/endversion/ui/routen.json` (Format: `routen.beispiel.json`; Zugang nur per Umgebungsvariablen). Rot = kein Merge; Gelb nur mit Grund in `docs/delivery/ABGABE_*.md`. Live-/Vercel-Test ist Sache des Prüfchats.
4. **Migration AP-EIN** (additiv, Startwerte): intake_drafts.zuletzt_feld · orders.pickup_by_name/_note/_source/_at/_login · orders.ausgabe_frei · customer_agreements.gueltig_bis · intake_item.anliegen_abgewaehlt · intake_suggestion.order_id · company_settings.versand_dienst ('DPD'), versand_nummer_format ('^\d{14}$'), versand_nummer_hinweis ('14 Ziffern'), versand_verfolgung_url, versand_label_api (siehe `paket.runde48` / `paket.runde49`).

### 3 · Inhalt Runde 46–49 (Owner-Entscheidungen, alle umgesetzt)
- **X12 Entwürfe je Login → Stufe 1** (`funktionen[X12]`, `screens[entwurf].x12_stufe1`, Der Tag). Fälle D05–D07.
- **Dritt-/Teilabholung Stufe 1** (`verhalten_appweit.abholung.durch_dritte`, Anliegen `abholung_durch`, 10.1 Abholer-Zeile + Pflichtfeld „Übergeben an“, Prüfung vor Buchung per Version). Fälle DA01/DA02.
- **Kein „Ohne Zahlung übergeben“** (`verhalten_appweit.uebergabe_ohne_zahlung`): gesperrt „Zahlung fehlt“; nur Sondervereinbarung (customer_agreements geld, gelber Kasten über der Hauptaktion) erlaubt „Übergeben · Rechnung folgt“; Werkstatt „bereit“ = `orders.ausgabe_frei` (RT05). „Ohne Preis übergeben“ nur bei Ziel-Kunde/Sondervereinbarung.
- **Versanddienst konfigurierbar** (`verhalten_appweit.versanddienst`, 8.1 Firmendaten Block „Versand“): kein Dienstleister-Name im Code, überall `{versanddienst}`; 10.1 prüft die Sendungsnummer gegen das eingestellte Format; Erkennung eingehender Pakete bleibt neutral.
- **RT-Präzisierungen:** RT01 `eingang.erkennung.ruecklese` · RT02 `eingang.erkennung.zustaende` (6 Zustände, retryIntakeRecognition idempotent) · RT03 `eingang.erkennung.formate` (20 MB, HEIC→JPEG serverseitig, XML nie OCR, nichts_erkannt, 10 Fixtures) · RT04 `eingang.erkennung.notiz.verneinung` (+ Anliegen preis_einwand, kundendaten; Fälle RT04-01…10) · RT06 `verhalten_appweit.gesperrt_katalog` (11 Sperren; CONFLICT → Feldabgleich) · RT08 `verhalten_appweit.auto_mail` Empfängerregel + `kette_detail.korrigieren` · B10 `verhalten_appweit.ebenen.fokus`.
- **Abholtage entfernt, Zeilenklick öffnet Objekt** (Runde 46).
- **Kein Balken „← zurück zu …“** (Runde 50, `verhalten_appweit.herkunft`): Rücksprung zum Ausgangspunkt bleibt automatisch beim Schließen/Speichern, Liste genau wie verlassen – ohne Hinweiszeile oben. Falls im Code schon ein solcher Balken existiert: entfernen (Korrektur appweit).

### 4 · Korrekturen außerhalb des Pakets → als „korrekturen“ in die Teil-PRs der Zielseiten (`paket.korrekturen_ausserhalb_runde48.liste`)
10.1 (Ohne-Zahlung raus, Sondervereinbarung, Abholer, Sendungsnummer aus 8.1) · Werkstatt (ausgabe_frei, „Heute sichern“ → Sperrkatalog) · eingang/ware/original (RT01–RT04) · appweit (RT06/RT08/B10) · 8.1 Firmendaten (Block Versand).

### 5 · Für den PL erledigt, keine Rückfragen offen
Ideen-Abgleich (93) liegt im Archiv; die 5 Owner-Entscheidungen daraus betreffen keinen AP-EIN-Teil-PR. Zwei Prozessfehler behoben (Testmodell-Gate wieder letzter Schritt; Was-ist-neu-Gate). Antwort bitte in `_review/MELDUNG_PLANUNGSCHAT.md`; Entscheidungen/Haken des Owners laufen über ihn, nicht über mich.

## 03.11. 13:40 – Runde 48b: Spec nach Übergabe (RT01–RT09) + drei Owner-Entscheidungen · neuer Bauplan 248C265F…

**Gültig:** `codex/BAUPLAN.next.json` SHA-256 **493F364CD05A1171D0316740CD1B0A1384FC4E0A95EC2CE008599F85AE992D81** (14:20, V36; ersetzt 248C265F…/820A9A6B…; spec 01ea3d07d5d6). Vorschau: https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC. Nachtrag 14:20: „Was ist neu“ für Runde 46–48 ergänzt + Gate; Sichtvertrag ohne Vorschau-Chrome → neue ui-Hashes.
Hinweis: Der Bauplan 820A9A6B… von 12:40 (UI-Wahrheit) ist damit überholt; `bauplan.ui`-Hashes neu (CSS-Bündel BEC708B4…, Sichtvertrag 47F11A21…), Dateien unter `docs/project/endversion/ui/` aktualisiert.

**Owner-Entscheidungen (03.11.), umgesetzt:**
1. **X12 Entwürfe je Login → Stufe 1** (`funktionen[X12]`, `screens[entwurf].x12_stufe1`, Der Tag „Entwurf · …“; Tabelle private.intake_drafts vorhanden, Spalte zuletzt_feld additiv). Paket Eingang: Seite entwurf, 3 neue Fälle D05–D07.
2. **Dritt-/Teilabholung Stufe 1** (`verhalten_appweit.abholung.durch_dritte`, Anliegen `abholung_durch`, orders.pickup_by_* additiv; 10.1 Abholer-Zeile + Pflichtfeld „Übergeben an“, Prüfung vor Buchung über Version; Teilabholung = Modus teillieferung). Fälle DA01/DA02.
3. **„Ohne Zahlung übergeben“ gibt es nicht mehr** (`verhalten_appweit.uebergabe_ohne_zahlung` = `screens[rauspruefen].sondervereinbarung`): ohne gebuchte Zahlung bleibt „Übergeben“ gesperrt „Zahlung fehlt“; Ausnahme nur **Sondervereinbarung** (customer_agreements geld, gueltig_bis additiv) – in 10.1 als gelber, nicht einklappbarer Kasten direkt über der Hauptaktion „Übergeben · Rechnung folgt“; Werkstatt zeigt „bereit“ nur mit orders.ausgabe_frei (RT05). „Ohne Preis übergeben“ nur noch bei Ziel-Kunde/Sondervereinbarung.

**RT-Präzisierungen (Pfad im Bauplan):** RT01 `eingang.erkennung.ruecklese` (intake_suggestion → Formular, bestätigte Werte bleiben, nach Buchung lesbar) · RT02 `eingang.erkennung.zustaende` (6 Zustände, retryIntakeRecognition idempotent) · RT03 `eingang.erkennung.formate` (eine Grenze 20 MB, HEIC serverseitig → JPEG, XML nie OCR, nichts_erkannt eigener Zustand, 10 Fixtures) · RT04 `eingang.erkennung.notiz.verneinung` (Verneinungs-/Kontextregeln, 9 Gegenbeispiele + Abwahl bleibt = Fälle RT04-01…10, neue Anliegen preis_einwand, kundendaten) · RT05 `screens[werkstatt].bereit_regel`, `prozesse.abschluss.ausgabe_frei` · RT06 `verhalten_appweit.gesperrt_katalog` (11 Sperren mit Ursache·Fakten·Hauptaktion·Alternative·Recht·Fortsetzung; CONFLICT → Feldabgleich statt „Neu laden“) · RT07 `paket.korrekturen_ausserhalb_runde48` (was außerhalb des Pakets liegt, mit Zielseite) · RT08 `verhalten_appweit.auto_mail` Empfängerregel (billing_email vs. email), `screens[auftrag].fassung3.kette_detail.korrigieren` · B13 DPD (`funktionen[W04].grund_runde48`, `screens[rauspruefen].versand_stufe1`: Sendungsnummer Pflicht) · B10 `verhalten_appweit.ebenen.fokus` (Fokusfalle).

**Korrekturen außerhalb des Pakets** (bitte als „korrekturen“ in die Teil-PRs der Zielseiten, kein Neubau): `paket.korrekturen_ausserhalb_runde48.liste` – 10.1, Werkstatt, eingang/ware/original (RT01–RT04), appweit (RT06/RT08/B10).

**Prozess:** Testmodell-Gate (f1_r28.gate) lief seit Runde 36 nicht mehr als letzter Schritt – behoben, läuft jetzt immer am Ende der Kette (fand 4 falsche Element-Kennungen, korrigiert). Paket Eingang jetzt 13 Seiten / 306 Fälle (alle testmodell-Seiten).

**Offen beim Owner (nicht blockierend):** RT08 „Ohne Preis übergeben“ – ich habe es auf Ziel-Kunde/Sondervereinbarung begrenzt (konsequent zu Entscheidung 3); wenn der Owner es ganz streichen will, eine Zeile. Live-Test/Vercel (0.7) → Prüfchat, nicht ich.

## 03.11. 12:40 – UI-Wahrheit abgelegt (Runde 48a) · bitte prüfen, bevor etwas an Codex geht

**Befund Owner (03.11.):** „Nichts sieht so aus wie vorgesehen.“ Ursache gefunden: Codex ist über `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` an Designsystem V1.1 + vier August-HTML + V5-Gesamtmock gebunden. Der Look der Endversion steckt in `groessen_v8.css`, `ui_ergaenzung.css` und ~60 KB Inline-Styles der Vorschau – nie an Codex gegangen. Zwei UI-Wahrheiten → gebaute App ≠ Vorschau.

**Abgelegt (inhaltsfrei, Repo):** `docs/project/endversion/ui/`
- `endversion_design.css` – ein Bündel (tokens + komponenten + groessen_v8 + ui_ergaenzung + Inline-Styles, Vorschau-Chrome entfernt; Musterdaten-Check 0). SHA 19B1F3EAAF5F4BBA…
- `SICHTVERTRAG.json` – 25 Seiten/Rollen × 3 Größen = 75 Einträge: Ebene, Fußzeile, Hauptaktion (im Viewport ohne Scrollen?), jedes Bedienelement mit Kennung (`data-spec-id` sonst Text), Lage, Größe, Farbe, Reihenfolge. SHA 7B99DFDD0DE32717…
- `pruefbilder/` – 75 PNG der Vorschau, 1:1 zum Vertrag.
- `pruefe_sicht.cjs` – Prüfskript gegen die gebaute App (Element da/sichtbar/Reihenfolge/≥44 px/Farbe/Hauptaktion im Viewport). Selbsttest gegen die Vorschau: 75/75 grün. Rot = kein Merge. `routen.beispiel.json` zeigt das Format; **PL/Codex füllt `routen.json`** mit den echten App-Pfaden (Zugang nur per Umgebungsvariablen).
- `LIESMICH.md` – Regeln (data-spec-id Pflicht, Klassen wie Vorschau, Hauptaktion in Dialog-Fußzeile, Knöpfe ≥ 44 px, Abweichung nur mit Grund).
- `CURRENT_DESIGN_REFERENCE.endversion.json` – **Vorschlag** für die Neubindung (schemaVersion 3). Gilt erst nach Owner-Bestätigung; bis dahin alte Datei.

**Bauplan:** `codex/BAUPLAN.next.json` neu mit `bauplan.ui` (gleiche Hashes). SHA 820A9A6BD4EF5F9F… (spec unverändert 21d0347a3319). Prozess: `ui_wahrheit.sh` läuft jetzt bei jedem Bau vor dem Export (Gate: Hauptaktion 3 Größen, Knöpfe, Musterdaten) – wiederkehrender Fehler im Prozess behoben, nicht von Hand.

**Bitte vom PL:**
1. Prüfen: LIESMICH + Vorschlag Neubindung. Wenn stimmig → Owner bestätigen lassen, `CURRENT_DESIGN_REFERENCE.json` ersetzen, Bauplan-SHA 820A9A6B… binden.
2. In jeden AP-EIN-Teil-PR: `pruefe_sicht.cjs` vor Merge (Prüfchat), Bericht in `docs/delivery/ABGABE_*.md`.
3. Bestehende Seiten (Der Tag, Werkstatt, Auftrag, Kunde): als Korrektur „Sicht gegen Vertrag“ in die Teil-PRs aufnehmen – kein Neubau, nur Angleichung.

**Noch bei mir (heute):** Runde 48b – Spec: X12 Entwürfe → Stufe 1 (Owner), Dritt-/Teilabholung Stufe 1 (Owner: ja), „ohne Zahlung übergeben“ gestrichen → nur mit Sondervereinbarung, klar angezeigt bei Warenausgang (Owner), RT01–RT08 Präzisierungen aus der Übergabe, DHL→DPD. Dann V35 + Meldung hier.

## 02.11. 20:05 – Owner-Entscheidung 8.11: später · neue gültige SHA

- **Gültige SHA-256 jetzt: `361F8085F38C7883055FBDC03368B1AB144DA39BC25945E41048D260DC6780F8`** (spec `21d0347a3319`). Sie ersetzt CF77BEC2…. Die Datei liegt unter `docs/project/endversion/codex/BAUPLAN.next.json`. Bitte TA-B2f mit dieser SHA anlegen.
- **Owner 02.11.: 8.11 „Termine & Auslastung“ wird später gebaut (mit F7), nicht in AP-EIN.**
  - `paket.seiten` hat damit 13 Seiten; „fertig“ = 272 Fälle grün (die testmodell-Seite termineinst bleibt „nicht_im_bauplan“).
  - Der Terminabgleich in 3 rechnet mit den Startwerten der neuen company_settings-Spalten (verhalten_appweit.termin_einstellungen). Die Migration dieser Spalten gehört weiter zu AP-EIN.
  - Die Kachel „Termine & Auslastung“ in Einstellungen › Werkstatt trägt `entfaellt_runde47` und wird nicht gebaut.
- Sonst gilt die Meldung von 19:50 unverändert, auch die offene Frage zu den Absprachen. Antwort bitte oben in `_review/MELDUNG_PLANUNGSCHAT.md`.

## 02.11. 19:50 – Antwort an den Planungschat: Bauplan b37f8b5208a3 liegt im Repo, Abschnitte gegenüber a887

**Ablauf ab jetzt (Owner 02.11.: kein Postbote):** Der Planungschat schreibt Fragen und Entscheidungen oben in `_review/MELDUNG_PLANUNGSCHAT.md`. Der Endversion-Chat liest die Datei, bevor er arbeitet, und antwortet hier, neueste Meldung oben. Bauplan-Lieferungen liegen immer unter `docs/project/endversion/codex/BAUPLAN.next.json`, die gültige SHA steht in der jeweils obersten Meldung.

**0. Abgelegt:** `docs/project/endversion/codex/BAUPLAN.next.json` und `BAUPLAN_LIESMICH.next.md`.
- **Gültige SHA-256: `CF77BEC2419C22232B46A859E87A44BACBE1391EF696A6673C19BDB7BF27CCFF`.** Sie ersetzt 8D90F0D4….
- Grund: Beim Abgleich mit a887 fiel auf, dass der Export bei `formulare.kunde.felder[kundentyp].optionen` den Wert der Option „Lieferant“ (nur Modus lieferant) verloren hatte. Das Exportskript ist korrigiert, dazu kam ein neues Gate „Listeneinträge ohne Wert“.
- Die Spec ist dieselbe (b37f8b5208a3). `BAUPLAN.json` ist unverändert (a887).
- Bitte TA-B2f mit CF77BEC2… anlegen.

**1.–4.** Einverstanden: ein Paket AP-EIN mit Teil-PRs; AP-K1 F2 geht darin auf; Generator-Erweiterung als erster Teil; die Nacharbeit gehört zu AP-EIN; Spec-Freeze für die laufenden Pakete.

**`formulare.kunde` gegenüber a887:**
- `felder`:
  - neu `auto_info` („Kunde automatisch informieren“, Ja/Nein, Standard Ja);
  - neu `vorrang` („Vorrang bei Terminen“, Standard Nein, ohne Recht entscheiden nur lesbar);
  - `kundentyp`: „Lieferant“ nur im Modus lieferant (Aufruf aus 3.8), im normalen 3.1 nur Firma | Privat (`angebot_lieferant`, eure Vorgabe vom 02.11.).
- `typ_felder`: Wechsel zu bzw. von Lieferant nur in 5.2 und nur mit Recht geld.
- `daten.spalten_neu`: zusätzlich `auto_info boolean NOT NULL DEFAULT true` und `vorrang boolean NOT NULL DEFAULT false` (additiv).
- `adresspruefung`: nur die Farbregel (ok = grün „Adresse geprüft“, prüfen = orange, Fehler = rot).
- neu `standard_fuer_auftraege`: Abschnitt in 5.1/5.2 mit Übergabe bevorzugt, Zahlungsbedingung, auto_info und vorrang.

**Absprachen (customer_agreements):**
- Gegenüber a887 ist hier inhaltlich nichts geändert. Neu ist nur `paket.eingriffe_ausserhalb.nicht_in_diesem_paket`: In AP-EIN sind die Absprachen ausgeblendet, weil es auf den Paket-Seiten keinen Testfall dafür gibt (U-234).
- Vorschlag: die Absprachen als eigener kleiner Teil nach AP-EIN, mit eurer Migration und eurem Akzeptanztest aus AP-K1 F2. Die Testfälle liefere ich nach, sobald ihr hier zustimmt.
- Wollt ihr sie stattdessen in AP-EIN haben, schreibt das in MELDUNG_PLANUNGSCHAT.md. Dann nehme ich den Ausschluss heraus und schreibe die Fälle; das ergibt eine neue SHA und eine kurze Prüfrunde.

**Gegenüber a887 geänderte Abschnitte im Bauplan:**
- neu: `paket`
- `abschnitte[F1 Neuer Eingang]`
- `screens`: anliegenwahl, aufgabe, eingang, einstellungen, entwurf, kundebearbeiten, kundeneu, mailein, nachrichten, neuigkeiten, original, rechnungein, rein, reklamation, tag, ware
- `verhalten_appweit`: 27 Schlüssel, u. a. annahme, terminabgleich, terminlage, termin_einstellungen, rueckfrage, aenderung, gegenvorschlag, abholung, auto_mail, zeilenklick, farbe, kundenkarte_im_eingang
- `bausteine_vertraege`: dublette, hb, mehrarbeit, pruefliste, terminvorschlag, warenpruefung, werkbank
- `eingang`: daten, erkennung, zustaende
- `formulare.kunde`
- `prozesse`: abschluss, auftrag, ware
- `werkstattregel`: abholung, etiketten, mehrarbeit, pflichtfoto, ruecknahme, stationen, stufe1_regeln
- `tagkonfig.bausteine`
- `korrekturen`: ein Eintrag mehr (Seite tag, Zeilenklick)
- `annahmen.liste`
- `testmodell`: datenlagen, konventionen, logins, seiten
- `bauregeln`: Rangfolge und „Gilt nicht“-Regel
- `ausserhalb`: 35 → 38 Einträge
- `bauplan`: spec_sha

Unverändert: rollen, rechte, stufen, addons, funktionen, navigation, meta, bauhinweise, baustand_seiten.

**Offen beim Owner:** der Haken für 8.11. Ohne ihn rechnet der Terminabgleich mit den festen Startwerten aus company_settings, und 8.11 folgt mit F7.

## 28.10. – Prüfung der Eingang-Gesamtmap (Vorschlag, wartet auf Owner)

- `docs/project/endversion/EINGANG_PRUEFUNG_MAP.md`: Jeder Weg der Map ist verfolgt. Ergebnis: machbar, aber noch nicht der einfachste Weg; 12 Befunde.
- Die Kernvorschläge:
  - Rückweg markieren: Nummer im Betreff, QR auf allen PDFs.
  - Drei Arbeitsorte: Kundenchat, „Zuordnen“ mit Meldung ab 24 h, Handlungsbedarf.
  - Automatik in 4 Stufen.
  - Eine Anliegen-Liste mit Aktionen für alle Kanäle.
  - Ausgang ab Stufe 1, dazu die Gesendeten aus Outlook.
  - Geräte-Schicht für PC, Tablet und Handy mit Live-Abgleich.
- Für die Klärungs-Chats B1 und B2: bitte diese Datei mitlesen. Verbindlich wird es erst nach der Owner-Entscheidung und der Übernahme in die spec.

## 28.10. – Nur noch die App-Basis (Owner)

- Owner-Haken nur noch für die App-Basis: Login, F0 Rechte, F2 Der Tag. Waren- und Informationseingang (F1) und F3–F7 sind zurückgestellt. Reparaturen an der Basis laufen weiter, Neubau gibt es keinen.
- `codex/BAUPLAN.json` (spec `9ce5a52f7517`) enthält nur noch diese drei Abschnitte und 25 Korrekturen. Die Korrekturen am Eingang stehen nicht mehr darin (passt zu H8).
- In AKTUELLE_ANWEISUNG.md steht dazu H9 über H8.
- Die Spec-Arbeit an F1 und F3–F7 ist geparkt. Der Stand der Gegenprüfung bleibt in der Spec erhalten (Runde 4: keine Blocker). Weitergemacht wird erst, wenn die Owner es freigibt.

## 27.10. ca. 23:15 – Einarbeitung F1, F3/F4, F5–F7 abgeschlossen, Gegenprüfung Runde 2 läuft

- spec `8faee2a3d317`, Bauplan neu erzeugt. Baureif bleiben **Login, F0, F2**. F1 steht im Bauplan nur mit Korrekturen.
- Befunde aus Runde 1 sind eingearbeitet: F1 49, F3/F4 38, F5–F7 47. Neue Annahmen gehen bis A-79. Mock und Abläufe (Buchen, Kunde, Mail, Rechnung, Einstellungen) laufen ohne Fehler.
- Neu in F6: **Stornorechnung** (`rechnungstorno`) und **Zahlung stornieren** (`zahlungsstorno`). F6 steht auf „spec-fertig“, bis die Owner diese zwei Seiten abhakt (OR-17).
- Neu: **F7b Datenkiste (Import)** als eigener Abschnitt, „in Arbeit“. In F7 ist sie ausgeblendet, bis F7b gebaut ist.
- **Korrektur zur Vorgabe „kein Skonto“:** Das war falsch. Es gilt die Owner-Entscheidung **U-111**: Rechnung auf Ziel 14 Tage, 2 % Skonto bei Zahlung in 10 Tagen. Satz und Frist werden je Kunde gespeichert und in der Rechnung ausgewiesen. Eine Zahlung innerhalb der Frist mit dem Skontobetrag schließt die Rechnung (A-73).
- Nächster Schritt: Ein frischer Prüfer prüft F1, F3/F4 und F5–F7 erneut. Baureif wird ein Abschnitt erst nach einer Runde ohne blockierende Punkte.
- Codex: unverändert nur Login → F0 → F2 bauen bzw. korrigieren. Kein Neubau von F3–F7.

## 27.10. abends – Login, F0, F2 baureif

- `BAUPLAN.json › baureife`: **Login, F0 und F2 baureif** (Gegenprüfung nach 5 Runden bestanden, spec `faba82e2e3ff`).
- Codex: Korrekturen für diese drei Abschnitte jetzt nach dem baureifen Bauplan, Reihenfolge Login → F0 → F2. F0 zuerst wegen der Bereichsprüfung, inkl. `migration_altbestand` und `server_umstellung.bereich_je_stelle`.
- Korrekturen mit Zielen aus F3–F6 sind `zurueckgestellt`: Daten, Filter und Text bauen, das Ziel vorerst über den bestehenden Pfad (`verhalten_appweit.ziele_bestand`).
- F1, F3/F4, F5–F7: Befunde werden gerade eingearbeitet, danach folgt die Gegenprüfung.
- Offene Sachfrage an die Owner: **Bundesland der Firma** (Feiertage, A-13). Bis dahin gelten die bundesweiten Feiertage.

## 27.10. ca. 23:30 – Stand Baureife

- Verträge, Ableitungen und Abnahmen liegen für alle Abschnitte F0–F7 vor. Die mechanische Prüfung `baureife()` ist für F0–F7 grün.
- Gegenprüfung aus Bauenden-Sicht (nur BAUPLAN.json), blockierende Punkte je Runde:
  - Login/F0/F2: 9 in Runde 1, 10 in Runde 2 (tiefer). Beide eingearbeitet, Runde 3 läuft.
  - F1: 11, wird eingearbeitet.
  - F3/F4: 13, wird eingearbeitet.
  - F5–F7: Prüfung läuft.
- Ablauf je Abschnitt: Befunde einarbeiten, dann prüft ein frischer Prüfer erneut. Baureif ist ein Abschnitt erst, wenn eine Runde ohne blockierende Punkte endet. Erst dann steht dort `baureif: true`.
- Neu im Bauplan:
  - `verhalten_appweit`: zentrale oeffne(ziel, arg), Zurück, Speichern, Rechte, Zeit, Tastatur, Geräte, Ziele im Bestand.
  - `annahmen` (A-01 …): Produktannahmen, die die Owner morgen bestätigt.
  - F0 mit `migration_altbestand` und `server_umstellung.bereich_je_stelle`.
  - Rangfolge bei Widerspruch: klaerungen > annahmen > Verträge > Struktur > Freitext.
- Reihenfolge der Korrekturen: Login → F0 → F1 → F2. F0 kommt zuerst, weil die übrigen Korrekturen Bereiche prüfen.
- Codex: weiter nur Korrekturen. Commit `a2381463 feat(f3)` ist vor der Sperre entstanden. Bitte nicht weiterbauen, bis F3 baureif ist.

## 27.10. 22:45 – Baureife-Sperre (U-211), Auftrag der Owner

Die Owner will: Was gebaut wird, soll beim ersten Mal richtig gebaut werden, keine Fehlersuche mehr.
Die Code-Durchsicht von Login, F0, F1 und F2 hat 56 Befunde ergeben, davon 14 schwer. Ursache: Der Bauplan war unvollständig. Viel Verhalten stand nur im Mock-Code und in Musterzeilen, und genau die bekommt Codex nicht. Dazu kommt: Der spec-check prüfte nur Kennungen.

**Neu, ab sofort verbindlich:**
1. `BAUPLAN.json › baureife`: Neu gebaut wird nur, wo `baureif: true` steht. Ein Abschnitt ist baureif, wenn alle drei Bedingungen erfüllt sind:
   - Jeder Baustein hat einen Vertrag (`bausteine_vertraege`).
   - Jeder Datenblock hat eine `ableitung`.
   - Jede Seite hat `abnahme`-Fälle **und** die Gegenprüfung aus Sicht des Bauenden ergab keine blockierenden Punkte.
2. Im Moment ist kein Abschnitt baureif. **Codex arbeitet nur den Korrekturteil ab** (H5 in AKTUELLE_ANWEISUNG.md), ohne Neubau von F3–F7 und ohne Backend-Vorarbeit für F3–F7 nach 4e.2.
3. Vor jedem Neubau schreibt Codex `codex/RUECKFRAGEN_<Abschnitt>.md`. Raten ist verboten.
4. Die Abgabe enthält je Abnahmefall Datei:Zeile. Klicktests macht weiterhin die Owner (Regel 4d).

**Heute Nacht im Endversion-Chat:** Verträge, Ableitungen und Abnahmen für alle Abschnitte werden geschrieben, dann folgt die Gegenprüfung. Sobald ein Abschnitt sie besteht, steht er in BAUPLAN.json als baureif. Codex liest BAUPLAN.json vor jedem Paket neu.

**Zum Merge 6:50:** Die zwei schweren F0-Befunde sind unverändert der erste Korrekturpunkt.
