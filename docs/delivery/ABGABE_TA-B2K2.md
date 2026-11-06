# TA-B2k2 · Runde-53-Bindung, Folgepfade und CI-Durchsatz

Anker auf Branch codex/ta-b2k2, gebunden an den verifizierten Owner-Merge von #180.

Die aktuelle Basis `4593e8f6eaa3215033898a53d4168581b5bfc4c8` ist der verifizierte Main-Merge von #180. Basis-Pin, Beleg und Scope-Test sind auf genau diesen Main-SHA fortgeschrieben.

Gebunden werden:

- BAUPLAN Runde 53: 9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA
- UI-Bündel, Sichtvertrag und Prüfsicht aus docs/project/endversion/ui/, mit dem gebundenen Referenz-Pointer 12288CE7AD6F707BA2D4942843BCBE45DC0351FCB6092281FE640B860417BF7F
- erzeugte Wegefälle aus e2e/generated/
- freigegebene Folgebranch-Muster kreile/b2-ein-* und kreile/b3-*
- der additive AP-ABS-Migrationspfad supabase/migrations/*_abs_*.sql sowie der lesende Vertrag effectiveCustomerAgreementRead
- alle 162 im Sichtvertrag gebundenen Referenzbilder (45 zuvor nur lokal vorhandene, unveränderte Bilder ergänzt)
- CI ohne Doppel- und Hängeläufe: Branch-Pushes laufen nur über Pull Requests, veraltete Läufe werden abgebrochen, Playwright-Browser werden versioniert gecacht und der Installationsschritt erhält genau einen Wiederholungsversuch
- Scope-Schutzliste: Produktpfade auf kreile/* und codex/* sind frei; nur Steuerung, Bauplan, Baseline und vorhandene Migrationen bleiben gesperrt

Der Scope-Selbsttest weist ausschließlich Steuerungspfad, Bauplan, Baseline und geänderte Bestandsmigration zurück. Der ausführbare Sichtprüfer wird gelintet; die übrigen bytegebundenen UI-Referenzen bleiben unverändert ignoriert. Die Lint-Baseline wird ausschließlich als geprüfte Vertragsmigration fortgeschrieben: keine Regel, Fehlerzahl oder Ausnahme wurde gelockert.

Lokaler Replay-Nachweis: Der vollständige generierte Replay-Lauf lief nach Wiederherstellung von DB, API und Storage lokal. Ausschließlich die neuen R53-Textfälle `RT04-12`, `RT04-13` und `RT04-15` wurden gemäß P84 mechanisch mit `R53-Angleich` in die Rot-Liste aufgenommen; ihr gezielter Replay-Lauf ist danach 3/3 grün. Weitere nicht zum Anker gehörende Produktfälle wurden weder umklassifiziert noch verändert.

DB-Soll: keine Datenänderung im Anker. Kein Merge und kein Production-Deploy durch Codex.
