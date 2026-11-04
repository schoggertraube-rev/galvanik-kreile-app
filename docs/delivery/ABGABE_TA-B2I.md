# TA-B2i · Enge P55-Freigabe

Basis `origin/main` `7c475a72a582b412a95d73224e5a94581aa7b377`; Auftrag NACHTLAUF P55. Dieser Anker enthält ausschließlich Scope-Checker, dessen Tests, den Ankerbeleg und diese Abgabe. Er enthält keinen Produktcode, keine Migration und keine neue Laufzeitabhängigkeit.

Der Produkt-Scope erlaubt je eine zusätzliche Migration genau für `*_ein2_fotoart.sql` und `*_ein4_rechte.sql`, insgesamt höchstens zwei Dateien im jeweiligen Teil. Weitere zweite oder dritte Migrationen bleiben gesperrt. `package.json` und `package-lock.json` sind nur gemeinsam für die exakt gepinnte Laufzeitabhängigkeit `fast-xml-parser` und deren tatsächlich auflösbare Abhängigkeitskette zulässig; Änderungen an sonstigen Manifestinhalten und fremden Lockfile-Paketen sind gesperrt.

Der vollständige bestehende Teil-6-Kandidat `984a6caa64a84a89d38317db1deb50faf84a57dd` besteht mit diesem Checker die Scope-Probe. Die zusätzliche Fotoart-Migration ist noch nicht gebaut; die erlaubten und abgelehnten Namens-/Anzahlkombinationen sowie Manifeständerungen werden im bestehenden Scope-Test geprüft. Keine anderen Gates, Workflows oder Produktdateien werden geändert.

P56 erlaubt zusätzlich exakt `src/app/actions/start.actions.ts` und `src/app/actions/__tests__/publicStartActions.test.ts` für den zuvor vorgelegten PIN-Reset-Fix. Der Fix selbst ist nicht Bestandteil dieses Ankers; HMAC, Tenant, Rollenfilter, Drossel und Antwort bleiben laut P56 unverändert.

DB-Soll: keine Datenänderung. Kein Produktions-Deploy oder Merge durch Codex. CI und alle Job-Schritte sowie der konkrete PR-Kopf werden nach Push im NACHTLAUF Abschnitt C belegt; Volltests laufen gemäß Owner-Freigabe in CI.
