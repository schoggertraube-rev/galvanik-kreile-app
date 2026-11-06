// Generated from BAUPLAN SHA-256 9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

import { runWithExpectedRed } from "./_expectedRed";
const cases = [
  {
    "id": "ABS-01",
    "titel": "5.1 → 5.4 öffnet leer, Hauptknopf gesperrt „Typ wählen“",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].abnahme[0]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kunde.absprache",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "absprache"
        },
        {
          "id": "absprache.zustand.leer",
          "erwartung": "sichtbar"
        },
        {
          "id": "absprache.speichern",
          "erwartung": "gesperrt",
          "wert": "Typ wählen"
        }
      ]
    }
  },
  {
    "id": "ABS-02",
    "titel": "Übergabe ohne Zahlung für den Kunden speichern, zurück in 5.1",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].aktionen[speichern]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kunde.absprache",
        "aktion": "klicken"
      },
      {
        "id": "absprache.typ",
        "aktion": "waehlen",
        "wert": "Übergabe ohne Zahlung · Rechnung folgt"
      },
      {
        "id": "absprache.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund eins"
      },
      {
        "id": "absprache.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "kunde"
        },
        {
          "id": "kunde.absprache-zeile",
          "erwartung": "text_enthaelt",
          "wert": "Übergabe ohne Zahlung · Rechnung folgt"
        }
      ],
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_bedingung_bar}",
            "typ": "ausgabe_ohne_zahlung",
            "order_id": null,
            "geld": true,
            "bezeichnung": "Übergabe ohne Zahlung · Rechnung folgt",
            "grund": "Prüfgrund eins"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-03",
    "titel": "Zahlungsziel ohne Tage → Fokus in Tage, nichts gespeichert",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].abnahme[1]",
      "screens[absprache].aktionen[speichern].tor"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
      "aufruf": {
        "seite": "absprache",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "absprache.typ",
        "aktion": "waehlen",
        "wert": "Zahlungsziel in Tagen"
      },
      {
        "id": "absprache.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund zwei"
      },
      {
        "id": "absprache.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "absprache"
        },
        {
          "id": "absprache.tage",
          "erwartung": "fokus"
        },
        {
          "text": "Tage eintragen · 1 bis 120",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "ABS-04",
    "titel": "Gilt bis in der Vergangenheit → Fehlertext",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].abnahme[2]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
      "aufruf": {
        "seite": "absprache",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "absprache.typ",
        "aktion": "waehlen",
        "wert": "Übergabe ohne Zahlung · Rechnung folgt"
      },
      {
        "id": "absprache.gueltig_bis",
        "aktion": "tippen",
        "wert": "{heute:-1|TT.MM.JJJJ}"
      },
      {
        "id": "absprache.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund drei"
      },
      {
        "id": "absprache.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "absprache.gueltig_bis",
          "erwartung": "fokus"
        },
        {
          "text": "Datum heute oder später wählen",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "ABS-05",
    "titel": "Ohne Recht geld kein Einstieg in 5.1 und 10.1",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].abnahme[3]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_buero_ohne_geld",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kunde.absprache",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "aktion": "oeffne",
        "wert": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rauspruefen"
        },
        {
          "id": "rauspruefen.absprache-festlegen",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "ABS-06",
    "titel": "Widerruf braucht Grund und gilt sofort",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].modus_widerruf"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "kunde_absprache_rechnung_folgt"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kunde.absprache-widerrufen",
        "aktion": "klicken"
      },
      {
        "id": "absprache.widerrufen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "absprache.grund",
            "erwartung": "fokus"
          },
          {
            "text": "Bitte Grund angeben",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "absprache.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund vier"
      },
      {
        "id": "absprache.widerrufen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "kunde"
        },
        {
          "id": "kunde.absprache-zeile",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 0,
          "wo": {
            "id": "{kunde_absprache_rechnung_folgt}"
          },
          "werte": {
            "widerrufen_am": "{gesetzt}",
            "widerrufen_von": "{login}",
            "widerruf_grund": "Prüfgrund vier"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-07",
    "titel": "10.1 Sammelrechnung: Knopf mit Monat, keine Einzelrechnung, Auftrag in Sammelliste",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.knopf_regel",
      "baustand.paket_folge.AP-ABS.sammelrechnung.anlegen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_sammel"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rauspruefen.absprache-kasten",
            "erwartung": "sichtbar"
          },
          {
            "id": "rauspruefen.uebergeben-sammelrechnung",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "rauspruefen.uebergeben-sammelrechnung",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [],
      "db": [
        {
          "tabelle": "invoices",
          "neu": 0
        },
        {
          "tabelle": "invoice_collections",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_bedingung_bar}",
            "status": "offen"
          }
        },
        {
          "tabelle": "invoice_collection_orders",
          "neu": 1,
          "werte": {
            "order_id": "{auftrag_fertig_unbezahlt}"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-08",
    "titel": "10.1 Rechnung folgt: Knopf erzeugt die Rechnung",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.knopf_regel"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_rechnung_folgt"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rauspruefen.uebergeben-rechnung-folgt",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [],
      "db": [
        {
          "tabelle": "invoices",
          "neu": 1,
          "werte": {
            "auftrag": "{auftrag_fertig_unbezahlt}"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-09",
    "titel": "Freitext mit geld = true hebt die Sperre nicht auf",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.abgeloest",
      "screens[absprache].regeln[5]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_freitext"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "rauspruefen.uebergeben-rechnung-folgt",
          "erwartung": "nicht_sichtbar"
        },
        {
          "text": "Zahlung fehlt",
          "erwartung": "sichtbar"
        },
        {
          "id": "rauspruefen.absprache-festlegen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "ABS-10",
    "titel": "Abgelaufene Absprache: Hinweis und Zahlung fehlt",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.ohne"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_abgelaufen"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "rauspruefen.absprache-hinweis",
          "erwartung": "text_enthaelt",
          "wert": "abgelaufen am"
        },
        {
          "id": "rauspruefen.uebergeben-rechnung-folgt",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "ABS-11",
    "titel": "10.1 ohne Absprache → „Absprache festlegen“ → zurück mit Absprache-Knopf",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.ohne"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rauspruefen.absprache-festlegen",
        "aktion": "klicken"
      },
      {
        "id": "absprache.typ",
        "aktion": "waehlen",
        "wert": "Übergabe ohne Zahlung · Rechnung folgt"
      },
      {
        "id": "absprache.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund fünf"
      },
      {
        "id": "absprache.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rauspruefen"
        },
        {
          "id": "rauspruefen.uebergeben-rechnung-folgt",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 1,
          "werte": {
            "order_id": "{auftrag_fertig_unbezahlt}",
            "typ": "ausgabe_ohne_zahlung"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-12",
    "titel": "Server lehnt Übergabe ab, wenn die Absprache inzwischen widerrufen ist",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.server",
      "screens[absprache].regeln[3]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_rechnung_folgt"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rauspruefen.uebergeben-rechnung-folgt",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "aktion": "db_setzen",
        "tabelle": "customer_agreements",
        "wo": {
          "id": "{kunde_absprache_rechnung_folgt}"
        },
        "werte": {
          "widerrufen_am": "{jetzt:-3min}"
        }
      },
      {
        "id": "rauspruefen.uebergeben-rechnung-folgt",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Zahlung fehlt",
          "erwartung": "sichtbar"
        },
        {
          "id": "rauspruefen.absprache-hinweis",
          "erwartung": "text_enthaelt",
          "wert": "widerrufen am"
        }
      ],
      "db": [
        {
          "tabelle": "invoices",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "ABS-13",
    "titel": "Der Tag: Sammelrechnung des Vormonats erstellen → Entwurf in 7.1",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.sammelrechnung.der_tag",
      "baustand.paket_folge.AP-ABS.sammelrechnung.erstellen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "kunde_absprache_sammel",
        "auftrag_uebergeben_sammel",
        "sammelliste_vormonat"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "tag.sammelrechnung-erstellen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rechnung"
        }
      ],
      "db": [
        {
          "tabelle": "invoices",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_bedingung_bar}"
          }
        },
        {
          "tabelle": "invoice_collections",
          "neu": 0,
          "wo": {
            "id": "{sammelliste_vormonat}"
          },
          "werte": {
            "status": "offen",
            "invoice_id": "{neu:invoices}"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-14",
    "titel": "Festschreiben setzt die Sammelliste auf abgerechnet, Zeile verschwindet",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.sammelrechnung.abgerechnet"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "kunde_absprache_sammel",
        "auftrag_uebergeben_sammel",
        "sammelliste_vormonat"
      ],
      "aufruf": {
        "seite": "tag",
        "arg": "(leer)",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "tag.sammelrechnung-erstellen",
        "aktion": "klicken"
      },
      {
        "id": "rechnung.festschreiben",
        "aktion": "klicken"
      },
      {
        "aktion": "oeffne",
        "wert": "tag",
        "arg": "(leer)"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "tag.sammelrechnung-erstellen",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "invoice_collections",
          "neu": 0,
          "wo": {
            "id": "{sammelliste_vormonat}"
          },
          "werte": {
            "status": "abgerechnet"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-15",
    "titel": "Ändern legt neue Zeile an und widerruft die alte",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].regeln[0]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "kunde_absprache_rechnung_folgt"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "kunde.absprache-aendern",
        "aktion": "klicken"
      },
      {
        "id": "absprache.typ",
        "aktion": "waehlen",
        "wert": "Sammelrechnung monatlich"
      },
      {
        "id": "absprache.tage",
        "aktion": "tippen",
        "wert": "14"
      },
      {
        "id": "absprache.grund",
        "aktion": "tippen",
        "wert": "Prüfgrund acht"
      },
      {
        "id": "absprache.speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "kunde"
        }
      ],
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 1,
          "werte": {
            "typ": "sammelrechnung",
            "ziel_tage": 14
          }
        },
        {
          "tabelle": "customer_agreements",
          "neu": 0,
          "wo": {
            "id": "{kunde_absprache_rechnung_folgt}"
          },
          "werte": {
            "widerrufen_am": "{gesetzt}",
            "widerruf_grund": "ersetzt durch Sammelrechnung monatlich"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-16",
    "titel": "10.1 Zahlungsziel: Knopf mit Tagen, Fälligkeit = Rechnungsdatum + 30",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.knopf_regel",
      "baustand.paket_folge.AP-ABS.typen[2]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_zahlungsziel"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "rauspruefen.uebergeben-zahlungsziel",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [],
      "db": [
        {
          "tabelle": "invoices",
          "neu": 1,
          "werte": {
            "auftrag": "{auftrag_fertig_unbezahlt}",
            "faellig": "{heute:+30}"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-17",
    "titel": "Vorrang: Absprache des Auftrags vor der des Kunden",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].regeln[4]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_rechnung_folgt",
        "auftrag_absprache_sammel"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "rauspruefen.uebergeben-sammelrechnung",
          "erwartung": "sichtbar"
        },
        {
          "id": "rauspruefen.uebergeben-rechnung-folgt",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "ABS-18",
    "titel": "Server lehnt absprache.speichern ohne Recht geld ab",
    "paket": "AP-ABS",
    "quelle": [
      "screens[absprache].abnahme[3]",
      "screens[absprache].zustaende.fehler.je_code"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_buero_ohne_geld",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_bar}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "befehl",
        "wert": "absprache.speichern",
        "daten": {
          "customer_id": "{kunde_bedingung_bar}",
          "typ": "ausgabe_ohne_zahlung",
          "grund": "Prüfgrund neun"
        }
      }
    ],
    "dann": {
      "anzeige": [],
      "server": {
        "fehler": "FORBIDDEN"
      },
      "db": [
        {
          "tabelle": "customer_agreements",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "ABS-19",
    "titel": "Ohne Recht geld: Kasten ohne Beträge, Übergeben mit Absprache möglich",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.eingriffe.rauspruefen.kasten"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_buero_ohne_geld",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_unbezahlt",
        "kunde_absprache_rechnung_folgt"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_unbezahlt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rauspruefen.absprache-kasten",
            "erwartung": "sichtbar"
          },
          {
            "text": "€",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "rauspruefen.uebergeben-rechnung-folgt",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [],
      "db": [
        {
          "tabelle": "invoices",
          "neu": 1,
          "werte": {
            "auftrag": "{auftrag_fertig_unbezahlt}"
          }
        }
      ]
    }
  },
  {
    "id": "ABS-20",
    "titel": "Versand mit Absprache: gleicher Knopf, Text „Versendet · Rechnung folgt“",
    "paket": "AP-ABS",
    "quelle": [
      "baustand.paket_folge.AP-ABS.versand"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar",
        "auftrag_fertig_versand",
        "kunde_absprache_rechnung_folgt"
      ],
      "aufruf": {
        "seite": "rauspruefen",
        "arg": "{auftrag_fertig_versand}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation: oeffne(ziel, arg) – arg ist die Zeilen-ID der Datenlage"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "rauspruefen.uebergeben-rechnung-folgt",
          "erwartung": "text_enthaelt",
          "wert": "Versendet · Rechnung folgt"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.describe("BAUPLAN Wege · absprache", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      await prepareGeneratedSeed(flowCase);
      await runWithExpectedRed(flowCase.id, red, () => runGeneratedFlowCase(page, flowCase));
    });
  }
});
