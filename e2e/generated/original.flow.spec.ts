// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "O01",
    "titel": "„Ansehen“ im Gespräch: 3.9 mit „unverändert“, Herkunft, Prüfsumme; zugeordnet → „Umhängen“ statt „Wem gehört das?“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].inhalt",
      "screens[original].regeln[4]",
      "screens[original].abnahme[0]",
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[ansehen]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "original"
        },
        {
          "text": "unverändert",
          "erwartung": "sichtbar"
        },
        {
          "text": "Herkunft",
          "erwartung": "sichtbar"
        },
        {
          "text": "Prüfsumme",
          "erwartung": "sichtbar"
        },
        {
          "id": "original.herunterladen",
          "erwartung": "sichtbar"
        },
        {
          "id": "original.umhaengen",
          "erwartung": "sichtbar"
        },
        {
          "id": "original.wem-gehoert",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "original.am-original-geprueft",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "O02",
    "titel": "„Am Original geprüft“: Toast; danach kein Vorschlag mehr „bitte prüfen“ (Knopf entfällt)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].inhalt[0].bloecke[1].aktion",
      "eingang.befehle[eingang.original_geprueft]",
      "screens[original].abnahme[3]"
    ],
    "deckt": [
      "original.am-original-geprueft"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "original.am-original-geprueft",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Am Original geprüft · Vorschläge bestätigt"
        },
        {
          "oben": "original"
        },
        {
          "id": "original.am-original-geprueft",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_suggestion",
          "wo": {
            "item_id": "{eingang_foto_kunde}",
            "sicherheit": "unsicher"
          },
          "werte": {
            "geprueft_am": "{gesetzt}",
            "geprueft_von": "{login}"
          }
        }
      ]
    },
    "notiz": "wo trifft beide Vorschläge der Datenlage – die Werte gelten für jede getroffene Zeile."
  },
  {
    "id": "O03a",
    "titel": "× schließt 3.9; das Gespräch steht unverändert darunter",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].aktionen[schliessen]",
      "verhalten_appweit.zurueck"
    ],
    "deckt": [
      "original.schliessen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "original.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "original",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "nachrichten"
        }
      ]
    }
  },
  {
    "id": "O03b",
    "titel": "Esc schließt 3.9; das Gespräch steht unverändert darunter",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].aktionen[schliessen]",
      "verhalten_appweit.zurueck"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "id": "nachrichten.ansehen",
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
          "id": "original",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "nachrichten"
        }
      ]
    }
  },
  {
    "id": "O04",
    "titel": "Datei .exe: Zustand gesperrt „Nicht geöffnet …“, kein Herunterladen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].zustaende.gesperrt",
      "screens[original].regeln[2]",
      "screens[original].abnahme[4]"
    ],
    "deckt": [
      "zustand.gesperrt"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_exe_kunde"
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
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "original"
        },
        {
          "id": "original.zustand.gesperrt",
          "erwartung": "text_enthaelt",
          "wert": "Nicht geöffnet"
        },
        {
          "id": "original.herunterladen",
          "erwartung": "nicht_sichtbar"
        }
      ]
    },
    "notiz": "„Vorfall an Wartung“ hat keine benannte Tabelle (Lücke) – nur Anzeige geprüft."
  },
  {
    "id": "O05",
    "titel": "„Umhängen“ öffnet 3.4 im Modus umhaengen (nicht schon_zugeordnet)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].aktionen[umhaengen]",
      "screens[mailein].regeln[4]"
    ],
    "deckt": [
      "original.umhaengen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "original.umhaengen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "mailein"
        },
        {
          "id": "mailein.zustand.schon_zugeordnet",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "O06",
    "titel": "Original nicht ladbar: Zustand fehler „Original nicht ladbar“; „Erneut“ lädt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].zustaende.fehler"
    ],
    "deckt": [
      "original.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "aktion": "netz_laden",
        "wert": "nächster Ladeaufruf"
      },
      {
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "original"
          },
          {
            "id": "original.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Original nicht ladbar"
          }
        ]
      },
      {
        "id": "original.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "original.zustand.fehler",
          "erwartung": "nicht_sichtbar"
        },
        {
          "text": "unverändert",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "O07",
    "titel": "Ohne Recht „mails“: Mail-Original zeigt Herkunft und Prüfsumme, nicht den Text („Mail · Inhalt nur fürs Büro“)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].regeln[3]",
      "screens[original].abnahme[5]",
      "screens[original].inhalt[0].bloecke[0].ableitung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_original",
        "datei_mail_eml"
      ],
      "aufruf": {
        "seite": "original",
        "arg": "{eingang_mail_original}#{datei_mail_eml}",
        "weg": "oeffne",
        "quelle": "screens[original].regeln (Runde 40: Datei-Argument = intake_file.id)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "original"
        },
        {
          "text": "Prüfsumme",
          "erwartung": "sichtbar"
        },
        {
          "text": "Herkunft",
          "erwartung": "sichtbar"
        },
        {
          "text": "Mail · Inhalt nur fürs Büro",
          "erwartung": "sichtbar"
        },
        {
          "text": "Prüftext Mail-Original",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "O08",
    "titel": "Nicht zugeordnetes Original: Hauptknopf „Wem gehört das?“ (kein „Umhängen“) → 3.4 dieses Eingangs",
    "paket": "AP-EIN",
    "quelle": [
      "screens[original].regeln[4]",
      "screens[original].aktionen[wem-gehoert]"
    ],
    "deckt": [
      "original.wem-gehoert"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "eingang_offen_ohne_anhang",
        "datei_offen"
      ],
      "aufruf": {
        "seite": "original",
        "arg": "{eingang_offen_ohne_anhang}#{datei_offen}",
        "weg": "oeffne",
        "quelle": "screens[original].regeln (Runde 40: Datei-Argument = intake_file.id)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "original.wem-gehoert",
            "erwartung": "sichtbar"
          },
          {
            "id": "original.umhaengen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "original.wem-gehoert",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "mailein"
        },
        {
          "id": "mailein.zustand.teilweise",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "O09",
    "titel": "Doppelklick „Am Original geprüft“: idempotent über die Datei, Vorschläge geprüft",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.befehle[eingang.original_geprueft].idempotenz"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_foto_kunde"
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
        "id": "nachrichten.ansehen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "original.am-original-geprueft",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Am Original geprüft · Vorschläge bestätigt"
        },
        {
          "id": "original.am-original-geprueft",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_suggestion",
          "wo": {
            "item_id": "{eingang_foto_kunde}",
            "sicherheit": "unsicher"
          },
          "werte": {
            "geprueft_am": "{gesetzt}"
          }
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · original", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
