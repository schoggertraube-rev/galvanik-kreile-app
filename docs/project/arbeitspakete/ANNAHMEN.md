# Annahmen des Planungschats – Bestätigung durch den Endversion-Chat

Je Zeile: ID · Paket · Annahme · BAUPLAN-Bezug · Status (offen / bestätigt / korrigiert: …).
Ein Paket mit offener Annahme ist nicht abnahmefähig.

| ID | Paket | Annahme | BAUPLAN-Bezug | Status |
|---|---|---|---|---|
| A-01 | AP-01 | ~~`intake_item` vorhanden, keine Migration~~ -> KORRIGIERT 31.10. per DB-Abgleich: keine Spec-Tabelle existiert; AP-01 legt `intake_item`+`intake_event` neu an (additiv, RLS). Rest des Datenmodells in Folgepaketen | eingang.daten | korrigiert (Planungschat) |
| A-02 | AP-01 | Rechte: reiner Auftrag = Bereich `eingang`; KV zusaetzlich `geld` | eingang.befehle[eingang.notiz/eingang.anlegen] | belegt aus Spec (Planungschat) |
| A-03 | AP-01 | Schnitt: Bestandskunde zuerst; Neukunde=AP-02, Ware=AP-03 | WIE-Entscheidung Planungschat (U-218) | entschieden (Endversion-Chat darf bis Baubeginn widersprechen) |
