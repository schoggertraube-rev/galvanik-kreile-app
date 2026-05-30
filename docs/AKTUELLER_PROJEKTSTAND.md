# 📊 Aktueller Projektstand: Galvanik-Kreile-WerkstattCockpit
*Stand: 30. Mai 2026*

Dieses Dokument dokumentiert den aktuellen bereinigten Live-Zustand des WerkstattCockpits nach dem erfolgreichen Abschluss aller Kern-Integrationspakete.

---

## 1. Branch- & Deployment-Status

* **Haupt-Branch**: `main` (sauber und synchron mit `origin/main`).
* **Live-Status**: Alle Pakete sind vollständig verifiziert, kompiliert und live auf der Vercel-Produktionsumgebung deployst.
* **Letzter Live-Commit**: `5975f9c` (Dokumenten-Rettung: * handoff & USP review notes *).
* **Live-URL**: `https://galvanik-kreile-werkstatt.vercel.app`

---

## 2. Erledigte Integrationspakete (Sauber deployst)

1. **Company Settings** (Stammdatenverwaltung vollständig integriert)
2. **E-Mail-Templates** (Idempotente DB-Migration `0014`, HTML-Template-Logik, Admin-Formular-Abschnitt mit interaktiver Live-Vorschau)
3. **UI-Cleanup** (Visuelle Bereinigung, optimierte mobile Navigation und Modals)
4. **Queue/Kontrolle** (Echte Vollständigkeitsprüfung aller Kundenaufträge im Warenausgang, Kundengruppierung/-sortierung in der Galvanik-Queue und optimiertes Parameter-Routing in der Kontrollansicht)
5. **Performance/Recharts** (Saubere Integration der `recharts` Visualisierungs-Dependency sowie typsichere Server-Actions zur Dashboard-Darstellung)
6. **Übergabe-Dokumentation** (Erfolgreiche Integration von `UEBERGABE_BACKLOG.md` und `UX_REVIEW_USP.md`)

---

## 3. Sicherheits-Tags & Archivierung

### Gesetzte Sicherheits-Tags:
* `checkpoint-2026-05-30-company-settings-email-templates-live` (Sicherung nach der Integration der E-Mail-Templates)
* `checkpoint-2026-05-30-performance-charts-live` (Sicherung nach dem Performance/Recharts-Deploy)

### Git-Bereinigung & Archivierung:
* Alle unhandlichen Stashes wurden **vollständig gelöscht**, um den Git-Arbeitsbaum sauber und übersichtlich zu halten.
* Zur permanenten Datensicherung aller historischen WIP-Strukturierungen und Backups wurden vor der Bereinigung die folgenden **Archiv-Branches** angelegt:
  * `backup/stash-0-ui-email-demo` (Historischer UI- & E-Mail-WIP)
  * `backup/stash-1-performance-queue-pdf` (Historischer Recharts- & PDF-WIP)
  * `backup/stash-2-session-3-substanz` (Vollständiges Backup der Session 3 inklusive Leitfäden)

---

## 4. Wichtige Arbeits- und Entwicklungsregeln (Eisern einzuhalten!)

> [!IMPORTANT]
> **1. Force-Push-Verbot**
> Es ist unter allen Umständen **strengstens verboten**, einen Force-Push (`git push --force`) auf den `main`-Branch auszuführen! Alle Änderungen müssen regulär gepusht werden.

> [!WARNING]
> **2. Datenbank-Änderungen & Migrationen**
> Bei künftigen Änderungen am Datenmodell ist stets der vollständige Drizzle-Migrationsprozess zu beachten:
> 1. Drizzle-Schema `src/db/schema.ts` aktualisieren.
> 2. Drizzle-Migration lokal generieren und verifizieren.
> 3. SQL-Migration remote auf Supabase anwenden.
> 4. Schema-Cache remote aktualisieren, bevor Code-Änderungen live gehen.
> 5. DB-Bezug vor remote-Ausführung immer erst an den Benutzer berichten.

---

## 5. Offene nächste Themen

* **RLS & Rollenmodell prüfen**: Supabase Row Level Security (RLS) Policies für den Live-Betrieb absichern und Rollenmatrix auf Datenbank-Ebene härten.
* **Admin- & Übergabe-Accounts planen**: Umstellung aller Entwickler- und Authentifizierungs-Accounts auf die finalen Kunden-Accounts für die Übergabe.
* **Demo-Daten-Verwaltung**: Konzeptionierung einer kontrollierten und spurlos löschbaren Demo-Daten-Generierung (ohne Beeinträchtigung echter Kundendaten).
* **Nächste Produktfunktion**: Jede künftige Funktionserweiterung muss vorab separat geplant, auf DDL-Relevanz geprüft und sauber isoliert im Feature-Branch entwickelt werden.
