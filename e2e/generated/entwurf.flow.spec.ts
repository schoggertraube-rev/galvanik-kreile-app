// Generated from BAUPLAN SHA-256 888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "D01",
    "titel": "Rückfrage aus 3 mit buchbarer Erfassung: „Buchen“ statt „Speichern“; Buchen bucht und schließt beide Ebenen",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage.erfassung_3",
      "verhalten_appweit.rueckfrage.knoepfe",
      "screens[entwurf].aktionen[speichern]"
    ],
    "deckt": [
      "entwurf.speichern",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "(leer)",
        "weg": [
          {
            "id": "navigation.plus",
            "aktion": "klicken"
          },
          {
            "id": "rein.auftrag-erfassen",
            "aktion": "klicken"
          }
        ],
        "quelle": "werkbank.interaktion[aufruf-leer] · rein.inhalt.ohne_vorlage[auftrag-erfassen]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "entwurf"
          },
          {
            "id": "eingang",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf.speichern",
            "erwartung": "text",
            "wert": "Buchen"
          },
          {
            "id": "entwurf.verwerfen",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf.weiter-bearbeiten",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf.entwurf-behalten",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "entwurf.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        },
        {
          "id": "eingang",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "D02",
    "titel": "Enter in der Rückfrage = Hauptaktion des Fensters (5.2 Speichern)",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage.bedienung",
      "screens[entwurf].aktionen[speichern].taste"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstieg außerhalb dieser Seite"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.email",
        "aktion": "tippen",
        "wert": "neu@alpha-pruef.test"
      },
      {
        "id": "kundebearbeiten.abbrechen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "entwurf"
          }
        ]
      },
      {
        "aktion": "taste",
        "wert": "Enter"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde gespeichert"
        },
        {
          "id": "kundebearbeiten",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_vollstaendig_firma}"
          },
          "werte": {
            "email": "neu@alpha-pruef.test"
          }
        }
      ]
    }
  },
  {
    "id": "D03",
    "titel": "Rückfrage aus 3, noch nicht buchbar: kein „Buchen“; „Als Entwurf ablegen“ aktiv (X12 Stufe 1, Runde 48 (Owner 03.11.))",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage.erfassung_3",
      "screens[entwurf].aktionen[entwurf-behalten]",
      "screens[entwurf].regeln[3]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "eingang",
        "arg": "(leer)",
        "weg": [
          {
            "id": "navigation.plus",
            "aktion": "klicken"
          },
          {
            "id": "rein.auftrag-erfassen",
            "aktion": "klicken"
          }
        ],
        "quelle": "werkbank.interaktion[aufruf-leer] · rein.inhalt.ohne_vorlage[auftrag-erfassen]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "entwurf"
        },
        {
          "id": "entwurf.speichern",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf.entwurf-behalten",
          "erwartung": "sichtbar"
        },
        {
          "id": "entwurf.entwurf-behalten",
          "erwartung": "aktiv"
        },
        {
          "id": "entwurf.verwerfen",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "D04",
    "titel": "Menüwechsel mit Änderung: Rückfrage genau einmal vor dem Verlassen; „Verwerfen“ öffnet das Ziel",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage.ausloeser",
      "verhalten_appweit.rueckfrage.ebenen"
    ],
    "deckt": [
      "entwurf.verwerfen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "eingang",
        "arg": "(leer)",
        "weg": [
          {
            "id": "navigation.plus",
            "aktion": "klicken"
          },
          {
            "id": "rein.auftrag-erfassen",
            "aktion": "klicken"
          }
        ],
        "quelle": "werkbank.interaktion[aufruf-leer] · rein.inhalt.ohne_vorlage[auftrag-erfassen]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "entwurf"
          },
          {
            "id": "eingang",
            "erwartung": "sichtbar"
          },
          {
            "dialoge": 2
          }
        ]
      },
      {
        "id": "entwurf.verwerfen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "nachrichten"
        },
        {
          "id": "eingang",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "D05",
    "titel": "Als Entwurf ablegen speichert je Login und steht auf Der Tag; Weiter bearbeiten stellt den Stand her",
    "paket": "AP-EIN",
    "quelle": [
      "screens[entwurf].x12_stufe1",
      "screens[entwurf].datenmodell"
    ],
    "deckt": [
      "entwurf.entwurf-behalten"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "(leer)",
        "weg": [
          {
            "id": "navigation.plus",
            "aktion": "klicken"
          },
          {
            "id": "rein.auftrag-erfassen",
            "aktion": "klicken"
          }
        ],
        "quelle": "werkbank.interaktion[aufruf-leer] · rein.inhalt.ohne_vorlage[auftrag-erfassen]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz Entwurf"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      },
      {
        "id": "entwurf.entwurf-behalten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Entwurf gespeichert · steht auf Der Tag"
        },
        {
          "oben": "tag"
        },
        {
          "text": "Entwurf · {kunde_vollstaendig_firma.name}",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_drafts",
          "neu": 1,
          "werte": {
            "login": "{login}",
            "art": "eingang"
          }
        },
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "D06",
    "titel": "Entwurf: Weiter bearbeiten öffnet 3 mit Stand; Buchen löscht den Entwurf in derselben Transaktion",
    "paket": "AP-EIN",
    "quelle": [
      "screens[entwurf].x12_stufe1"
    ],
    "deckt": [
      "tag.entwurf.weiter-bearbeiten"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "entwurf_eigen"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "quelle": "screens[tag].regeln[3]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "tag.entwurf.weiter-bearbeiten",
        "aktion": "klicken"
      },
      {
        "id": "eingang.erfassen-text",
        "erwartung": "wert",
        "wert": "{entwurf_eigen.text}"
      },
      {
        "id": "eingang.menge",
        "aktion": "tippen",
        "wert": "20",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "{auftrag} gebucht"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1
        },
        {
          "tabelle": "intake_drafts",
          "neu": -1
        }
      ]
    }
  },
  {
    "id": "D07",
    "titel": "Entwurf eines anderen Logins ist unsichtbar",
    "paket": "AP-EIN",
    "quelle": [
      "screens[entwurf].x12_stufe1"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "entwurf_fremd"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "quelle": "screens[tag].regeln[3]"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "text": "Entwurf ·",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · entwurf", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
