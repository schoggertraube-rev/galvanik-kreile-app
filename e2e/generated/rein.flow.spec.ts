// Generated from BAUPLAN SHA-256 888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "F01",
    "titel": "PC: 3.0 mit Ablagefläche, „Datei“, „Fotos mit Tablet/Handy“ und „Ohne Vorlage“ – kein Sucher",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].abnahme[0]",
      "screens[rein].inhalt[0].pc"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "navigation.plus",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rein"
        },
        {
          "id": "rein.datei",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.handy",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.ausloesen",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "rein.auftrag-erfassen",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.kunde-anlegen",
          "erwartung": "sichtbar"
        },
        {
          "text": "Datei hierher ziehen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "F02",
    "titel": "Datei (Foto) ohne lesbaren Inhalt: Original gesichert, „Erkannt · unklar“, Ohne Vorlage verschwindet",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].inhalt[0].werkzeuge[datei]",
      "screens[rein].zustaende.laden",
      "eingang.erkennung.datei.arten[unklar]",
      "screens[rein].inhalt[0].ohne_vorlage_wann"
    ],
    "deckt": [
      "rein.datei",
      "zustand.erkannt"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rein.zustand.erkannt",
          "erwartung": "text_enthaelt",
          "wert": "Erkannt"
        },
        {
          "id": "rein.spaeter-zuordnen",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.wem-gehoert",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.auftrag-erfassen",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "richtung": "rein",
            "zuordnung": "offen"
          }
        },
        {
          "tabelle": "intake_file",
          "neu": 1,
          "werte": {
            "item_id": "{neu:intake_item}",
            "dateiname": "pruef_foto.jpg",
            "lesbar": true
          }
        }
      ]
    }
  },
  {
    "id": "F03",
    "titel": "„Später zuordnen“: Toast, Eingang bleibt offen in Zuordnen",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].inhalt[1].immer[spaeter-zuordnen]",
      "screens[rein].abnahme[3]"
    ],
    "deckt": [
      "rein.spaeter-zuordnen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "rein.spaeter-zuordnen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Gespeichert · wartet unter Nachrichten › Zuordnen"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "zuordnung": "offen",
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "F04",
    "titel": "Schließen nach Aufnahme ohne Recht „mails“: „Gespeichert · Büro ordnet zu“",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].aktionen[schliessen].meldung_ohne_mails",
      "screens[rein].abnahme[10]"
    ],
    "deckt": [
      "rein.schliessen"
    ],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "rein.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Gespeichert · Büro ordnet zu"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "zuordnung": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "F05",
    "titel": "Excel-Datei: gespeichert, nicht gelesen – Zustand fehler mit „Wem gehört das?“ und „Später zuordnen“",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].zustaende.fehler",
      "eingang.erkennung.datei.grenzen"
    ],
    "deckt": [
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_tabelle.xlsx"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rein.zustand.fehler",
          "erwartung": "text_enthaelt",
          "wert": "Nicht lesbar · Original gesichert"
        },
        {
          "id": "rein.wem-gehoert",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.spaeter-zuordnen",
          "erwartung": "sichtbar"
        },
        {
          "id": "rein.als-dokument",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_file",
          "neu": 1,
          "werte": {
            "dateiname": "pruef_tabelle.xlsx",
            "lesbar": false
          }
        }
      ]
    }
  },
  {
    "id": "F06",
    "titel": "Mehrere Dateien in einer Auswahl = ein Eingang mit mehreren Originalen",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].inhalt[0].werkzeuge[datei].verhalten"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": [
          "pruef_foto.jpg",
          "pruef_foto_2.jpg"
        ]
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rein.zustand.erkannt",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1
        },
        {
          "tabelle": "intake_file",
          "neu": 2,
          "werte": {
            "item_id": "{neu:intake_item}"
          }
        }
      ]
    }
  },
  {
    "id": "F07",
    "titel": "Art unklar mit erwarteter Ware: Kacheln „Erwartete Ware“; Tipp öffnet 3.7 dieses Auftrags (3.0 ersetzt)",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].regeln[16]",
      "screens[rein].inhalt[1].erwartet",
      "screens[rein].abnahme[6]",
      "screens[rein].regeln[15]"
    ],
    "deckt": [
      "rein.erwartet-waehlen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet",
        "kunde_bedingung_vorkasse",
        "auftrag_erwartet_2"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "text": "Erwartete Ware",
            "erwartung": "sichtbar"
          },
          {
            "id": "rein.erwartet-waehlen",
            "erwartung": "anzahl",
            "wert": 2
          }
        ]
      },
      {
        "id": "rein.erwartet-waehlen",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "ware"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1
        }
      ]
    },
    "notiz": "Reihenfolge der Kacheln: ware_seit aufsteigend (ohne Kunden-Vorschlag); welcher der beiden Aufträge Kachel 1 ist, folgt aus den Datenlagen und wird nicht geprüft."
  },
  {
    "id": "F08",
    "titel": "Modus aus der Erfassung (eingang „Aufnehmen“) mit Excel: Zustand fehler mit „Als Dokument übernehmen“ und „Neues Foto“, ohne „Wem gehört das?“",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].zustaende.fehler",
      "screens[rein].regeln[8]"
    ],
    "deckt": [
      "rein.als-dokument",
      "rein.neues-foto"
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
        "id": "eingang.aufnehmen",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_tabelle.xlsx"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rein.als-dokument",
            "erwartung": "sichtbar"
          },
          {
            "id": "rein.neues-foto",
            "erwartung": "sichtbar"
          },
          {
            "id": "rein.wem-gehoert",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "rein.spaeter-zuordnen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "rein.als-dokument",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Als Dokument übernommen · ohne Vorschläge"
        },
        {
          "oben": "eingang"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.dokument",
          "erwartung": "text_enthaelt",
          "wert": "pruef_tabelle.xlsx"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1
        },
        {
          "tabelle": "intake_file",
          "neu": 1,
          "werte": {
            "dateiname": "pruef_tabelle.xlsx"
          }
        }
      ]
    }
  },
  {
    "id": "F09",
    "titel": "Modus aus der Erfassung: Schließen vor „Übernehmen“ – Erfassung unverändert, Original „in Erfassung verworfen“",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].regeln[4]",
      "bausteine_vertraege.werkbank.stapel_original"
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
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.aufnehmen",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "rein.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "eingang"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.erfassen-text",
          "erwartung": "wert",
          "wert": "Prüfnotiz eins"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "einsatz": "info",
            "kennzeichen_enthaelt": "in_erfassung_verworfen"
          }
        }
      ]
    }
  },
  {
    "id": "F10",
    "titel": "„Neues Foto“ nach Excel im Modus: zurück zum Grundzustand, kein zweiter Eingang",
    "paket": "AP-F",
    "quelle": [
      "screens[rein].zustaende.fehler.aktionen[neues-foto]"
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
        "id": "eingang.aufnehmen",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_tabelle.xlsx"
      },
      {
        "id": "rein.neues-foto",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rein"
        },
        {
          "id": "rein.zustand.fehler",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "rein.datei",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "F11",
    "titel": "Netzfehler beim Hochladen: nichts geht verloren, der Upload läuft weiter – genau ein Eingang mit einem Original",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.geraete.regeln[4]",
      "screens[rein].zustaende.laden"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rein.zustand.erkannt",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1
        },
        {
          "tabelle": "intake_file",
          "neu": 1,
          "werte": {
            "dateiname": "pruef_foto.jpg"
          }
        }
      ]
    }
  },
  {
    "id": "F12",
    "titel": "Doppelklick „Später zuordnen“: ein Eingang, ein Toast",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rein].inhalt[1].immer[spaeter-zuordnen]",
      "eingang.daten.neu[intake_item].regeln[1]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "rein.spaeter-zuordnen",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Gespeichert · wartet unter Nachrichten › Zuordnen"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "zuordnung": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "F13",
    "titel": "Esc nach der Aufnahme = „Später zuordnen“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rein].regeln[10]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": [],
        "hinweis": "Startseite des Logins nach der Anmeldung (rollen[].start)"
      },
      "geraet": "desktop",
      "erkennung": "nichts"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.datei",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Gespeichert · wartet unter Nachrichten › Zuordnen"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "zuordnung": "offen",
            "einsatz": "offen"
          }
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · rein", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
