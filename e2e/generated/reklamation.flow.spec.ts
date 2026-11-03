// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "L01",
    "titel": "Auftrag #aufnehmen: Teile des Auftrags, „Ware kommt zurück?“ = noch offen, keine Entscheidung; Schließen ohne Wirkung",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].inhalt",
      "screens[reklamation].zustaende.leer",
      "screens[reklamation].aktionen[schliessen]"
    ],
    "deckt": [
      "reklamation.schliessen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "reklamation"
          },
          {
            "id": "reklamation.teile",
            "erwartung": "anzahl",
            "wert": 2
          },
          {
            "id": "reklamation.ware_zurueck",
            "erwartung": "gewaehlt",
            "wert": "noch offen"
          },
          {
            "id": "reklamation.aufnehmen",
            "erwartung": "sichtbar"
          },
          {
            "id": "reklamation.bewertung",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "reklamation.entscheiden",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "reklamation.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "L02",
    "titel": "Aufnehmen ohne Teile und Mangel: „Noch offen“, nichts angelegt; „Zur Lücke“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].zustaende.teilweise",
      "screens[reklamation].inhalt[1].felder",
      "eingang.befehle[reklamation.aufnehmen].fehler"
    ],
    "deckt": [
      "reklamation.zur-luecke",
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.aufnehmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Noch offen"
          },
          {
            "id": "reklamation.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Betroffene Teile"
          },
          {
            "id": "reklamation.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Mangel"
          },
          {
            "oben": "reklamation"
          }
        ]
      },
      {
        "id": "reklamation.zur-luecke",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "reklamation.zustand.teilweise",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "reklamation"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "L03",
    "titel": "Entscheiden berechtigt + Nacharbeit: Liefertermin vorbelegt; Nacharbeitsauftrag (Zahlungsmodus keiner, ware erwartet)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].aktionen[entscheiden]",
      "screens[reklamation].abnahme[1]",
      "screens[reklamation].abnahme[10]",
      "prozesse.reklamation"
    ],
    "deckt": [
      "reklamation.entscheiden",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_aufgenommen"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_aufgenommen}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.bewertung",
        "aktion": "waehlen",
        "wert": "berechtigt"
      },
      {
        "id": "reklamation.massnahme",
        "aktion": "waehlen",
        "wert": "Nacharbeit"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.liefertermin",
            "erwartung": "nicht_leer"
          }
        ]
      },
      {
        "id": "reklamation.entscheiden",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Entschieden · Nacharbeit"
        },
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "wo": {
            "id": "{reklamation_aufgenommen}"
          },
          "werte": {
            "stand": "massnahme_nacharbeit",
            "bewertung": "berechtigt",
            "massnahme": "nacharbeit"
          }
        },
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "nacharbeit_zu": "{reklamation_aufgenommen}",
            "kunde": "{kunde_vollstaendig_firma}",
            "zahlungsmodus": "keiner",
            "ware": "erwartet",
            "station": "wareneingang",
            "eingangsart": "versand"
          }
        }
      ]
    }
  },
  {
    "id": "L04",
    "titel": "Abgelehnt ohne Begründung → Feldfehler am Feld „Begründung“ (Fokus), nichts gespeichert; mit Begründung → „Entschieden · abgelehnt“, Stand kunde_informieren",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].abnahme[3]",
      "screens[reklamation].inhalt[2].felder[begruendung]",
      "screens[reklamation].regeln[4]",
      "verhalten_appweit.pflicht_grund"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_aufgenommen"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_aufgenommen}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.bewertung",
        "aktion": "waehlen",
        "wert": "abgelehnt"
      },
      {
        "id": "reklamation.entscheiden",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.begruendung.fehler",
            "erwartung": "sichtbar"
          },
          {
            "id": "reklamation.begruendung",
            "erwartung": "fokus"
          },
          {
            "id": "reklamation.zustand.teilweise",
            "erwartung": "nicht_sichtbar"
          },
          {
            "oben": "reklamation"
          }
        ],
        "db": [
          {
            "tabelle": "complaint",
            "wo": {
              "id": "{reklamation_aufgenommen}"
            },
            "werte": {
              "stand": "aufgenommen"
            }
          }
        ]
      },
      {
        "id": "reklamation.begruendung",
        "aktion": "tippen",
        "wert": "Prüfbegründung Ablehnung"
      },
      {
        "id": "reklamation.entscheiden",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Entschieden · abgelehnt"
        },
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "wo": {
            "id": "{reklamation_aufgenommen}"
          },
          "werte": {
            "stand": "kunde_informieren",
            "bewertung": "abgelehnt",
            "begruendung": "Prüfbegründung Ablehnung"
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
    "id": "L05",
    "titel": "„Ware kommt zurück?“ = nein: Maßnahme Nacharbeit gesperrt „Nacharbeit braucht die Teile“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].inhalt[1].felder[ware_zurueck].regel",
      "screens[reklamation].inhalt[2].felder[massnahme].regel",
      "screens[reklamation].abnahme[7]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_ohne_ware"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_ohne_ware}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.bewertung",
        "aktion": "waehlen",
        "wert": "berechtigt"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "reklamation.massnahme",
          "erwartung": "gesperrt",
          "wert": "Nacharbeit braucht die Teile",
          "option": "Nacharbeit"
        }
      ]
    }
  },
  {
    "id": "L06",
    "titel": "„Kunde zieht zurück“: ohne Notiz Feldfehler, nichts gespeichert; mit Notiz abgeschlossen (zurückgezogen)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].zustaende.zurueckziehen",
      "screens[reklamation].regeln[5]",
      "screens[reklamation].abnahme[8]",
      "eingang.befehle[reklamation.abschliessen]",
      "verhalten_appweit.pflicht_grund"
    ],
    "deckt": [
      "reklamation.zurueckgezogen",
      "reklamation.zurueckziehen-speichern",
      "zustand.zurueckziehen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_aufgenommen"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_aufgenommen}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.zurueckgezogen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.zustand.zurueckziehen",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "reklamation.zurueckziehen-speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "reklamation"
          },
          {
            "id": "reklamation.notiz.fehler",
            "erwartung": "sichtbar"
          },
          {
            "id": "reklamation.zustand.teilweise",
            "erwartung": "nicht_sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "complaint",
            "wo": {
              "id": "{reklamation_aufgenommen}"
            },
            "werte": {
              "stand": "aufgenommen"
            }
          }
        ]
      },
      {
        "id": "reklamation.notiz",
        "aktion": "tippen",
        "wert": "Kunde hat telefonisch zurückgezogen"
      },
      {
        "id": "reklamation.zurueckziehen-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Reklamation abgeschlossen · zurückgezogen"
        },
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "wo": {
            "id": "{reklamation_aufgenommen}"
          },
          "werte": {
            "stand": "abgeschlossen",
            "abschluss_art": "zurueckgezogen",
            "abschluss_notiz": "Kunde hat telefonisch zurückgezogen"
          }
        }
      ]
    }
  },
  {
    "id": "L07",
    "titel": "Ohne Recht „entscheiden“ (Werkstatt): keine Entscheidung, „Kunde zieht zurück“ da",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].recht_regel",
      "screens[reklamation].regeln[6]",
      "verhalten_appweit.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_aufgenommen"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_aufgenommen}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "reklamation"
        },
        {
          "id": "reklamation.bewertung",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "reklamation.entscheiden",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "reklamation.zurueckgezogen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "L08",
    "titel": "„Gutschrift erteilt“ mit Betrag und Nr. → Stand kunde_informieren",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].zustaende.gutschrift",
      "screens[reklamation].regeln[3]",
      "screens[reklamation].abnahme[9]"
    ],
    "deckt": [
      "reklamation.gutschrift-erteilt",
      "reklamation.gutschrift-speichern",
      "zustand.gutschrift"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_gutschrift"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_gutschrift}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.gutschrift-erteilt",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.zustand.gutschrift",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "reklamation.gutschrift_betrag",
        "aktion": "tippen",
        "wert": "50,00"
      },
      {
        "id": "reklamation.gutschrift_nr",
        "aktion": "tippen",
        "wert": "GS-PRUEF-1"
      },
      {
        "id": "reklamation.gutschrift-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Gutschrift vermerkt · Kunde informieren"
        },
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "wo": {
            "id": "{reklamation_gutschrift}"
          },
          "werte": {
            "stand": "kunde_informieren",
            "gutschrift_betrag": 50,
            "gutschrift_nr": "GS-PRUEF-1"
          }
        }
      ]
    }
  },
  {
    "id": "L09",
    "titel": "Esc ohne Änderung schließt; mit Änderung Esc → Rückfrage über 4.8, „Verwerfen“ ohne Reklamation",
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
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "taste",
        "wert": "Escape"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "aktion": "oeffne",
        "wert": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen"
      },
      {
        "id": "reklamation.beschreibung",
        "aktion": "tippen",
        "wert": "Prüfbeschreibung Rückfrage"
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
            "id": "reklamation",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "text_enthaelt",
            "wert": "Beschreibung"
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
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "L10",
    "titel": "„Reklamation aufnehmen“ mit Teil und Mangel: Stand aufgenommen (Menge betroffen = geliefert vorbelegt)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].aktionen[aufnehmen]",
      "screens[reklamation].abnahme[0]",
      "eingang.befehle[reklamation.aufnehmen]",
      "screens[reklamation].regeln (Runde 40)"
    ],
    "deckt": [
      "reklamation.aufnehmen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.teile",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "reklamation.mangel",
        "aktion": "waehlen",
        "wert": "Blasen"
      },
      {
        "id": "reklamation.aufnehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Reklamation {reklamation} aufgenommen · Meister entscheidet"
        },
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "neu": 1,
          "werte": {
            "auftrag_id": "{auftrag_quelle}",
            "kunde_id": "{kunde_vollstaendig_firma}",
            "stand": "aufgenommen",
            "mangel": "blasen",
            "ware_zurueck": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "L11",
    "titel": "Doppelklick „Reklamation aufnehmen“ → genau eine Reklamation",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.befehle[reklamation.aufnehmen].idempotenz"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.teile",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "reklamation.mangel",
        "aktion": "waehlen",
        "wert": "Blasen"
      },
      {
        "id": "reklamation.aufnehmen",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "neu": 1,
          "werte": {
            "stand": "aufgenommen"
          }
        }
      ]
    }
  },
  {
    "id": "L12",
    "titel": "Speichern scheitert: „Nicht gespeichert · alle Eingaben sind noch da“; „Erneut“, dann „Entscheidung speichern“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].zustaende.fehler",
      "screens[reklamation].regeln (Runde 40)"
    ],
    "deckt": [
      "reklamation.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle",
        "reklamation_aufgenommen"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{reklamation_aufgenommen}",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1] (Auftragskarte „Mehr › Reklamation“, Kundenkarte, Der Tag – außerhalb)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.bewertung",
        "aktion": "waehlen",
        "wert": "abgelehnt"
      },
      {
        "id": "reklamation.begruendung",
        "aktion": "tippen",
        "wert": "Prüfbegründung Netz"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "reklamation.entscheiden",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nicht gespeichert · alle Eingaben sind noch da"
          },
          {
            "id": "reklamation.begruendung",
            "erwartung": "wert",
            "wert": "Prüfbegründung Netz"
          },
          {
            "oben": "reklamation"
          }
        ],
        "db": [
          {
            "tabelle": "complaint",
            "wo": {
              "id": "{reklamation_aufgenommen}"
            },
            "werte": {
              "stand": "aufgenommen"
            }
          }
        ]
      },
      {
        "id": "reklamation.erneut",
        "aktion": "klicken"
      },
      {
        "id": "reklamation.entscheiden",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Entschieden · abgelehnt"
        },
        {
          "id": "reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "wo": {
            "id": "{reklamation_aufgenommen}"
          },
          "werte": {
            "stand": "kunde_informieren",
            "begruendung": "Prüfbegründung Netz"
          }
        }
      ]
    }
  },
  {
    "id": "L13",
    "titel": "„Menge betroffen“: vorbelegt mit der gelieferten Menge; über geliefert → Feldfehler, nichts angelegt; im Rahmen → aufgenommen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[reklamation].elemente_runde41[teile.menge]",
      "screens[reklamation].inhalt[1].felder[teile].regel",
      "verhalten_appweit.speichern"
    ],
    "deckt": [
      "reklamation.teile.menge"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "reklamation",
        "arg": "{auftrag_quelle}#aufnehmen",
        "weg": "oeffne",
        "quelle": "screens[reklamation].regeln[1]"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "reklamation.teile",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "reklamation.mangel",
        "aktion": "waehlen",
        "wert": "Blasen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.teile.menge",
            "erwartung": "wert",
            "wert": "3",
            "nr": 1
          }
        ]
      },
      {
        "id": "reklamation.teile.menge",
        "aktion": "tippen",
        "wert": "4",
        "nr": 1
      },
      {
        "id": "reklamation.aufnehmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "reklamation.teile.menge.fehler",
            "erwartung": "sichtbar",
            "nr": 1
          },
          {
            "oben": "reklamation"
          }
        ],
        "db": [
          {
            "tabelle": "complaint",
            "neu": 0
          }
        ]
      },
      {
        "id": "reklamation.teile.menge",
        "aktion": "tippen",
        "wert": "2",
        "nr": 1
      },
      {
        "id": "reklamation.aufnehmen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Reklamation {reklamation} aufgenommen · Meister entscheidet"
        }
      ],
      "db": [
        {
          "tabelle": "complaint",
          "neu": 1,
          "werte": {
            "auftrag_id": "{auftrag_quelle}",
            "stand": "aufgenommen"
          }
        }
      ]
    },
    "notiz": "Gelieferte Menge = Positionsmenge von „Prüfteil Kopie A“ (3 Stück, ware da, ohne Teillieferung)."
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · reklamation", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
