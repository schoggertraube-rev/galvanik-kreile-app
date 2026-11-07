# Quellen-Neuordnung #189

Einmaliger Governance-Anker auf `codex/bauregeln-neustart`, Basis `d447404c84dc8f3be729d19530d8e66f1d5097c8`. Kein Produktcode und keine Migration.

Aktive Steuerung: genau BAUREGELN, WARTESCHLANGE und SEITENHOHEIT unter `_review/`. AGENTS verweist darauf. Die frühere Warteschlange und die drei alten Klärungseinstiege liegen im gelieferten Archiv; kein ausführbarer Alt-Stummel bleibt.

PL-Freigabe vom 07.11. 20:05: Planungsablage `archiv/`, `lieferung_*/`, `quellen/`, `pakete/` mitnehmen, BAULOG auslassen. Mitgelieferte Vorschauen sind noch keine Freigabe für neue Produktoberflächen. Arbeitskopien unter `docs/project/endversion/` wurden nicht übernommen.

Authority-Checker und Schema binden die drei Quellen; beide SHA-Pins wurden passend aktualisiert. Die Scope-Ausnahme gilt nur für diesen Branch und die genaue Basis sowie denselben einmaligen Main-Merge. Negative Tests verweigern Produktpfade, andere Workflows, BAULOG, andere Basis und spätere Änderungen am neu aufgenommenen Archiv. Für alle normalen Produkt-PRs bleibt der bisherige Quellenschutz unverändert.

Sechs namentlich aufgeführte Archiv-/Quellen-Dateien enthalten schon in der PL-Lieferung Leerraum. Ausschließlich diese Dateien behalten ihre Bytes durch `-text -whitespace` in `.gitattributes`; keine Regel für Produktcode, keine globale Ausnahme. Die Planungsdateien selbst wurden nicht umgeschrieben.

Lokale Nachweise: drei neue Scope-Fälle bestanden; `git diff --check origin/main` leer. Vollständiger Authority-Selbsttest ist lokal durch 33 ungebundene fremde Referenzbilder im aktiven Arbeitsbaum blockiert (`DESIGN_POINTER_PAGE_BINDING`); nichts wurde entfernt oder als gültig umgedeutet. CI prüft den Git-Kandidaten mit den 162 gebundenen Bildern. Keine lokale Gesamtsuite gemäß BAUREGELN.

Vor Merge: CI und Planungschat prüfen den exakten Kandidaten. Erwarteter einmaliger Ratchet-Bootstrap: geschützte Main-Basis hat die vorigen Authority-Bytes und meldet `Authority checker hash mismatch`. Keine Lintregel, Fehlerzahl oder sonstige Baseline wurde gelockert. Nach Owner-Merge muss Main vollständig grün sein. Owner merged; Codex führt keinen Merge oder Production-Deploy aus.
