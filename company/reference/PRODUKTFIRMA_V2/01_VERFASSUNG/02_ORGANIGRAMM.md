# ORGANIGRAMM

Schlanker, steuerbarer Kern. Tiefe durch Spezialisten-Katalog, Kontrolle durch wenige aktive Rollen.

---

## 1. Gesamtbild

```
                          DU (Stakeholder, Ebene A)
                          USP · Ideen · Twins · Endabnahme
                                     │
                                     ▼
                    ┌────────────────────────────────────┐
                    │        PERSISTENTER KERN            │
                    │        (3 Rollen, immer aktiv)      │
                    ├────────────────────────────────────┤
                    │  Mission Coordinator                │  ← deine Hauptschnittstelle
                    │  Product Steward (USP-Wächter)      │
                    │  Chief Verifier (GPT-5, unabhängig) │  ← gibt nichts ohne Beweis frei
                    └────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
      ┌──────────────┐     ┌──────────────────┐    ┌────────────────────┐
      │ USER-TWIN-RAT│     │ SPEZIALISTEN-POOL│    │   DAUER-DIENSTE     │
      │ (deine Twins)│     │ ~40 Rollen,      │    │ Market Scout        │
      │ Veto-Recht   │     │ wenige je Mission│    │ Knowledge Officer   │
      └──────────────┘     │ AKTIV (hire/fire)│    └────────────────────┘
                           └──────────────────┘
```

---

## 2. Persistenter Kern (immer aktiv)

| Rolle | Mandat | Modell-Tier |
|---|---|---|
| **Mission Coordinator** | Nimmt Ideen, vergibt IDEA-IDs, klärt Komplexität, stellt Spezialisten ein/aus, koordiniert Missionen, hält Rückmeldung an dich. Entscheidet nicht allein über Produkt. | T2 |
| **Product Steward** | Wächter des USP. Prüft jede Idee/jeden Bau gegen die USP-Verfassung. Bereitet deine Entscheidungsvorlagen vor. Schützt deine Originalintention. | T2 |
| **Chief Verifier** | Unabhängige Abnahme. Bekommt Beweis-Artefakte, nicht Worte. Blockiert jede Fertig-/Live-Meldung ohne Beleg. Anderes Modell als der Builder. | T4 (GPT-5) |

---

## 3. User-Twin-Rat

Deine hochgeladenen Nutzerprofile. **Pflicht-Konsultation** bei: Konzept, Visual Pitch, vor Livegang. **Veto-Recht:** Ein gebauter Weg, der einen Twin nachweislich überfordert, geht nicht live. Twins ändert nur der Stakeholder (Versionssperre).

---

## 4. Spezialisten-Pool (Katalog, on-demand aktiv)

11 Abteilungen, ~40 Rollen. Vollständige Beschreibung mit Fähigkeitsprofilen: `03_AGENTUR_PERSONAL/00_ROSTER_HANDBUCH.md`.

| Abteilung | Kürzel |
|---|---|
| A Produktstrategie & USP | STR |
| B User Intelligence & Research | USR |
| C Product Experience & Design | UX |
| D Plattform & Architektur | ARC |
| E Product Engineering | ENG |
| F Data, AI & Automation | DATA |
| G Integrations & Ecosystem | INT |
| H Security, Privacy & Trust | SEC |
| I Quality, Reliability & Release | QA |
| J Operations & Customer Success | OPS |
| K Continuous Learning (Dauerdienst) | LRN |

**Aktivierungsregel:** Je Mission wird nur das eingestellt, was der Mission Coordinator für diese Mission braucht. Der Rest bleibt auf Standby. So kommt jede Abteilung „im richtigen Moment umfassend zum Zug", ohne dass 40 Rollen gleichzeitig Lärm machen.

---

## 5. Mission Teams

Für jede Idee entsteht ein temporäres, interdisziplinäres Team aus Kern + relevanten Spezialisten + Twin-Konsultation. Es besitzt einen **vollständigen Nutzerweg** als Ergebnis — nicht „Frontend fertig / Backend fertig", sondern „der definierte Nutzer erreicht sein Ziel in Produktion, vollständig, verständlich, sicher". Nach Abschluss löst sich das Team auf, Spezialisten gehen auf Standby.

---

## 6. WIP-Grenzen (Schutz vor Chaos)

- max. 3 aktive Missionen gleichzeitig,
- max. 1 Änderung am Kernvertrag je Domäne gleichzeitig,
- kein paralleler Umbau desselben UI-Grundmusters,
- keine neue Mission bei offenem P0/P1,
- keine direkte Arbeit auf `main`.
