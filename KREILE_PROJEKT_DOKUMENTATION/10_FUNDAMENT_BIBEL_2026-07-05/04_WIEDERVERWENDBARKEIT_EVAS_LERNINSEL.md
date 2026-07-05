# 04 · Wiederverwendbarkeit — Kann das Fundament Evas Lerninsel & andere Projekte tragen?

## Kurzantwort

**Ja — aber nicht im heutigen Zustand, und nicht per einfachem Fork.** Der *generische Kern* ist wiederverwendbar und gut. Aber genau die drei Dinge, die man für ein Mehrprojekt-Fundament am dringendsten braucht — **echte Mandantentrennung, ein kanonischer Datenpfad, reproduzierbares Schema** — sind heute kaputt (Cluster A/B/C). Ein Fork des aktuellen Stands würde diese Defekte **mitkopieren** und du hättest dasselbe Problem in zwei Projekten.

**Empfehlung:** Erst Kreile bis **Welle 3** sanieren (dann sind Tenant-aus-Session, App-Rolle + FORCE RLS, kanonischer Pfad da), **dann** den generischen Kern als sauberes **Starter-Template** ausgründen. Der Zusatzaufwand dafür ist danach gering, weil die Sanierung genau die Mehrprojekt-Fähigkeit herstellt.

---

## Was ist generischer Kern vs. Kreile-Domäne?

| Baustein | Einordnung | Wiederverwendbar für Evas Lerninsel? |
|---|---|---|
| Auth: HMAC-Session, Guards, Rollen/Permissions (`appSession`, `authorization`, `roles`, `permissions`) | **generischer Kern** | ✅ ja (nach PIN-Hash-Fix; Rollen anpassen: Therapeutin/Eltern/Kind statt Rolf/Philipp/Michael) |
| Tenant-Mechanik (aktuell hardcodiert + tote RLS) | **Kern, aber defekt** | ⚠️ erst nach Welle 3 (App-Rolle, FORCE RLS, Tenant-aus-Session) |
| Offline-Outbox (IndexedDB) | **generischer Kern** | ✅ ja (Termin-/Antragserfassung offline) |
| Capture/OCR (Gemini-Client, Scan→Struktur) | **generischer Kern** | ✅ ja (z.B. Anträge/Bögen scannen) — sehr wertvoll für eine Praxis |
| SQL-View-Muster (KPI in Views) | **generisches Muster** | ✅ ja (Auslastung, offene Termine, Umsatz) |
| Transaktionslogik (advisory lock, atomare Anlage) | **generischer Kern** | ✅ ja (Termin/Antrag atomar anlegen) |
| UI-Shell (RightNav, TopWorkflowBar, Startscreen, Karten) | **Kern mit Domänenfärbung** | ✅ Grundgerüst ja, Inhalte/Stationen ersetzen |
| Register-/Governance-Maschinerie (Cowork) | **generischer Prozess** | ✅ ja — projektunabhängig nützlich |
| Galvanik-Domäne: Bäder, Stationen, Warendurchlauf, Oberflächen | **reine Kreile-Domäne** | ❌ nein (durch Lerntherapie-Domäne ersetzen) |
| Buchhaltung (BWA, DATEV, Belege, Perioden) | **Kreile-Domäne** (teils generisch) | 🔶 teilweise (jede Firma braucht Belege, aber Umfang ist Kreile-spezifisch) |
| Kunden-/Auftragskartei | **Kern mit Domänenfärbung** | ✅ Struktur ja (Kunde→Klient, Auftrag→Therapiefall/Antrag) |

## Der DSGVO-Faktor bei Evas Lerninsel (wichtig!)

Evas Lerninsel ist Lerntherapie — **Kinder, potenziell Gesundheitsdaten, besonders schützenswert**. Das erhöht die Latte: Die heute toten Sicherheitsschichten (Cluster A) sind dort **nicht optional**, sondern rechtlich zwingend. Das ist ein weiteres starkes Argument, **zuerst** die Sicherheits-/Tenant-Sanierung (Welle 0 + 3) zu machen und erst den *gehärteten* Kern zu übernehmen. Ein Fork des unsicheren Ist-Zustands in ein Kinderdaten-Projekt wäre ein Compliance-Risiko.

## Drei Optionen im Vergleich (Fachvotum Platform Architecture)

| Option | Aufwand | Risiko | Zeitgewinn | Wartbarkeit | Urteil |
|---|---|---|---|---|---|
| **(a) Heutiges Repo forken & ausmisten** | mittel | **hoch** — kopiert tote RLS, Tenant-Hardcode, Mock-Dualität | scheinbar schnell | schlecht (zwei defekte Kopien) | ❌ nicht empfohlen |
| **(b) Sauberen Kern sofort als Template extrahieren** | hoch | hoch — man extrahiert Defektes | mittel | mittel | 🔶 nur wenn Kreile aufgegeben würde |
| **(c) Erst Kreile bis Welle 3 sanieren, dann Kern ausgründen** | mittel (Sanierung ohnehin nötig) | **niedrig** | am nachhaltigsten | **gut** | ✅ **empfohlen** |

## Was der generische Starter-Kern nach Sanierung enthalten würde

```
kern-template/
├── auth/            # Session, Guards, Rollen, PIN(gehasht) — Rollen konfigurierbar
├── tenant/          # App-Rolle, FORCE RLS, SET LOCAL app.tenant_id (aus Session)
├── data/            # EIN kanonischer Server-Datenpfad (Drizzle + Tenant-Kontext)
├── offline/         # eine IndexedDB-Outbox (Blob, idempotent)
├── capture/         # Foto/Scan → Original sichern → OCR/KI → Zuordnung
├── views/           # KPI-in-SQL-Muster
├── ui-shell/        # Startscreen, Nav, Karten, leere/Fehlerzustände
└── governance/      # Register-/Missionsmaschinerie
```
Darauf setzt jedes Projekt seine **Domänen-Module**: Kreile → Galvanik-Stationen; Evas Lerninsel → Termine/Klienten/Anträge; nächstes Projekt → seine Entitäten.

## Konkrete „Impliziere-das"-Liste, um das Fundament weiterzuverwenden

1. **Tenant nie hardcoden** — immer aus Session. (Behebt F-H1, macht Multi-Projekt erst möglich.)
2. **App-Rolle + FORCE RLS + `SET LOCAL`** als unverhandelbares Architektur-Fundament. (Behebt F-A1/A2/A3.)
3. **Genau ein Datenpfad**, kein Mock-Schalter. (Behebt F-C1 — die Kernursache.)
4. **Domänenmodule klar von Kern trennen** (eigener Ordner, klare Grenze, kein Quer-Import Kern→Domäne).
5. **Schema nur über versionierte Migrationen**, kein `db push`. (Behebt F-B1/B2/B4 — macht jedes neue Projekt reproduzierbar.)
6. **Register-Pflicht** ab Projekt-Tag-1 (nicht wie hier nachträglich).

**Fazit:** Du musst **nicht** von vorne beginnen. Du musst das Fundament **einmal richtig sanieren** — und bekommst dabei als Nebenprodukt genau die Mehrprojekt-Fähigkeit, die Evas Lerninsel braucht.
