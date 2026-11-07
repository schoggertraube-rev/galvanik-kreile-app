# Review Q09 – Kleine Sackgassen

Geprüft: 27.10.2026 13:36 UTC · Branch kreile/s1-p2-eingang · Commit 5aece709 (Abgabe nennt Produkt-SHA bcca55f2)

Urteil: **PASS**

Geprüft:
- "Ware raus": OrdersAppAdapter übernimmt ?station=fertig|galvanik|angenommen (Whitelist).
- "Kunde anlegen": requestGlobalCreate("CUSTOMER") -> bestehendes Neukundenformular (ein Schreibweg).
- Stufen-Schalter: Reiter ausgeblendet, serverseitige Feature-Wahrheit bleibt (keine Daten gelöscht).
- "Systemadministrator informieren": sichtbare Rückmeldung bei Erfolg/Fehler, Doppelklick gesperrt; SQL ui_events pin_reset_requested belegt.
- MockAppFrame + SalesStageFeatureContext + Mock-Test entfernt (370 Zeilen toter Code) – passt zu "keine Demo-Daten im Produktpfad".
- Gregor sieht alles: per Preview-Klicktest belegt (keine Codeänderung nötig).
- Keine verbotenen Pfade, keine Hex-Farben, keine Migration.

Nächster Schritt: Q10 Gesamtklicktest Q1–Q9, danach Merge-Anfrage.
