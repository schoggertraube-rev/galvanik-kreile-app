// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "N01",
    "titel": "Menüpunkt „Nachrichten“ öffnet die Seite mit Filter „Offen“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].abnahme[0]",
      "screens[nachrichten].werkzeug"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "nachrichten"
        },
        {
          "id": "nachrichten.nfilter",
          "erwartung": "gewaehlt",
          "wert": "Offen"
        }
      ]
    }
  },
  {
    "id": "N02",
    "titel": "Ohne Recht „mails“ fehlt der Menüpunkt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].abnahme[0]",
      "navigation.buero[nachrichten]",
      "verhalten_appweit.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "navigation.nachrichten",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "N03",
    "titel": "Filter „Zuordnen“ mit eindeutigem Vorschlag: „Ja, zu …“ ordnet mit einem Klick zu",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].abnahme[3]",
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[vorschlag-ja]",
      "bausteine_vertraege.nachrichten.interaktion[1]"
    ],
    "deckt": [
      "nachrichten.vorschlag-ja"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_bekannt"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "id": "nachrichten.nfilter",
        "aktion": "waehlen",
        "wert": "Zuordnen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "nachrichten.vorschlag-ja",
            "erwartung": "text_enthaelt",
            "wert": "Ja, zu"
          },
          {
            "id": "nachrichten.vorschlag-anders",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "nachrichten.vorschlag-ja",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "nachrichten"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_bekannt}"
          },
          "werte": {
            "zuordnung": "bestaetigt",
            "kunde_id": "{kunde_vollstaendig_firma}"
          }
        }
      ]
    },
    "notiz": "Meldung „Zugeordnet · n weitere von Adresse“ ist für n = 0 nicht festgelegt (Lücke) – nur DB geprüft."
  },
  {
    "id": "N04",
    "titel": "Ohne Vorschlag nur „Anders zuordnen“ → 3.4 genau dieses Eingangs (Zustand teilweise)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].abnahme[3]",
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[vorschlag-anders]"
    ],
    "deckt": [
      "nachrichten.vorschlag-anders"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "eingang_mail_unbekannt"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "id": "nachrichten.nfilter",
        "aktion": "waehlen",
        "wert": "Zuordnen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "nachrichten.vorschlag-ja",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "nachrichten.vorschlag-anders",
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
        },
        {
          "text": "anfrage@unbekannt-pruef.test",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "N05",
    "titel": "„Nur Info“ an einer Nachricht: Toast, Einsatz info, keine offenen Anliegen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[nur-info]",
      "eingang.befehle[eingang.einsatz_erledigen]",
      "screens[nachrichten].regeln[3]"
    ],
    "deckt": [
      "nachrichten.nur-info"
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
        "id": "nachrichten.nur-info",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Als Info vermerkt"
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
    "id": "N06",
    "titel": "„Erledigt“ an einer Nachricht: Toast, Einsatz erledigt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[erledigt]",
      "eingang.befehle[eingang.einsatz_erledigen]"
    ],
    "deckt": [
      "nachrichten.erledigt"
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
        "id": "nachrichten.erledigt",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Erledigt"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "einsatz": "erledigt",
            "anliegen_offen": []
          }
        }
      ]
    }
  },
  {
    "id": "N07",
    "titel": "„Wieder öffnen“ nur mit Grund: ohne Grund Feldfehler, nichts gespeichert; mit Grund wieder offen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].zustaende.wieder",
      "screens[nachrichten].regeln[6]",
      "screens[nachrichten].abnahme[5]",
      "eingang.befehle[eingang.wieder_oeffnen]",
      "verhalten_appweit.pflicht_grund"
    ],
    "deckt": [
      "nachrichten.wieder-oeffnen",
      "nachrichten.wieder-speichern",
      "zustand.wieder"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_erledigt"
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
        "id": "nachrichten.wieder-oeffnen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "nachrichten.zustand.wieder",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "nachrichten.wieder-speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "nachrichten.zustand.wieder",
            "erwartung": "sichtbar"
          },
          {
            "id": "nachrichten.grund.fehler",
            "erwartung": "sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "intake_item",
            "wo": {
              "id": "{eingang_mail_erledigt}"
            },
            "werte": {
              "einsatz": "erledigt"
            }
          }
        ]
      },
      {
        "id": "nachrichten.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund Rückfrage"
      },
      {
        "id": "nachrichten.wieder-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wieder offen"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_erledigt}"
          },
          "werte": {
            "einsatz": "offen",
            "anliegen_offen": [
              "nachfrage"
            ]
          }
        }
      ]
    }
  },
  {
    "id": "N08",
    "titel": "Keine offenen Nachrichten: Zustand leer mit „Alle zeigen“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].zustaende.leer"
    ],
    "deckt": [
      "zustand.leer"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_erledigt"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "nachrichten.zustand.leer",
          "erwartung": "text_enthaelt",
          "wert": "Alles erledigt · keine offenen Nachrichten"
        },
        {
          "id": "nachrichten.alle-zeigen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "N09",
    "titel": "Liste nicht ladbar: Zustand fehler „Nachrichten konnten nicht geladen werden“; „Erneut laden“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].zustaende.fehler"
    ],
    "deckt": [
      "nachrichten.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "netz_laden",
        "wert": "nächster Ladeaufruf"
      },
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "nachrichten.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nachrichten konnten nicht geladen werden"
          }
        ]
      },
      {
        "id": "nachrichten.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "nachrichten.zustand.fehler",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "nachrichten.nfilter",
          "erwartung": "gewaehlt",
          "wert": "Offen"
        }
      ]
    }
  },
  {
    "id": "N10",
    "titel": "Doppelklick „Ja, zu …“: eine Zuordnung, kein Fehler",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[vorschlag-ja]",
      "eingang.befehle[eingang.zuordnen_gruppe]",
      "screens[mailein].regeln (Runde 40: idempotent)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_bekannt"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "id": "nachrichten.nfilter",
        "aktion": "waehlen",
        "wert": "Zuordnen"
      },
      {
        "id": "nachrichten.vorschlag-ja",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "nachrichten.zustand.fehler",
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
            "id": "{eingang_mail_bekannt}"
          },
          "werte": {
            "zuordnung": "bestaetigt",
            "kunde_id": "{kunde_vollstaendig_firma}"
          }
        }
      ]
    }
  },
  {
    "id": "N11",
    "titel": "Anliegen-Karte „Anliegen wählen“ (Lesen und entscheiden) öffnet M6 für diese Nachricht",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].aktionen[entscheiden]",
      "screens[nachrichten].regeln (Runde 40)",
      "screens[anliegenwahl].abnahme[0]"
    ],
    "deckt": [
      "nachrichten.entscheiden"
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
        "id": "nachrichten.entscheiden",
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
        }
      ]
    }
  },
  {
    "id": "N12",
    "titel": "„Alle zeigen“ im Zustand leer setzt den Filter „Alle“ – die erledigte Nachricht erscheint",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].zustaende.leer",
      "screens[nachrichten].regeln (Runde 40)"
    ],
    "deckt": [
      "nachrichten.alle-zeigen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_erledigt"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "id": "nachrichten.alle-zeigen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "nachrichten.nfilter",
          "erwartung": "gewaehlt",
          "wert": "Alle"
        },
        {
          "id": "nachrichten.zustand.leer",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "N13",
    "titel": "Klick auf eine Gruppenzeile öffnet das Gespräch dieser Gruppe mit ihrer Anliegen-Karte",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].elemente_runde41[gruppe]",
      "bausteine_vertraege.nachrichten.interaktion[0]"
    ],
    "deckt": [
      "nachrichten.gruppe"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "id": "nachrichten.gruppe",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "nachrichten"
        },
        {
          "id": "nachrichten.entscheiden",
          "erwartung": "sichtbar"
        },
        {
          "id": "nachrichten.nur-info",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "N14",
    "titel": "Netzfehler bei „Ja, zu …“: roter Toast „Nicht gespeichert · …“ mit „Erneut“, nichts zugeordnet; „Erneut“ ordnet zu",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].regeln (Runde 42, Nachtrag 2)",
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[vorschlag-ja]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_bekannt"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.nachrichten",
        "aktion": "klicken"
      },
      {
        "id": "nachrichten.nfilter",
        "aktion": "waehlen",
        "wert": "Zuordnen"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "nachrichten.vorschlag-ja",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "toast": "Nicht gespeichert · {fehler}"
          },
          {
            "id": "nachrichten.erneut",
            "erwartung": "sichtbar"
          },
          {
            "id": "nachrichten.vorschlag-ja",
            "erwartung": "sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "intake_item",
            "wo": {
              "id": "{eingang_mail_bekannt}"
            },
            "werte": {
              "zuordnung": "offen",
              "kunde_id": null
            }
          }
        ]
      },
      {
        "id": "nachrichten.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "nachrichten"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_bekannt}"
          },
          "werte": {
            "zuordnung": "bestaetigt",
            "kunde_id": "{kunde_vollstaendig_firma}"
          }
        }
      ]
    }
  },
  {
    "id": "N15",
    "titel": "Netzfehler bei „Erledigt“: roter Toast mit „Erneut“, Einsatz bleibt offen; „Erneut“ erledigt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[nachrichten].regeln (Runde 42, Nachtrag 2)",
      "screens[nachrichten].inhalt[0].aktionen_je_nachricht[erledigt]"
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
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "nachrichten.erledigt",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "toast": "Nicht gespeichert · {fehler}"
          },
          {
            "id": "nachrichten.erneut",
            "erwartung": "sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "intake_item",
            "wo": {
              "id": "{eingang_mail_lesen}"
            },
            "werte": {
              "einsatz": "offen",
              "anliegen_offen": [
                "lesen"
              ]
            }
          }
        ]
      },
      {
        "id": "nachrichten.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Erledigt"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "einsatz": "erledigt",
            "anliegen_offen": []
          }
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.describe("BAUPLAN Wege · nachrichten", () => {
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
