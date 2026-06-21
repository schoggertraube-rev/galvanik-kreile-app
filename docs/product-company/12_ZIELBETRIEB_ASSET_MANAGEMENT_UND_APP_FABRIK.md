# Zielbetrieb: Asset Management und App-Fabrik

## 1. Grundmodell

```
DU
Ideen · Wünsche · HTML-Mocks · geschäftliche Freigaben
        │
        ▼
COWORK – Chief Innovation Partner
Ideenaufnahme · Discovery · Routing · Rückmeldung
        │
        ▼
MISSION CONTROL
GitHub Projects/Linear · IDEA/MISSION/DEFECT/RELEASE
        │
        ├───────────────┐
        ▼               ▼
ASSET CATALOG       CLAUDE CODE
Versionen           Agenten · Worktrees · Code · Tests
        │               │
        └───────┬───────┘
                ▼
CI / PREVIEW / REVIEW
                ▼
PRODUKTION
                ▼
MONITORING UND WIRKUNG
```

## 2. Minimaler Werkzeugstapel

### Unverzichtbar

- Claude Cowork
- Claude Code
- GitHub
- GitHub Projects oder Linear
- GitHub Actions
- Vercel
- Supabase
- Playwright

### Für hochwertige Produktarbeit

- Figma
- Storybook
- Visuelle Regression (z. B. Chromatic)
- Sentry
- PostHog oder vergleichbare Produktanalytik

### Für Assets und Sicherheit

- Supabase Storage, S3 oder Cloudflare R2
- 1Password, Infisical oder Vault

## 3. Asset-Katalog

Start als Datei: `product-assets.yaml`  
Später als interne Supabase-Tabelle und kleine Verwaltungsoberfläche.

## 4. Firmenkern und Kundenprojekte

### Gemeinsamer Kern

`product-company-core` enthält: Agenten · Skills · Hooks · Evals · Mission Templates · Asset-Schema · Qualitätsgates · Connector-Verträge.

### Pro Kundenprojekt

Eigenes Repository mit: USP · Twins · CI · Datenmodell · Missionen · kundenspezifischen Assets.

Keine Live-Kopplung der Kundendaten zwischen Projekten.

## 5. Verhalten bei einer neuen Idee

1. Cowork erfasst die Idee.
2. Mission-System erzeugt IDEA-ID.
3. Product Strategy und UX prüfen Problem und USP.
4. UX erstellt bei sichtbarer Änderung einen Nullbasis-Prototyp.
5. Daten, Architektur, Security und Performance prüfen Machbarkeit.
6. Mission wird freigegeben.
7. Claude Code baut im Worktree.
8. CI und unabhängige Review prüfen.
9. Preview wird abgenommen.
10. Produktion und Wirkung werden gemessen.

## 6. Deine Aufgabe als Stakeholder

Du lieferst nur:

- Idee oder Problem
- optional Screenshot/HTML-Mock
- Entscheidung bei Kosten, Vertrag, Recht oder grundlegender Produktausrichtung
- Endabnahme des sichtbaren Zielprodukts

Die Firma übernimmt alle technischen und fachlichen Zwischenschritte.
