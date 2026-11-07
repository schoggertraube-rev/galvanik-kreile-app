// Generated from BAUPLAN SHA-256 9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

import { runWithExpectedRed } from "./_expectedRed";
const cases = [
  {
    "id": "T01",
    "titel": "8.11 öffnet mit den gespeicherten Werten (Puffer 1, passt 80, knapp 100, zu wenig 50, Vorrang 110)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].inhalt",
      "screens[termineinst].zustaende.leer",
      "verhalten_appweit.termin_einstellungen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "termineinst"
        },
        {
          "id": "termineinst.tagesleistung",
          "erwartung": "nicht_leer"
        },
        {
          "id": "termineinst.puffer",
          "erwartung": "wert",
          "wert": "1"
        },
        {
          "id": "termineinst.grenze_passt",
          "erwartung": "wert",
          "wert": "80"
        },
        {
          "id": "termineinst.grenze_knapp",
          "erwartung": "wert",
          "wert": "100"
        },
        {
          "id": "termineinst.grenze_wenig",
          "erwartung": "wert",
          "wert": "50"
        },
        {
          "id": "termineinst.grenze_vorrang",
          "erwartung": "wert",
          "wert": "110"
        },
        {
          "id": "termineinst.speichern",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "T02",
    "titel": "„Speichern“: Toast, Dialog zu, neuer Wert in company_settings",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].aktionen[speichern]",
      "verhalten_appweit.termin_einstellungen"
    ],
    "deckt": [
      "termineinst.speichern",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.grenze_passt",
        "aktion": "tippen",
        "wert": "70"
      },
      {
        "id": "termineinst.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Termin-Einstellungen gespeichert"
        },
        {
          "id": "termineinst",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "company_settings",
          "wo": {
            "id": "{termine_einstellungen}"
          },
          "werte": {
            "auslastung_passt_pct": 70
          }
        },
        {
          "tabelle": "company_settings",
          "wo": {
            "id": "{termine_einstellungen}"
          },
          "werte": {
            "auslastung_knapp_pct": 100
          }
        }
      ]
    }
  },
  {
    "id": "T03",
    "titel": "Puffer außerhalb 0–10: Feldfehler, nichts gespeichert",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].inhalt[0].felder[puffer].pruefung",
      "screens[termineinst].zustaende.teilweise",
      "verhalten_appweit.speichern"
    ],
    "deckt": [
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.puffer",
        "aktion": "tippen",
        "wert": "11"
      },
      {
        "id": "termineinst.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "termineinst"
        },
        {
          "id": "termineinst.puffer.fehler",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "company_settings",
          "wo": {
            "id": "{termine_einstellungen}"
          },
          "werte": {
            "uebergabepuffer_tage": 1
          }
        }
      ]
    }
  },
  {
    "id": "T04",
    "titel": "„knapp“ unter „passt“: Feldfehler an „knapp“, nichts gespeichert",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].inhalt[1].felder[grenze_knapp].pruefung",
      "verhalten_appweit.speichern"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.grenze_knapp",
        "aktion": "tippen",
        "wert": "70"
      },
      {
        "id": "termineinst.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "termineinst"
        },
        {
          "id": "termineinst.grenze_knapp.fehler",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "company_settings",
          "wo": {
            "id": "{termine_einstellungen}"
          },
          "werte": {
            "auslastung_knapp_pct": 100
          }
        }
      ]
    }
  },
  {
    "id": "T05a",
    "titel": "Ohne Änderung: Abbrechen schließt sofort ohne Rückfrage",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].aktionen[abbrechen]",
      "verhalten_appweit.rueckfrage.ohne_aenderung"
    ],
    "deckt": [
      "termineinst.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "termineinst",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "T05b",
    "titel": "Ohne Änderung: × schließt sofort ohne Rückfrage",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].aktionen[abbrechen]",
      "verhalten_appweit.rueckfrage.ohne_aenderung"
    ],
    "deckt": [
      "termineinst.schliessen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "termineinst",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "T05c",
    "titel": "Ohne Änderung: Esc schließt sofort ohne Rückfrage",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].aktionen[abbrechen]",
      "verhalten_appweit.rueckfrage.ohne_aenderung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "termineinst",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "T06",
    "titel": "Mit Änderung: Esc → Rückfrage über 8.11; „Verwerfen“ schließt ohne zu speichern",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage",
      "verhalten_appweit.aenderung",
      "screens[entwurf]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.grenze_passt",
        "aktion": "tippen",
        "wert": "70"
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
            "id": "termineinst",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "text_enthaelt",
            "wert": "Auslastung „passt“ bis"
          },
          {
            "id": "entwurf.speichern",
            "erwartung": "sichtbar"
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
          "id": "termineinst",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "company_settings",
          "wo": {
            "id": "{termine_einstellungen}"
          },
          "werte": {
            "auslastung_passt_pct": 80
          }
        }
      ]
    }
  },
  {
    "id": "T07",
    "titel": "Speichern scheitert: „Nicht gespeichert · Eingaben sind noch da“; „Erneut“ speichert",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].zustaende.fehler"
    ],
    "deckt": [
      "termineinst.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe (einstellungen › Kachel „Termine & Auslastung“; Reiter werkstatt fehlt in einstellungen.arg_ist)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "termineinst.grenze_passt",
        "aktion": "tippen",
        "wert": "70"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "termineinst.speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "termineinst.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nicht gespeichert · Eingaben sind noch da"
          },
          {
            "id": "termineinst.grenze_passt",
            "erwartung": "wert",
            "wert": "70"
          },
          {
            "oben": "termineinst"
          }
        ],
        "db": [
          {
            "tabelle": "company_settings",
            "wo": {
              "id": "{termine_einstellungen}"
            },
            "werte": {
              "auslastung_passt_pct": 80
            }
          }
        ]
      },
      {
        "id": "termineinst.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Termin-Einstellungen gespeichert"
        },
        {
          "id": "termineinst",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "company_settings",
          "wo": {
            "id": "{termine_einstellungen}"
          },
          "werte": {
            "auslastung_passt_pct": 70
          }
        }
      ]
    }
  },
  {
    "id": "T08",
    "titel": "Ohne Recht „entscheiden“ (nur „einstellungen“): 8.11 lesbar, kein „Speichern“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[termineinst].regeln (Runde 40)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_einstellungen",
      "datenlagen": [
        "termine_einstellungen"
      ],
      "aufruf": {
        "seite": "termineinst",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "screens[termineinst].aufrufe"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "termineinst"
        },
        {
          "id": "termineinst.puffer",
          "erwartung": "wert",
          "wert": "1"
        },
        {
          "id": "termineinst.speichern",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.describe("BAUPLAN Wege · termineinst", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      await prepareGeneratedSeed(flowCase);
      await runWithExpectedRed(flowCase.id, red, () => runGeneratedFlowCase(page, flowCase));
    });
  }
});
