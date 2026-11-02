# AP-EIN · Eingang komplett (Stufe 1) – ein Paket, sechs Teil-PRs

Status: **bereit** (Teil 0 nach TA-B2f; Vorbau lokal ab sofort). Fassung 1 vom 02.11.2026 abends (Planungschat).
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block B2, je Teil ein Branch frisch von main (`kreile/b2-ein-<n>`).
WAS: BAUPLAN spec `21d0347a3319`, SHA-256 `361F8085F38C7883055FBDC03368B1AB144DA39BC25945E41048D260DC6780F8` (kommt mit TA-B2f als `BAUPLAN.json` auf main). Abschnitt `paket` ist für dieses Paket vorrangig (`paket.vorrang`): 13 Seiten, 272 Fälle; Eingriffe außerhalb nur nach `paket.eingriffe_ausserhalb.erlaubt`; nicht bauen, was `nicht_im_paket` / `nicht_in_diesem_paket` nennt. Owner: U-225–U-235, U-236, U-237.

## Fertig (ganzes Paket)
Alle 272 Fälle der Paket-Seiten grün in CI (agentur-gate, Replay-DB); `e2e/generated/_erwartet_rot.json` enthält keinen Fall dieser Seiten mehr (nur Elemente aus `nicht_in_diesem_paket` bleiben ausgeblendet). Jeder Teil ist fertig, wenn die Fälle **seiner** Seiten grün sind und kein vorher grüner Fall rot wird.

## Teile (Reihenfolge, je ein PR, je eine Abgabe `docs/delivery/ABGABE_AP-EIN-<n>.md`)
| Teil | Seiten (Fälle) | Inhalt |
|---|---|---|
| 0 Fundament | – | Generator-Erweiterung: Platzhalter `{kw_ende:±n}`, `{kw_folge_anfang:±n}`, `{gesetzt}`, `{reklamation}`, `{login}`, `{fehler}`, Schritt `netz_laden`; alle 272 Fälle laufen und stehen mit ihrem Teil (EIN-1 … EIN-5) auf der Rot-Liste; Datenlagen/Seed nach `testmodell.datenlagen`. Keine Produktänderung. |
| 1 Kunde | kundeneu (34), kundebearbeiten (29) | Datenvertrag und eine Kunden-Komponente nach `AP-K1-kunde/PAKET.md` (Fassung 2, gilt als Teil 1) mit Bauplan 21d0347a: zusätzlich `auto_info`, `vorrang`, Abschnitt `standard_fuer_auftraege`, Lieferant nur im Modus lieferant (3.1) bzw. mit `geld` in 5.2, Farbregel der Adressprüfung. **Ohne Absprachen** (AP-ABS, U-237): kein Key `agreements`, keine Tabelle. Command-Keys für die neuen Felder: `autoInfo`, `vorrang`. |
| 2 Erfassung | rein (13), eingang (87), entwurf (4), anliegenwahl (7) | 3.0 komplett (Aufnahme Foto/Datei/Fotos vom Handy, Notiz + „Lesen“, ohne Vorlage), 3 komplett inkl. Terminabgleich (`terminlage`, `termin_einstellungen` mit Startwerten in `company_settings`, 8.11 nicht), Annahme mit Auftragsbestätigung über `outbox_mails` (feste Vorlage `annahme.vorlage_stufe1`, Versand über den bestehenden Mailweg), Meldung „… · Auftragsbestätigung wird gesendet“, 3.6 Entwurf, M6 Anliegenwahl. Abholtag entfällt: `pickup_weekday`, `pickups_max_per_day` werden nicht mehr gelesen (Spalten bleiben). Ersetzt die Erfassungslogik aus AP-01/AP-R, wo der Bauplan anders sagt (eine Wahrheit). |
| 3 Ware & Original | ware (18), original (10) | 3.7 Ware annehmen (`goods_receipt`, Warenprüfung, Pflichtfoto), 3.9 Original (`intake_file`, SHA-256-Sicherung, Seiten). App installierbar nach `eingang.geraete` (Manifest, Symbol, Vollbild, Web-Share-Ziel „Teilen an die App“, U-236). |
| 4 Nachrichten | mailein (15), nachrichten (15), aufgabe (11), reklamation (13) | 3.4 Mail-Eingang über Microsoft Graph (Abruf, Zuordnung, ohne Picker-Modi), 2.3 Nachrichten/Anliegen, 2.4 Aufgabe, 4.8 Reklamation aufnehmen; dazu die Korrektur Der Tag „Zeilenklick öffnet das Objekt, Aktion nur über den farbigen Knopf“ (`korrekturen`, Seite tag) und `FILE_BLOCKED` ins bestehende Fehlerprotokoll. |
| 5 Eingangsrechnungen | rechnungein (16) | 3.8 Rechnung prüfen (`supplier_invoice`, XRechnung/ZUGFeRD, OCR über Azure Document Intelligence), Lieferant anlegen aus 3.8 (Modus lieferant). |

## Datenverträge (Migrationen)
- Teil 1: `AP-K1-kunde/migration.sql`, SHA-256 `501FC772832FBF6CD8F653B71F9E9AFCA720006469A488EA4920CEBD04BEE60E` (vom Planungschat, Probe gegen Dev mit erzwungenem Abbruch).
- Teile 2–5: Codex schreibt je Teil **eine** additive Migration genau nach den `daten`-Abschnitten des Bauplans (u. a. `eingang.daten`, `verhalten_appweit.termin_einstellungen`, `outbox_mails`, `goods_receipt`, `intake_file`, `intake_suggestion`, `supplier_invoice`), Dateiname `supabase/migrations/<zeitstempel>_ein<n>_<thema>.sql`. **Vor** der Anwendung auf Dev prüft der Planungschat sie gegen Dev mit erzwungenem Abbruch (Meldung in C mit Dateipfad und SHA, dann weiter am nächsten lokalen Schritt bis „Migration geprüft“). Keine Spalte löschen, keine alte Migration ändern.
- RLS/Grants wie `intake_item` (tenant_isolation, nur `service_role`).

## Tests
- Abnahme sind die erzeugten Wege-Fälle (U-230/U-234); Codex ändert weder Testmodell noch erzeugte Tests.
- Akzeptanztests vom Planungschat (bytegleich, nie ändern): Teil 1 `AP-K1-kunde/apk1_kunde_datenvertrag.integration.test.ts.txt` (SHA `C3E99986E1A32CA46CE1C59EB77190A614C6064688D11047069464039EB797F6`) und `AP-K1-kunde/ap01b_eingang_bestandskunde_unvollstaendig.f2.integration.test.ts.txt` (SHA `198C039878FB6080BE34DD54E3A2467779A083E008D2D3626888C900FE4D5823`, ersetzt ap01b); AP-R `apr_freitext_einheiten` bleibt gültig.
- H18: jede neue oder geänderte Server-Action mit Integrationstest gegen die Replay-DB (`*.integration.test.ts` außerhalb `src/test/acceptance/`), Inventar nachführen.
- Microsoft Graph und Azure in CI nicht live aufrufen: Adapter an der bestehenden Grenze (`microsoftGraph.ts`, `azureDocumentIntelligence.ts`) mit fester Antwort nur in der Replay-Umgebung; auf der Preview echt (Preview-Variablen sind gesetzt).

## Verbote
Keine zweite Erfassung, kein zweiter Auftrags- oder Kunden-Schreibweg, keine Ersatzwerte, kein `catch` ohne Log, keine Picker-Modi, kein 8.11, keine Absprachen, keine Seiten außerhalb `paket.seiten` außer `eingriffe_ausserhalb.erlaubt`. Previews nur aus Git.

## Abnahme durch die Owner (je Teil ≤ 6 Klicks, Tablet und Desktop)
Der Planungschat legt den Klickweg je Teil vor, nachdem er ihn selbst auf der Preview genau dieses SHA gelaufen ist. Teil 3, 4 und 5 werden zusätzlich auf dem Tablet mit Kamera (Foto, Datei, Teilen an die App) und mit echtem Testpostfach bzw. Azure geprüft.
