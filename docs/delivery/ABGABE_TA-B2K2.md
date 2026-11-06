# TA-B2k2 · Runde-53-Bindung und AP-ABS-Pfade

Anker auf Branch codex/ta-b2k2, gebunden an den verifizierten Owner-Merge von #180.

Die aktuelle Basis `4593e8f6eaa3215033898a53d4168581b5bfc4c8` ist der verifizierte Main-Merge von #180. Basis-Pin, Beleg und Scope-Test sind auf genau diesen Main-SHA fortgeschrieben.

Gebunden werden:

- BAUPLAN Runde 53: 9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA
- UI-Bündel, Sichtvertrag und Prüfsicht aus docs/project/endversion/ui/, mit dem gebundenen Referenz-Pointer 12288CE7AD6F707BA2D4942843BCBE45DC0351FCB6092281FE640B860417BF7F
- erzeugte Wegefälle aus e2e/generated/
- freigegebene Folgebranch-Muster kreile/b2-ein-* und kreile/b3-*
- der additive AP-ABS-Migrationspfad supabase/migrations/*_abs_*.sql sowie der lesende Vertrag effectiveCustomerAgreementRead

Der Scope-Selbsttest weist eine Nachbar-Datei außerhalb der Inventur weiterhin zurück. Die Lint-Baseline wird ausschließlich als geprüfte Vertragsmigration fortgeschrieben: keine Regel, Fehlerzahl oder Ausnahme wurde gelockert.

DB-Soll: keine Datenänderung im Anker. Kein Merge und kein Production-Deploy durch Codex.
