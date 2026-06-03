# Regulatorische, technische und Schnittstellen-Anforderungen für eine Buchhaltungs-/Steuer-/Lohn-Funktion (DE-Einzelunternehmer, RheinMain) — Faktenbasis für eine Bauspezifikation

## TL;DR
- **Bei Buchhaltung/Steuern ist viel erlaubt:** Eigene Software darf via ERiC (kostenlose C-Bibliothek der Finanzverwaltung) UStVA, USt-Jahres, EÜR, ESt, GewSt etc. an ELSTER übermitteln und sauber kontierte Buchungsstapel + Belege via DATEV-Format/DATEV-Datenservice an den Steuerberater geben — sofern GoBD-Unveränderbarkeit, Verfahrensdokumentation und revisionssichere Archivierung eingehalten werden.
- **Bei der Lohnabrechnung ist die Grenze hart:** Für die SV-Meldungen (DEÜV, Beitragsnachweise, eAU, AAG, A1) braucht es eine ITSG/GKV-systemgeprüfte Entgeltabrechnungssoftware mit gültiger Produkt-MOD-ID. Ohne Zertifizierung bleibt nur das (manuelle) SV-Meldeportal oder die Auslagerung — eine selbstgebaute App darf nicht direkt an die SV-Träger melden.
- **Größte 2025/26-Änderungen:** E-Rechnungs-Empfangspflicht seit 1.1.2025 (Versandpflicht gestaffelt bis 2028), USt-Voranmeldungs-Schwellen auf 9.000 €/2.000 € angehoben, Aufbewahrungsfrist Buchungsbelege auf 8 Jahre verkürzt, sv.net zum 30.6.2024 durch das kostenpflichtige SV-Meldeportal abgelöst.

## Key Findings

1. **ELSTER/ERiC ist für Eigenentwicklung offen, aber an Registrierung + Hersteller-ID gebunden.** ERiC ist eine C-Bibliothek (libericapi), die lokal/serverseitig läuft, die Daten plausibilisiert, verschlüsselt und an die ELSTER-Annahmeserver sendet — kein reiner REST-Call. Zugang nur nach Registrierung im Entwicklerbereich beim Bayerischen Landesamt für Steuern; kein Rechtsanspruch.
2. **DATEV-Anbindung ist der De-facto-Standard für den „ein-Klick-zum-Steuerberater"-Workflow** — entweder per Datei (DATEV-Format/EXTF-Buchungsstapel + Belege) oder per API (DATEV-Datenservice/DATEVconnect online).
3. **GoBD setzt die harten Software-Anforderungen:** Unveränderbarkeit (keine Löschung, nur Storno), Protokollierung, Verfahrensdokumentation, revisionssichere Archivierung im Originalformat (E-Rechnung-XML!), GoBD-/Z3-Datenexport.
4. **E-Rechnung:** Empfang seit 1.1.2025 Pflicht, Versand gestaffelt bis 2028; Formate XRechnung (XML) und ZUGFeRD (hybrid PDF/A-3+XML), beide nach EN 16931.
5. **Lohn ist der Knackpunkt** — zertifizierte (ITSG-systemgeprüfte) Software für die SV-Seite zwingend.
6. **Weitere Behördenpflichten** (GewSt, IHK, Rundfunkbeitrag, Statistik, BG, Transparenzregister) sind teils automatisierbar, teils nur teilweise.
7. **Banking/Belegfluss** läuft über PSD2/XS2A (z. B. finAPI) und/oder FinTS, plus OCR/KI-Kontierung.
8. **Marktlösungen** zeigen die Praxisgrenze: lexoffice/Lexware Office mit integriertem ITSG-zertifiziertem Lohn, sevDesk ohne eigenen Lohn.

## Details

### 1. ELSTER / ERiC — elektronische Übermittlung an die Finanzverwaltung

**Was ist ERiC?** Der ELSTER Rich Client ist eine von der Steuerverwaltung kostenlos bereitgestellte **C-Bibliothek** (`libericapi.so`/`ericapi.h`, plus Plugins), die in Steuer-, Finanz- und Lohnbuchhaltungsprogramme eingebunden wird. ERiC plausibilisiert (validiert) die Steuerdaten, verschlüsselt und signiert sie und übermittelt sie über eine gesicherte Verbindung an die Annahmeserver der Finanzverwaltung (ZPS ELSTER, Serverfarm in Nürnberg, dann zuständiges Landesrechenzentrum). Bei Erfolg kann ERiC eine PDF erzeugen. ERiC hat **keine GUI** — die Oberfläche muss die App selbst bauen. Seit dem Umstieg (1.7.2019) ist die Übermittlung kein neutraler Webservice-Aufruf mehr, sondern läuft als „BlackBox" über die ausgelieferten Programmteile; ERiC muss also **lokal/serverseitig** eingebunden werden.

**Offizielles SDK / Entwicklerzugang:** Ja. Die Steuerverwaltung stellt ERiC mit Schnittstellenspezifikation kostenlos bereit. Voraussetzung ist die Registrierung als Hersteller/Entwickler. Ablauf laut ELSTER-Entwicklerseite: (1) Registrierung als Hersteller/Entwickler, (2) Prüfung durch den IuK-Bereich des Bayerischen Landesamts für Steuern, ob Softwareherstellung beabsichtigt ist, (3) Einrichtung eines Zugangs zum Entwicklerbereich (Zugangsdaten per E-Mail innerhalb weniger Tage), (4) ERiC-Download im Entwicklerbereich, (5) **Hersteller-ID beantragen** (wird in Übermittlungen eingebettet), (6) Newsletter abonnieren. **Es besteht ausdrücklich kein Anspruch auf einen Account.** Support läuft über das passwortgeschützte „Herstellerforum" (forum.elster.de/herstellerforum).

**Lizenz / Erlaubnis für Drittsoftware:** ERiC ist explizit für die Integration in „eigene" kommerzielle und frei erhältliche Programme gedacht — sowohl für an Kunden verkaufte Produkte als auch für selbstgebaute/in-house genutzte Anwendungen. Wichtiger Vorbehalt: Die ERiC-Nutzungsbedingungen sind gegenüber **Open Source** historisch restriktiv (freie Software war teils per Lizenzbedingung ausgeschlossen). Der genaue aktuelle Lizenztext liegt nur im passwortgeschützten Entwicklerbereich vor und sollte vor Architekturentscheidungen (insb. SaaS/Cloud-Deployment, Open-Source-Komponenten) durch Registrierung verbindlich geprüft werden. Eine reine SaaS-/Server-Einbindung ist technisch verbreitet (z. B. SAP-Szenarien, Online-Steuerportale seit 2008), explizite öffentliche Verbots-/Erlaubnisaussagen zur Cloud fehlen jedoch.

**Rechtsgrundlage / Pflicht:** Die Nutzung von ERiC ist für die sichere Kommunikation gesetzlich zwingend (§§ 87a, 87b, 87c, 72a AO). Nach § 87b AO gilt eine elektronische Übermittlung ohne ordnungsgemäße Nutzung der vorgeschriebenen Schnittstelle als „nicht erfolgt".

**Übermittelbare Erklärungen/Meldungen (Datenarten via ERiC):** Umsatzsteuer-Voranmeldung (UStVA), Umsatzsteuer-Jahreserklärung, Lohnsteuer-Anmeldung (LStA), Lohnsteuerbescheinigung (LStB), ELStAM, Einkommensteuer (ESt), Anlage EÜR, Gewerbesteuer + GewSt-Zerlegung, Körperschaftsteuer, E-Bilanz, Dauerfristverlängerung, Steuerkontoabfrage, Datenabholung u. a.

**Authentifizierung:** Für Organisationen ist ein **ELSTER-Organisationszertifikat** nötig (ausgestellt auf die betriebliche Steuernummer; Registrierung über „Mein Unternehmenskonto"/Mein ELSTER). Die Zertifikatsdatei ist eine **.pfx-Datei** (Soft-PSE), geschützt mit selbstgewählter PIN. Ablauf: Antrag → Aktivierungs-ID per E-Mail + Aktivierungsbrief per Post (~5 Werktage) → Download. Dasselbe Organisationszertifikat dient auch dem Login zu „Mein Unternehmenskonto" (Rechtsgrundlage § 8 Abs. 1 OZG). In der ERiC-Integration übergibt die App die .pfx + PIN an ERiC, das damit signiert/authentifiziert (ersetzt die Unterschrift).

**Pflicht zur elektronischen Übermittlung:** ESt-Erklärung bei Gewinneinkünften, UStVA + USt-Jahreserklärung, GewSt, EÜR (§ 60 Abs. 4 EStDV — Papier nur im Härtefall), E-Bilanz — alle „authentifiziert" mit Zertifikat.

**Schwellenwerte USt-Voranmeldung (seit 1.1.2025, BEG IV / Wachstumschancengesetz):**
- Vorjahres-Zahllast **> 9.000 €** (vorher 7.500 €) → **monatlich**
- **2.000 € bis 9.000 €** → **vierteljährlich**
- **≤ 2.000 €** (vorher 1.000 €) → Finanzamt kann von der Voranmeldung **befreien** (Jahreserklärung genügt)
- **Existenzgründer:** im Gründungsjahr und Folgejahr grundsätzlich **monatlich** (Sonderregelung § 18 Abs. 2 Satz 4 UStG)
- Abgabefrist: 10. Tag nach Ablauf des Voranmeldungszeitraums; Dauerfristverlängerung um 1 Monat möglich (bei Monatszahlern gegen Sondervorauszahlung 1/11).

### 2. DATEV-Schnittstelle — „ein Klick zum Steuerberater"

**DATEV-Format (Dateibasis):** Erkennbar an Dateinamen `EXTF_*.csv` bzw. `DTVF_*.csv`. Zentrale Datei ist der **Buchungsstapel** (`EXTF_Buchungsstapel.csv`, Datenkategorie 21), ergänzt um Sachkonten (`EXTF_SKBeschrift.csv`), Debitoren/Kreditoren-Stammdaten (`EXTF_Stammdaten-Deb-Kred.csv`) und Textschlüssel. Die Kopfzeile trägt u. a. Berater-/Mandantennummer, Wirtschaftsjahresbeginn, Sachkontenrahmen und Sachkontenlänge. Das Format ist GoBD-konform auf **Festschreibung** ausgelegt (nach Import nicht mehr ohne Weiteres änderbar). Die offizielle Schnittstellenbeschreibung liegt im **DATEV Developer Portal** (developer.datev.de, kostenfreie Registrierung) inkl. Prüfprogramm.

**API-basierte Übergabe (moderner Weg):** **DATEV-Datenservice** (Buchungsdatenservice + Belegbilderservice) bzw. **DATEVconnect online** — webbasierte, von DATEV geprüfte APIs, über die Drittsoftware Belegbilder und/oder strukturierte Buchungs-/Belegdaten direkt ins DATEV-Rechenzentrum nach „DATEV Unternehmen online" überträgt. Vorkontierte Datensätze oder einfache Buchungsvorschläge sind möglich; Belege werden 1:1 (Belegbild + Metadaten + Buchungsdaten) übergeben und mit dem Buchungssatz verknüpft. Authentifizierung beim Anwender per DATEV mIDentity (USB) oder DATEV SmartLogin (App).

**DATEV Unternehmen online (DUO) / Belegtransfer:** DUO ist die Cloud-Plattform für die Zusammenarbeit Mandant↔Kanzlei: revisionssicheres Belegarchiv, Online-Banking-Abruf, GoBD-konformes Kassenbuch, Rechnungsschreibung. **DATEV Belegtransfer** ist das Upload-Programm (Belegbilder + strukturierte Rechnungsdaten via XML-Schnittstelle online → „Belege online"); es erzeugt eindeutige Beleglinks, die im Buchungsstapel referenziert werden. Einschränkung: Belegtransfer läuft über DATEV mIDentity (kein macOS).

**Kontenrahmen:** **SKR03** (prozessorientiert, nach Geschäftsablauf — beliebt bei EÜR/Freiberuflern und Kleinbetrieben) und **SKR04** (abschlussorientiert, nach Bilanz/GuV-Gliederung). Inhaltlich gleich, nur andere Kontonummern. Sachkonten 4-stellig (Standard), Personenkonten 5-stellig (Debitoren ab 10000, Kreditoren ab 70000). Wechsel nur zum Jahreswechsel (GoB-Stetigkeit). Eine App sollte beide Rahmen unterstützen und den vom Steuerberater genutzten Rahmen abfragen.

### 3. GoBD — Anforderungen an selbstgebaute Buchhaltungssoftware

Rechtsbasis: BMF-Schreiben vom 28.11.2019, geändert 11.3.2024 (GoBD 2024). Kernprinzipien: Nachvollziehbarkeit, Vollständigkeit, Richtigkeit, zeitgerechte Buchung, Ordnung, **Unveränderbarkeit**.

**Konkrete Software-Anforderungen:**
- **Unveränderbarkeit:** Einmal erfasste Buchungen dürfen nicht unprotokolliert geändert/gelöscht werden. Korrekturen nur per **Storno-/Nachbuchung**, nie durch Überschreiben. Jede Änderung mit Datum/Uhrzeit/Benutzer protokollieren (Audit-Trail).
- **Belege im Originalformat:** E-Rechnungen (XRechnung/ZUGFeRD) müssen im digitalen Original (XML) unverändert archiviert werden — ein bloßer PDF-Ausdruck genügt nicht; eine Konvertierung, die die maschinelle Auswertbarkeit zerstört, ist GoBD-widrig.
- **Revisionssichere Archivierung:** unveränderbare Speicherung (Write-Once oder manipulationssicheres Änderungsprotokoll), Vollständigkeit, Recherchierbarkeit über die ganze Aufbewahrungsfrist. Netzlaufwerk/E-Mail-Ordner genügen nicht.
- **Ersetzendes Scannen** ist zulässig, wenn die Verfahrensdokumentation den Scanprozess beschreibt und die digitale Kopie nachweislich dem Original entspricht.
- **Verfahrensdokumentation:** Pflicht — beschreibt Belegerfassung, Buchung, Archivierung, IKS; muss für einen sachverständigen Dritten nachvollziehbar und aktuell sein (nach jeder Prozess-/Softwareänderung). Ohne sie gilt die Buchführung als nicht ordnungsgemäß.
- **Datenzugriff Betriebsprüfung:** drei Stufen — **Z1** (unmittelbarer Lesezugriff im System), **Z2** (mittelbarer Zugriff/Auswertungen), **Z3** (Datenträger-/Datenüberlassung in maschinell auswertbarem Format). Eine App muss alle drei ermöglichen. Der GoBD-Export erfolgt im Beschreibungsstandard (Standardformate wie CSV + maschinenlesbare Datenbeschreibung im XML/index.xml — die aus der GDPdU/IDEA-Welt bekannte Struktur). **GoBD-2024-Neuerung:** „Datenträgerüberlassung" → „Datenüberlassung" (auch über Austauschplattformen); ältere Formate (ASCII-Druckdateien, EBCDIC) nach 31.12.2024 unzulässig.

**Aufbewahrungsfristen (Stand 2025/2026 — wichtig, da mehrfach geändert):**
- **Buchungsbelege (Rechnungen, Kostenbelege, Kontoauszüge, Quittungen): seit 1.1.2025 von 10 auf 8 Jahre verkürzt** (§ 147 Abs. 3 Satz 1 AO, § 257 Abs. 4 HGB, § 14b Abs. 1 Satz 1 UStG — Viertes Bürokratieentlastungsgesetz, verkündet am 19.10.2024 im Bundesgesetzblatt). Laut IHK München gilt: „Acht Jahre für Buchungsbelege und Rechnungen … Diese ab dem 1.1.2025 geltende neue Frist gilt für alle Unterlagen, deren Aufbewahrungsfrist am 31.12.2024 noch nicht abgelaufen ist."
- **Finanzbranche — Sonderbehandlung (Quellenkonflikt, bitte beachten):** Nach Darstellung von EY und IHK Ostthüringen wurde für **Banken, Versicherungen und Wertpapierinstitute** die Verkürzung im „Gesetz zur Modernisierung und Digitalisierung der Schwarzarbeitsbekämpfung" (Kabinett 6.8.2025, Bundestag 13.11.2025) **zurückgenommen** und die 10-Jahres-Frist wiederhergestellt (Cum/Cum-/Cum/Ex-Hintergrund). Eine abweichende Darstellung beschreibt für diesen Sektor lediglich eine gestaffelte Übergangsregelung (2025: 9 Jahre, ab 2026: 8 Jahre). **Für den Einzelunternehmer ist das irrelevant — für ihn gelten unstreitig 8 Jahre.** Die Finanzbranchen-Frist sollte bei Bedarf am Gesetzestext final verifiziert werden.
- **10 Jahre:** Bücher, Inventare, Jahresabschlüsse, Eröffnungsbilanzen, Lageberichte; **6 Jahre:** Handels-/Geschäftsbriefe, sonstige steuerrelevante Unterlagen. **Verfahrensdokumentation:** so lange wie die zugehörigen Unterlagen (im Zweifel 10 Jahre). Fristbeginn jeweils Ende des Entstehungs-Kalenderjahres.
- Konsequenz für die App: Frist-Engine sollte 6/8/10 Jahre pro Belegtyp differenziert und konfigurierbar verwalten.

### 4. E-Rechnung / ZUGFeRD / XRechnung — Zeitplan und Bauanforderungen

**Rechtsbasis:** Wachstumschancengesetz (27.3.2024); BMF-Einführungsschreiben 15.10.2024, weiteres Anwendungsschreiben 15.10.2025 (Aufnahme in den UStAE). Begriffe seit 1.1.2025: **E-Rechnung** (strukturiertes, EN-16931-konformes Format) vs. **sonstige Rechnung** (Papier, einfaches PDF). Ein einfaches PDF ist **keine** E-Rechnung mehr.

**Zeitplan (inländische B2B-Umsätze):**
- **Empfangspflicht: seit 1.1.2025 für ALLE Unternehmen, ohne Übergangsfrist.** Jeder Unternehmer muss E-Rechnungen empfangen und verarbeiten können (mindestens E-Mail-Postfach + Software zur Visualisierung/Verarbeitung).
- **2025–2026 (Versand):** Papier/PDF noch erlaubt (PDF nur mit Zustimmung des Empfängers).
- **2027:** Unternehmen mit **Vorjahresumsatz (2026) > 800.000 €** müssen E-Rechnungen versenden; **≤ 800.000 €** dürfen noch Papier/sonstige Formate nutzen; EDI weiterhin zulässig.
- **ab 1.1.2028:** **alle** Unternehmen müssen im inländischen B2B E-Rechnungen versenden.
- **Ausnahmen:** Kleinbetragsrechnungen ≤ 250 €, Fahrausweise, bestimmte steuerfreie Umsätze (§ 4 Nr. 8–29); Kleinunternehmer (§ 19) müssen ab 2028 keine E-Rechnung ausstellen, aber empfangen können.
- ViDA/EU-Meldesystem: ursprünglich 2028, jetzt 2030/2032 in Diskussion; deutsches Meldesystem nicht vor EU-Lösung.

**Formate (beide EN 16931):**
- **XRechnung:** reine XML-Datei (KoSIT-Standard), v3.0 ab 2025 nur noch CII-Syntax; im B2G verpflichtend (Routing-ID/Leitweg-ID im Feld BT-10). Nicht menschenlesbar ohne Viewer.
- **ZUGFeRD:** Hybrid — **PDF/A-3 mit eingebettetem XML** (CII-Syntax); pragmatisch für KMU, da menschen- und maschinenlesbar. Profile MINIMUM/BASIC/EN 16931/EXTENDED (für die B2B-Pflicht ist mind. EN-16931-Profil sicher). ZUGFeRD 2.x ≈ Factur-X. Eine ZUGFeRD-2.3.2-Datei im EN-16931-Profil entspricht extrahiert einer XRechnung 3.0.2.

**Bauanforderungen an die App:**
- **Empfangen/Verarbeiten** beider Formate (XML-only und hybrid PDF/A-3) — Pflicht seit 2025; Validierung gegen EN 16931 (z. B. via Schematron/KoSIT-Validator/Mustang-Validator).
- **Erstellen/Versenden** valider XRechnung und ZUGFeRD (für 2027/2028).
- **Archivierung:** XML als Original aufbewahren (GoBD); bei ZUGFeRD das hybride PDF; Konsistenz zwischen PDF-Sichtteil und XML sicherstellen.
- Übermittlungswege: E-Mail (ZUGFeRD üblich), Peppol (BIS 3.0, primär UBL — für XRechnung/B2G), zentrale Rechnungseingangsplattformen (ZRE) für Bundesbehörden.

### 5. Lohnabrechnung — hier zwingt das Recht zu zertifizierter Software

**Der Kernpunkt:** Für den **direkten elektronischen Datenaustausch mit den Sozialversicherungsträgern** muss die Entgeltabrechnungssoftware **GKV-zertifiziert / ITSG-systemgeprüft** sein (Systemuntersuchung nach § 22 DEÜV im Auftrag des GKV-Spitzenverbands). Die Software erhält eine **Produkt-Modifikations-Identnummer (Prod-MOD-ID)**, die bei jeder eingehenden Meldung vom SV-Träger geprüft wird; läuft sie ab (spätestens nach einem Jahr), werden Meldungen **abgewiesen**. Geprüft werden u. a. SV-Beitragsberechnung, DEÜV-Meldungen, Beitragsnachweise, AAG-Erstattungsanträge, eAU-Abruf, A1-Bescheinigung, rvBEA. Seit 2011 müssen Bescheinigungen aus **systemgeprüfter Software** oder maschineller Ausfüllhilfe kommen (§ 23 SGB IV).

**Kann man Lohn ohne zertifizierte Software rechtskonform selbst machen?** Faktisch **nein** für die SV-Meldungen. Optionen ohne eigene Zertifizierung:
1. **SV-Meldeportal** (manuelle Ausfüllhilfe der SV-Träger, kostenpflichtig) — führt keine Berechnungen durch.
2. **Auslagerung** an Steuerberater/Lohnbüro.
3. Eigene App nur als **Vorerfassung/Datensammler**, die an eine zertifizierte Engine bzw. den Steuerberater übergibt.
Eine selbstgebaute App darf **nicht** ohne ITSG-Systemprüfung direkt an die SV-Träger melden.

**SV-Meldeportal löst sv.net ab:** Das alte sv.net wurde zum **30.6.2024** endgültig abgeschaltet (inkl. Support); Meldungen ausschließlich über das **SV-Meldeportal** ab 1.7.2024 (reine Webanwendung; gestartet 4.10.2023). Registrierung mit **ELSTER-Organisationszertifikat**; pro Betriebsnummer eine eigene Registrierung. **Seit 2025 kostenpflichtig** (Nutzungszeitraum 3 Jahre). Das Portal macht **keine Berechnungen** und konkurriert nicht mit den professionellen Abrechnungsprogrammen.

**Lohnsteuer-Seite (via ELSTER/ERiC):** **ELStAM**-Abruf (elektronische Lohnsteuerabzugsmerkmale), **Lohnsteuer-Anmeldung** (monatlich/vierteljährlich/jährlich je nach Vorjahres-Lohnsteuer), Lohnsteuerbescheinigung — alle über ELSTER/ERiC. **eAU** (elektronische Arbeitsunfähigkeitsbescheinigung): Arbeitgeber rufen AU-Zeiten elektronisch ab (Verfahren EAA); seit 2022 auch Zeiterfassungssysteme GKV-zertifizierbar, sofern sie eAU abrufen.

**Weitere Lohn-Pflichten:** Beitragsnachweise an Krankenkassen, DEÜV-An-/Ab-/Jahresmeldungen, A1-Bescheinigungen (Auslandseinsatz), Berufsgenossenschaft/Unfallversicherung (elektronischer Lohnnachweis/UV-Meldung), Mindestlohn-Dokumentation (Arbeitszeitaufzeichnung nach MiLoG), euBP (elektronisch unterstützte Betriebsprüfung) und DLS (Digitale Lohnschnittstelle) für Lohnsteuer-Außenprüfungen.

### 6. Weitere Behörden-/Verwaltungspflichten

- **Gewerbesteuererklärung:** elektronisch via ELSTER/ERiC pflichtig (§ 14a GewStG); GewSt-Messbetrag/Zerlegung ebenfalls. Automatisiert vorbereitbar aus der Buchhaltung.
- **IHK-/Handwerkskammer-Beiträge:** Pflichtmitgliedschaft; Beitragsbescheide kammerseitig — App kann Rückstellungen/Zahlungen verwalten, nicht „einreichen".
- **Rundfunkbeitrag (Betriebsstätte):** Pflicht je Betriebsstätte, gestaffelt nach sozialversicherungspflichtig Beschäftigten. Laut Beitragsservice: „Kleinunternehmen mit bis zu 8 Beschäftigten (Staffel 1) zahlen für jede Betriebsstätte nur einen Drittelbeitrag – monatlich 6,12 Euro. Kleinunternehmen mit 9 bis 19 Beschäftigten (Staffel 2) zahlen … monatlich 18,36 Euro." 1 betrieblich genutztes Kfz je Betriebsstätte frei, jedes weitere 6,12 €. **Homeoffice:** Laut Beitragsservice sind „Arbeitsplätze von Selbstständigen … in einer beitragspflichtigen privaten Wohnung … anmeldepflichtige Betriebsstätten. Diese sind jedoch beitragsfrei, wenn die Privatwohnung bereits beim Beitragsservice angemeldet ist und diese Betriebsstätte ausschließlich über die Privatwohnung betreten werden kann." Der Beitragsservice verschickt keine regelmäßigen Zahlungsaufforderungen mehr — Selbstüberwachung nötig (App-Erinnerung sinnvoll).
- **Statistische Meldungen (Statistisches Bundesamt/Landesämter):** je nach Branche/Größe (z. B. Konjunktur-, Umsatzsteuerstatistik); Übermittlung über eSTATISTIK.core/IDEV. Kleine Einzelunternehmen oft nicht/selten betroffen, aber im Einzelfall zu prüfen.
- **Transparenzregister:** Einzelunternehmen sind in der Regel **nicht** meldepflichtig (keine juristische Person/eingetragene Personengesellschaft); die Jahresgebühr von 19,80 € betrifft meldepflichtige Vereinigungen. Für den Einzelunternehmer i. d. R. kein Thema.
- **Berufsgenossenschaft:** Pflichtmitgliedschaft, jährlicher Lohnnachweis (digital, UV-Meldeverfahren).

Automatisierbar als „Vorbereitung": GewSt-Erklärung (aus FiBu), Rundfunkbeitrag-Erinnerung/Stammdaten, BG-Lohnnachweis (über zertifizierte Lohnsoftware), Fristen-/Zahlungsmanagement. Nicht automatisiert einreichbar: Kammerbeiträge (Bescheid-getrieben).

### 7. Banking / Belegfluss

**Kontoumsatz-Import:**
- **PSD2 / XS2A (Open Banking):** der zukunftssichere Weg; Zugriff auf Zahlungskonten über lizenzierte Aggregatoren. **finAPI** (BaFin-lizenziert) ist verbreitet — bietet Drittsoftware Zugang ohne eigene BaFin-Lizenz; deckt nahezu alle DE-Banken (Strom-Konten via XS2A, weitere Kontotypen via FinTS/Web-Scraping-Fallback). DATEV nutzt seit 9/2019 finAPI für seinen „HBCI"-Zugang. Weitere Aggregatoren: Tink, Klarna Kosma, GoCardless.
- **FinTS/HBCI:** klassischer deutscher Standard; laut Wikipedia „wird HBCI seit 2002 von ca. 2000 Banken in Deutschland angeboten, also rund der Hälfte der deutschen Banken" (andere Quellen nennen rund 3.000 über FinTS 3.0 erreichbare Institute). Unterstützt SCA nach PSD2 in FinTS 3.0; nützlich für Kontotypen, die XS2A nicht abdeckt (Sparkonten, Kreditkarten, Depots). Wird teils abgekündigt (z. B. xentral empfiehlt Umstieg auf PSD2), bleibt aber nutzbar. Für Lastschriften teils weiterhin FinTS nötig.
- Praktisch: PSD2/XS2A für Girokonten als Primärweg, FinTS als Fallback; Aggregator (finAPI/Tink/Kosma) zwischenschalten, um die eigene BaFin-Lizenz zu vermeiden.

**Beleg-OCR & automatische Kontierung:** OCR + KI extrahiert Rechnungsdaten (Nummer, Datum, Betrag, Steuersatz, Lieferant, USt-ID), gleicht mit Stammdaten ab und erzeugt **Buchungsvorschläge mit Kontierung und Steuerschlüssel**; das System lernt aus Korrekturen (individueller Lerndatenbestand). **Bankumsatz↔Beleg-Zuordnung:** Matching in beide Richtungen (Beleg sucht Umsatz und umgekehrt) anhand Betrag/Datum/Referenz; für belegfreie Wiederholzahlungen (Miete, Strom, PayPal-Gebühren) Vorschlag einer Buchungskategorie. Lexware Office und DATEV (Bankassistent mit Lerndatenbestand) demonstrieren das Muster.

### 8. Marktüberblick — wo ziehen die Etablierten die Grenze?

- **lexoffice / Lexware Office (Haufe-Lexware):** Komplettlösung; offizielle Angabe „Über 350.000 Kunden und 50.000 Steuerberater nutzen bereits Lexware Office" (erste TÜV-Rheinland-zertifizierte Cloud-Buchhaltung). Inkl. **integrierter, ITSG-zertifizierter Lohnabrechnung** (Lohn & Gehalt; im L-/XL-Tarif), Bankanbindung (FinTS + Open Banking), UStVA/ELSTER, EÜR, GoBD-Langzeitarchiv, sehr enge DATEV-Anbindung (Export + DATEV Cloud Services + Steuerberaterzugang). Lohn erstellt/versendet automatisch Meldungen an Krankenkassen, Finanzamt, Berufsgenossenschaften; XRechnung-Versand ab XL-Tarif.
- **sevDesk:** Cloud-Buchhaltung, DATEV-Export, ELSTER-UStVA, E-Rechnung (XRechnung/ZUGFeRD) — **keine eigene, integrierte Lohnabrechnung** (Lohn nur als Zusatz/über Partner); empfiehlt für Lohn Steuerberater/Lohn-Partner.
- **DATEV Unternehmen online / DATEV Mittelstand:** Goldstandard der Steuerberater-Zusammenarbeit; Belegtransfer, Bankassistent, optimiert für Kanzlei-Zugriff über DATEV-Cloud.
- **BuchhaltungsButler, FastBill, Papierkram, sorted:** Cloud-Buchhaltung/Rechnung mit DATEV-Export und (je nach Tool) Banking/OCR; BuchhaltungsButler dokumentiert GoBD-konformes Arbeiten (Z3-Export, unveränderbare Archivierung in DE-Rechenzentrum).

**Typischer „ein-Klick-zum-Steuerberater"-Workflow:** Belege per OCR erfassen → KI-Buchungsvorschlag mit SKR-Konto/Steuerschlüssel → Bankumsatz automatisch zuordnen → festgeschriebener Buchungsstapel + Belegbilder per DATEV-Format/DATEV-Datenservice an DUO/Kanzlei; UStVA direkt via ELSTER.

**Grenze Selbstmachen ↔ Steuerberater:** Buchhaltung, UStVA, EÜR, E-Rechnung lassen sich selbst machen; **Jahresabschluss/Bilanz, komplexe Steuererklärungen und v. a. die Lohnabrechnung** sind die typischen Übergabepunkte. Lohn bietet von den Reinen-Cloud-Tools praktisch nur Lexware Office integriert und zertifiziert an.

## Recommendations

**Stufe 1 — Buchhaltung & USt (geringstes Risiko, sofort baubar):**
- ERiC-Entwicklerzugang + Hersteller-ID beim Bayerischen Landesamt für Steuern beantragen; ELSTER-Organisationszertifikat (.pfx) als Authentifizierungsbasis einplanen. **Vor Architekturfestlegung** die ERiC-Nutzungsbedingungen im Entwicklerbereich auf SaaS-/Cloud- und Open-Source-Klauseln prüfen (öffentlich nicht abschließend dokumentiert).
- GoBD von Anfang an einbauen: unveränderbarer Audit-Trail, Storno-statt-Löschen, revisionssichere Archivierung im Originalformat, Verfahrensdokumentations-Generator, Z1/Z2/Z3-Export.
- E-Rechnung-Empfang+Verarbeitung (XRechnung + ZUGFeRD, EN-16931-Validierung) als Pflicht-MVP; Versand für 2027/2028 vorsehen.
- DATEV-Übergabe doppelt: EXTF-Buchungsstapel (Datei) **und** DATEV-Datenservice/DATEVconnect (API); SKR03 und SKR04 unterstützen.
- Banking über PSD2/XS2A-Aggregator (finAPI o. ä.) + FinTS-Fallback; OCR/KI-Kontierung mit Lerndatenbestand.

**Stufe 2 — Steuer-Vorbereitung erweitern:** EÜR, ESt (Gewinneinkünfte), GewSt automatisiert aus der FiBu vorbereiten und via ERiC übermitteln; Fristen-/Zahlungs-Engine inkl. Rundfunkbeitrag-Erinnerung und Aufbewahrungsfristen (6/8/10 Jahre differenziert).

**Stufe 3 — Lohn (nur mit Zertifizierung oder Partner):** Realistisch zunächst als Vorerfassung mit Übergabe an Steuerberater/zertifizierte Engine bauen. Eigene Direktmeldung an SV-Träger **nur** nach erfolgreicher ITSG-Systemprüfung (Prod-MOD-ID, jährliche Requalifizierung). Lohnsteuer-Seite (ELStAM, LStA) ist über ERiC machbar; die SV-Seite ist die zertifizierungspflichtige Hürde.

**Schwellen, die Entscheidungen ändern:** Vorjahres-USt-Zahllast 9.000 €/2.000 € (Voranmeldungsrhythmus); 800.000 € Vorjahresumsatz (E-Rechnungs-Versandpflicht 2027); 1.1.2028 (E-Rechnungs-Versandpflicht für alle); Aufbewahrung 8 Jahre (Einzelunternehmer) vs. 10 (Finanzbranche).

## Caveats
- **Keine Rechts-/Steuerberatung:** Diese Faktenbasis ersetzt keine Einzelfallberatung; die App soll nicht beraten, sondern technisch vorbereiten.
- **ERiC-Lizenzdetails (SaaS/Open Source) sind öffentlich nicht abschließend dokumentiert** — verbindlich nur im passwortgeschützten Entwicklerbereich; vor Cloud-Architektur prüfen.
- **Aufbewahrungsfristen sind politisch volatil und quellenseitig uneinheitlich:** 10→8 (BEG IV 2025), Sonderbehandlung der Finanzbranche (10 Jahre laut EY/IHK Ostthüringen bzw. gestaffelt 9→8 laut anderer Quelle) — für Einzelunternehmer aber unstreitig 8 Jahre; Fristen-Engine konfigurierbar halten.
- **ViDA/EU-Meldesystem** ist Zukunft (2030/2032 im Gespräch) — Architektur für späteres E-Reporting offen halten.
- **Zertifizierungszwang Lohn** ist die größte Realisierungshürde des „Dienstleister-ersetzen"-Ziels; ohne ITSG-Systemprüfung ist die direkte SV-Meldung aus Eigensoftware nicht zulässig.