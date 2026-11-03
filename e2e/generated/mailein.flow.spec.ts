// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
import { test } from "@playwright/test";
import expectedRed from "./_erwartet_rot.json";
import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";

const cases = [
  {
    "id": "M01",
    "titel": "Eindeutiger Vorschlag: Fakten mit Vorschlag, „Kunde zuordnen“, kein „Neukunde aus Absender“; Hauptknopf öffnet 3 mit Text und vorgeschlagenem Kunden",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].inhalt[0]",
      "screens[mailein].aktionen",
      "screens[mailein].abnahme[0]",
      "screens[mailein].abnahme[1]"
    ],
    "deckt": [
      "mailein.neuer-eingang-aus-mail"
    ],
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
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "mailein"
          },
          {
            "text": "{kunde_vollstaendig_firma.name}",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.kunde-zuordnen",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.neuer-eingang-aus-mail",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.neukunde-aus-absender",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.als-lieferant",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.zustand.teilweise",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "mailein.neuer-eingang-aus-mail",
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
          "erwartung": "nicht_leer"
        },
        {
          "id": "eingang.kundenzeile",
          "erwartung": "text_enthaelt",
          "wert": "{kunde_vollstaendig_firma.name}"
        }
      ]
    }
  },
  {
    "id": "M02",
    "titel": "„Kunde zuordnen“ → Zustand erfolg „Abgelegt bei …“ mit Weiter, Kundenkarte, Fertig; Eingang am Kunden",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].aktionen[kunde-zuordnen]",
      "screens[mailein].zustaende.erfolg",
      "screens[mailein].regeln[5]",
      "screens[mailein].abnahme[4]"
    ],
    "deckt": [
      "mailein.kunde-zuordnen",
      "mailein.fertig",
      "zustand.erfolg"
    ],
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
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "mailein.kunde-zuordnen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "mailein.zustand.erfolg",
            "erwartung": "text_enthaelt",
            "wert": "Abgelegt bei {kunde_vollstaendig_firma.name}"
          },
          {
            "id": "mailein.weiter",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.kundenkarte-oeffnen",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.fertig",
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
              "zuordnung": "bestaetigt",
              "kunde_id": "{kunde_vollstaendig_firma}"
            }
          }
        ]
      },
      {
        "id": "mailein.fertig",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
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
            "kunde_id": "{kunde_vollstaendig_firma}",
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "M03",
    "titel": "Unbekannter Absender: Zustand teilweise; „Kunde suchen“, Treffer wählen → erfolg, Zuordnung hand",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].zustaende.teilweise",
      "screens[mailein].zustaende.kundesuche",
      "screens[mailein].inhalt[2]",
      "screens[mailein].abnahme[3]"
    ],
    "deckt": [
      "mailein.kunde-suchen",
      "mailein.kunde-waehlen",
      "zustand.teilweise",
      "zustand.kundesuche"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_unbekannt"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_unbekannt}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "mailein.zustand.teilweise",
            "erwartung": "text_enthaelt",
            "wert": "Kein eindeutiger Vorschlag"
          },
          {
            "id": "mailein.neukunde-aus-absender",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.kunde-suchen",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.kunde-zuordnen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "mailein.kunde-suchen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "mailein.zustand.kundesuche",
            "erwartung": "sichtbar"
          }
        ]
      },
      {
        "id": "mailein.kunde-suche",
        "aktion": "tippen",
        "wert": "Prueffirma Alpha"
      },
      {
        "id": "mailein.kunde-waehlen",
        "aktion": "klicken",
        "nr": 1
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein.zustand.erfolg",
          "erwartung": "text_enthaelt",
          "wert": "Abgelegt bei {kunde_vollstaendig_firma.name}"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_unbekannt}"
          },
          "werte": {
            "zuordnung": "hand",
            "kunde_id": "{kunde_vollstaendig_firma}"
          }
        }
      ]
    }
  },
  {
    "id": "M04",
    "titel": "„Neukunde aus Absender“ ersetzt 3.4 durch 3.1; Abbrechen ohne Änderung → beide zu, Eingang bleibt offen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].aktionen[neukunde-aus-absender]",
      "screens[mailein].abnahme[17]",
      "verhalten_appweit.rueckfrage.ebenen"
    ],
    "deckt": [
      "mailein.neukunde-aus-absender"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "eingang_mail_unbekannt"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_unbekannt}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "mailein.neukunde-aus-absender",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "kundeneu"
          },
          {
            "id": "mailein",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
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
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_unbekannt}"
          },
          "werte": {
            "zuordnung": "offen",
            "kunde_id": null
          }
        },
        {
          "tabelle": "customers",
          "neu": 0
        }
      ]
    },
    "notiz": "Vorbelegung aus Absender/Signatur ist keine Änderung (verhalten_appweit.rueckfrage.ebenen) – daher keine Rückfrage."
  },
  {
    "id": "M05",
    "titel": "„Kein Geschäftsvorgang“ › „Werbung / Spam“: Toast, Einsatz erledigt, Zuordnung hand ohne Ziel",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].zustaende.kein",
      "screens[mailein].regeln[8]",
      "eingang.befehle[eingang.kein_vorgang]"
    ],
    "deckt": [
      "mailein.nicht-zuordnen",
      "mailein.kein-werbung",
      "zustand.kein"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "eingang_mail_unbekannt"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_unbekannt}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "mailein.nicht-zuordnen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "mailein.zustand.kein",
            "erwartung": "text_enthaelt",
            "wert": "Kein Geschäftsvorgang"
          }
        ]
      },
      {
        "id": "mailein.kein-werbung",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kein Geschäftsvorgang · Werbung"
        },
        {
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_unbekannt}"
          },
          "werte": {
            "einsatz": "erledigt",
            "zuordnung": "hand",
            "kunde_id": null
          }
        }
      ]
    }
  },
  {
    "id": "M06",
    "titel": "Ohne „kunden“ und „auftraege“: nur „Später · fürs Büro“ → Toast „Gespeichert · Büro ordnet zu“",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].aktionen[spaeter]",
      "screens[mailein].regeln[3]",
      "screens[mailein].abnahme[8]"
    ],
    "deckt": [
      "mailein.spaeter"
    ],
    "gegeben": {
      "login": "login_nur_eingang",
      "datenlagen": [
        "eingang_foto_offen"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_foto_offen}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "mailein.spaeter",
            "erwartung": "text",
            "wert": "Später · fürs Büro"
          },
          {
            "id": "mailein.kunde-zuordnen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.auftrag-zuordnen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.kunde-suchen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.neukunde-aus-absender",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.nicht-zuordnen",
            "erwartung": "nicht_sichtbar"
          },
          {
            "id": "mailein.teilen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "mailein.spaeter",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Gespeichert · Büro ordnet zu"
        },
        {
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_foto_offen}"
          },
          "werte": {
            "zuordnung": "offen",
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "M07",
    "titel": "Login ohne „mails“: Mail-Inhalt „nur fürs Büro“, kein „Kein Geschäftsvorgang“, Kunde zuordnen bleibt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].inhalt[0].ableitung.quelle",
      "screens[mailein].regeln[3]",
      "screens[mailein].abnahme[7]"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_werkstatt",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_bekannt"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_bekannt}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "mailein"
        },
        {
          "text": "Mail · Inhalt nur fürs Büro",
          "erwartung": "sichtbar"
        },
        {
          "id": "mailein.nicht-zuordnen",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "mailein.kunde-zuordnen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "M08a",
    "titel": "× schließt 3.4 ohne Änderung; Eingang bleibt offen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].regeln[5]",
      "verhalten_appweit.tastatur"
    ],
    "deckt": [
      "mailein.schliessen"
    ],
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
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "mailein.schliessen",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
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
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "M08b",
    "titel": "Esc schließt 3.4 ohne Änderung; Eingang bleibt offen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].regeln[5]",
      "verhalten_appweit.tastatur"
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
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
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
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "entwurf",
          "erwartung": "nicht_sichtbar"
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
            "einsatz": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "M09",
    "titel": "Mail nicht ladbar: Zustand fehler „Postfach nicht erreichbar“ mit „Erneut“ (ohne „Anbindungen“ ohne Recht wartung); „Erneut“ lädt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].zustaende.fehler",
      "screens[mailein].regeln[10]",
      "screens[mailein].abnahme[16]"
    ],
    "deckt": [
      "mailein.erneut",
      "zustand.fehler"
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
        "aktion": "netz_laden",
        "wert": "nächster Ladeaufruf"
      },
      {
        "aktion": "oeffne",
        "wert": "mailein",
        "arg": "{eingang_mail_bekannt}"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "mailein"
          },
          {
            "id": "mailein.zustand.fehler",
            "erwartung": "text_enthaelt",
            "wert": "Postfach nicht erreichbar"
          },
          {
            "id": "mailein.erneut",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.anbindungen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "mailein.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein.zustand.fehler",
          "erwartung": "nicht_sichtbar"
        },
        {
          "text": "{kunde_vollstaendig_firma.name}",
          "erwartung": "sichtbar"
        },
        {
          "id": "mailein.kunde-zuordnen",
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
            "zuordnung": "offen"
          }
        }
      ]
    }
  },
  {
    "id": "M10",
    "titel": "Doppelklick „Kunde zuordnen“: idempotent – Erfolgsanzeige, kein „schon zugeordnet“, eine Zuordnung",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].regeln (Runde 40)",
      "screens[mailein].zustaende.schon_zugeordnet.wann"
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
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "id": "mailein.kunde-zuordnen",
        "aktion": "doppelklicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein.zustand.erfolg",
          "erwartung": "text_enthaelt",
          "wert": "Abgelegt bei {kunde_vollstaendig_firma.name}"
        },
        {
          "id": "mailein.zustand.schon_zugeordnet",
          "erwartung": "nicht_sichtbar"
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
    "id": "M11",
    "titel": "3.4 mit schon zugeordnetem Eingang: Zustand schon_zugeordnet „Mail ist schon zugeordnet · …“ nur mit „Fertig“, nichts geändert",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].zustaende.schon_zugeordnet",
      "screens[mailein].regeln[4]"
    ],
    "deckt": [
      "zustand.schon_zugeordnet"
    ],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "kunde_vollstaendig_firma",
        "eingang_mail_lesen"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_lesen}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "id": "mailein.zustand.schon_zugeordnet",
            "erwartung": "text_enthaelt",
            "wert": "Mail ist schon zugeordnet"
          },
          {
            "id": "mailein.fertig",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.kunde-zuordnen",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "mailein.fertig",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
        }
      ],
      "db": [
        {
          "tabelle": "intake_item",
          "wo": {
            "id": "{eingang_mail_lesen}"
          },
          "werte": {
            "zuordnung": "automatisch",
            "kunde_id": "{kunde_vollstaendig_firma}",
            "einsatz": "offen"
          }
        }
      ]
    },
    "notiz": "Zwei Logins gleichzeitig braucht der Harness nicht: der zweite Login trifft denselben DB-Stand wie dieser Aufruf (Eingang schon zugeordnet)."
  },
  {
    "id": "M12",
    "titel": "Modus kein aus M6 bei zugeordneter Nachricht: direkt „Kein Geschäftsvorgang · Grund“, „Privat“ → Toast, erledigt",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].regeln (Runde 40)",
      "screens[anliegenwahl].abnahme[2]",
      "eingang.befehle[eingang.kein_vorgang]"
    ],
    "deckt": [
      "mailein.kein-privat",
      "zustand.kein"
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
        "id": "nachrichten.anliegen-waehlen",
        "aktion": "klicken",
        "nr": 1
      },
      {
        "id": "anliegenwahl.kein",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "mailein"
          },
          {
            "id": "mailein.zustand.kein",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.zustand.schon_zugeordnet",
            "erwartung": "nicht_sichtbar"
          }
        ]
      },
      {
        "id": "mailein.kein-privat",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "toast": "Kein Geschäftsvorgang · privat"
        },
        {
          "id": "mailein",
          "erwartung": "nicht_sichtbar"
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
            "zuordnung": "hand",
            "kunde_id": null
          }
        }
      ]
    }
  },
  {
    "id": "M13",
    "titel": "AP-EIN ohne Picker: „Auftrag zuordnen“ und „Teilen“ ausgeblendet – auch mit zwei offenen Anliegen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].regeln (Runde 41)",
      "paket.eingriffe_ausserhalb"
    ],
    "deckt": [],
    "gegeben": {
      "login": "login_meister",
      "datenlagen": [
        "eingang_mail_zwei_anliegen"
      ],
      "aufruf": {
        "seite": "mailein",
        "arg": "{eingang_mail_zwei_anliegen}",
        "weg": "oeffne",
        "quelle": "screens[mailein].regeln[0] (Einstiege 3.0, Nachrichten, Der Tag, 3.9)"
      },
      "geraet": "desktop"
    },
    "wenn": [],
    "dann": {
      "anzeige": [
        {
          "oben": "mailein"
        },
        {
          "id": "mailein.auftrag-zuordnen",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "mailein.teilen",
          "erwartung": "nicht_sichtbar"
        },
        {
          "id": "mailein.kunde-suchen",
          "erwartung": "sichtbar"
        }
      ]
    }
  },
  {
    "id": "M14",
    "titel": "Netzfehler beim „Kunde zuordnen“: 3.4 bleibt offen mit „Erneut“, Eingang unverändert; „Erneut“ wiederholt das Zuordnen",
    "paket": "AP-EIN",
    "quelle": [
      "screens[mailein].regeln (Runde 42)",
      "verhalten_appweit.speichern"
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
        "aktion": "netz_unterbrechen",
        "wert": "nächster Serveraufruf"
      },
      {
        "id": "mailein.kunde-zuordnen",
        "aktion": "klicken"
      },
      {
        "aktion": "erwarten",
        "anzeige": [
          {
            "oben": "mailein"
          },
          {
            "id": "mailein.erneut",
            "erwartung": "sichtbar"
          },
          {
            "id": "mailein.zustand.erfolg",
            "erwartung": "nicht_sichtbar"
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
        "id": "mailein.erneut",
        "aktion": "klicken"
      }
    ],
    "dann": {
      "anzeige": [
        {
          "id": "mailein.zustand.erfolg",
          "erwartung": "text_enthaelt",
          "wert": "Abgelegt bei {kunde_vollstaendig_firma.name}"
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
  }
] as unknown as FlowCase[];

test.beforeEach(async () => { await prepareGeneratedSeed(); });

test.describe("BAUPLAN Wege · mailein", () => {
  for (const flowCase of cases) {
    const packageTag = flowCase.paket ? `@${flowCase.paket}` : "@UNASSIGNED";
    test(`${flowCase.id || "OFFEN"} ${packageTag} · ${flowCase.titel || "noch nicht beschrieben"}`, async ({ page }) => {
      const red = expectedRed[flowCase.id as keyof typeof expectedRed];
      test.fail(Boolean(red), red ? `${red.paket}: ${red.grund}` : undefined);
      await runGeneratedFlowCase(page, flowCase);
    });
  }
});
