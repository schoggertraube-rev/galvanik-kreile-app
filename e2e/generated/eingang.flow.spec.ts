// Generated from BAUPLAN SHA-256 9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "E01",
    "titel": "Plus öffnet eine leere Erfassung",
    "paket": "AP-R",
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
    "paket": "AP-R",
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
    "paket": "AP-EIN",
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
      "screens[eingang].abnahme[58]",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
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
    "titel": "Enter springt Feld für Feld; erst im letzten Pflichtfeld (Eingangsart) löst Enter den Hauptknopf mit seinem Tor aus",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.werkbank.geraete",
      "screens[eingang].abnahme[53]",
      "verhalten_appweit.tastatur_enter",
      "SICHTVERTRAG eingang.fokus"
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
        "id": "eingang.eingangsart"
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
      "screens[eingang].abnahme[17]",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
          }
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
      "bausteine_vertraege.werkbank.buchen.idempotenz",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
          }
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
      "screens[eingang].abnahme[40]",
      "verhalten_appweit.rueckfrage.erfassung_3"
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
        },
        {
          "id": "entwurf.speichern",
          "erwartung": "nicht_sichtbar"
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
      "screens[eingang].abnahme[40]",
      "verhalten_appweit.rueckfrage.erfassung_3"
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
        },
        {
          "id": "entwurf.speichern",
          "erwartung": "nicht_sichtbar"
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
      "screens[eingang].abnahme[40]",
      "verhalten_appweit.rueckfrage.erfassung_3"
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
        },
        {
          "id": "entwurf.speichern",
          "erwartung": "nicht_sichtbar"
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
    "paket": "AP-R",
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
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.werkbank.rechte",
      "bausteine_vertraege.werkbank.zahlung.faelle[0].ohne_geld",
      "screens[eingang].abnahme[8]",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
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
      "bausteine_vertraege.werkbank.zahlung",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.werkbank.zahlung.faelle[1].ohne_geld",
      "formulare.kunde.vollstaendigkeit.ohne_geld",
      "screens[eingang].abnahme[5]",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
          }
        }
      ]
    }
  },
  {
    "id": "E28",
    "titel": "Übergabe aus der Kundenkarte vorbelegt; ein Wechsel schreibt nie in die Kundenbedingung",
    "paket": "AP-EIN",
    "quelle": [
      "screens[eingang].felder[uebergabe].vorbelegung",
      "formulare.kunde.felder[uebergabe]",
      "screens[eingang].abnahme[9]",
      "bausteine_vertraege.werkbank.regeln[6]",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
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
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-EIN",
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
    "paket": "AP-R",
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
    "paket": "AP-R",
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
    "paket": "AP-R",
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
  },
  {
    "id": "C01",
    "titel": "Kundenkarte „Neuer Auftrag“ ({kunde}): Kunde, Art Auftrag, Übergabe und Zahlung aus der Kundenkarte, Eingangsart leer",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[aufruf-kunde]",
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.{kunde}",
      "screens[eingang].abnahme[30]"
    ],
    "deckt": [
      "werkbank.aufruf-kunde"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_vorkasse"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{kunde_bedingung_vorkasse}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "eingang"
        },
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_bedingung_vorkasse.name}"
        },
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "aus der Kundenkarte"
        },
        {
          "id": "eingang.art",
          "erwartung": "gewaehlt",
          "wert": "Auftrag"
        },
        {
          "id": "eingang.art.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "aus Aufruf"
        },
        {
          "id": "eingang.uebergabe",
          "erwartung": "gewaehlt",
          "wert": "Versand"
        },
        {
          "id": "eingang.uebergabe.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "aus Kundenkarte"
        },
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert",
          "wert": "Vorkasse"
        },
        {
          "id": "eingang.eingangsart",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.terminstatus",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.erfassen-text",
          "erwartung": "leer"
        }
      ]
    }
  },
  {
    "id": "C02",
    "titel": "{kunde} ohne Übergabe-Vorliebe, mit Vorgeschichte: Übergabe „wie zuletzt“",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.{kunde}"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.uebergabe",
          "erwartung": "gewaehlt",
          "wert": "Versand"
        },
        {
          "id": "eingang.uebergabe.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "wie zuletzt"
        }
      ]
    }
  },
  {
    "id": "C03",
    "titel": "{kunde} ohne Vorliebe und ohne Vorgeschichte: Übergabe leer, Zahlungsmodus aus der Bedingung",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.{kunde}",
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.herkunft",
      "bausteine_vertraege.werkbank.zahlung"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.uebergabe",
          "erwartung": "ohne_wahl"
        },
        {
          "id": "eingang.zahlungsmodus",
          "erwartung": "wert",
          "wert": "Vorkasse"
        },
        {
          "id": "eingang.zahlungsmodus.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "aus Kundenkarte"
        }
      ]
    }
  },
  {
    "id": "C04",
    "titel": "{kunde} ohne Änderung: Abbrechen schließt sofort (Aufruf-Übernahmen zählen zum Ausgangszustand)",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.aenderung",
      "bausteine_vertraege.werkbank.interaktion[abbrechen]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{kunde_vollstaendig_firma}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
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
    "id": "C05",
    "titel": "{kunde} vollständig buchen → genau ein neuer Auftrag dieses Kunden",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[eingang-erfolg]",
      "bausteine_vertraege.werkbank.buchen.schritte",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_vorkasse"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{kunde_bedingung_vorkasse}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        },
        {
          "oben": "auftrag"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_bedingung_vorkasse}",
            "art": "auftrag",
            "uebergabe": "versand",
            "zahlungsmodus": "vorkasse",
            "eingangsart": "persoenlich"
          }
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
          }
        }
      ]
    }
  },
  {
    "id": "C06",
    "titel": "Auftragskarte „Duplizieren“ ({auftrag}#kopie): Kunde und alle Positionen, ohne Fotos, Liefertermin und Prüfhaken; Art Auftrag",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[aufruf-auftrag]",
      "screens[eingang].abnahme[29]"
    ],
    "deckt": [
      "werkbank.aufruf-auftrag"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{auftrag_quelle}#kopie",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "anzahl",
          "wert": 2
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "wert",
          "wert": "Prüfteil Kopie A",
          "nr": 1
        },
        {
          "id": "eingang.menge",
          "erwartung": "wert",
          "wert": "3",
          "nr": 1
        },
        {
          "id": "eingang.einheit",
          "erwartung": "wert",
          "wert": "Stück",
          "nr": 1
        },
        {
          "id": "eingang.oberflaeche",
          "erwartung": "wert",
          "wert": "Verchromen",
          "nr": 1
        },
        {
          "id": "eingang.ausfuehrung",
          "erwartung": "wert",
          "wert": "Hochglanz",
          "nr": 1
        },
        {
          "id": "eingang.material",
          "erwartung": "wert",
          "wert": "Messing",
          "nr": 1
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "wert",
          "wert": "Prüfteil Kopie B",
          "nr": 2
        },
        {
          "id": "eingang.menge",
          "erwartung": "wert",
          "wert": "2",
          "nr": 2
        },
        {
          "id": "eingang.einheit",
          "erwartung": "wert",
          "wert": "kg",
          "nr": 2
        },
        {
          "id": "eingang.oberflaeche",
          "erwartung": "wert",
          "wert": "Verzinken",
          "nr": 2
        },
        {
          "id": "eingang.ausfuehrung",
          "erwartung": "wert",
          "wert": "gelb passiviert",
          "nr": 2
        },
        {
          "id": "eingang.material",
          "erwartung": "wert",
          "wert": "Stahl",
          "nr": 2
        },
        {
          "id": "eingang.preis",
          "erwartung": "nicht_leer",
          "nr": 1
        },
        {
          "id": "eingang.preis",
          "erwartung": "leer",
          "nr": 2
        },
        {
          "id": "eingang.art",
          "erwartung": "gewaehlt",
          "wert": "Auftrag"
        },
        {
          "id": "eingang.eingangsart",
          "erwartung": "gewaehlt",
          "wert": "Versand eingegangen"
        },
        {
          "id": "eingang.eingangsart.herkunft",
          "erwartung": "text_enthaelt",
          "wert": "vorgeschlagen · aus"
        },
        {
          "id": "eingang.liefertermin",
          "erwartung": "leer"
        },
        {
          "id": "eingang.geprueft",
          "erwartung": "aus"
        },
        {
          "id": "eingang.pruefliste.eingangsfoto",
          "erwartung": "text_enthaelt",
          "wert": "fehlt"
        }
      ]
    }
  },
  {
    "id": "C07",
    "titel": "Auftragskarte „KV“ ({auftrag}#kv): Kunde, Art KV, alle Positionen; Hauptknopf „KV anlegen“",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[aufruf-auftrag]",
      "screens[eingang].abnahme[29]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{auftrag_quelle}#kv",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.art",
          "erwartung": "gewaehlt",
          "wert": "KV"
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "anzahl",
          "wert": 2
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "wert",
          "wert": "Prüfteil Kopie A",
          "nr": 1
        },
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
          "id": "eingang.eingangsart",
          "erwartung": "gewaehlt",
          "wert": "Versand eingegangen"
        }
      ]
    }
  },
  {
    "id": "C08",
    "titel": "#kopie ohne Recht „geld“: Positionen ohne Preis, keine Art",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[aufruf-auftrag]",
      "bausteine_vertraege.werkbank.rechte"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{auftrag_quelle}#kopie",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.bezeichnung",
          "erwartung": "anzahl",
          "wert": 2
        },
        {
          "id": "eingang.preis",
          "erwartung": "nicht_sichtbar",
          "nr": 1
        },
        {
          "id": "eingang.art",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "C09",
    "titel": "#kopie buchen: neuer Auftrag mit den kopierten Positionen; der Ursprungsauftrag bleibt unverändert",
    "paket": "AP-C",
    "quelle": [
      "bausteine_vertraege.werkbank.interaktion[aufruf-auftrag]",
      "bausteine_vertraege.werkbank.buchen.schritte",
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{auftrag_quelle}#kopie",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+120}"
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "Wunsch"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Versand"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        },
        {
          "oben": "auftrag"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_vollstaendig_firma}",
            "art": "auftrag",
            "eingangsart": "versand",
            "uebergabe": "versand",
            "zahlungsmodus": "vorkasse"
          }
        },
        {
          "tabelle": "items",
          "neu": 2,
          "werte": {
            "auftrag": "{neu:orders}"
          }
        },
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_quelle}"
          },
          "werte": {
            "uebergabe": "versand",
            "liefertermin": "{arbeitstag:-10}"
          }
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}"
          }
        }
      ]
    },
    "notiz": "Übergabe Versand (Termin laut terminlage.formel). Kopierte Werte sind Aufruf-Vorbelegung = Herkunft vorbelegt (schluessel.herkunft) = Prüfliste ok. Wunschtermin 120 Arbeitstage voraus: Bewertung „passt“ (Reserve > 2, terminvorschlag.berechnung), Prüfliste Liefertermin ok. Positionswerte wie C06; geprüft werden Zahl der Positionen und unveränderte Quelle."
  },
  {
    "id": "C10",
    "titel": "Plus bei offener Kundenkarte: 3.0 zeigt den Kontext „für …“; „Auftrag oder KV erfassen“ setzt diesen Kunden",
    "paket": "AP-C",
    "quelle": [
      "screens[rein].regeln (Kontext, Runde 27)",
      "abschnitte[F1].einstiege_bestand"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_vorkasse"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_vorkasse}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "rein"
          },
          {
            "id": "rein.kontext",
            "erwartung": "text_enthaelt",
            "wert": "{kunde_bedingung_vorkasse.name}"
          }
        ]
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
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_bedingung_vorkasse.name}"
        },
        {
          "id": "eingang.art",
          "erwartung": "gewaehlt",
          "wert": "Auftrag"
        },
        {
          "id": "eingang.uebergabe",
          "erwartung": "gewaehlt",
          "wert": "Versand"
        }
      ]
    }
  },
  {
    "id": "C11",
    "titel": "Plus mit Kontext, „×“ am Kontext: Erfassung leer",
    "paket": "AP-C",
    "quelle": [
      "screens[rein].inhalt[0].kontext"
    ],
    "deckt": [
      "rein.kontext-entfernen"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_vorkasse"
      ],
      "aufruf": {
        "seite": "kunde",
        "arg": "{kunde_bedingung_vorkasse}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "navigation.plus",
        "aktion": "klicken"
      },
      {
        "id": "rein.kontext-entfernen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "rein.kontext",
            "erwartung": "nicht_sichtbar"
          }
        ]
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
          "id": "eingang.kundenzeile",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.art",
          "erwartung": "ohne_wahl"
        }
      ]
    }
  },
  {
    "id": "C12",
    "titel": "Plus bei offener Auftragskarte: „Auftrag oder KV erfassen“ setzt den Kunden des Auftrags, keine Positionen",
    "paket": "AP-C",
    "quelle": [
      "screens[rein].regeln (Kontext, Runde 27)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
      ],
      "aufruf": {
        "seite": "auftrag",
        "arg": "{auftrag_quelle}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne) · abschnitte[F1].einstiege_bestand"
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
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "anzahl",
          "wert": 1
        },
        {
          "id": "eingang.bezeichnung",
          "erwartung": "leer",
          "nr": 1
        }
      ]
    }
  },
  {
    "id": "Q01",
    "titel": "Ohne Wahl ist nichts grün; nach dem Klick ist genau die gewählte Option grün",
    "paket": "AP-Q1",
    "quelle": [
      "verhalten_appweit.auswahl",
      "screens[eingang].felder",
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.termin_ist"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.uebergabe",
            "erwartung": "nicht_gewaehlt",
            "option": "Abholung"
          },
          {
            "id": "eingang.uebergabe",
            "erwartung": "nicht_gewaehlt",
            "option": "Versand"
          },
          {
            "id": "eingang.art",
            "erwartung": "nicht_gewaehlt",
            "option": "Auftrag"
          },
          {
            "id": "eingang.art",
            "erwartung": "nicht_gewaehlt",
            "option": "KV"
          }
        ]
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "KV"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+15}"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "verlassen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "Wunsch"
          },
          {
            "id": "eingang.terminstatus.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "Kundenwunsch"
          }
        ]
      },
      {
        "id": "eingang.terminstatus",
        "aktion": "waehlen",
        "wert": "bestätigt"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.uebergabe",
          "erwartung": "gewaehlt",
          "wert": "Abholung"
        },
        {
          "id": "eingang.uebergabe",
          "erwartung": "nicht_gewaehlt",
          "option": "Versand"
        },
        {
          "id": "eingang.art",
          "erwartung": "gewaehlt",
          "wert": "KV"
        },
        {
          "id": "eingang.art",
          "erwartung": "nicht_gewaehlt",
          "option": "Auftrag"
        },
        {
          "id": "eingang.terminstatus",
          "erwartung": "gewaehlt",
          "wert": "bestätigt"
        },
        {
          "id": "eingang.terminstatus",
          "erwartung": "nicht_gewaehlt",
          "option": "Wunsch"
        },
        {
          "id": "eingang.eingangsart",
          "erwartung": "ohne_wahl"
        }
      ]
    }
  },
  {
    "id": "Q02",
    "titel": "Vorbelegter Wert ist grün mit Herkunft; ein Klick auf die andere Option macht genau diese grün",
    "paket": "AP-Q1",
    "quelle": [
      "verhalten_appweit.auswahl",
      "verhalten_appweit.auswahl.vorbelegt",
      "bausteine_vertraege.werkbank.vorbelegung_je_aufruf.herkunft"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_bedingung_vorkasse"
      ],
      "aufruf": {
        "seite": "eingang",
        "arg": "{kunde_bedingung_vorkasse}",
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
            "id": "eingang.uebergabe",
            "erwartung": "gewaehlt",
            "wert": "Versand"
          },
          {
            "id": "eingang.uebergabe.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "aus Kundenkarte"
          },
          {
            "id": "eingang.art",
            "erwartung": "gewaehlt",
            "wert": "Auftrag"
          }
        ]
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
          "id": "eingang.uebergabe",
          "erwartung": "gewaehlt",
          "wert": "Abholung"
        },
        {
          "id": "eingang.uebergabe",
          "erwartung": "nicht_gewaehlt",
          "option": "Versand"
        }
      ]
    }
  },
  {
    "id": "Q03",
    "titel": "Wechsel zwischen Optionen: immer genau eine grün",
    "paket": "AP-Q1",
    "quelle": [
      "verhalten_appweit.auswahl"
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
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "persönlich angeliefert"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.eingangsart",
          "erwartung": "gewaehlt",
          "wert": "persönlich angeliefert"
        },
        {
          "id": "eingang.eingangsart",
          "erwartung": "nicht_gewaehlt",
          "option": "Anfrage per Telefon"
        }
      ]
    }
  },
  {
    "id": "TA01",
    "titel": "Wunsch passt (+30 AT, leere Werkstatt): grün, Termin ist „bestätigt“ (Wunsch passt); Buchen speichert wunsch_passt",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.tabelle[0]",
      "verhalten_appweit.terminlage.formel.bewertung",
      "verhalten_appweit.terminabgleich.herkunft"
    ],
    "deckt": [
      "eingang.abgleich"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+30}"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "passt"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          },
          {
            "id": "eingang.terminstatus.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "Wunsch passt"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "ok"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "liefertermin": "{arbeitstag:+30}",
            "wunschtermin": "{arbeitstag:+30}",
            "terminstatus": "bestaetigt",
            "termin_herkunft": "wunsch_passt"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA02",
    "titel": "Wunsch knapp (Woche 88–90 % ausgelastet): orange, „bestätigt“ (Wunsch knapp); Buchen speichert wunsch_knapp",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.tabelle[1]",
      "verhalten_appweit.terminlage.formel.auslastung",
      "verhalten_appweit.terminlage.formel.bewertung",
      "verhalten_appweit.termin_einstellungen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "termine_einstellungen",
        "auftrag_auslastung_90"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+30}"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "knapp"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          },
          {
            "id": "eingang.terminstatus.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "Wunsch knapp"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_vollstaendig_firma}",
            "liefertermin": "{arbeitstag:+30}",
            "terminstatus": "bestaetigt",
            "termin_herkunft": "wunsch_knapp"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA03",
    "titel": "Wunsch nicht machbar (+4 AT): rot, Prüfzeile „entscheiden“; „… anbieten“ → Gegenvorschlag; Buchen speichert liefertermin = machbar, wunschtermin, terminstatus_seit",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.tabelle[2]",
      "bausteine_vertraege.terminvorschlag.interaktion[anbieten]",
      "verhalten_appweit.gegenvorschlag"
    ],
    "deckt": [
      "eingang.abgleich.anbieten"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+4}"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "frühestens"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "entscheiden"
          },
          {
            "id": "eingang.abgleich.anbieten",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.abgleich.trotzdem",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.abgleich.uebernehmen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "eingang.abgleich.anbieten",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "Gegenvorschlag"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "ok"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "liefertermin": "{arbeitstag:+6}",
            "wunschtermin": "{arbeitstag:+4}",
            "terminstatus": "gegenvorschlag",
            "termin_herkunft": "gegenvorschlag",
            "terminstatus_seit": "{gesetzt}"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA04",
    "titel": "Nicht machbar, „Wunsch trotzdem zusagen“ (Recht entscheiden): Liefertermin = Wunsch, bestätigt, ueber_auslastung",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.tabelle[3]",
      "bausteine_vertraege.terminvorschlag.interaktion[trotzdem]",
      "verhalten_appweit.terminabgleich.rechte"
    ],
    "deckt": [
      "eingang.abgleich.trotzdem"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+4}"
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
        "id": "eingang.abgleich.trotzdem",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "ok"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "liefertermin": "{arbeitstag:+4}",
            "wunschtermin": "{arbeitstag:+4}",
            "terminstatus": "bestaetigt",
            "termin_herkunft": "ueber_auslastung"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA05",
    "titel": "Ohne Recht „entscheiden“ (Werkstatt): bei nicht machbar nur „… anbieten“, kein „trotzdem zusagen“",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.rechte",
      "verhalten_appweit.rechte"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+4}"
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.abgleich.anbieten",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.abgleich.trotzdem",
          "erwartung": "nicht_sichtbar"
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA06",
    "titel": "Unmöglich (+3 AT, kürzer als 1 + Durchlauf): nur „… anbieten“",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.tabelle[4]",
      "verhalten_appweit.terminlage.formel.bewertung",
      "verhalten_appweit.terminabgleich.rechte"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+3}"
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.abgleich",
          "erwartung": "text_enthaelt",
          "wert": "frühestens"
        },
        {
          "id": "eingang.abgleich.anbieten",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.abgleich.trotzdem",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.pruefliste.liefertermin",
          "erwartung": "status",
          "wert": "entscheiden"
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA07",
    "titel": "Vorrang-Kunde: Woche 103–105 % gilt bis zur Vorrang-Grenze (110 %) als knapp → bestätigt, wunsch_knapp",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.vorrang",
      "verhalten_appweit.terminlage.formel.machbar",
      "verhalten_appweit.termin_einstellungen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "kunde_vorrang",
        "termine_einstellungen",
        "auftrag_auslastung_105"
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
        "wert": "{kunde_vorrang.name}"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+30}"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "knapp"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_vorrang}",
            "liefertermin": "{arbeitstag:+30}",
            "terminstatus": "bestaetigt",
            "termin_herkunft": "wunsch_knapp"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA08",
    "titel": "Ohne Wunsch: drei Vorschläge; „Schnell“ → Liefertermin = machbar, bestätigt (Vorschlag gewählt)",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.ohne_wunsch",
      "verhalten_appweit.terminlage.formel.vorschlaege",
      "bausteine_vertraege.terminvorschlag.vorschlaege"
    ],
    "deckt": [
      "eingang.vorschlag.schnell"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.vorschlag.schnell",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.vorschlag.empfohlen",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.vorschlag.entspannt",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "eingang.vorschlag.schnell",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.vorschlag.schnell",
            "erwartung": "gewaehlt"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          },
          {
            "id": "eingang.terminstatus.herkunft",
            "erwartung": "text_enthaelt",
            "wert": "Vorschlag gewählt"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "liefertermin": "{arbeitstag:+6}",
            "terminstatus": "bestaetigt",
            "termin_herkunft": "vorschlag"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA09",
    "titel": "Ohne Oberfläche: „Noch nicht abgeglichen – erst Oberfläche wählen“, Termin ist bleibt „Wunsch“",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.regel",
      "screens[eingang].elemente_runde43[abgleich]"
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
        "wert": "{arbeitstag:+30}"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.abgleich",
          "erwartung": "text_enthaelt",
          "wert": "Noch nicht abgeglichen"
        },
        {
          "id": "eingang.terminstatus",
          "erwartung": "gewaehlt",
          "wert": "Wunsch"
        },
        {
          "id": "eingang.abgleich.anbieten",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "TA10",
    "titel": "Bearbeitungszeit „5 Wochen“: machbar ≥ +25 AT – Wunsch +20 ist nicht machbar, „anbieten“ setzt +25; processing_weeks 5",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminlage.formel.bearbeitungszeit",
      "bausteine_vertraege.terminvorschlag.bearbeitungszeit"
    ],
    "deckt": [
      "eingang.bearbeitungszeit"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+20}"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.bearbeitungszeit",
            "erwartung": "gewaehlt",
            "wert": "1 Woche"
          },
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "passt"
          }
        ]
      },
      {
        "id": "eingang.bearbeitungszeit",
        "aktion": "waehlen",
        "wert": "5 Wochen"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "frühestens"
          },
          {
            "id": "eingang.abgleich.anbieten",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "eingang.abgleich.anbieten",
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "liefertermin": "{arbeitstag:+25}",
            "wunschtermin": "{arbeitstag:+20}",
            "processing_weeks": 5,
            "terminstatus": "gegenvorschlag"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA11",
    "titel": "Art KV, Wunsch nicht machbar: „Wunsch übernehmen“ (kein „trotzdem“); KV gespeichert mit wunsch_kv, keine Auto-Mail",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.entscheidung",
      "screens[eingang].abnahme[51]",
      "verhalten_appweit.annahme.toast"
    ],
    "deckt": [
      "eingang.abgleich.uebernehmen"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "KV"
      },
      {
        "id": "eingang.preis",
        "aktion": "tippen",
        "wert": "50,00",
        "nr": 1
      },
      {
        "id": "eingang.aufwand_min",
        "aktion": "tippen",
        "wert": "60",
        "nr": 1
      },
      {
        "id": "eingang.gueltig_bis",
        "aktion": "tippen",
        "wert": "{heute:+30}"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+4}"
      },
      {
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.eingangsart",
        "aktion": "waehlen",
        "wert": "Anfrage per Telefon"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich.uebernehmen",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.abgleich.anbieten",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.abgleich.trotzdem",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "eingang.abgleich.uebernehmen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "Wunsch"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "KV angelegt · {kv}"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "art": "kv",
            "liefertermin": "{arbeitstag:+4}",
            "terminstatus": "wunsch",
            "termin_herkunft": "wunsch_kv"
          }
        },
        {
          "tabelle": "outbox_mails",
          "neu": 0
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "TA12",
    "titel": "Normaler Kunde, Wunsch-KW über „knapp“ (> 120 %), spätere KW frei: nicht machbar, „anbieten“ = erster Arbeitstag der freien KW",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminlage.formel.machbar",
      "verhalten_appweit.terminlage.formel.auslastung",
      "verhalten_appweit.terminabgleich.tabelle[2]",
      "verhalten_appweit.termin_einstellungen"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "termine_einstellungen",
        "auftrag_auslastung_voll"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+30}"
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
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "nicht machbar"
          },
          {
            "id": "eingang.abgleich",
            "erwartung": "text_enthaelt",
            "wert": "frühestens"
          },
          {
            "id": "eingang.abgleich.anbieten",
            "erwartung": "sichtbar"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "entscheiden"
          }
        ]
      },
      {
        "id": "eingang.abgleich.anbieten",
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_vollstaendig_firma}",
            "liefertermin": "{kw_folge_anfang:+40}",
            "wunschtermin": "{arbeitstag:+30}",
            "terminstatus": "gegenvorschlag",
            "termin_herkunft": "gegenvorschlag"
          }
        }
      ]
    },
    "notiz": "machbar prüft nur die KW des Termins (Runde 42, Nachtrag 2); alle KWs von heute + 6 AT bis zum Liefertermin des Lastauftrags sind voll belegt, die KW danach ist leer."
  },
  {
    "id": "AB01",
    "titel": "Kunde mit „automatisch informieren“ = Nein: Toast „… Kunde bitte informieren (keine Auto-Mail)“, kein outbox-Eintrag",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "verhalten_appweit.annahme.toast"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_ohne_auto_info"
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
        "wert": "{kunde_ohne_auto_info.name}"
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
          "toast": "Wareneingang gebucht · {auftrag} · Kunde bitte informieren (keine Auto-Mail)"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_ohne_auto_info}"
          }
        },
        {
          "tabelle": "outbox_mails",
          "neu": 0
        }
      ]
    }
  },
  {
    "id": "AB02",
    "titel": "Doppelklick „Buchen“: ein Auftrag, genau ein outbox-Eintrag „auftragsbestaetigung“",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.annahme.auftragsbestaetigung",
      "eingang.daten.neu[outbox_mails].regeln[0]",
      "bausteine_vertraege.werkbank.buchen.idempotenz"
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1
        },
        {
          "tabelle": "outbox_mails",
          "neu": 1,
          "werte": {
            "vorlage": "auftragsbestaetigung",
            "objekt": "{neu:orders}",
            "status": "wartet"
          }
        }
      ]
    }
  },
  {
    "id": "TA13a",
    "titel": "Ohne Wunsch: Vorschlag „Empfohlen“ wählen → bestätigt (Vorschlag gewählt)",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.ohne_wunsch",
      "verhalten_appweit.terminlage.formel.vorschlaege"
    ],
    "deckt": [
      "eingang.vorschlag.empfohlen"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
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
        "id": "eingang.vorschlag.empfohlen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.vorschlag.empfohlen",
            "erwartung": "gewaehlt"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "terminstatus": "bestaetigt",
            "termin_herkunft": "vorschlag"
          }
        }
      ]
    },
    "notiz": "Datum = Schnell + 1 Woche (nächster Arbeitstag) – bei Feiertagen nicht als {arbeitstag:+n} ausdrückbar, daher ohne Datumsprüfung."
  },
  {
    "id": "TA13b",
    "titel": "Ohne Wunsch: Vorschlag „Entspannt“ wählen → bestätigt (Vorschlag gewählt)",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.terminabgleich.ohne_wunsch",
      "verhalten_appweit.terminlage.formel.vorschlaege"
    ],
    "deckt": [
      "eingang.vorschlag.entspannt"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
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
        "id": "eingang.vorschlag.entspannt",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.vorschlag.entspannt",
            "erwartung": "gewaehlt"
          },
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "terminstatus": "bestaetigt",
            "termin_herkunft": "vorschlag"
          }
        }
      ]
    }
  },
  {
    "id": "TA14",
    "titel": "Terminvorschlag nicht ladbar: Zeile „Terminvorschlag nicht verfügbar“, keine Knöpfe; Prüfzeile folgt nur dem Feld",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.terminvorschlag.laden",
      "bausteine_vertraege.terminvorschlag.zustaende"
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
        "id": "eingang.uebergabe",
        "aktion": "waehlen",
        "wert": "Abholung"
      },
      {
        "id": "eingang.liefertermin",
        "aktion": "tippen",
        "wert": "{arbeitstag:+30}"
      },
      {
        "aktion": "netz_laden",
        "wert": "nächster Ladeaufruf"
      },
      {
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Terminvorschlag nicht verfügbar",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.abgleich.anbieten",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.vorschlag.schnell",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.pruefliste.liefertermin",
          "erwartung": "status",
          "wert": "ok"
        }
      ]
    }
  },
  {
    "id": "TA15",
    "titel": "Ohne Übergabe: „Erst Abholung oder Versand wählen“, noch keine Vorschläge",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.terminvorschlag.uebergabe_regel.ohne_uebergabe"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
          "text": "Erst Abholung oder Versand wählen",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.vorschlag.schnell",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "TA16",
    "titel": "Wahl-Verfall: Vorschlag „Schnell“ gewählt, dann Menge 5 → Datum nicht mehr leistbar: „Termin nicht mehr leistbar – neu wählen“, Prüfzeile entscheiden",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.terminvorschlag.interaktion[handaenderung]",
      "bausteine_vertraege.terminvorschlag.interaktion[handaenderung].verfall_je_wahl (Runde 44)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "termine_einstellungen"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
        "nr": 1
      },
      {
        "id": "eingang.art",
        "aktion": "waehlen",
        "wert": "Auftrag"
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
        "id": "eingang.preis",
        "aktion": "tippen",
        "wert": "1000,00",
        "nr": 1
      },
      {
        "id": "eingang.vorschlag.schnell",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "ok"
          }
        ]
      },
      {
        "id": "eingang.menge",
        "aktion": "tippen",
        "wert": "5",
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
          "text": "Termin nicht mehr leistbar – neu wählen",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.pruefliste.liefertermin",
          "erwartung": "status",
          "wert": "entscheiden"
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf). Mit Preis 1000 € je Stück und tagesleistung_eur 1000: Menge 1 → Aufwandstage 1 (machbar +6 AT), Menge 5 → Aufwandstage 5 (machbar +10 AT)."
  },
  {
    "id": "TA17",
    "titel": "Wahl-Verfall: „Wunsch trotzdem zusagen“ bleibt bei Mengenänderung (Zusage gilt)",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.terminvorschlag.interaktion[handaenderung]",
      "bausteine_vertraege.terminvorschlag.interaktion[handaenderung].verfall_je_wahl (Runde 44)"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "termine_einstellungen"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+4}"
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
        "id": "eingang.preis",
        "aktion": "tippen",
        "wert": "1000,00",
        "nr": 1
      },
      {
        "id": "eingang.abgleich.trotzdem",
        "aktion": "klicken"
      },
      {
        "id": "eingang.menge",
        "aktion": "tippen",
        "wert": "2",
        "nr": 1
      },
      {
        "id": "eingang.menge",
        "aktion": "verlassen",
        "nr": 1
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.terminstatus",
            "erwartung": "gewaehlt",
            "wert": "bestätigt"
          },
          {
            "text": "zugesagt",
            "erwartung": "sichtbar"
          },
          {
            "text": "Termin nicht mehr leistbar – neu wählen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "eingang.pruefliste.liefertermin",
            "erwartung": "status",
            "wert": "ok"
          }
        ]
      },
      {
        "id": "eingang.buchen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "liefertermin": "{arbeitstag:+4}",
            "terminstatus": "bestaetigt",
            "termin_herkunft": "ueber_auslastung"
          }
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf). Mit Preis 1000 € je Stück und tagesleistung_eur 1000: Menge 1 → Aufwandstage 1 (machbar +6 AT), Menge 5 → Aufwandstage 5 (machbar +10 AT)."
  },
  {
    "id": "TA18",
    "titel": "„Ändern“ nach „anbieten“ setzt die Wahl zurück: Liefertermin wieder Wunsch, Termin ist „Wunsch“, Prüfzeile entscheiden",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.terminvorschlag.interaktion[aendern] (Runde 44)"
    ],
    "deckt": [
      "eingang.liefertermin.aendern"
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
        "id": "eingang.oberflaeche",
        "aktion": "waehlen",
        "wert": "Verzinken",
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
        "wert": "{arbeitstag:+4}"
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
        "id": "eingang.abgleich.anbieten",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "eingang.liefertermin.aendern",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "eingang.liefertermin.aendern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.liefertermin",
          "erwartung": "wert",
          "wert": "{arbeitstag:+4}"
        },
        {
          "id": "eingang.terminstatus",
          "erwartung": "gewaehlt",
          "wert": "Wunsch"
        },
        {
          "id": "eingang.pruefliste.liefertermin",
          "erwartung": "status",
          "wert": "entscheiden"
        },
        {
          "id": "eingang.abgleich.anbieten",
          "erwartung": "sichtbar"
        }
      ]
    },
    "notiz": "Rechnung: Verzinken Durchlauf 3 (werkstattregel.durchlauf_arbeitstage), Aufwandstage 1 (ohne Preis), Übergabepuffer 1 → frühestens plus_arbeitstage(heute, 6); Bearbeitungszeit App-Schätzung aufrunden(5 ÷ 5) = 1 Woche (5 AT) → machbar = +6 AT; unmöglich unter +4 AT (1 + Durchlauf)."
  },
  {
    "id": "AB03",
    "titel": "Mail → „Auftrag oder KV erfassen“ → Buchen: Mail-Eintrag am neuen Auftrag (Schritt 6), Toast mit Auftragsbestätigungs-Zusatz",
    "paket": "AP-EIN",
    "quelle": [
      "bausteine_vertraege.werkbank.buchen.schritte",
      "verhalten_appweit.annahme.toast",
      "screens[mailein].abnahme[1]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_bekannt"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_bekannt}",
        "weg": "oeffne",
        "quelle": "verhalten_appweit.navigation (oeffne); Einstieg außerhalb dieser Seite"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "mailein.neuer-eingang-aus-mail",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "eingang"
          },
          {
            "id": "eingang.kundenzeile",
            "erwartung": "text_enthaelt",
            "wert": "{kunde_vollstaendig_firma.name}"
          }
        ]
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
          "toast": "Wareneingang gebucht · {auftrag} · Auftragsbestätigung wird gesendet"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "neu": 1,
          "werte": {
            "kunde": "{kunde_vollstaendig_firma}"
          }
        },
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_bekannt}"
          },
          "werte": {
            "vorgang_art": "auftrag",
            "vorgang_id": "{neu:orders}",
            "kunde_id": "{kunde_vollstaendig_firma}"
          }
        }
      ]
    },
    "notiz": "Ohne Mail-Herkunftshinweis: der Hinweis „Mail war schon zugeordnet“ entsteht nur, wenn ein anderer Login die Mail während der Erfassung zuordnet (zwei Sitzungen) – nicht in diesem Fall."
  },
  {
    "id": "KK01",
    "titel": "Kundenkarte aus 3 (Kundenzeile) öffnet als Ebene über der Erfassung; × zurück in dieselbe Erfassung mit allen Eingaben",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.kundenkarte_im_eingang",
      "bausteine_vertraege.werkbank.interaktion[ueberlagern]"
    ],
    "deckt": [
      "eingang.kundenkarte"
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
        "id": "eingang.kundenkarte",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "kunde"
          },
          {
            "id": "eingang",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "kunde.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "oben": "eingang"
        },
        {
          "id": "eingang.erfassen-text",
          "erwartung": "wert",
          "wert": "Prüfnotiz eins"
        },
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "DA01",
    "titel": "Notiz „mein Bruder holt ab“ → Anliegen Abholer → am Auftrag gespeichert, 4.1 und 10.1 zeigen die Mitteilung",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.abholung.durch_dritte",
      "eingang.anliegen[abholung_durch]"
    ],
    "deckt": [
      "eingang.anliegen.abholung_durch"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle"
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
        "wert": "Mein Bruder Jens holt die Teile morgen ab."
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
        "id": "eingang.anliegen.abholung_durch",
        "aktion": "klicken"
      },
      {
        "id": "eingang.anliegen.abholer_speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Abholmitteilung gespeichert"
        },
        {
          "text": "Abholung durch Jens",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_quelle.id}"
          },
          "werte": {
            "pickup_by_name": "Jens",
            "pickup_by_source": "notiz"
          }
        },
        {
          "tabelle": "order_events",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "DA02",
    "titel": "Widerruf „holt doch nicht ab“ setzt den Abholer zurück, alte Mitteilung bleibt im Verlauf",
    "paket": "AP-EIN",
    "quelle": [
      "verhalten_appweit.abholung.durch_dritte"
    ],
    "deckt": [
      "eingang.anliegen.abholung_durch"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "auftrag_quelle_abholer"
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
        "wert": "Jens holt doch nicht ab, ich komme selbst."
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
        "id": "eingang.anliegen.abholung_durch",
        "aktion": "klicken"
      },
      {
        "id": "eingang.anliegen.abholer_speichern",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Abholer: Kunde selbst",
          "erwartung": "sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "orders",
          "wo": {
            "id": "{auftrag_quelle_abholer.id}"
          },
          "werte": {
            "pickup_by_name": null
          }
        },
        {
          "tabelle": "order_events",
          "neu": 1
        }
      ]
    }
  },
  {
    "id": "RT04-01",
    "titel": "Verneinung/Kontext: „Bitte nicht zurückrufen, ich melde mich selbst.“ → kein Rückruf",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Bitte nicht zurückrufen, ich melde mich selbst."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.rueckruf",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.anliegen.hinweis",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-02",
    "titel": "Verneinung/Kontext: „Kein Rückruf mehr nötig.“ → kein Anliegen",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Kein Rückruf mehr nötig."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.rueckruf",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-03",
    "titel": "Verneinung/Kontext: „Bitte nur die Außenseite verchromen.“ → genau ein Hinweis",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Bitte nur die Außenseite verchromen."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.hinweis",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.anliegen.aufgabe",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-04",
    "titel": "Verneinung/Kontext: „Keine Frist, hat Zeit bis Dezember.“ → keine Frist",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Keine Frist, hat Zeit bis Dezember."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.frist",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.anliegen.termin",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-05",
    "titel": "Verneinung/Kontext: „Rufen Sie mich morgen an.“ → Rückruf morgen",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Rufen Sie mich morgen an."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.rueckruf",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-06",
    "titel": "Verneinung/Kontext: „Preis passt nicht.“ → Preis-Einwand",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Preis passt nicht."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.preis_einwand",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.anliegen.kv_annahme",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-07",
    "titel": "Verneinung/Kontext: „Sie hatten 180 € gesagt.“ → Hinweis klären",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Sie hatten 180 € gesagt."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.hinweis",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.anliegen.kv_annahme",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-08",
    "titel": "Verneinung/Kontext: „Teile fertig? Und bitte die Rechnung an buchhaltung@beispiel.de“ → zwei Chips",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Teile fertig? Und bitte die Rechnung an buchhaltung@beispiel.de"
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.nachfrage",
          "erwartung": "sichtbar"
        },
        {
          "id": "eingang.anliegen.kundendaten",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-09",
    "titel": "Verneinung/Kontext: „Danke, alles gut angekommen.“ → kein Anliegen",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Danke, alles gut angekommen."
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
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.rueckruf",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.anliegen.hinweis",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "eingang.anliegen.reklamation",
          "erwartung": "nicht_sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-10",
    "titel": "Abgewählter Chip bleibt für denselben Text abgewählt",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.notiz.verneinung.abgewaehlt_bleibt"
    ],
    "deckt": [
      "eingang.anliegen"
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
        "wert": "Bitte um Rückruf wegen Termin."
      },
      {
        "id": "eingang.anliegen.rueckruf.abwaehlen",
        "aktion": "klicken"
      },
      {
        "aktion": "taste",
        "wert": "Escape"
      },
      {
        "id": "entwurf.entwurf-behalten",
        "aktion": "klicken"
      },
      {
        "id": "tag.entwurf.weiter-bearbeiten",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "eingang.anliegen.rueckruf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "werte": {
            "anliegen_abgewaehlt": [
              "rueckruf"
            ]
          }
        }
      ]
    }
  },
  {
    "id": "RT04-11",
    "titel": "„Nicht verchromen, nur vernickeln“ → Oberfläche Vernickeln",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.runde53"
    ],
    "deckt": [
      "eingang.erkennung"
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
        "wert": "Bitte 12 Teile nicht verchromen, nur vernickeln."
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Vernickeln",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-12",
    "titel": "Zahlwort „zwölf“ → Menge 12",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.runde53"
    ],
    "deckt": [
      "eingang.erkennung"
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
        "wert": "Zwölf Teile verzinken, gelb passiviert."
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "12",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-13",
    "titel": "„ein paar Teile“ → keine Menge, Prüfliste „Menge eintragen“",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.runde53"
    ],
    "deckt": [
      "eingang.erkennung"
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
        "wert": "Ein paar Teile verzinken."
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Menge eintragen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-14",
    "titel": "Wunschdatum im Satz statt Mail-Datum",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.runde53"
    ],
    "deckt": [
      "eingang.erkennung"
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
        "wert": "Mail vom 01.11.: Brauche die Teile bis Mittwoch."
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Mi",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "RT04-15",
    "titel": "Mehr als 20 Positionen → Hinweis und zweiter Beleg",
    "paket": "AP-EIN",
    "quelle": [
      "eingang.erkennung.runde53"
    ],
    "deckt": [
      "eingang.erkennung"
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
        "wert": "{text_mit_23_positionen}"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "text": "Rest als zweiten Beleg anlegen",
          "erwartung": "sichtbar"
        }
      ]
    }
  }
] as unknown as FlowCase[];

test.describe("BAUPLAN Wege · eingang", () => {
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
