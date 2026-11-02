// Generated from BAUPLAN SHA-256 5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "B01",
    "titel": "{kunde}: alle Felder vorbelegt, keine Kundensuche, kein Hinweis",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].regeln[0]",
      "screens[kundebearbeiten].aufrufe",
      "screens[kundebearbeiten].abnahme[11]"
    ],
    "deckt": [
      "aufruf.{kunde}"
    ],
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "kundebearbeiten"
        },
        {
          "id": "kundebearbeiten.kundentyp",
          "erwartung": "gewaehlt",
          "wert": "Firma"
        },
        {
          "id": "kundebearbeiten.name",
          "erwartung": "wert",
          "wert": "{kunde_vollstaendig_firma.company_name}"
        },
        {
          "id": "kundebearbeiten.email",
          "erwartung": "wert",
          "wert": "{kunde_vollstaendig_firma.email}"
        },
        {
          "id": "kundebearbeiten.land",
          "erwartung": "wert",
          "wert": "Deutschland"
        },
        {
          "id": "kundebearbeiten.kundensuche",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundebearbeiten.hinweis",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "B02",
    "titel": "{kunde}#fehlend ohne Zahlungsbedingung (Recht geld): Hinweis oben, Fokus im fehlenden Feld",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aufrufe",
      "screens[kundebearbeiten].abnahme[0]",
      "screens[kundebearbeiten].abnahme[1]"
    ],
    "deckt": [
      "zustand.fehlt",
      "aufruf.{kunde}#fehlend"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_ohne_bedingung",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_ohne_bedingung}#fehlend",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.hinweis",
          "erwartung": "text_enthaelt",
          "wert": "Für Aufträge fehlt: Zahlungsbedingung"
        },
        {
          "id": "kundebearbeiten.zahlungsbedingung",
          "erwartung": "fokus"
        },
        {
          "id": "kundebearbeiten.zahlungsbedingung",
          "erwartung": "ohne_wahl"
        }
      ]
    }
  },
  {
    "id": "B03",
    "titel": "{kunde}#fehlend Firma ohne Ansprechpartner: Fokus Nachname",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aufrufe",
      "formulare.kunde.vollstaendigkeit.labels"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_firma_ohne_ansprechpartner",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_firma_ohne_ansprechpartner}#fehlend",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.hinweis",
          "erwartung": "text_enthaelt",
          "wert": "Ansprechpartner"
        },
        {
          "id": "kundebearbeiten.nachname",
          "erwartung": "fokus"
        }
      ]
    }
  },
  {
    "id": "B04",
    "titel": "PLZ passt nicht zum Land: Anschrift fehlt; Land Schweiz → gespeichert",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aufrufe",
      "formulare.kunde.vollstaendigkeit.labels",
      "formulare.kunde.felder[plz].validierung",
      "formulare.kunde.adresspruefung.wann (Änderung des Lands)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_plz_land_widerspruch",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_plz_land_widerspruch}#fehlend",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.hinweis",
            "erwartung": "text_enthaelt",
            "wert": "Anschrift"
          },
          {
            "id": "kundebearbeiten.plz",
            "erwartung": "fokus"
          }
        ]
      },
      {
        "id": "kundebearbeiten.land",
        "aktion": "waehlen",
        "wert": "Schweiz"
      },
      {
        "id": "kundebearbeiten.land",
        "aktion": "verlassen"
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
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
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        },
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_plz_land_widerspruch}"
          },
          "werte": {
            "country": "CH",
            "zip_code": "3013"
          }
        }
      ]
    }
  },
  {
    "id": "B05",
    "titel": "Änderung speichern → Toast, zurück zur aufrufenden Ebene",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aktionen[speichern]",
      "screens[kundebearbeiten].abnahme[5]"
    ],
    "deckt": [
      "kundebearbeiten.speichern",
      "zustand.erfolg"
    ],
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
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
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
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
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        },
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
    "id": "B06",
    "titel": "Unvollständig speichern: Zwischenschritt „Trotzdem speichern“",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].zustaende.teilweise",
      "screens[kundebearbeiten].abnahme[6]"
    ],
    "deckt": [
      "kundebearbeiten.trotzdem-speichern",
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_firma_ohne_ansprechpartner",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_firma_ohne_ansprechpartner}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Für Auftrag fehlt noch:"
          },
          {
            "id": "kundebearbeiten.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Ansprechpartner"
          }
        ],
        "db": [
          {
            "tabelle": "customers",
            "wo": {
              "id": "{kunde_firma_ohne_ansprechpartner}"
            },
            "werte": {
              "contact_role": null
            }
          }
        ]
      },
      {
        "id": "kundebearbeiten.trotzdem-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde gespeichert · unvollständig"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_firma_ohne_ansprechpartner}"
          },
          "werte": {
            "contact_role": "Einkauf"
          }
        }
      ]
    }
  },
  {
    "id": "B17",
    "titel": "Zwischenschritt „Weiter ausfüllen“: zurück ins Formular, Fokus im fehlenden Feld, nichts gespeichert",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].zustaende.teilweise"
    ],
    "deckt": [
      "kundebearbeiten.weiter-ausfuellen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_firma_ohne_ansprechpartner",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_firma_ohne_ansprechpartner}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      },
      {
        "id": "kundebearbeiten.weiter-ausfuellen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.zustand.teilweise",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundebearbeiten.nachname",
          "erwartung": "fokus"
        },
        {
          "oben": "kundebearbeiten"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_firma_ohne_ansprechpartner}"
          },
          "werte": {
            "contact_role": null
          }
        }
      ]
    }
  },
  {
    "id": "B07",
    "titel": "Ohne Recht „geld“: kein Feld Zahlungsbedingung; fehlt nur sie, ohne Zwischenschritt gespeichert",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].regeln[2]",
      "screens[kundebearbeiten].abnahme[2]",
      "screens[kundebearbeiten].abnahme[10]",
      "formulare.kunde.vollstaendigkeit.speichern_ohne_geld"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_ohne_bedingung",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_ohne_bedingung}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.zahlungsbedingung",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "kundebearbeiten.funktion",
        "aktion": "tippen",
        "wert": "Lager"
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde gespeichert"
        },
        {
          "id": "kundebearbeiten.zustand.teilweise",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_ohne_bedingung}"
          },
          "werte": {
            "zahlungsbedingung": null,
            "contact_role": "Lager"
          }
        }
      ]
    }
  },
  {
    "id": "B08",
    "titel": "Zahlungsbedingung ohne Freischaltung: nur Vorkasse | Bar",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].regeln[2]",
      "screens[kundebearbeiten].abnahme[3]"
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.zahlungsbedingung",
          "erwartung": "optionen",
          "wert": [
            "Vorkasse",
            "Bar oder Karte bei Abholung"
          ]
        }
      ]
    }
  },
  {
    "id": "B09",
    "titel": "Zahlungsbedingung mit Freischaltung: zusätzlich „Rechnung auf Ziel · 30 Tage“",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].regeln[2]",
      "formulare.kunde.felder[zahlungsbedingung].option_ziel",
      "screens[kundebearbeiten].abnahme[3]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_rechnung_freigeschaltet",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_rechnung_freigeschaltet}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.zahlungsbedingung",
          "erwartung": "optionen",
          "wert": [
            "Vorkasse",
            "Bar oder Karte bei Abholung",
            "Rechnung auf Ziel · 30 Tage"
          ]
        },
        {
          "id": "kundebearbeiten.zahlungsbedingung",
          "erwartung": "gewaehlt",
          "wert": "Rechnung auf Ziel · 30 Tage"
        }
      ]
    }
  },
  {
    "id": "B10",
    "titel": "Ungültige PLZ: Fehlertext am Feld, nichts gespeichert",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].abnahme[7]",
      "formulare.kunde.adresspruefung.gespeichert (Feldfehler geht vor)"
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.plz",
        "aktion": "tippen",
        "wert": "1234"
      },
      {
        "id": "kundebearbeiten.plz",
        "aktion": "verlassen"
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.plz.fehler",
          "erwartung": "text",
          "wert": "PLZ prüfen"
        },
        {
          "id": "kundebearbeiten.plz",
          "erwartung": "fokus"
        },
        {
          "oben": "kundebearbeiten"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_vollstaendig_firma}"
          },
          "werte": {
            "zip_code": "{kunde_vollstaendig_firma.zip_code}"
          }
        }
      ]
    }
  },
  {
    "id": "B11",
    "titel": "Netzfehler → „Nicht gespeichert · Eingaben sind noch da“, „Erneut speichern“",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].zustaende.fehler",
      "screens[kundebearbeiten].abnahme[9]"
    ],
    "deckt": [
      "kundebearbeiten.erneut-speichern",
      "zustand.fehler"
    ],
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.email",
        "aktion": "tippen",
        "wert": "zwei@alpha-pruef.test"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nicht gespeichert · Eingaben sind noch da"
          },
          {
            "id": "kundebearbeiten.email",
            "erwartung": "wert",
            "wert": "zwei@alpha-pruef.test"
          }
        ],
        "db": [
          {
            "tabelle": "customers",
            "wo": {
              "id": "{kunde_vollstaendig_firma}"
            },
            "werte": {
              "email": "{kunde_vollstaendig_firma.email}"
            }
          }
        ]
      },
      {
        "id": "kundebearbeiten.erneut-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde gespeichert"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_vollstaendig_firma}"
          },
          "werte": {
            "email": "zwei@alpha-pruef.test"
          }
        }
      ]
    }
  },
  {
    "id": "B12a",
    "titel": "Abbrechen schließt ohne Rückfrage und ohne Änderung",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aktionen[abbrechen]",
      "screens[kundebearbeiten].regeln[-1]",
      "screens[kundebearbeiten].abnahme[9]"
    ],
    "deckt": [
      "kundebearbeiten.abbrechen"
    ],
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.email",
        "aktion": "tippen",
        "wert": "nicht@alpha-pruef.test"
      },
      {
        "id": "kundebearbeiten.abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
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
            "email": "{kunde_vollstaendig_firma.email}"
          }
        }
      ]
    }
  },
  {
    "id": "B12b",
    "titel": "× schließt ohne Rückfrage und ohne Änderung",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aktionen[abbrechen]",
      "screens[kundebearbeiten].regeln[-1]",
      "screens[kundebearbeiten].abnahme[9]"
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.email",
        "aktion": "tippen",
        "wert": "nicht@alpha-pruef.test"
      },
      {
        "id": "kundebearbeiten.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
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
            "email": "{kunde_vollstaendig_firma.email}"
          }
        }
      ]
    }
  },
  {
    "id": "B12c",
    "titel": "Esc schließt ohne Rückfrage und ohne Änderung",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aktionen[abbrechen]",
      "screens[kundebearbeiten].regeln[-1]",
      "screens[kundebearbeiten].abnahme[9]"
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.email",
        "aktion": "tippen",
        "wert": "nicht@alpha-pruef.test"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
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
            "email": "{kunde_vollstaendig_firma.email}"
          }
        }
      ]
    }
  },
  {
    "id": "B13",
    "titel": "Typwechsel Firma → Privat: Rückfrage, „Wechseln“, Anzeigename „Vorname Nachname“",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].zustaende.typwechsel",
      "formulare.kunde.typ_felder.wechsel",
      "screens[kundebearbeiten].abnahme[14]"
    ],
    "deckt": [
      "kundebearbeiten.typ-wechseln",
      "zustand.typwechsel"
    ],
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.kundentyp",
        "aktion": "waehlen",
        "wert": "Privat"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.zustand.typwechsel",
            "erwartung": "text_enthaelt",
            "wert": "Angaben entfallen"
          },
          {
            "id": "kundebearbeiten.zustand.typwechsel",
            "erwartung": "text_enthaelt",
            "wert": "Firmenname"
          }
        ]
      },
      {
        "id": "kundebearbeiten.typ-wechseln",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.kundentyp",
            "erwartung": "gewaehlt",
            "wert": "Privat"
          },
          {
            "id": "kundebearbeiten.name",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "kundebearbeiten.nachname",
            "erwartung": "wert",
            "wert": "{kunde_vollstaendig_firma.last_name}"
          }
        ]
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde gespeichert"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_vollstaendig_firma}"
          },
          "werte": {
            "customer_type": "privat",
            "company_name": null,
            "contact_role": null,
            "name": "Testa Alphaprobe"
          }
        }
      ]
    }
  },
  {
    "id": "B14",
    "titel": "Typwechsel abbrechen: Typ bleibt Firma",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].zustaende.typwechsel"
    ],
    "deckt": [
      "kundebearbeiten.typ-wechsel-abbrechen"
    ],
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
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.kundentyp",
        "aktion": "waehlen",
        "wert": "Privat"
      },
      {
        "id": "kundebearbeiten.typ-wechsel-abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.kundentyp",
          "erwartung": "gewaehlt",
          "wert": "Firma"
        },
        {
          "id": "kundebearbeiten.name",
          "erwartung": "wert",
          "wert": "{kunde_vollstaendig_firma.company_name}"
        },
        {
          "id": "kundebearbeiten.zustand.typwechsel",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "B15",
    "titel": "Typwechsel Privat → Firma ohne Rückfrage; Firmenname leer, Person wird Ansprechpartner",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.typ_felder.wechsel"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_privat_ohne_ansprechpartner",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundebearbeiten",
        "arg": "{kunde_privat_ohne_ansprechpartner}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – die Einstiege (5.1, 5.3, 7.1/7.2, 8.6) liegen außerhalb dieses Bauplans"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundebearbeiten.kundentyp",
        "aktion": "waehlen",
        "wert": "Firma"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundebearbeiten.zustand.typwechsel",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundebearbeiten.name",
          "erwartung": "leer"
        },
        {
          "id": "kundebearbeiten.vorname",
          "erwartung": "wert",
          "wert": "{kunde_privat_ohne_ansprechpartner.first_name}"
        },
        {
          "id": "kundebearbeiten.funktion",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "B16",
    "titel": "#uebernahme aus 3.1: 5.2 ersetzt 3.1, leere Felder vorbelegt, abweichender Wert als „neu · bisher“ zum Übernehmen",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundebearbeiten].aufrufe",
      "bausteine_vertraege.dublette.interaktion[diesen-kunden-bearbeiten]",
      "screens[kundebearbeiten].abnahme[15]",
      "screens[kundebearbeiten].ebene"
    ],
    "deckt": [
      "aufruf.{kunde}#uebernahme"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "verzeichnis_pruefadressen"
      ],
      "aufruf": {
        "seite": "kundeneu",
        "arg": "(leer)",
        "weg": [
          {
            "id": "navigation.plus",
            "aktion": "klicken"
          },
          {
            "id": "rein.kunde-anlegen",
            "aktion": "klicken"
          }
        ],
        "quelle": "rein.inhalt.ohne_vorlage[kunde-anlegen]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kundeneu.kundentyp",
        "aktion": "waehlen",
        "wert": "Firma"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.phone}"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "neu@alpha-pruef.test"
      },
      {
        "id": "kundeneu.rechnungs_email",
        "aktion": "tippen",
        "wert": "rechnung@alpha-pruef.test"
      },
      {
        "id": "kundeneu.rechnungs_email",
        "aktion": "verlassen"
      },
      {
        "id": "kundeneu.diesen-kunden-bearbeiten",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "kundebearbeiten"
          },
          {
            "id": "kundeneu",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "kundebearbeiten.rechnungs_email",
            "erwartung": "wert",
            "wert": "rechnung@alpha-pruef.test"
          },
          {
            "id": "kundebearbeiten.rechnungs_email.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "aus deiner Eingabe"
          },
          {
            "id": "kundebearbeiten.email",
            "erwartung": "wert",
            "wert": "{kunde_vollstaendig_firma.email}"
          },
          {
            "text": "neu: neu@alpha-pruef.test",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "kundebearbeiten.email.uebernehmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundebearbeiten.email",
            "erwartung": "wert",
            "wert": "neu@alpha-pruef.test"
          }
        ]
      },
      {
        "id": "kundebearbeiten.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde gespeichert"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        },
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_vollstaendig_firma}"
          },
          "werte": {
            "email": "neu@alpha-pruef.test",
            "billing_email": "rechnung@alpha-pruef.test"
          }
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · kundebearbeiten", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      test.skip(!flowCase.paket, "Im Bauplan noch keinem Paket zugeordnet");
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
