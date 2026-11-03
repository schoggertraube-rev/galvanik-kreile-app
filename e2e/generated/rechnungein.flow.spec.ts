// Generated from BAUPLAN SHA-256 888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "R01",
    "titel": "3.8 öffnet mit Original und Lieferant aus der Zuordnung; Knöpfe des Stands „prüfen“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].inhalt[0]",
      "screens[rechnungein].inhalt[0].bloecke[1].felder[lieferant]",
      "screens[rechnungein].aktionen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "rechnungein"
        },
        {
          "text": "gesichert · unverändert",
          "erwartung": "sichtbar"
        },
        {
          "id": "rechnungein.lieferant",
          "erwartung": "wert",
          "wert": "{lieferant_bekannt.name}"
        },
        {
          "id": "rechnungein.offen",
          "erwartung": "sichtbar"
        },
        {
          "id": "rechnungein.unklar",
          "erwartung": "sichtbar"
        },
        {
          "id": "rechnungein.ist-bezahlt",
          "erwartung": "sichtbar"
        },
        {
          "id": "rechnungein.keine-rechnung",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "R02",
    "titel": "„Erfassen · fällig …“ legt die Eingangsrechnung offen an und erledigt den Eingang",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].aktionen[offen]",
      "screens[rechnungein].regeln[10]",
      "eingang.befehle[rechnung.erfassen]",
      "screens[rechnungein].zustaende.erfolg"
    ],
    "deckt": [
      "rechnungein.offen",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.offen",
            "erwartung": "text",
            "wert": "Erfassen · fällig {heute:+9|WT TT.MM.}"
          }
        ]
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Eingangsrechnung erfasst · fällig {heute:+9|WT TT.MM.}"
        },
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "lieferant_id": "{lieferant_bekannt}",
            "item_id": "{eingang_rechnung}",
            "nummer": "PR-1001",
            "datum": "{heute:-5}",
            "netto": 100,
            "ust": 19,
            "brutto": 119,
            "faellig_am": "{heute:+9}",
            "zahlstatus": "offen"
          }
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "R03",
    "titel": "Pflicht Rechnungsnummer fehlt: Feldfehler, 3.8 bleibt offen, nichts erfasst",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].inhalt[0].bloecke[1].felder[rechnungsnummer]",
      "verhalten_appweit.speichern"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": ""
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rechnungein"
        },
        {
          "id": "rechnungein.rechnungsnummer.fehler",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "R04",
    "titel": "„Unklar – klären“ mit Grund: Rechnung unklar + Aufgabe „Rechnung klären“ für Recht Geld in einem Schritt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.unklar",
      "screens[rechnungein].regeln[4]",
      "screens[rechnungein].abnahme[3]",
      "eingang.befehle[rechnung.unklar]"
    ],
    "deckt": [
      "rechnungein.unklar",
      "rechnungein.unklar-speichern",
      "zustand.unklar"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.unklar",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.unklar",
            "erwartung": "sichtbar"
          },
          {
            "id": "rechnungein.grund",
            "erwartung": "leer"
          }
        ]
      },
      {
        "id": "rechnungein.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund Betrag"
      },
      {
        "id": "rechnungein.unklar-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Eingangsrechnung unklar · Aufgabe für Recht Geld"
        },
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "item_id": "{eingang_rechnung}",
            "zahlstatus": "unklar",
            "unklar_grund": "Prüfgrund Betrag"
          }
        },
        {
          "tabelle": "task",
          "neu": 1,
          "werte": {
            "art": "rechnung",
            "fuer_bereich": "geld",
            "faellig_am": "{heute:+0}",
            "bezug_typ": "eingangsrechnung",
            "bezug_id": "{neu:supplier_invoice}",
            "status": "offen"
          }
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "R05",
    "titel": "„Ist schon bezahlt“: Bezahlt am heute vorbelegt; „Erfassen · bezahlt“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.bezahlt",
      "screens[rechnungein].regeln[5]",
      "screens[rechnungein].abnahme[5]"
    ],
    "deckt": [
      "rechnungein.ist-bezahlt",
      "rechnungein.bezahlt-speichern",
      "zustand.bezahlt"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "id": "rechnungein.ist-bezahlt",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.bezahlt",
            "erwartung": "sichtbar"
          },
          {
            "id": "rechnungein.bezahlt_am",
            "erwartung": "wert",
            "wert": "{heute:+0}"
          }
        ]
      },
      {
        "id": "rechnungein.bezahlt-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Eingangsrechnung erfasst · bezahlt"
        },
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "nummer": "PR-1001",
            "zahlstatus": "bezahlt",
            "bezahlt_am": "{heute:+0}"
          }
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "R06",
    "titel": "Abbrechen ohne Änderung schließt sofort; mit Änderung Esc → Rückfrage, „Weiter bearbeiten“ zurück in 3.8",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].aktionen[abbrechen]",
      "verhalten_appweit.rueckfrage",
      "verhalten_appweit.aenderung"
    ],
    "deckt": [
      "rechnungein.abbrechen",
      "entwurf.weiter-bearbeiten"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.abbrechen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "nicht_sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "supplier_invoice",
            "neu": 0
          },
          {
            "tabelle": "intake_item",
            "wo": {
              "id": "{eingang_rechnung}"
            },
            "werte": {
              "einsatz": "offen"
            }
          }
        ]
      },
      {
        "aktion": "oeffne",
        "wert": "rechnungein",
        "arg": "{eingang_rechnung}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
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
            "id": "rechnungein",
            "erwartung": "sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "text_enthaelt",
            "wert": "Netto"
          }
        ]
      },
      {
        "id": "entwurf.weiter-bearbeiten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rechnungein"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "R07",
    "titel": "Eingangsrechnung #klaeren: Ergebnis „ungültig“ mit Grund → zahlstatus ungueltig, Aufgabe erledigt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.klaeren",
      "screens[rechnungein].abnahme[6]",
      "eingang.befehle[rechnung.klaeren]"
    ],
    "deckt": [
      "rechnungein.klaerung-speichern",
      "zustand.klaeren"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "rechnung_unklar",
        "aufgabe_rechnung_klaeren"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{rechnung_unklar}#klaeren",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.klaeren",
            "erwartung": "text_enthaelt",
            "wert": "Rechnung klären"
          },
          {
            "text": "Prüfgrund unklar",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "rechnungein.ergebnis",
        "aktion": "waehlen",
        "wert": "ungültig"
      },
      {
        "id": "rechnungein.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund nicht unsere Rechnung"
      },
      {
        "id": "rechnungein.klaerung-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "wo": {
            "id": "{rechnung_unklar}"
          },
          "werte": {
            "zahlstatus": "ungueltig",
            "ungueltig_grund": "Prüfgrund nicht unsere Rechnung"
          }
        },
        {
          "tabelle": "task",
          "wo": {
            "id": "{aufgabe_rechnung_klaeren}"
          },
          "werte": {
            "status": "erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "R08",
    "titel": "Eingangsrechnung offen: Zustand bezahlt_markieren, „Als bezahlt markieren“ ändert dieselbe Zeile",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.bezahlt_markieren",
      "screens[rechnungein].regeln[6]",
      "eingang.befehle[rechnung.status]"
    ],
    "deckt": [
      "rechnungein.als-bezahlt",
      "zustand.bezahlt_markieren"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "rechnung_offen"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{rechnung_offen}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.bezahlt_markieren",
            "erwartung": "text_enthaelt",
            "wert": "offen"
          },
          {
            "id": "rechnungein.bezahlt_am",
            "erwartung": "wert",
            "wert": "{heute:+0}"
          }
        ]
      },
      {
        "id": "rechnungein.als-bezahlt",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Als bezahlt markiert"
        },
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        },
        {
          "tabelle": "supplier_invoice",
          "wo": {
            "id": "{rechnung_offen}"
          },
          "werte": {
            "zahlstatus": "bezahlt",
            "bezahlt_am": "{heute:+0}"
          }
        }
      ]
    }
  },
  {
    "id": "R06b",
    "titel": "× ohne Änderung schließt 3.8 sofort; nichts erfasst",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].aktionen[abbrechen]",
      "verhalten_appweit.rueckfrage.ohne_aenderung"
    ],
    "deckt": [
      "rechnungein.schliessen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "R09",
    "titel": "Speichern scheitert: „Nicht gespeichert · alle Eingaben sind noch da“; „Erneut“, dann „Erfassen“ legt genau eine Rechnung an",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.fehler"
    ],
    "deckt": [
      "rechnungein.erneut",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Nicht gespeichert · alle Eingaben sind noch da"
          },
          {
            "id": "rechnungein.rechnungsnummer",
            "erwartung": "wert",
            "wert": "PR-1001"
          },
          {
            "oben": "rechnungein"
          }
        ],
        "db": [
          {
            "tabelle": "supplier_invoice",
            "neu": 0
          }
        ]
      },
      {
        "id": "rechnungein.erneut",
        "aktion": "klicken"
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Eingangsrechnung erfasst · fällig {heute:+9|WT TT.MM.}"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "nummer": "PR-1001",
            "zahlstatus": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "R10",
    "titel": "Ohne Recht „geld“: Aufruf von 3.8 öffnet nichts, Toast „Recht Geld fehlt“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].regeln (Runde 40)",
      "screens[rechnungein].regeln[7]",
      "screens[rechnungein].abnahme[4]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_buero_ohne_geld",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
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
        "aktion": "oeffne",
        "wert": "rechnungein",
        "arg": "{eingang_rechnung}"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Recht Geld fehlt"
        },
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "dialoge": 0
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "R11",
    "titel": "Doppelklick „Erfassen“ → genau eine Eingangsrechnung",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].regeln (Runde 40)",
      "eingang.daten.neu[supplier_invoice].regeln (UNIQUE item_id)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "id": "rechnungein.offen",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Eingangsrechnung erfasst · fällig {heute:+9|WT TT.MM.}"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "item_id": "{eingang_rechnung}",
            "nummer": "PR-1001"
          }
        }
      ]
    }
  },
  {
    "id": "R12",
    "titel": "Dublette gleich (Nummer, Lieferant, Datum, Betrag): „Erfassen“ → Zustand dublette nur mit „Als doppelt ablegen“ → Zeile doppelt mit Verweis",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.dublette",
      "screens[rechnungein].regeln[3]",
      "screens[rechnungein].abnahme[1]",
      "screens[rechnungein].regeln (Runde 40)"
    ],
    "deckt": [
      "rechnungein.doppelt-ablegen",
      "zustand.dublette"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung",
        "rechnung_vorhanden"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.dublette",
            "erwartung": "text_enthaelt",
            "wert": "gibt es schon"
          },
          {
            "id": "rechnungein.doppelt-ablegen",
            "erwartung": "sichtbar"
          },
          {
            "id": "rechnungein.trotzdem",
            "erwartung": "nicht_sichtbar"
          }
        ],
        "db": [
          {
            "tabelle": "supplier_invoice",
            "neu": 0
          }
        ]
      },
      {
        "id": "rechnungein.doppelt-ablegen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Als doppelt abgelegt · Eingang erledigt"
        },
        {
          "id": "rechnungein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "zahlstatus": "doppelt",
            "verweis_id": "{rechnung_vorhanden}",
            "item_id": "{eingang_rechnung}"
          }
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_rechnung}"
          },
          "werte": {
            "einsatz": "erledigt"
          }
        }
      ]
    }
  },
  {
    "id": "R13",
    "titel": "Dublette mit anderem Datum: „Trotzdem erfassen“ nur mit Grund; „Erfassen“ speichert dublette_grund",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.dublette",
      "screens[rechnungein].regeln[3]",
      "screens[rechnungein].abnahme[1]"
    ],
    "deckt": [
      "rechnungein.trotzdem"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung",
        "rechnung_vorhanden"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rechnungein.rechnungsnummer",
        "aktion": "tippen",
        "wert": "PR-1001"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-5}"
      },
      {
        "id": "rechnungein.netto",
        "aktion": "tippen",
        "wert": "100,00"
      },
      {
        "id": "rechnungein.ust",
        "aktion": "tippen",
        "wert": "19,00"
      },
      {
        "id": "rechnungein.brutto",
        "aktion": "tippen",
        "wert": "119,00"
      },
      {
        "id": "rechnungein.faellig",
        "aktion": "tippen",
        "wert": "{heute:+9}"
      },
      {
        "id": "rechnungein.rechnungsdatum",
        "aktion": "tippen",
        "wert": "{heute:-4}"
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.dublette",
            "erwartung": "sichtbar"
          },
          {
            "id": "rechnungein.trotzdem",
            "erwartung": "sichtbar"
          },
          {
            "id": "rechnungein.doppelt-ablegen",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "rechnungein.dublette_grund",
        "aktion": "tippen",
        "wert": "Prüfgrund zweite Rechnung"
      },
      {
        "id": "rechnungein.trotzdem",
        "aktion": "klicken"
      },
      {
        "id": "rechnungein.offen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Eingangsrechnung erfasst · fällig {heute:+9|WT TT.MM.}"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 1,
          "werte": {
            "nummer": "PR-1001",
            "datum": "{heute:-4}",
            "zahlstatus": "offen",
            "dublette_grund": "Prüfgrund zweite Rechnung"
          }
        }
      ]
    }
  },
  {
    "id": "R14",
    "titel": "Erkannte Werte vorbelegt; ein unsicherer Wert → „1 Felder unsicher · am Original prüfen“, „Geprüft“ zurück in den Grundzustand",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].zustaende.teilweise",
      "screens[rechnungein].abnahme[0]",
      "eingang.daten.neu[intake_suggestion] (rechnung.*)"
    ],
    "deckt": [
      "rechnungein.geprueft",
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung_erkannt"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung_erkannt}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang) bzw. screens[rechnungein].regeln[6] (arg Eingangsrechnung)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rechnungein.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "unsicher"
          },
          {
            "id": "rechnungein.rechnungsnummer",
            "erwartung": "wert",
            "wert": "PR-4001"
          },
          {
            "id": "rechnungein.rechnungsdatum",
            "erwartung": "wert",
            "wert": "{heute:-2}"
          }
        ]
      },
      {
        "id": "rechnungein.geprueft",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "rechnungein.zustand.teilweise",
          "erwartung": "nicht_sichtbar"
        },
        {
          "oben": "rechnungein"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "R15",
    "titel": "Erkannte Nummer gibt es beim Lieferanten schon: beim Öffnen orange Hinweis „… gibt es schon …“ (noch kein Zustand dublette)",
    "paket": "AP-EIN",
    "quelle": [
      "screens[rechnungein].elemente_runde41[dublette-hinweis]",
      "screens[rechnungein].regeln (Runde 40/41)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "lieferant_bekannt",
        "eingang_rechnung_erkannt",
        "rechnung_vorhanden_4001"
      ],
      "aufruf": {
        "seite": "rechnungein",
        "arg": "{eingang_rechnung_erkannt}",
        "weg": "oeffne",
        "quelle": "anliegenwahl.aktionen[rechnungein] (arg Eingang)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "rechnungein"
        },
        {
          "id": "rechnungein.dublette-hinweis",
          "erwartung": "text_enthaelt",
          "wert": "PR-4001"
        },
        {
          "id": "rechnungein.dublette-hinweis",
          "erwartung": "text_enthaelt",
          "wert": "gibt es schon"
        },
        {
          "id": "rechnungein.zustand.dublette",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "supplier_invoice",
          "neu": 0
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · rechnungein", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
