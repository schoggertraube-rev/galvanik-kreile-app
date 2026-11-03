// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "W01",
    "titel": "3.7 öffnet mit Kopf, Positionen und leerer Warenprüfung; Hauptknopf „Annehmen · in Galvanik“",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].inhalt",
      "screens[ware].abnahme[0]",
      "bausteine_vertraege.warenpruefung.aufbau"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "ware"
        },
        {
          "text": "Erwartet",
          "erwartung": "sichtbar"
        },
        {
          "text": "direkt beauftragt",
          "erwartung": "sichtbar"
        },
        {
          "id": "ware.annehmen",
          "erwartung": "text",
          "wert": "Annehmen · in Galvanik"
        },
        {
          "id": "ware.warenzustand",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "ware.position.stimmt",
          "erwartung": "anzahl",
          "wert": 2
        },
        {
          "id": "ware.packstuecke",
          "erwartung": "text_enthaelt",
          "wert": "von"
        }
      ]
    }
  },
  {
    "id": "W02",
    "titel": "Unauffällig, Foto, alle stimmen → „Annehmen · in Galvanik“: ware da, In Arbeit, Laufzettel",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[annehmen]",
      "screens[ware].abnahme[1]",
      "eingang.befehle[ware.annehmen]"
    ],
    "deckt": [
      "ware.annehmen",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} angenommen · in Galvanik · Laufzettel wird gedruckt"
        },
        {
          "id": "ware",
          "erwartung": "nicht_sichtbar"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "da",
            "station": "in_arbeit"
          }
        },
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "auftrag_id": "{auftrag_erwartet}",
            "zustand": "unauffaellig",
            "status": "galvanik"
          }
        }
      ]
    }
  },
  {
    "id": "W03",
    "titel": "Ohne Foto: Hauptknopf springt zur Lücke, „Noch offen“, nichts angenommen; „Zur Lücke“",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[annehmen].verhalten",
      "screens[ware].zustaende.teilweise",
      "bausteine_vertraege.warenpruefung.regeln[0]",
      "screens[ware].foto_gate"
    ],
    "deckt": [
      "ware.zur-luecke",
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Noch offen"
          },
          {
            "id": "ware.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Foto"
          },
          {
            "oben": "ware"
          }
        ]
      },
      {
        "id": "ware.zur-luecke",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "ware.zustand.teilweise",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "ware"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "erwartet",
            "station": "wareneingang"
          }
        }
      ]
    }
  },
  {
    "id": "W04",
    "titel": "„Nur annehmen“ ohne Foto: ware da, Station Wareneingang, Aufgabe „… fehlt“ für Aufträge",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[nur-annehmen]",
      "screens[ware].abnahme[5]",
      "bausteine_vertraege.warenpruefung.regeln[3]"
    ],
    "deckt": [
      "ware.nur-annehmen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.nur-annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} angenommen · Wareneingang · Laufzettel wird gedruckt"
        },
        {
          "id": "ware",
          "erwartung": "nicht_sichtbar"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "da",
            "station": "wareneingang"
          }
        },
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "status": "angenommen"
          }
        },
        {
          "tabelle": "task",
          "neu": 1,
          "werte": {
            "art": "aufgabe",
            "fuer_bereich": "auftraege",
            "faellig_am": "{heute:+0}"
          }
        }
      ]
    }
  },
  {
    "id": "W05",
    "titel": "Abweichung „falsche Teile“ ohne Foto der Abweichung: „Mit Abweichung annehmen“ springt zur Lücke",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[annehmen].texte_je_zustand",
      "screens[ware].abnahme[2]",
      "bausteine_vertraege.warenpruefung.regeln[0]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Abweichung"
      },
      {
        "id": "ware.grund",
        "aktion": "waehlen",
        "wert": "falsche Teile"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.annehmen",
            "erwartung": "text",
            "wert": "Mit Abweichung annehmen"
          }
        ]
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "ware.zustand.teilweise",
          "erwartung": "text_enthaelt",
          "wert": "Foto der Abweichung"
        },
        {
          "oben": "ware"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "erwartet"
          }
        }
      ]
    }
  },
  {
    "id": "W06",
    "titel": "Verunreinigt mit Foto (alle stimmen): ware abweichung, nicht in Galvanik",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].regeln[5]",
      "bausteine_vertraege.warenpruefung.regeln[2]",
      "bausteine_vertraege.warenpruefung.verpackung (Runde 28)",
      "screens[ware].abnahme[3]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Abweichung"
      },
      {
        "id": "ware.grund",
        "aktion": "waehlen",
        "wert": "verunreinigt – nicht in Galvanik"
      },
      {
        "id": "ware.foto.abweichung",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} mit Abweichung angenommen · Antwortvorschlag im Gespräch · Laufzettel wird gedruckt"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "abweichung",
            "station": "wareneingang"
          }
        },
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "zustand": "abweichung",
            "status": "angenommen"
          }
        }
      ]
    }
  },
  {
    "id": "W07",
    "titel": "Verpackungs-Abweichung (beschädigt, alle stimmen): „Annehmen · in Galvanik“ frei, ware da",
    "paket": "AP-W",
    "quelle": [
      "bausteine_vertraege.warenpruefung.verpackung",
      "screens[ware].abnahme[8]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Abweichung"
      },
      {
        "id": "ware.grund",
        "aktion": "waehlen",
        "wert": "beschädigt"
      },
      {
        "id": "ware.foto.abweichung",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.annehmen",
            "erwartung": "text",
            "wert": "Annehmen · in Galvanik"
          },
          {
            "id": "ware.nur-annehmen",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} angenommen · in Galvanik · Laufzettel wird gedruckt · Info an den Kunden liegt im Gespräch"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "da",
            "station": "in_arbeit"
          }
        },
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "zustand": "abweichung",
            "status": "galvanik"
          }
        }
      ]
    }
  },
  {
    "id": "W08",
    "titel": "Teillieferung · in Galvanik: ware teilweise, In Arbeit",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].regeln[9]",
      "screens[ware].abnahme[9]",
      "bausteine_vertraege.warenpruefung.aufbau"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.rest-kommt-noch",
        "aktion": "klicken"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.annehmen",
            "erwartung": "text",
            "wert": "Teillieferung · in Galvanik"
          },
          {
            "id": "ware.teil-warten",
            "erwartung": "sichtbar"
          },
          {
            "id": "ware.nur-annehmen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Teillieferung {auftrag} angenommen · in Galvanik · Rest erwartet · Laufzettel wird gedruckt"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "teilweise",
            "station": "in_arbeit"
          }
        },
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "zustand": "teillieferung"
          }
        }
      ]
    }
  },
  {
    "id": "W09",
    "titel": "Teillieferung · auf Rest warten: ware teilweise, Station Wareneingang",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[teil-warten]",
      "screens[ware].abnahme[10]"
    ],
    "deckt": [
      "ware.teil-warten"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.rest-kommt-noch",
        "aktion": "klicken"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "id": "ware.teil-warten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Teillieferung {auftrag} angenommen · wartet auf den Rest · Laufzettel wird gedruckt"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "teilweise",
            "station": "wareneingang"
          }
        }
      ]
    }
  },
  {
    "id": "W10",
    "titel": "Rest annehmen (ware teilweise, In Arbeit): Zustand rest, „Rest prüfen“, „Rest annehmen“ → ware da, Station bleibt",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].zustaende.rest",
      "screens[ware].regeln[10]",
      "screens[ware].abnahme[11]"
    ],
    "deckt": [
      "ware.rest-annehmen",
      "ware.rest-pruefen",
      "zustand.rest"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_teilweise"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_teilweise}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.zustand.rest",
            "erwartung": "text_enthaelt",
            "wert": "Teillieferung angenommen · Rest erwartet"
          }
        ]
      },
      {
        "id": "ware.rest-pruefen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.position.stimmt",
            "erwartung": "anzahl",
            "wert": 1
          }
        ]
      },
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.teile",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.position.stimmt",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "ware.rest-annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Rest {auftrag} angenommen · Ware vollständig · Laufzettel wird gedruckt"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_teilweise}"
          },
          "werte": {
            "ware": "da",
            "station": "in_arbeit"
          }
        }
      ]
    }
  },
  {
    "id": "W11",
    "titel": "Zustand rest: „Schließen“ schließt ohne Änderung",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].zustaende.rest"
    ],
    "deckt": [
      "ware.schliessen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_teilweise"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_teilweise}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "ware",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_teilweise}"
          },
          "werte": {
            "ware": "teilweise"
          }
        }
      ]
    }
  },
  {
    "id": "W12",
    "titel": "Ohne Recht „auftraege“: Hauptknopf heißt „Ware annehmen“ (= Nur annehmen)",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[annehmen].texte_je_recht",
      "bausteine_vertraege.warenpruefung.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_nur_eingang",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.annehmen",
            "erwartung": "text",
            "wert": "Ware annehmen"
          }
        ]
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} angenommen · Wareneingang · Laufzettel wird gedruckt"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "da",
            "station": "wareneingang"
          }
        }
      ]
    },
    "notiz": "Ohne „auftraege“ ist der Hauptknopf „Nur annehmen“ (texte_je_recht) – Meldung und Wirkung wie aktionen[nur-annehmen]."
  },
  {
    "id": "W13",
    "titel": "Abbrechen: Zwischenstand bleibt am Eingang des Auftrags; erneutes Öffnen zeigt den Zustand wieder",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].aktionen[abbrechen]",
      "bausteine_vertraege.warenpruefung.regeln[1]",
      "screens[ware].regeln[7]",
      "screens[ware].abnahme[6]"
    ],
    "deckt": [
      "ware.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.abbrechen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware",
            "erwartung": "nicht_sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "goods_receipt",
            "neu": 1,
            "werte": {
              "status": "entwurf",
              "zustand": "unauffaellig"
            }
          },
          {
            "tabelle": "intake_item",
            "neu": 1,
            "werte": {
              "kanal": "foto",
              "zuordnung": "hand"
            }
          }
        ]
      },
      {
        "aktion": "oeffne",
        "wert": "ware",
        "arg": "{auftrag_erwartet}"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "ware"
        },
        {
          "id": "ware.warenzustand",
          "erwartung": "gewaehlt",
          "wert": "Unauffällig"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "erwartet"
          }
        }
      ]
    }
  },
  {
    "id": "W14",
    "titel": "Speichern scheitert: „Nicht gespeichert · alle Eingaben sind noch da“, „Erneut“, dann angenommen",
    "paket": "AP-W",
    "quelle": [
      "screens[ware].zustaende.fehler",
      "bausteine_vertraege.warenpruefung.zustaende.fehler"
    ],
    "deckt": [
      "ware.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nicht gespeichert · alle Eingaben sind noch da"
          },
          {
            "id": "ware.warenzustand",
            "erwartung": "gewaehlt",
            "wert": "Unauffällig"
          }
        ],
        "db": [
          {
            "tabelle": "orders",
            "wo": {
              "id": "{auftrag_erwartet}"
            },
            "werte": {
              "ware": "erwartet"
            }
          }
        ]
      },
      {
        "id": "ware.erneut",
        "aktion": "klicken"
      },
      {
        "id": "ware.annehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} angenommen · in Galvanik · Laufzettel wird gedruckt"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "da"
          }
        }
      ]
    }
  },
  {
    "id": "Q06",
    "titel": "Warenprüfung: Zustand gewählt grün, Grund-Chips einzeln",
    "paket": "AP-Q1",
    "quelle": [
      "verhalten_appweit.auswahl",
      "bausteine_vertraege.warenpruefung.aufbau"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "ware.warenzustand",
            "erwartung": "nicht_gewaehlt",
            "option": "Unauffällig"
          },
          {
            "id": "ware.warenzustand",
            "erwartung": "nicht_gewaehlt",
            "option": "Abweichung"
          }
        ]
      },
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Abweichung"
      },
      {
        "id": "ware.grund",
        "aktion": "waehlen",
        "wert": "beschädigt"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "ware.warenzustand",
          "erwartung": "gewaehlt",
          "wert": "Abweichung"
        },
        {
          "id": "ware.warenzustand",
          "erwartung": "nicht_gewaehlt",
          "option": "Unauffällig"
        },
        {
          "id": "ware.grund",
          "erwartung": "gewaehlt",
          "wert": "beschädigt"
        },
        {
          "id": "ware.grund",
          "erwartung": "nicht_gewaehlt",
          "option": "falsche Teile"
        }
      ]
    }
  },
  {
    "id": "W15",
    "titel": "× mit Eingaben: keine Rückfrage (3.7 speichert jeden Schritt), Zwischenstand bleibt",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.aenderung",
      "screens[ware].regeln[7]",
      "bausteine_vertraege.warenpruefung.regeln[1]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "ware",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "status": "entwurf",
            "zustand": "unauffaellig"
          }
        },
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "erwartet"
          }
        }
      ]
    }
  },
  {
    "id": "W16",
    "titel": "Esc mit Eingaben: keine Rückfrage (3.7 speichert jeden Schritt), Zwischenstand bleibt",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.aenderung",
      "screens[ware].regeln[7]",
      "bausteine_vertraege.warenpruefung.regeln[1]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
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
          "id": "ware",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "status": "entwurf",
            "zustand": "unauffaellig"
          }
        },
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "erwartet"
          }
        }
      ]
    }
  },
  {
    "id": "W17",
    "titel": "Doppelklick „Annehmen · in Galvanik“: idempotent (client_key) – genau ein goods_receipt, ein Laufzettel",
    "paket": "AP-EIN",
    "quelle": [
      "screens[ware].aktionen[annehmen]",
      "eingang.befehle[ware.annehmen] (Runde 42, Nachtrag 2: client_key)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_erwartet"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstiege laut screens[ware].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.warenzustand",
        "aktion": "waehlen",
        "wert": "Unauffällig"
      },
      {
        "id": "ware.foto.paket",
        "aktion": "datei",
        "wert": "pruef_foto.jpg"
      },
      {
        "id": "ware.alle-stimmen",
        "aktion": "klicken"
      },
      {
        "id": "ware.annehmen",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Ware {auftrag} angenommen · in Galvanik · Laufzettel wird gedruckt"
        },
        {
          "druck": 1
        }
      ],
      "db": [
        {
          "tabelle": "goods_receipt",
          "neu": 1,
          "werte": {
            "status": "galvanik"
          }
        },
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_erwartet}"
          },
          "werte": {
            "ware": "da",
            "station": "in_arbeit"
          }
        }
      ]
    }
  },
  {
    "id": "RT01-01",
    "titel": "Zwei Originale erzeugen je eigene Vorschläge mit Fundstelle; Übernehmen belegt Felder vor (Herkunft „erkannt“)",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.ruecklese"
    ],
    "deckt": [
      "ware.uebernehmen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "zettel_handschrift.jpg"
      },
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "visitenkarte.jpg"
      },
      {
        "id": "ware.uebernehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.menge",
          "erwartung": "wert",
          "wert": "30",
          "nr": 1
        },
        {
          "id": "eingang.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "erkannt",
          "nr": 1
        },
        {
          "text": "{eingang_foto_offen.fixture_firma}",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_suggestion",
          "neu": 5
        }
      ]
    }
  },
  {
    "id": "RT01-02",
    "titel": "Von Hand geänderter Wert wird durch ein weiteres Foto nicht zurückgesetzt",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.ruecklese.bestaetigt_bleibt"
    ],
    "deckt": [
      "ware.uebernehmen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "zettel_handschrift.jpg"
      },
      {
        "id": "ware.uebernehmen",
        "aktion": "klicken"
      },
      {
        "id": "eingang.menge",
        "aktion": "tippen",
        "wert": "28",
        "nr": 1
      },
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "zettel_handschrift.jpg"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.menge",
          "erwartung": "wert",
          "wert": "28",
          "nr": 1
        },
        {
          "text": "neu erkannt: 30",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT02-01",
    "titel": "Erkennung scheitert einmal: „Erneut lesen“ verarbeitet dasselbe Original, kein zweiter Eingang",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.zustaende"
    ],
    "deckt": [
      "ware.erneut-lesen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_fehlgeschlagen",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.zustand",
        "erwartung": "text_enthaelt",
        "wert": "Erkennung fehlgeschlagen"
      },
      {
        "id": "ware.erneut-lesen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "ware.zustand",
          "erwartung": "text_enthaelt",
          "wert": "Erkennung läuft"
        },
        {
          "text": "Vorschläge",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "neu": 0
        },
        {
          "tabelle": "goods_receipts",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "RT02-02",
    "titel": "Erkennung hängt (> 2 Minuten): Zustand verwaist mit „Erneut lesen“",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.zustaende"
    ],
    "deckt": [
      "ware.erneut-lesen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_verwaist",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "ware.zustand",
          "erwartung": "text_enthaelt",
          "wert": "Erkennung hängt"
        },
        {
          "id": "ware.erneut-lesen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT03-01",
    "titel": "Format foto.heic → Vorschläge",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.formate"
    ],
    "deckt": [
      "ware.uebernehmen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "foto.heic"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Vorschläge",
          "erwartung": "sichtbar"
        },
        {
          "id": "ware.uebernehmen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT03-02",
    "titel": "Format grenze_20mb.jpg → Vorschläge",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.formate"
    ],
    "deckt": [
      "ware.uebernehmen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "grenze_20mb.jpg"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Vorschläge",
          "erwartung": "sichtbar"
        },
        {
          "id": "ware.uebernehmen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT03-03",
    "titel": "Format zu_gross.jpg → Datei zu groß (max. 20 MB)",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.formate"
    ],
    "deckt": [
      "ware.als-datei-ablegen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "zu_gross.jpg"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Datei zu groß (max. 20 MB)",
          "erwartung": "sichtbar"
        },
        {
          "id": "ware.als-datei-ablegen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT03-04",
    "titel": "Format unlesbar.jpg → Nichts erkannt",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.formate"
    ],
    "deckt": [
      "ware.von-hand-erfassen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "unlesbar.jpg"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Nichts erkannt",
          "erwartung": "sichtbar"
        },
        {
          "id": "ware.von-hand-erfassen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT03-05",
    "titel": "Format rechnung_xrechnung.xml → Rechnung",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.formate"
    ],
    "deckt": [
      "ware.bei-vorgang-ablegen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "auftrag_erwartet",
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "ware",
        "arg": "{auftrag_erwartet.id}#{eingang_foto_offen.id}",
        "weg": [],
        "quelle": "screens[ware]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "ware.foto",
        "aktion": "datei",
        "wert": "rechnung_xrechnung.xml"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Rechnung",
          "erwartung": "sichtbar"
        },
        {
          "id": "ware.bei-vorgang-ablegen",
          "erwartung": "sichtbar"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · ware", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
