# TA-B2j · P59-Freigabe für Eingang und Folgewege

Basis `origin/main` `27c3435474e5cec4d1241bf75a646a895edc1e91`. Dieser Anker enthält ausschließlich Scope-Checker, dessen Tests, den Ankerbeleg und diese Abgabe; keine Produktänderung und keine Migration.

P59 erlaubt die inventarisierten Modul- und Routenpfade für Eingang, Nachrichten, Kunden, Aufträge, Werkstatt und KV sowie die gemeldeten Original- und Belegleser. Die Scope-Probe des bestehenden Teil-6-Kandidaten `12b34247feb69e16ebea6c2f85eeaa4018926d1a` ist bestanden. Der breitere Pfadbereich gibt künftigen Änderungen mehr Spielraum; Paketumfang und fachliche Prüfung bleiben erforderlich.

Für `ein0` bis `ein6` gibt es keine Anzahlgrenze für neue, regelkonform benannte Migrationen. Bereits vorhandene Migrationen bleiben gegen Änderungen gesperrt; die Grenzen für andere Migrationsfamilien bleiben bestehen. Tests prüfen freigegebene und gesperrte Pfade, mehrere neue Migrationen, Änderungen bestehender Migrationen und ungültige Namen. Keine anderen Gates oder Workflows geändert.

Für den nach Teil 6 vorgesehenen separaten KV-Schritt erlaubt der Branchfilter zusätzlich genau `kreile/b2-ein-2b`; benachbarte Branchnamen bleiben gesperrt.

P61 ergänzt genau `src/components/start/StartScreenClient.tsx` für die produktseitige Hydrationssperre beim Login; benachbarte Start-Dateien bleiben außerhalb des Scopes. Authentifizierung, Sitzungen und Rechte werden dadurch nicht freigegeben oder verändert.

DB-Soll: keine Datenänderung. CI und Prüfnachweise des konkreten PR-Kopfes stehen im NACHTLAUF Abschnitt C. Kein Merge und kein Produktions-Deploy durch Codex.
