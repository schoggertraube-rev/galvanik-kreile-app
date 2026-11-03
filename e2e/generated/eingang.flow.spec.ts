// Generated from BAUPLAN SHA-256 5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "E01",
    "titel": "Plus öffnet eine leere Erfassung",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[aufruf-leer]",
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.ohne Argument",
      "screens[eingang].zustaende.leer",
      "screens[eingang].rail.pruefliste.pflicht (Runde 26)"
    ],
    "deckt": [
      "werkbank.aufruf-leer",
      "zustand.leer"
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
        "id": "rein.auftrag-erfassen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "eingang"
        },
        {
          "id": "eingang.kundensuche",
          "erwartung": "fokus"
        },
        {
          "id": "eingang.zustand.leer",
          "erwartung": "text_enthaelt",
          "wert": "Kunde suchen oder Neukunde anlegen"
        },
        {
          "id": "eingang.art",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.terminstatus",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.uebergabe",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.eingangsart",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.menge",
          "erwartung": "wert",
          "wert": "1",
          "nr": 1
        },
        {
          "id": "eingang.einheit",
          "erwartung": "ohne_wahl",
          "nr": 1
        },
        {
          "id": "eingang.oberflaeche",
          "erwartung": "wert",
          "wert": "noch zu klären",
          "nr": 1
        },
        {
          "id": "eingang.liefertermin",
          "erwartung": "leer"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "id": "eingang.pruefliste.art",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "id": "eingang.pruefliste.terminstatus",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "id": "eingang.pruefliste.eingangsart",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "id": "eingang.pruefliste.einheit",
          "erwartung": "status",
          "wert": "fehlt"
        }
      ]
    }
  },
  {
    "id": "E02",
    "titel": "Taste N öffnet „Neu erfassen“ (3.0)",
    "paket": "AP-01",
    "quelle": [
      "navigation.kopf[plus]",
      "bausteine_vertraege.werkbank.geraete"
    ],
    "deckt": [
      "navigation.plus"
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
        "aktion": "taste",
        "wert": "n"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "rein"
        },
        {
          "dialoge": 1
        }
      ]
    }
  },
  {
    "id": "E03",
    "titel": "Kundensuche: Trefferliste erst ab 2 Zeichen, höchstens 10",
    "paket": "AP-01",
    "quelle": [
      "formulare.kunde.felder[kundensuche]",
      "bausteine_vertraege.KundeFormular.daten.filter",
      "screens[eingang].abnahme[1]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "kunde_firma_ohne_ansprechpartner",
        "kunde_ohne_bedingung"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "P"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.kundensuche.treffer",
            "erwartung": "anzahl",
            "wert": 0
          }
        ]
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "Prueffirma"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.kundensuche.treffer",
          "erwartung": "anzahl_min",
          "wert": 3
        },
        {
          "id": "eingang.kundensuche.treffer",
          "erwartung": "anzahl_max",
          "wert": 10
        }
      ]
    }
  },
  {
    "id": "E04",
    "titel": "Kein Treffer: Hinweis und „Neukunde anlegen“",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.KundeFormular.interaktion[Tippen in Kunde suchen]"
    ],
    "deckt": [
      "eingang.neukunde-anlegen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "Zzqxv"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Kein Kunde gefunden",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.neukunde-anlegen",
          "erwartung": "sichtbar"
        }
      ]
    },
    "notiz": "AP-01 Fassung 4.1 zeigt hier übergangsweise „Kunde anlegen“ (3.1 als Ebene); Bauplan: „Neukunde anlegen“ inline (AP-02 F2)."
  },
  {
    "id": "E05",
    "titel": "Treffer wählen setzt den Bestandskunden",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.KundeFormular.interaktion[Treffer wählen]",
      "bausteine_vertraege.pruefliste.regeln[2]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "status",
          "wert": "ok"
        },
        {
          "id": "eingang.zustand.teilweise_bestand",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.dublette",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "E07",
    "titel": "Bestandskunde vollständig → „Wareneingang buchen“ → Auftragskarte",
    "paket": "AP-01",
    "quelle": [
      "screens[eingang].aktionen[buchen]",
      "bausteine_vertraege.werkbank.interaktion[eingang-erfolg]",
      "bausteine_vertraege.werkbank.buchen.schritte",
      "screens[eingang].abnahme[15]",
      "screens[eingang].abnahme[58]"
    ],
    "deckt": [
      "eingang.buchen",
      "werkbank.hauptknopf",
      "werkbank.eingang-erfolg",
      "zustand.erfolg"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        },
        {
          "oben": "auftrag"
        },
        {
          "id": "eingang",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_vollstaendig_firma}",
            "art": "auftrag",
            "liefertermin": "{arbeitstag:+15}",
            "terminstatus": "wunsch",
            "uebergabe": "abholung",
            "zahlungsmodus": "vorkasse",
            "eingangsart": "persoenlich",
            "geprueft": true
          }
        },
        {
          "tabelle": "items",
          "neu": 1,
          "werte": {
            "auftrag": "{neu:orders}",
            "bezeichnung": "Prüfteil eins",
            "menge": 1,
            "einheit": "stueck",
            "oberflaeche": "offen",
            "ausfuehrung": "offen"
          }
        },
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "kanal": "notiz",
            "richtung": "intern",
            "einsatz": "erledigt",
            "text": "Prüfnotiz eins",
            "vorgang_art": "auftrag",
            "vorgang_id": "{neu:orders}"
          }
        }
      ]
    }
  },
  {
    "id": "E08",
    "titel": "Pflicht fehlt → nichts gesendet, Sprung, „Noch offen: …“",
    "paket": "AP-01",
    "quelle": [
      "screens[eingang].aktionen[buchen].regel",
      "bausteine_vertraege.werkbank.interaktion[hauptknopf]",
      "bausteine_vertraege.pruefliste.interaktion",
      "screens[eingang].abnahme[13]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.buchen",
          "erwartung": "aktiviert"
        },
        {
          "text": "Noch offen: Teil / Leistung",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "fokus",
          "nr": 1
        },
        {
          "id": "eingang.pruefliste.bezeichnung",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "oben": "eingang"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        },
        {
          "tabelle": "intake_item",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "E09",
    "titel": "Enter im Feld Menge löst den Hauptknopf mit seinem Tor aus",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.geraete",
      "screens[eingang].abnahme[53]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "aktion": "taste",
        "wert": "Enter",
        "id": "eingang.menge"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Noch offen: Teil / Leistung",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "fokus",
          "nr": 1
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "E10",
    "titel": "Doppelklick auf „Wareneingang buchen“ → genau ein Auftrag",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.buchen.idempotenz",
      "bausteine_vertraege.werkbank.interaktion[hauptknopf]",
      "screens[eingang].abnahme[17]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        },
        {
          "oben": "auftrag"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1
        },
        {
          "tabelle": "intake_item",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "E11",
    "titel": "Netzfehler → Zustand fehler, alle Eingaben stehen, „Erneut buchen“ bucht genau einmal",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[fehler]",
      "screens[eingang].zustaende.fehler",
      "bausteine_vertraege.werkbank.buchen.rueckrollen",
      "bausteine_vertraege.werkbank.buchen.idempotenz"
    ],
    "deckt": [
      "werkbank.fehler",
      "eingang.erneut-buchen",
      "zustand.fehler"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Speichern fehlgeschlagen · alle Eingaben sind noch da"
          },
          {
            "id": "eingang.erneut-buchen",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.bezeichnung",
            "erwartung": "wert",
            "wert": "Prüfteil eins",
            "nr": 1
          },
          {
            "id": "eingang.erfassen-text",
            "erwartung": "wert",
            "wert": "Prüfnotiz eins"
          },
          {
            "oben": "eingang"
          }
        ],
        "db": [
          {
            "tabelle": "orders",
            "neu": 0
          }
        ]
      },
      {
        "id": "eingang.erneut-buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        },
        {
          "oben": "auftrag"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1
        }
      ]
    },
    "notiz": "„Entwurf behalten und schließen“ im Zustand fehler ist X12 (Stufe 2) und wird hier nicht geprüft."
  },
  {
    "id": "E12a",
    "titel": "Ohne Änderung: Abbrechen schließt sofort ohne Rückfrage",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "bausteine_vertraege.werkbank.aenderung",
      "screens[eingang].aktionen[abbrechen]"
    ],
    "deckt": [
      "eingang.abbrechen",
      "werkbank.abbrechen"
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
        "id": "eingang.abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang",
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
    "id": "E13a",
    "titel": "Mit Änderung: Abbrechen → Rückfrage 3.6 über der Erfassung",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "screens[entwurf]",
      "screens[eingang].abnahme[40]"
    ],
    "deckt": [
      "werkbank.abbrechen"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.abbrechen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "entwurf"
        },
        {
          "id": "entwurf.verwerfen",
          "erwartung": "sichtbar"
        },
        {
          "id": "entwurf.weiter-bearbeiten",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E12b",
    "titel": "Ohne Änderung: × schließt sofort ohne Rückfrage",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "bausteine_vertraege.werkbank.aenderung",
      "screens[eingang].aktionen[abbrechen]"
    ],
    "deckt": [
      "werkbank.abbrechen"
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
        "id": "eingang.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang",
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
    "id": "E13b",
    "titel": "Mit Änderung: × → Rückfrage 3.6 über der Erfassung",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "screens[entwurf]",
      "screens[eingang].abnahme[40]"
    ],
    "deckt": [
      "werkbank.abbrechen"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "entwurf"
        },
        {
          "id": "entwurf.verwerfen",
          "erwartung": "sichtbar"
        },
        {
          "id": "entwurf.weiter-bearbeiten",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E12c",
    "titel": "Ohne Änderung: Esc schließt sofort ohne Rückfrage",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "bausteine_vertraege.werkbank.aenderung",
      "screens[eingang].aktionen[abbrechen]"
    ],
    "deckt": [
      "werkbank.abbrechen"
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
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang",
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
    "id": "E13c",
    "titel": "Mit Änderung: Esc → Rückfrage 3.6 über der Erfassung",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "screens[entwurf]",
      "screens[eingang].abnahme[40]"
    ],
    "deckt": [
      "werkbank.abbrechen"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
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
          "id": "entwurf.verwerfen",
          "erwartung": "sichtbar"
        },
        {
          "id": "entwurf.weiter-bearbeiten",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E14",
    "titel": "3.6 „Weiter bearbeiten“ schließt nur die Rückfrage",
    "paket": "AP-01",
    "quelle": [
      "screens[entwurf].aktionen[weiter-bearbeiten]"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.abbrechen",
        "aktion": "klicken"
      },
      {
        "id": "entwurf.weiter-bearbeiten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "eingang"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.erfassen-text",
          "erwartung": "wert",
          "wert": "Prüfnotiz eins"
        }
      ]
    }
  },
  {
    "id": "E15",
    "titel": "3.6 „Verwerfen“ schließt beide Ebenen; das nächste Plus öffnet leer",
    "paket": "AP-01",
    "quelle": [
      "screens[entwurf].aktionen[verwerfen]",
      "bausteine_vertraege.werkbank.interaktion[aufruf-leer]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.abbrechen",
        "aktion": "klicken"
      },
      {
        "id": "entwurf.verwerfen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "entwurf",
            "erwartung": "nicht_sichtbar"
          },
          {
            "toast": "Entwurf verworfen"
          }
        ]
      },
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.auftrag-erfassen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.erfassen-text",
          "erwartung": "leer"
        },
        {
          "id": "eingang.kundenzeile",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.kundensuche",
          "erwartung": "leer"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "E16",
    "titel": "Esc mit offener Rückfrage schließt nur die oberste Ebene",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[abbrechen]",
      "verhalten_appweit.tastatur"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.abbrechen",
        "aktion": "klicken"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "eingang"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.erfassen-text",
          "erwartung": "wert",
          "wert": "Prüfnotiz eins"
        }
      ]
    }
  },
  {
    "id": "E17",
    "titel": "Ohne Recht „eingang“: kein Plus, Taste N öffnet nichts",
    "paket": "AP-01",
    "quelle": [
      "navigation.kopf[plus].recht",
      "bausteine_vertraege.werkbank.rechte",
      "verhalten_appweit.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_ohne_eingang",
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
        "aktion": "taste",
        "wert": "n"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "navigation.plus",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "rein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "dialoge": 0
        }
      ]
    }
  },
  {
    "id": "E18",
    "titel": "Ohne Recht „geld“: kein Zahlungsmodus, keine Art, kein Preis; Server leitet den Modus ab",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.rechte",
      "bausteine_vertraege.werkbank.zahlung.faelle[0].ohne_geld",
      "screens[eingang].abnahme[8]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.zahlungsmodus",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "eingang.art",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "eingang.preis",
            "erwartung": "nicht_sichtbar",
            "nr": 1
          },
          {
            "id": "eingang.pruefliste.zahlungsmodus",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "eingang.pruefliste.preis",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "art": "auftrag",
            "zahlungsmodus": "vorkasse"
          }
        }
      ]
    }
  },
  {
    "id": "E19",
    "titel": "Bedingung Vorkasse → Zahlungsmodus „Vorkasse“ vorbelegt mit Herkunft",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "screens[eingang].felder[zahlungsmodus].vorbelegung",
      "verhalten_appweit.auswahl.vorbelegt"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert",
          "wert": "Vorkasse"
        },
        {
          "id": "eingang.zahlungsmodus.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "aus Kundenkarte"
        },
        {
          "id": "eingang.pruefliste.zahlungsmodus",
          "erwartung": "status",
          "wert": "ok"
        }
      ]
    }
  },
  {
    "id": "E20",
    "titel": "Bedingung Bar + Abholung → „Bar oder Karte bei Abholung“; Buchen speichert bar",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_bedingung_bar.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.zahlungsmodus",
            "erwartung": "wert",
            "wert": "Bar oder Karte bei Abholung"
          }
        ]
      },
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "zahlungsmodus": "bar",
            "uebergabe": "abholung"
          }
        }
      ]
    }
  },
  {
    "id": "E21",
    "titel": "Bedingung Bar + Versand → Vorkasse, „Bar oder Karte“ gesperrt",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "bausteine_vertraege.werkbank.zahlung.versand_bar"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_bedingung_bar.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Versand"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert",
          "wert": "Vorkasse"
        },
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "gesperrt",
          "wert": "nur bei Abholung",
          "option": "Bar oder Karte bei Abholung"
        }
      ]
    }
  },
  {
    "id": "E22",
    "titel": "Wechsel auf Versand bei gewähltem Bar → Vorkasse mit Hinweis",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "bausteine_vertraege.werkbank.zahlung.versand_bar"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_bar"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_bedingung_bar.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Versand"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert",
          "wert": "Vorkasse"
        },
        {
          "text": "angepasst: Versand",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E23",
    "titel": "Ohne Freischaltung: „Rechnung auf Ziel“ sichtbar, aber gesperrt",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "screens[eingang].felder[zahlungsmodus].sperre",
      "screens[eingang].abnahme[6]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "gesperrt",
          "wert": "Ziel nicht freigeschaltet",
          "option": "Rechnung auf Ziel"
        }
      ]
    }
  },
  {
    "id": "E24",
    "titel": "Bedingung Rechnung mit Freischaltung → „Rechnung auf Ziel“ vorbelegt",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "bausteine_vertraege.werkbank.zahlung.ziel_freigeschaltet"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_rechnung_freigeschaltet"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_rechnung_freigeschaltet.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert",
          "wert": "Rechnung auf Ziel"
        },
        {
          "id": "eingang.pruefliste.zahlungsmodus",
          "erwartung": "status",
          "wert": "ok"
        }
      ]
    }
  },
  {
    "id": "E25",
    "titel": "Ohne Bedingung (Recht geld) → kein Ersatzwert, Abschnitt 1 fragt sie ab",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "bausteine_vertraege.werkbank.zahlung.faelle[1].mit_geld",
      "screens[eingang].zustaende.teilweise_bestand",
      "screens[eingang].abnahme[4]"
    ],
    "deckt": [
      "eingang.jetzt-ergaenzen-bestand",
      "zustand.teilweise_bestand"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_ohne_bedingung"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_ohne_bedingung.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.zustand.teilweise_bestand",
            "erwartung": "text_enthaelt",
            "wert": "Zahlungsbedingung"
          }
        ]
      },
      {
        "id": "eingang.jetzt-ergaenzen-bestand",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsbedingung",
          "erwartung": "fokus"
        },
        {
          "id": "eingang.zahlungsbedingung",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert_nicht",
          "wert": "Rechnung auf Ziel"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "text_enthaelt",
          "wert": "fehlt: Zahlungsbedingung"
        }
      ]
    }
  },
  {
    "id": "E26",
    "titel": "Altwert Rechnung ohne Freischaltung gilt wie fehlend",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung",
      "bausteine_vertraege.werkbank.zahlung.regel",
      "formulare.kunde.felder[zahlungsbedingung].regel"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_rechnung_ohne_freischaltung"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_rechnung_ohne_freischaltung.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zahlungsbedingung",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "text_enthaelt",
          "wert": "fehlt: Zahlungsbedingung"
        },
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert_nicht",
          "wert": "Rechnung auf Ziel"
        }
      ]
    }
  },
  {
    "id": "E27",
    "titel": "Ohne Bedingung, Login ohne „geld“ → keine Sackgasse, Modus aus der Übergabe",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung.faelle[1].ohne_geld",
      "formulare.kunde.vollstaendigkeit.ohne_geld",
      "screens[eingang].abnahme[5]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_ohne_bedingung"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_ohne_bedingung.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.kundenzeile",
            "erwartung": "text_enthaelt",
            "wert": "Unvollständig – Zahlungsbedingung fehlt · Büro ergänzt"
          },
          {
            "id": "eingang.zustand.teilweise_bestand",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "zahlungsmodus": "bar"
          }
        },
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_ohne_bedingung}"
          },
          "werte": {
            "zahlungsbedingung": null
          }
        }
      ]
    }
  },
  {
    "id": "E28",
    "titel": "Übergabe aus der Kundenkarte vorbelegt; ein Wechsel schreibt nie in die Kundenbedingung",
    "paket": null,
    "quelle": [
      "screens[eingang].felder[uebergabe].vorbelegung",
      "formulare.kunde.felder[uebergabe]",
      "screens[eingang].abnahme[9]",
      "bausteine_vertraege.werkbank.regeln[6]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_vorkasse"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_bedingung_vorkasse.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.uebergabe",
            "erwartung": "gewaehlt",
            "wert": "Versand"
          },
          {
            "id": "eingang.uebergabe.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "aus Kundenkarte"
          }
        ]
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag}"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "uebergabe": "abholung",
            "zahlungsmodus": "vorkasse"
          }
        },
        {
          "tabelle": "customers",
          "wo": {
            "id": "{kunde_bedingung_vorkasse}"
          },
          "werte": {
            "zahlungsbedingung": "vorkasse",
            "handover_preference": "versand"
          }
        }
      ]
    }
  },
  {
    "id": "E29",
    "titel": "Bestandskunde mit PLZ, die nicht zum Land passt → unvollständig, Buchen springt zu Kunde",
    "paket": "AP-01",
    "quelle": [
      "screens[eingang].zustaende.teilweise_bestand",
      "formulare.kunde.vollstaendigkeit.labels (Owner 02.11.: Anschrift gefüllt UND gültig)",
      "formulare.kunde.felder[plz].validierung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_plz_land_widerspruch"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_plz_land_widerspruch.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zustand.teilweise_bestand",
          "erwartung": "text_enthaelt",
          "wert": "Anschrift"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "text": "Noch offen: Kunde",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "E30",
    "titel": "Privatkunde ohne Ansprechpartner ist vollständig",
    "paket": "AP-01",
    "quelle": [
      "formulare.kunde.vollstaendigkeit.labels",
      "formulare.kunde.typ_felder.Privat"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_privat_ohne_ansprechpartner"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_privat_ohne_ansprechpartner.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zustand.teilweise_bestand",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "status",
          "wert": "ok"
        }
      ]
    }
  },
  {
    "id": "E31",
    "titel": "Firma ohne Ansprechpartner ist unvollständig",
    "paket": "AP-01",
    "quelle": [
      "formulare.kunde.vollstaendigkeit.labels"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_firma_ohne_ansprechpartner"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_firma_ohne_ansprechpartner.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.zustand.teilweise_bestand",
          "erwartung": "text_enthaelt",
          "wert": "Ansprechpartner"
        },
        {
          "id": "eingang.pruefliste.kunde",
          "erwartung": "status",
          "wert": "fehlt"
        }
      ]
    }
  },
  {
    "id": "E32",
    "titel": "Schnell erfassen: Menge, Einheit, Oberfläche und Wunschtermin erkannt; „Alles bestätigen“",
    "paket": "AP-01",
    "quelle": [
      "bausteine_vertraege.erfassen.interaktion[erkennen]",
      "bausteine_vertraege.erfassen.interaktion[alles-bestaetigen]",
      "bausteine_vertraege.erfassen.erkennung.text_regeln",
      "bausteine_vertraege.erfassen.erkennung.feld_abbildung",
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.termin_ist",
      "screens[eingang].abnahme[20]"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "3 kg Prüfteil verzinken bis {arbeitstag:+15|TT.MM.}"
      },
      {
        "id": "eingang.angaben-erkennen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.menge",
            "erwartung": "wert",
            "wert": "3",
            "nr": 1
          },
          {
            "id": "eingang.einheit",
            "erwartung": "wert",
            "wert": "kg",
            "nr": 1
          },
          {
            "id": "eingang.oberflaeche",
            "erwartung": "wert",
            "wert": "Verzinken",
            "nr": 1
          },
          {
            "id": "eingang.menge.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "erkannt",
            "nr": 1
          },
          {
            "id": "eingang.pruefliste.menge",
            "erwartung": "status",
            "wert": "prüfen"
          },
          {
            "id": "eingang.liefertermin",
            "erwartung": "wert",
            "wert": "{arbeitstag:+15}"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "Wunsch"
          }
        ]
      },
      {
        "id": "eingang.alles-bestaetigen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.pruefliste.menge",
          "erwartung": "status",
          "wert": "ok"
        },
        {
          "id": "eingang.pruefliste.oberflaeche",
          "erwartung": "status",
          "wert": "ok"
        }
      ]
    }
  },
  {
    "id": "E33",
    "titel": "Erkanntes Feld von Hand geändert → nur dieses gilt als bestätigt",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.erfassen.interaktion[feld-von-hand]",
      "screens[eingang].abnahme[21]"
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "3 kg Prüfteil verzinken"
      },
      {
        "id": "eingang.angaben-erkennen",
        "aktion": "klicken"
      },
      {
        "id": "eingang.menge",
        "aktion": "tippen",
        "wert": "4",
        "nr": 1
      },
      {
        "id": "eingang.menge",
        "aktion": "verlassen",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.pruefliste.menge",
          "erwartung": "status",
          "wert": "ok"
        },
        {
          "id": "eingang.menge.herkunft",
          "erwartung": "nicht_sichtbar",
          "nr": 1
        },
        {
          "id": "eingang.pruefliste.oberflaeche",
          "erwartung": "status",
          "wert": "prüfen"
        }
      ]
    }
  },
  {
    "id": "E34",
    "titel": "Schnell erfassen: Telefonnummer eines Bestandskunden setzt genau diesen Kunden",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.erfassen.interaktion[erkannter-kunde]",
      "bausteine_vertraege.dublette.daten.filter"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Rückruf {kunde_vollstaendig_firma.phone} wegen 2 Stück Prüfteil"
      },
      {
        "id": "eingang.angaben-erkennen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        }
      ]
    },
    "notiz": "AP-01 Fassung 4.1/4.2 füllt mit erkannten Kundenangaben nur die Kundensuche vor; Bauplan: genau ein sicherer Treffer wird gesetzt."
  },
  {
    "id": "E35",
    "titel": "Neukunde inline: Suchtext nach Muster übernommen, keine Kunden-Notiz, „Zurück zur Suche“",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.KundeFormular.interaktion[Neukunde anlegen]",
      "bausteine_vertraege.KundeFormular.interaktion[Zurück zur Suche]",
      "screens[eingang].abnahme[2]"
    ],
    "deckt": [
      "eingang.neukunde-anlegen",
      "eingang.zurueck-zur-suche",
      "zustand.neukunde"
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "06100 909090"
      },
      {
        "id": "eingang.neukunde-anlegen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.zustand.neukunde",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.telefon",
            "erwartung": "nicht_leer"
          },
          {
            "id": "eingang.notiz",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "eingang.dublette",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "eingang.zurueck-zur-suche",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.kundensuche",
          "erwartung": "wert",
          "wert": "06100 909090"
        },
        {
          "id": "eingang.zustand.neukunde",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "E36",
    "titel": "Neukunde teilweise: „Jetzt ergänzen“ und „Nur als Interessent speichern“",
    "paket": null,
    "quelle": [
      "screens[eingang].zustaende.teilweise",
      "bausteine_vertraege.werkbank.interaktion[interessent]",
      "bausteine_vertraege.werkbank.interaktion[interessent-tor]",
      "screens[eingang].abnahme[38]"
    ],
    "deckt": [
      "eingang.jetzt-ergaenzen",
      "eingang.interessent-speichern",
      "werkbank.interessent",
      "werkbank.interessent-tor",
      "zustand.teilweise"
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "06100 909090"
      },
      {
        "id": "eingang.neukunde-anlegen",
        "aktion": "klicken"
      },
      {
        "id": "eingang.kundentyp",
        "aktion": "waehlen",
        "wert": "Firma"
      },
      {
        "id": "eingang.name",
        "aktion": "tippen",
        "wert": "Neufirma Lambda GmbH"
      },
      {
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Für Auftrag fehlt bei"
          }
        ]
      },
      {
        "id": "eingang.jetzt-ergaenzen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.nachname",
            "erwartung": "fokus"
          }
        ]
      },
      {
        "id": "eingang.interessent-speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Interessent {kunde} angelegt · Angaben im Verlauf"
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
            "customer_type": "business",
            "company_name": "Neufirma Lambda GmbH"
          }
        },
        {
          "tabelle": "orders",
          "neu": 0
        },
        {
          "tabelle": "intake_item",
          "neu": 1,
          "werte": {
            "kanal": "notiz",
            "richtung": "intern",
            "einsatz": "info",
            "kunde_id": "{neu:customers}"
          }
        }
      ]
    }
  },
  {
    "id": "E37",
    "titel": "Möglicher Doppelter im Eingang: Buchen springt zur Entscheidung; „Diesen Kunden verwenden“",
    "paket": null,
    "quelle": [
      "bausteine_vertraege.dublette.regeln[0]",
      "bausteine_vertraege.dublette.zustaende.fehler",
      "bausteine_vertraege.dublette.interaktion[diesen-kunden-verwenden]",
      "screens[eingang].abnahme[3]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "Zzqxv"
      },
      {
        "id": "eingang.neukunde-anlegen",
        "aktion": "klicken"
      },
      {
        "id": "eingang.kundentyp",
        "aktion": "waehlen",
        "wert": "Firma"
      },
      {
        "id": "eingang.name",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.name",
        "aktion": "verlassen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.dublette",
            "erwartung": "text_enthaelt",
            "wert": "Ähnlicher Kunde vorhanden"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.pruefliste.kunde",
            "erwartung": "status",
            "wert": "entscheiden"
          }
        ],
        "db": [
          {
            "tabelle": "customers",
            "neu": 0
          },
          {
            "tabelle": "orders",
            "neu": 0
          }
        ]
      },
      {
        "id": "eingang.diesen-kunden-verwenden",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        },
        {
          "id": "eingang.zustand.neukunde",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "customers",
          "neu": 0
        }
      ]
    },
    "notiz": "Möglicher Treffer: gleicher normalisierter Firmenname, PLZ und Ort noch leer (dublette.daten.filter)."
  },
  {
    "id": "E38",
    "titel": "Art KV: Hauptknopf „KV anlegen“, Gültig bis, Preis und Aufwand Pflicht",
    "paket": null,
    "quelle": [
      "screens[eingang].aktionen[buchen].text_kv",
      "screens[eingang].felder[gueltig_bis]",
      "formulare.position.felder[aufwand_min]",
      "screens[eingang].abnahme[27]"
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
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "KV"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.buchen",
          "erwartung": "text",
          "wert": "KV anlegen"
        },
        {
          "id": "eingang.gueltig_bis",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.aufwand_min",
          "erwartung": "sichtbar",
          "nr": 1
        },
        {
          "id": "eingang.pruefliste.preis",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.pruefliste.aufwand_min",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.pruefliste.gueltig_bis",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E39",
    "titel": "Position hinzufügen und entfernen (Klärung 19)",
    "paket": null,
    "quelle": [
      "screens[eingang].abschnitt[2].aktionen",
      "screens[eingang].abschnitt[2].aktionen_je_eintrag",
      "screens[eingang].abnahme[12]"
    ],
    "deckt": [
      "eingang.position-hinzufuegen",
      "eingang.position-entfernen"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.position-entfernen",
            "erwartung": "anzahl",
            "wert": 0
          }
        ]
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Teil eins",
        "nr": 1
      },
      {
        "id": "eingang.position-hinzufuegen",
        "aktion": "klicken"
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Teil zwei",
        "nr": 2
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.position-entfernen",
            "erwartung": "anzahl",
            "wert": 2
          }
        ]
      },
      {
        "id": "eingang.position-entfernen",
        "aktion": "klicken",
        "nr": 2
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.bezeichnung",
          "erwartung": "anzahl",
          "wert": 1
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "wert",
          "wert": "Teil eins",
          "nr": 1
        },
        {
          "id": "eingang.position-entfernen",
          "erwartung": "anzahl",
          "wert": 0
        }
      ]
    }
  },
  {
    "id": "E40",
    "titel": "Eingangsart steuert Telefonnotiz, „geprüft“ und Warnung Eingangsfoto",
    "paket": null,
    "quelle": [
      "screens[eingang].felder[telefonnotiz]",
      "screens[eingang].felder[geprueft]",
      "screens[eingang].felder[eingangsfoto].hinweis",
      "screens[eingang].abnahme[33]",
      "screens[eingang].abnahme[34]"
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
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "Anfrage per Telefon"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.telefonnotiz",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.geprueft",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "eingang.pruefliste.eingangsfoto",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.telefonnotiz",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.geprueft",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.pruefliste.geprueft",
          "erwartung": "status",
          "wert": "fehlt"
        },
        {
          "id": "eingang.pruefliste.eingangsfoto",
          "erwartung": "text_enthaelt",
          "wert": "sperrt nicht"
        }
      ]
    }
  },
  {
    "id": "E41",
    "titel": "Feldprüfung: Liefertermin in der Vergangenheit, Menge 0 bei Stück",
    "paket": null,
    "quelle": [
      "screens[eingang].felder[liefertermin].pruefung",
      "formulare.position.felder[menge].pruefung",
      "bausteine_vertraege.werkbank.validierung"
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
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:-1}"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "verlassen"
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.menge",
        "aktion": "tippen",
        "wert": "0",
        "nr": 1
      },
      {
        "id": "eingang.menge",
        "aktion": "verlassen",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.liefertermin.fehler",
          "erwartung": "text",
          "wert": "Liefertermin liegt in der Vergangenheit"
        },
        {
          "id": "eingang.menge.fehler",
          "erwartung": "text",
          "wert": "Menge 1–99 999 (ganze Zahl)",
          "nr": 1
        }
      ]
    }
  },
  {
    "id": "E43",
    "titel": "Werkzeug „Aus Mail“ nur mit Recht „mails“ (ohne Recht)",
    "paket": null,
    "quelle": [
      "screens[eingang].erfassen.werkzeuge[aus-mail].recht"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
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
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.aus-mail",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.aufnehmen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E44",
    "titel": "Werkzeug „Aus Mail“ nur mit Recht „mails“ (mit Recht)",
    "paket": null,
    "quelle": [
      "screens[eingang].erfassen.werkzeuge[aus-mail].recht"
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
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.aus-mail",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "E45",
    "titel": "Prüfliste: Eingangsart fehlt → „Noch offen: Eingangsart“",
    "paket": null,
    "quelle": [
      "screens[eingang].rail.pruefliste.pflicht (Runde 26)",
      "bausteine_vertraege.pruefliste.interaktion"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.einheit",
        "aktion": "waehlen",
        "wert": "Stück",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Noch offen: Eingangsart",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.eingangsart",
          "erwartung": "fokus"
        },
        {
          "id": "eingang.pruefliste.eingangsart",
          "erwartung": "status",
          "wert": "fehlt"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    },
    "notiz": "Paket für die Prüflisten-Zeilen der Runde 26 legt der Planungschat fest."
  },
  {
    "id": "E46",
    "titel": "Prüfliste: Einheit fehlt → „Noch offen: Einheit“, Position 1",
    "paket": null,
    "quelle": [
      "screens[eingang].rail.pruefliste.pflicht (Runde 26)",
      "bausteine_vertraege.pruefliste.regeln[1]",
      "formulare.position.felder[einheit].vorbelegung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
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
        "id": "eingang.erfassen-text",
        "aktion": "tippen",
        "wert": "Prüfnotiz eins"
      },
      {
        "id": "eingang.kundensuche",
        "aktion": "tippen",
        "wert": "{kunde_vollstaendig_firma.name}"
      },
      {
        "id": "eingang.kundensuche.treffer",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "tippen",
        "wert": "Prüfteil eins",
        "nr": 1
      },
      {
        "id": "eingang.bezeichnung",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      },
      {
        "id": "eingang.geprueft",
        "aktion": "klicken"
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Noch offen: Einheit",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.einheit",
          "erwartung": "fokus",
          "nr": 1
        },
        {
          "id": "eingang.pruefliste.einheit",
          "erwartung": "text_enthaelt",
          "wert": "Position 1 fehlt"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "E47",
    "titel": "Prüfliste ohne Recht „geld“: keine Zeile Art",
    "paket": null,
    "quelle": [
      "screens[eingang].rail.pruefliste.pflicht (Runde 26)",
      "bausteine_vertraege.pruefliste.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
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
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.pruefliste.art",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.pruefliste.terminstatus",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.pruefliste.eingangsart",
          "erwartung": "sichtbar"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · eingang", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
