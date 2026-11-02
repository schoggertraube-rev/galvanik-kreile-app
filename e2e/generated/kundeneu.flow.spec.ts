// Generated from BAUPLAN SHA-256 5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "K01",
    "titel": "Leerer Dialog: Hinweis ohne Knopf, nur Typwahl und Kontakt, Kundennummer nicht eingebbar",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].zustaende.leer",
      "formulare.kunde.typ_felder.ohne_wahl",
      "screens[kundeneu].abnahme[1]",
      "bausteine_vertraege.werkbank.interaktion[aufruf-leer]"
    ],
    "deckt": [
      "zustand.leer",
      "werkbank.aufruf-leer"
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
        "id": "rein.kunde-anlegen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "kundeneu"
        },
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "fokus"
        },
        {
          "id": "kundeneu.zustand.leer",
          "erwartung": "text_enthaelt",
          "wert": "Erst suchen – vielleicht gibt es den Kunden schon"
        },
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "optionen",
          "wert": [
            "Firma",
            "Privat"
          ]
        },
        {
          "id": "kundeneu.telefon",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.email",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.name",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.vorname",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.nachname",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.pruefliste.info",
          "erwartung": "text",
          "wert": "Kundennummer wird beim Speichern vergeben"
        }
      ]
    }
  },
  {
    "id": "K02",
    "titel": "Privat: Anrede, Vorname, Nachname – kein Firmenname, keine USt-ID",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.typ_felder.Privat",
      "screens[kundeneu].abnahme[14]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "wert": "Privat"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "gewaehlt",
          "wert": "Privat"
        },
        {
          "id": "kundeneu.anrede",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.vorname",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.nachname",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.name",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.ustid",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.funktion",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.adresse",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.land",
          "erwartung": "wert",
          "wert": "Deutschland"
        }
      ]
    }
  },
  {
    "id": "K03",
    "titel": "Firma: Firmenname, Ansprechpartner, USt-ID, Website, E-Mail für Rechnungen",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.typ_felder.Firma",
      "screens[kundeneu].abnahme[15]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.name",
          "erwartung": "sichtbar"
        },
        {
          "text": "Ansprechpartner",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.anrede",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.vorname",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.nachname",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.funktion",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.ustid",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.website",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.rechnungs_email",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "K04",
    "titel": "Mit Recht „geld“: Zahlungsbedingung nur Vorkasse | Bar, vorbelegt Vorkasse",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].felder[zahlungsbedingung]",
      "bausteine_vertraege.werkbank.zahlung.faelle[3]",
      "screens[kundeneu].abnahme[2]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.zahlungsbedingung",
          "erwartung": "optionen",
          "wert": [
            "Vorkasse",
            "Bar oder Karte bei Abholung"
          ]
        },
        {
          "id": "kundeneu.zahlungsbedingung",
          "erwartung": "gewaehlt",
          "wert": "Vorkasse"
        },
        {
          "id": "kundeneu.pruefliste.zahlungsbedingung",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "K05",
    "titel": "Ohne Recht „geld“: kein Feld, keine Prüflisten-Zeile, gespeichert wird Vorkasse",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].felder[zahlungsbedingung].ohne_recht",
      "bausteine_vertraege.werkbank.zahlung.faelle[3].ohne_geld",
      "screens[kundeneu].abnahme[2]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.zahlungsbedingung",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "kundeneu.pruefliste.zahlungsbedingung",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "company_name": "Neufirma Kappa GmbH",
            "zahlungsbedingung": "vorkasse"
          }
        }
      ]
    }
  },
  {
    "id": "K06",
    "titel": "Vollständige Firma speichern → Kundenkarte direkt, Server vergibt Nummer",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[kunde-speichern]",
      "bausteine_vertraege.werkbank.interaktion[kundeneu-erfolg]",
      "formulare.kunde.daten",
      "formulare.kunde.anzeige.name",
      "screens[kundeneu].abnahme[4]"
    ],
    "deckt": [
      "kundeneu.kunde-speichern",
      "werkbank.kundeneu-erfolg",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        },
        {
          "oben": "kunde"
        },
        {
          "id": "kundeneu",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "address_status": "gefunden",
            "customer_type": "business",
            "company_name": "Neufirma Kappa GmbH",
            "name": "Neufirma Kappa GmbH",
            "salutation": "frau",
            "first_name": "Kira",
            "last_name": "Kappaprobe",
            "contact_role": "Einkauf",
            "email": "einkauf@kappa-neu.test",
            "street": "Neuweg",
            "house_number": "7",
            "zip_code": "99107",
            "city": "Neustadt am Prüfbach",
            "country": "DE",
            "zahlungsbedingung": "vorkasse",
            "notiz": "Prüfnotiz Kunde"
          }
        }
      ]
    }
  },
  {
    "id": "K07",
    "titel": "Privat speichern → Anzeigename „Vorname Nachname“ vom Server",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.anzeige.name",
      "formulare.kunde.daten"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "wert": "Privat"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Ida"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Iotaprobe"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 717171"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "ida@iota-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "9"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99109"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        },
        {
          "oben": "kunde"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "customer_type": "privat",
            "name": "Ida Iotaprobe",
            "first_name": "Ida",
            "last_name": "Iotaprobe",
            "company_name": null
          }
        }
      ]
    }
  },
  {
    "id": "K08",
    "titel": "Nur Typ, Name, Telefon → Interessent; Prüfliste zeigt Fehlendes, sperrt nicht",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].regeln[0]",
      "screens[kundeneu].zustaende.teilweise",
      "screens[kundeneu].abnahme[0]"
    ],
    "deckt": [
      "kundeneu.weiter-ausfuellen",
      "zustand.teilweise"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Ny GmbH"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 727272"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Speicherbar als Interessent · für Auftrag fehlt:"
          },
          {
            "id": "kundeneu.pruefliste.email",
            "erwartung": "status",
            "wert": "fehlt"
          }
        ]
      },
      {
        "id": "kundeneu.weiter-ausfuellen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.nachname",
            "erwartung": "fokus"
          }
        ]
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        },
        {
          "oben": "kunde"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "company_name": "Neufirma Ny GmbH",
            "email": null
          }
        }
      ]
    }
  },
  {
    "id": "K09",
    "titel": "„Als Interessent speichern“ legt an wie „Kunde speichern“",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].zustaende.teilweise.aktionen[als-interessent-speichern]",
      "bausteine_vertraege.werkbank.interaktion[interessent-tor]"
    ],
    "deckt": [
      "kundeneu.als-interessent-speichern",
      "werkbank.interessent-tor"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "wert": "Privat"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Xiprobe"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 737373"
      },
      {
        "id": "kundeneu.als-interessent-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        },
        {
          "oben": "kunde"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "customer_type": "privat",
            "last_name": "Xiprobe"
          }
        }
      ]
    }
  },
  {
    "id": "K10",
    "titel": "Pflicht fehlt: Sprung zum Feld, „Noch offen: …“, nichts gespeichert",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[kunde-speichern].regel",
      "bausteine_vertraege.pruefliste.interaktion"
    ],
    "deckt": [
      "werkbank.hauptknopf"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 747474"
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.kunde-speichern",
          "erwartung": "aktiviert"
        },
        {
          "text": "Noch offen: Firma oder Privat",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "fokus"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "K11",
    "titel": "Feldprüfung beim Verlassen: PLZ, E-Mail, Telefon, Firmenname",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.felder[].validierung",
      "formulare.kunde.validierung_regel"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "N"
      },
      {
        "id": "kundeneu.name",
        "aktion": "verlassen"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "12"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "verlassen"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "ohne-at.test"
      },
      {
        "id": "kundeneu.email",
        "aktion": "verlassen"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "9910"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "verlassen"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.name.fehler",
          "erwartung": "text",
          "wert": "Firmenname bitte mit mindestens 2 Zeichen"
        },
        {
          "id": "kundeneu.telefon.fehler",
          "erwartung": "text",
          "wert": "Telefonnummer prüfen"
        },
        {
          "id": "kundeneu.email.fehler",
          "erwartung": "text",
          "wert": "E-Mail-Adresse prüfen"
        },
        {
          "id": "kundeneu.plz.fehler",
          "erwartung": "text",
          "wert": "PLZ prüfen"
        }
      ]
    }
  },
  {
    "id": "K12",
    "titel": "PLZ mit 4 Ziffern ist bei Österreich gültig",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.felder[plz].validierung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "wert": "Privat"
      },
      {
        "id": "kundeneu.land",
        "aktion": "waehlen",
        "wert": "Österreich"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "9910"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "verlassen"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.plz.fehler",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "K13",
    "titel": "Sicherer Treffer (gleiche Telefonnummer, auch +49): Speichern springt zur Dublette",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.dublette.daten.filter",
      "bausteine_vertraege.dublette.zustaende.fehler",
      "bausteine_vertraege.dublette.regeln[0]",
      "screens[kundeneu].abnahme[3]"
    ],
    "deckt": [
      "zustand.dublette"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Omikron GmbH"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "+496100111111"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "verlassen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.dublette",
            "erwartung": "text_enthaelt",
            "wert": "Diesen Kunden gibt es schon"
          },
          {
            "id": "kundeneu.diesen-kunden-bearbeiten",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.dublette",
          "erwartung": "sichtbar"
        },
        {
          "oben": "kundeneu"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "K14",
    "titel": "„Ist ein anderer Kunde“ bestätigt nur; danach legt „Kunde speichern“ an",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.dublette.interaktion[ist-ein-anderer-kunde]",
      "bausteine_vertraege.dublette.zustaende.fehler"
    ],
    "deckt": [
      "kundeneu.ist-ein-anderer-kunde"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_privat_ohne_ansprechpartner"
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
        "wert": "Privat"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "{kunde_privat_ohne_ansprechpartner.first_name}"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "{kunde_privat_ohne_ansprechpartner.last_name}"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 777777"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "verlassen"
      },
      {
        "id": "kundeneu.ist-ein-anderer-kunde",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "db": [
          {
            "tabelle": "customers",
            "neu": 0
          }
        ]
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "customer_type": "privat",
            "last_name": "{kunde_privat_ohne_ansprechpartner.last_name}"
          }
        }
      ]
    }
  },
  {
    "id": "K16",
    "titel": "„Diesen Kunden bearbeiten“ öffnet 5.2 statt einen zweiten Kunden anzulegen",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.dublette.interaktion[diesen-kunden-bearbeiten]",
      "screens[kundebearbeiten].ebene"
    ],
    "deckt": [
      "kundeneu.diesen-kunden-bearbeiten"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
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
        "wert": "06100 111111"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "verlassen"
      },
      {
        "id": "kundeneu.diesen-kunden-bearbeiten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "kundebearbeiten"
        },
        {
          "id": "kundeneu",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "K17",
    "titel": "Möglicher Treffer: gleicher Vor- und Nachname, PLZ/Ort leer",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.dublette.daten.filter",
      "screens[kundeneu].abnahme[16]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_privat_ohne_ansprechpartner"
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
        "wert": "Privat"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "{kunde_privat_ohne_ansprechpartner.first_name}"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "{kunde_privat_ohne_ansprechpartner.last_name}"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "verlassen"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.dublette",
          "erwartung": "text_enthaelt",
          "wert": "Ähnlicher Kunde vorhanden"
        },
        {
          "id": "kundeneu.diesen-kunden-bearbeiten",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.vorhandenen-oeffnen",
          "erwartung": "sichtbar"
        },
        {
          "id": "kundeneu.ist-ein-anderer-kunde",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "K18a",
    "titel": "Ohne Änderung: Abbrechen schließt sofort",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[abbrechen]",
      "bausteine_vertraege.werkbank.aenderung"
    ],
    "deckt": [
      "kundeneu.abbrechen",
      "werkbank.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "K19a",
    "titel": "Mit Änderung: Abbrechen → Rückfrage 3.6",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[abbrechen]",
      "screens[entwurf].abnahme[0]"
    ],
    "deckt": [
      "werkbank.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 757575"
      },
      {
        "id": "kundeneu.abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "entwurf"
        },
        {
          "id": "kundeneu",
          "erwartung": "sichtbar"
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
    }
  },
  {
    "id": "K18b",
    "titel": "Ohne Änderung: × schließt sofort",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[abbrechen]",
      "bausteine_vertraege.werkbank.aenderung"
    ],
    "deckt": [
      "werkbank.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "K19b",
    "titel": "Mit Änderung: × → Rückfrage 3.6",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[abbrechen]",
      "screens[entwurf].abnahme[0]"
    ],
    "deckt": [
      "werkbank.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 757575"
      },
      {
        "id": "kundeneu.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "entwurf"
        },
        {
          "id": "kundeneu",
          "erwartung": "sichtbar"
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
    }
  },
  {
    "id": "K18c",
    "titel": "Ohne Änderung: Esc schließt sofort",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[abbrechen]",
      "bausteine_vertraege.werkbank.aenderung"
    ],
    "deckt": [
      "werkbank.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "K19c",
    "titel": "Mit Änderung: Esc → Rückfrage 3.6",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[abbrechen]",
      "screens[entwurf].abnahme[0]"
    ],
    "deckt": [
      "werkbank.abbrechen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 757575"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "entwurf"
        },
        {
          "id": "kundeneu",
          "erwartung": "sichtbar"
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
    }
  },
  {
    "id": "K20",
    "titel": "Netzfehler → Zustand fehler, „Erneut speichern“ legt genau einen Kunden an",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].zustaende.fehler",
      "bausteine_vertraege.werkbank.interaktion[fehler]",
      "bausteine_vertraege.werkbank.buchen.idempotenz",
      "screens[kundeneu].abnahme[5]"
    ],
    "deckt": [
      "kundeneu.erneut-speichern",
      "werkbank.fehler",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Speichern fehlgeschlagen · alle Eingaben sind noch da"
          },
          {
            "id": "kundeneu.erneut-speichern",
            "erwartung": "sichtbar"
          },
          {
            "id": "kundeneu.name",
            "erwartung": "wert",
            "wert": "Neufirma Kappa GmbH"
          }
        ],
        "db": [
          {
            "tabelle": "customers",
            "neu": 0
          }
        ]
      },
      {
        "id": "kundeneu.erneut-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        },
        {
          "oben": "kunde"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "K21",
    "titel": "Doppelklick auf „Kunde speichern“ → genau ein Kunde",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.werkbank.buchen.idempotenz"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "K22",
    "titel": "Enter in einem einzeiligen Feld löst „Kunde speichern“ mit Tor aus",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].aktionen[kunde-speichern].taste_regel",
      "bausteine_vertraege.werkbank.geraete"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "aktion": "taste",
        "wert": "Enter",
        "id": "kundeneu.ort"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "K23",
    "titel": "Adressprüfung: Adresse im Verzeichnis → „gefunden“, gespeichert mit address_status gefunden",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.adresse.zustaende.gefunden",
      "formulare.kunde.adresspruefung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "verlassen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.adresse",
            "erwartung": "text_enthaelt",
            "wert": "Adresse gefunden"
          },
          {
            "id": "kundeneu.pruefliste.anschrift",
            "erwartung": "status",
            "wert": "ok"
          }
        ]
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kunde {kunde} angelegt"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 1,
          "werte": {
            "address_status": "gefunden"
          }
        }
      ]
    }
  },
  {
    "id": "K26",
    "titel": "Adressprüfung: Ort passt nicht zur PLZ → orange, Speichern springt zur Meldung",
    "paket": "AP-K1",
    "quelle": [
      "formulare.kunde.adresspruefung.ergebnisse.ort_passt_nicht",
      "formulare.kunde.adresspruefung.speichern",
      "bausteine_vertraege.adresse.regeln[1]",
      "screens[kundeneu].abnahme[17]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Kappa GmbH"
      },
      {
        "id": "kundeneu.anrede",
        "aktion": "waehlen",
        "wert": "Frau"
      },
      {
        "id": "kundeneu.vorname",
        "aktion": "tippen",
        "wert": "Kira"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Kappaprobe"
      },
      {
        "id": "kundeneu.funktion",
        "aktion": "tippen",
        "wert": "Einkauf"
      },
      {
        "id": "kundeneu.telefon",
        "aktion": "tippen",
        "wert": "06100 707070"
      },
      {
        "id": "kundeneu.email",
        "aktion": "tippen",
        "wert": "einkauf@kappa-neu.test"
      },
      {
        "id": "kundeneu.strasse",
        "aktion": "tippen",
        "wert": "Neuweg"
      },
      {
        "id": "kundeneu.hausnummer",
        "aktion": "tippen",
        "wert": "7"
      },
      {
        "id": "kundeneu.plz",
        "aktion": "tippen",
        "wert": "99107"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Neustadt am Prüfbach"
      },
      {
        "id": "kundeneu.notiz",
        "aktion": "tippen",
        "wert": "Prüfnotiz Kunde"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "tippen",
        "wert": "Falschort"
      },
      {
        "id": "kundeneu.ort",
        "aktion": "verlassen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.pruefliste.anschrift",
            "erwartung": "status",
            "wert": "prüfen"
          },
          {
            "text": "gehört zu",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "kundeneu.kunde-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "kundeneu"
        },
        {
          "text": "gehört zu",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "K24",
    "titel": "Werkzeug „Aus Mail-Signatur“ nur mit Recht „mails“",
    "paket": null,
    "quelle": [
      "screens[kundeneu].erfassen.werkzeuge[aus-mail-signatur].recht",
      "screens[kundeneu].abnahme[7]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [],
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
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.aus-mail-signatur",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.visitenkarte-scannen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "K25",
    "titel": "Schnell erfassen: Rechtsform → Firma, Name, Telefon, E-Mail erkannt mit Herkunft",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.erfassen.erkennung.kunde",
      "bausteine_vertraege.erfassen.erkennung.text_regeln",
      "bausteine_vertraege.erfassen.erkennung.auswahllisten"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.erfassen-text",
        "aktion": "tippen",
        "wert": "Neufirma Rho GmbH\n06100 767676\ninfo@rho-neu.test"
      },
      {
        "id": "kundeneu.angaben-erkennen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "gewaehlt",
          "wert": "Firma"
        },
        {
          "id": "kundeneu.name",
          "erwartung": "wert",
          "wert": "Neufirma Rho GmbH"
        },
        {
          "id": "kundeneu.telefon",
          "erwartung": "nicht_leer"
        },
        {
          "id": "kundeneu.email",
          "erwartung": "wert",
          "wert": "info@rho-neu.test"
        },
        {
          "id": "kundeneu.name.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "erkannt"
        }
      ]
    }
  },
  {
    "id": "K27",
    "titel": "Ohne Recht „kunden“: Dublette ohne „Diesen Kunden bearbeiten“ und ohne „Vorhandenen öffnen“",
    "paket": "AP-K1",
    "quelle": [
      "bausteine_vertraege.dublette.interaktion[vorhandenen-oeffnen] („nur mit Recht kunden“)",
      "bausteine_vertraege.dublette.interaktion[diesen-kunden-bearbeiten]",
      "screens[kundeneu].zustaende.dublette"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_ohne_kunden",
      "datenlagen": [
        "kunde_vollstaendig_firma"
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
        "id": "kundeneu.telefon",
        "aktion": "verlassen"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.dublette",
          "erwartung": "text_enthaelt",
          "wert": "Diesen Kunden gibt es schon"
        },
        {
          "id": "kundeneu.diesen-kunden-bearbeiten",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.vorhandenen-oeffnen",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "K28",
    "titel": "Typwechsel in 3.1 vor dem Speichern: Firma → Privat mit Rückfrage",
    "paket": "AP-K1",
    "quelle": [
      "screens[kundeneu].zustaende.typwechsel",
      "formulare.kunde.typ_felder.wechsel"
    ],
    "deckt": [
      "kundeneu.typ-wechseln",
      "kundeneu.typ-wechsel-abbrechen",
      "zustand.typwechsel"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [],
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
        "id": "kundeneu.name",
        "aktion": "tippen",
        "wert": "Neufirma Sigma GmbH"
      },
      {
        "id": "kundeneu.nachname",
        "aktion": "tippen",
        "wert": "Sigmaprobe"
      },
      {
        "id": "kundeneu.kundentyp",
        "aktion": "waehlen",
        "wert": "Privat"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.zustand.typwechsel",
            "erwartung": "text_enthaelt",
            "wert": "1 Angaben entfallen: Firmenname"
          }
        ]
      },
      {
        "id": "kundeneu.typ-wechsel-abbrechen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "kundeneu.kundentyp",
            "erwartung": "gewaehlt",
            "wert": "Firma"
          }
        ]
      },
      {
        "id": "kundeneu.kundentyp",
        "aktion": "waehlen",
        "wert": "Privat"
      },
      {
        "id": "kundeneu.typ-wechseln",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "kundeneu.kundentyp",
          "erwartung": "gewaehlt",
          "wert": "Privat"
        },
        {
          "id": "kundeneu.name",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "kundeneu.nachname",
          "erwartung": "wert",
          "wert": "Sigmaprobe"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · kundeneu", () => {
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
