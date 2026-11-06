// Generated from BAUPLAN SHA-256 9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "A01",
    "titel": "„Anderes Anliegen“ an einer Nachricht „Lesen und entscheiden“ öffnet das Menü mit Rückruf, Nur Info, Kein Geschäftsvorgang",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].abnahme[0]",
      "screens[anliegenwahl].regeln[2]",
      "eingang.anliegen[rueckruf|info].kontext"
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "anliegenwahl"
        },
        {
          "id": "anliegenwahl.rueckruf_anlegen",
          "erwartung": "sichtbar"
        },
        {
          "id": "anliegenwahl.nur_info",
          "erwartung": "sichtbar"
        },
        {
          "id": "anliegenwahl.kein",
          "erwartung": "sichtbar"
        },
        {
          "id": "anliegenwahl.schliessen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "A02",
    "titel": "Ohne Recht „geld“: Geld-Anliegen fehlen (Zahlung, Rechnung, KV annehmen, Absage)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].regeln[0]",
      "screens[anliegenwahl].aktionen",
      "verhalten_appweit.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_buero_ohne_geld",
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "anliegenwahl"
        },
        {
          "id": "anliegenwahl.rueckruf_anlegen",
          "erwartung": "sichtbar"
        },
        {
          "id": "anliegenwahl.zahlung_pruefen",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "anliegenwahl.rechnungein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "anliegenwahl.kv_annehmen",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "anliegenwahl.kv_absage",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "A03",
    "titel": "„Rückruf anlegen“ und im Dialog „Abbrechen“: Anliegen rueckruf bleibt offen, Einsatz offen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].abnahme[3]",
      "screens[anliegenwahl].regeln[0]",
      "eingang.befehle[eingang.anliegen]"
    ],
    "deckt": [
      "anliegenwahl.rueckruf_anlegen",
      "aufgabe.abbrechen"
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
          }
        ],
        "db": [
          {
            "tabelle": "intake_item",
            "wo": {
              "id": "{eingang_mail_lesen}"
            },
            "werte": {
              "anliegen": [
                "rueckruf"
              ]
            }
          }
        ]
      },
      {
        "id": "aufgabe.abbrechen",
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
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "anliegen": [
              "rueckruf"
            ],
            "anliegen_offen": [
              "rueckruf"
            ],
            "einsatz": "offen"
          }
        },
        {
          "tabelle": "task",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "A04",
    "titel": "„Nur Info“: Toast, Menü zu, Einsatz info",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].aktionen[nur_info]",
      "eingang.befehle[eingang.einsatz_erledigen]"
    ],
    "deckt": [
      "anliegenwahl.nur_info"
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
        "id": "nachrichten.anliegen-waehlen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "anliegenwahl.nur_info",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Als Info vermerkt"
        },
        {
          "id": "anliegenwahl",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "einsatz": "info",
            "anliegen_offen": []
          }
        }
      ]
    }
  },
  {
    "id": "A05a",
    "titel": "Schließen schließt das Menü ohne Wirkung",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].aktionen[schliessen]",
      "verhalten_appweit.tastatur"
    ],
    "deckt": [
      "anliegenwahl.schliessen"
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
        "id": "nachrichten.anliegen-waehlen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "anliegenwahl.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "anliegenwahl",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "nachrichten"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "anliegen": [
              "lesen"
            ],
            "anliegen_offen": [
              "lesen"
            ],
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "A05b",
    "titel": "Esc schließt das Menü ohne Wirkung",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].aktionen[schliessen]",
      "verhalten_appweit.tastatur"
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
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "anliegenwahl",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "nachrichten"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "anliegen": [
              "lesen"
            ],
            "anliegen_offen": [
              "lesen"
            ],
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "A06",
    "titel": "„Weitere“ klappt Anliegen mit unerfülltem Kontext auf (Frist, Aufgabe, Rechnung prüfen)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[anliegenwahl].aktionen[weitere]",
      "screens[anliegenwahl].regeln (Runde 40)",
      "screens[anliegenwahl].regeln[2]"
    ],
    "deckt": [
      "anliegenwahl.weitere"
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
        "id": "nachrichten.anliegen-waehlen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "anliegenwahl.frist_anlegen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "anliegenwahl.aufgabe_anlegen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "anliegenwahl.weitere",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "anliegenwahl.weitere",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "anliegenwahl.frist_anlegen",
          "erwartung": "sichtbar"
        },
        {
          "id": "anliegenwahl.aufgabe_anlegen",
          "erwartung": "sichtbar"
        },
        {
          "id": "anliegenwahl.rechnungein",
          "erwartung": "sichtbar"
        },
        {
          "oben": "anliegenwahl"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.describe("BAUPLAN Wege · anliegenwahl", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await prepareGeneratedSeed(flowCase);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
