// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "G01",
    "titel": "Aus dem Gespräch „Aufgabe“: Art Aufgabe, Für ich, fällig heute, Bezug Kunde; „Auf Der Tag“ legt sie an",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].inhalt[0].felder",
      "screens[aufgabe].aktionen[speichern]",
      "screens[aufgabe].abnahme[4]",
      "eingang.befehle[aufgabe.speichern]"
    ],
    "deckt": [
      "aufgabe.speichern",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "nachrichten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "screens[nachrichten].arg_ist (Kunde = Gruppe des Kunden geöffnet)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "nachrichten.aufgabe-anlegen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "aufgabe"
          },
          {
            "id": "aufgabe.art",
            "erwartung": "gewaehlt",
            "wert": "Aufgabe"
          },
          {
            "id": "aufgabe.fuer",
            "erwartung": "wert",
            "wert": "ich"
          },
          {
            "id": "aufgabe.faellig",
            "erwartung": "wert",
            "wert": "{heute:+0}"
          },
          {
            "id": "aufgabe.bezug",
            "erwartung": "text_enthaelt",
            "wert": "{kunde_vollstaendig_firma.name}"
          },
          {
            "id": "aufgabe.erledigt",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "aufgabe.speichern",
            "erwartung": "text",
            "wert": "Auf Der Tag"
          }
        ]
      },
      {
        "id": "aufgabe.titel",
        "aktion": "tippen",
        "wert": "Prüfaufgabe eins"
      },
      {
        "id": "aufgabe.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Aufgabe auf Der Tag · fällig {heute:+0|WT TT.MM.}"
        },
        {
          "id": "aufgabe",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 1,
          "werte": {
            "art": "aufgabe",
            "titel": "Prüfaufgabe eins",
            "faellig_am": "{heute:+0}",
            "vorlauf_tage": 0,
            "bezug_typ": "kunde",
            "bezug_id": "{kunde_vollstaendig_firma}",
            "status": "offen",
            "fuer_login": "{login}",
            "fuer_bereich": null
          }
        }
      ]
    }
  },
  {
    "id": "G02",
    "titel": "Pflicht „Was ist zu tun?“ leer: „Noch offen“, nichts gespeichert; „Zur Lücke“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].zustaende.teilweise",
      "screens[aufgabe].inhalt[0].felder[titel]"
    ],
    "deckt": [
      "aufgabe.zur-luecke",
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "nachrichten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "screens[nachrichten].arg_ist (Kunde = Gruppe des Kunden geöffnet)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "nachrichten.aufgabe-anlegen",
        "aktion": "klicken"
      },
      {
        "id": "aufgabe.titel",
        "aktion": "tippen",
        "wert": ""
      },
      {
        "id": "aufgabe.speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "aufgabe.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Noch offen"
          },
          {
            "id": "aufgabe.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Was ist zu tun?"
          },
          {
            "oben": "aufgabe"
          }
        ],
        "db": [
          {
            "tabelle": "task",
            "neu": 0
          }
        ]
      },
      {
        "id": "aufgabe.zur-luecke",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "aufgabe.zustand.teilweise",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "aufgabe"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "G03",
    "titel": "Rückruf aus „Anliegen wählen“: vorbelegt; „Auf Der Tag“ legt den Rückruf an und schließt das Anliegen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].abnahme[0]",
      "screens[aufgabe].inhalt[0].felder",
      "eingang.befehle[aufgabe.speichern]",
      "eingang.zustaende.einsatz_regel"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "nachrichten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "screens[nachrichten].arg_ist (Kunde = Gruppe des Kunden geöffnet)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "nachrichten.anliegen-waehlen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "anliegenwahl.rueckruf_anlegen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "aufgabe"
          },
          {
            "id": "aufgabe.art",
            "erwartung": "gewaehlt",
            "wert": "Rückruf"
          },
          {
            "id": "aufgabe.titel",
            "erwartung": "nicht_leer"
          },
          {
            "id": "aufgabe.fuer",
            "erwartung": "wert",
            "wert": "ich"
          },
          {
            "id": "aufgabe.faellig",
            "erwartung": "wert",
            "wert": "{heute:+0}"
          }
        ]
      },
      {
        "id": "aufgabe.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Aufgabe auf Der Tag · fällig {heute:+0|WT TT.MM.}"
        },
        {
          "id": "aufgabe",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 1,
          "werte": {
            "art": "rueckruf",
            "faellig_am": "{heute:+0}",
            "vorlauf_tage": 0,
            "item_id": "{eingang_mail_lesen}",
            "status": "offen",
            "fuer_login": "{login}",
            "fuer_bereich": null
          }
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "anliegen": [
              "rueckruf"
            ],
            "anliegen_offen": [],
            "einsatz": "erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "G04",
    "titel": "Mit Änderung: Esc → Rückfrage über 2.4; „Verwerfen“ schließt ohne Aufgabe",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage",
      "verhalten_appweit.aenderung",
      "screens[entwurf]"
    ],
    "deckt": [
      "entwurf.verwerfen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "nachrichten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "screens[nachrichten].arg_ist (Kunde = Gruppe des Kunden geöffnet)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "nachrichten.aufgabe-anlegen",
        "aktion": "klicken"
      },
      {
        "id": "aufgabe.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Aufgabe"
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
            "id": "aufgabe",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "text_enthaelt",
            "wert": "Notiz"
          },
          {
            "id": "entwurf.verwerfen",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf.weiter-bearbeiten",
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
          "id": "aufgabe",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "G05",
    "titel": "Offene Aufgabe: „Erledigt“ mit Notiz → erledigt, Notiz im Verlauf des Bezugs",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].aktionen[erledigt]",
      "screens[aufgabe].abnahme[1]",
      "eingang.befehle[aufgabe.erledigen]"
    ],
    "deckt": [
      "aufgabe.erledigt"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "aufgabe_offen"
      ],
      "aufruf": {
        "seite": "aufgabe",
        "arg": "{aufgabe_offen}",
        "weg": "oeffne",
        "quelle": "screens[aufgabe].arg_ist (vorhandene Aufgabe; Einstiege Der Tag, Kunden-/Auftragskarte)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "aufgabe.speichern",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "aufgabe.aendern-speichern",
            "erwartung": "sichtbar"
          },
          {
            "id": "aufgabe.erledigt",
            "erwartung": "sichtbar"
          },
          {
            "id": "aufgabe.titel",
            "erwartung": "wert",
            "wert": "Prüfaufgabe offen"
          }
        ]
      },
      {
        "id": "aufgabe.notiz",
        "aktion": "tippen",
        "wert": "Prüfvermerk erledigt"
      },
      {
        "id": "aufgabe.erledigt",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Erledigt · steht im Verlauf"
        },
        {
          "id": "aufgabe",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "wo": {
            "id": "{aufgabe_offen}"
          },
          "werte": {
            "status": "erledigt",
            "erledigt_notiz": "Prüfvermerk erledigt"
          }
        },
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "kanal": "notiz",
            "richtung": "intern",
            "text": "Prüfvermerk erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "G06",
    "titel": "Offene Aufgabe ändern: neue Fälligkeit, „Speichern“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].aktionen[aendern-speichern]",
      "eingang.befehle[aufgabe.speichern]"
    ],
    "deckt": [
      "aufgabe.aendern-speichern"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "aufgabe_offen"
      ],
      "aufruf": {
        "seite": "aufgabe",
        "arg": "{aufgabe_offen}",
        "weg": "oeffne",
        "quelle": "screens[aufgabe].arg_ist (vorhandene Aufgabe; Einstiege Der Tag, Kunden-/Auftragskarte)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "aufgabe.faellig",
        "aktion": "tippen",
        "wert": "{heute:+3}"
      },
      {
        "id": "aufgabe.aendern-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Aufgabe gespeichert"
        },
        {
          "id": "aufgabe",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 0
        },
        {
          "tabelle": "task",
          "wo": {
            "id": "{aufgabe_offen}"
          },
          "werte": {
            "faellig_am": "{heute:+3}",
            "status": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "G07",
    "titel": "Doppelklick auf „Auf Der Tag“ → genau eine Aufgabe",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.befehle[aufgabe.speichern].idempotenz",
      "eingang.daten.neu[task]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "nachrichten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "screens[nachrichten].arg_ist (Kunde = Gruppe des Kunden geöffnet)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "nachrichten.aufgabe-anlegen",
        "aktion": "klicken"
      },
      {
        "id": "aufgabe.titel",
        "aktion": "tippen",
        "wert": "Prüfaufgabe zwei"
      },
      {
        "id": "aufgabe.speichern",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Aufgabe auf Der Tag · fällig {heute:+0|WT TT.MM.}"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 1,
          "werte": {
            "titel": "Prüfaufgabe zwei"
          }
        }
      ]
    }
  },
  {
    "id": "G08",
    "titel": "Aufgabe „Rechnung klären“: „Klären“ statt „Erledigt“ → 3.8 Eingangsrechnung #klaeren",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].aktionen[rechnung-klaeren]",
      "screens[aufgabe].abnahme[2]",
      "prozesse.aufgabe"
    ],
    "deckt": [
      "aufgabe.rechnung-klaeren"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "rechnung_unklar",
        "aufgabe_rechnung_klaeren"
      ],
      "aufruf": {
        "seite": "aufgabe",
        "arg": "{aufgabe_rechnung_klaeren}",
        "weg": "oeffne",
        "quelle": "screens[aufgabe].arg_ist (vorhandene Aufgabe)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "aufgabe.art",
            "erwartung": "gewaehlt",
            "wert": "Rechnung klären"
          },
          {
            "id": "aufgabe.erledigt",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "aufgabe.rechnung-klaeren",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "aufgabe.rechnung-klaeren",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rechnungein"
        },
        {
          "id": "rechnungein.zustand.klaeren",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "wo": {
            "id": "{aufgabe_rechnung_klaeren}"
          },
          "werte": {
            "status": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "G09",
    "titel": "Speichern scheitert: „Nicht gespeichert · Eingaben sind noch da“; „Erneut“, dann „Auf Der Tag“ legt genau eine Aufgabe an",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].zustaende.fehler"
    ],
    "deckt": [
      "aufgabe.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "nachrichten",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "screens[nachrichten].arg_ist (Kunde = Gruppe des Kunden geöffnet)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "nachrichten.aufgabe-anlegen",
        "aktion": "klicken"
      },
      {
        "id": "aufgabe.titel",
        "aktion": "tippen",
        "wert": "Prüfaufgabe drei"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "aufgabe.speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "aufgabe.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nicht gespeichert · Eingaben sind noch da"
          },
          {
            "id": "aufgabe.titel",
            "erwartung": "wert",
            "wert": "Prüfaufgabe drei"
          },
          {
            "oben": "aufgabe"
          }
        ],
        "db": [
          {
            "tabelle": "task",
            "neu": 0
          }
        ]
      },
      {
        "id": "aufgabe.erneut",
        "aktion": "klicken"
      },
      {
        "id": "aufgabe.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Aufgabe auf Der Tag · fällig {heute:+0|WT TT.MM.}"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "neu": 1,
          "werte": {
            "titel": "Prüfaufgabe drei"
          }
        }
      ]
    }
  },
  {
    "id": "G10",
    "titel": "× ohne Änderung schließt 2.4 sofort; Aufgabe unverändert",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.rueckfrage.ohne_aenderung",
      "verhalten_appweit.kennungen"
    ],
    "deckt": [
      "aufgabe.schliessen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "aufgabe_offen"
      ],
      "aufruf": {
        "seite": "aufgabe",
        "arg": "{aufgabe_offen}",
        "weg": "oeffne",
        "quelle": "screens[aufgabe].arg_ist (vorhandene Aufgabe)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "aufgabe.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "aufgabe",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "task",
          "wo": {
            "id": "{aufgabe_offen}"
          },
          "werte": {
            "status": "offen",
            "faellig_am": "{heute:+0}"
          }
        }
      ]
    }
  },
  {
    "id": "G11",
    "titel": "Aufgabe „Rechnung klären“ ohne Recht „geld“: kein „Klären“ (und kein „Erledigt“)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[aufgabe].aktionen[rechnung-klaeren]",
      "screens[aufgabe].regeln (Runde 40)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "lieferant_bekannt",
        "rechnung_unklar",
        "aufgabe_rechnung_klaeren"
      ],
      "aufruf": {
        "seite": "aufgabe",
        "arg": "{aufgabe_rechnung_klaeren}",
        "weg": "oeffne",
        "quelle": "screens[aufgabe].arg_ist (vorhandene Aufgabe)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "aufgabe"
        },
        {
          "id": "aufgabe.rechnung-klaeren",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "aufgabe.erledigt",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · aufgabe", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
