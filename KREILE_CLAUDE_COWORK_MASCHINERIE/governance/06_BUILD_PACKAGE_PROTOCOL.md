# Protokoll für jedes Baupaket

## Paketkopf

```text
WORK-PACKAGE-ID:
Titel:
Projektphase:
Owner:
Pflichtspezialisten:
Status:
```

## Pflichtinhalt

- bestätigte Anforderung
- Symptom, Ursache und Evidenz
- betroffene Nutzer und wirtschaftliche Auswirkung
- Tabellen, Spalten, FKs und Views
- TypeScript-Typen, Actions, Repositories und Props
- Events, Analytics und Rollen
- alle Konsumenten
- Nutzerfluss
- Loading/Empty/Error/Data/Unauthorized/Offline/Saving/Success/Conflict
- Nicht-Scope
- STOPP-Bedingungen
- nummerierte Akzeptanzkriterien
- Rollback

## Prüfphase

```text
P1 npx tsc --noEmit
P2 npm run lint
P3 npm run test
P4 npm run build
P5 git diff --stat
P6 git status --short
```

Zusätzlich DB-Query, Servernachweis, UI-Nachweis, Reload, Rollen, Responsive, Performance, Security und Produktion bei Release.
