# F0_STORAGE_CONTRACT (Neufassung 2026-08-10, BF-005/007)

Fruehere Fassung (behauptete fehlende Limits; Encoding-Schaeden) vollstaendig ersetzt.

## Ist-Vertrag (live, Prod)
- 4 Buckets, alle `public=false`.
- `item-photos`: 12 MiB, MIME jpeg/png/webp. `buchhaltung-belege`: 5 MiB, MIME pdf/png/jpeg.
- Zugriff app-seitig ausschliesslich service_role + kurzlebige Signed URLs; keine oeffentlichen Kundendateien.
- Policies (scan_objects_* u.a.) prod-verifiziert; Bestand als CI-Inventar (Sektion F) gesichert.

## Beweis der Objekt-Autorisierung (nicht nur Inventar)
CI-Gate `f0-storage-http-tests.mjs` gegen die echte Storage-HTTP-API (lokale Replay-Instanz):
S1 eigener Upload (service_role) 200 · S2 Signed-URL eigenes Objekt 200 · S3 anon-GET deny ·
S4 anon-Upload deny · S5 fremder Objektpfad deny · S6 bucketuebergreifend deny ·
S7 falscher MIME 415 · S8 Groessenueberschreitung 413 · S9 Signed-URL abgelaufen deny ·
S10 Signed-URL manipuliert deny · S11 Signed-URL fremder Pfad deny · S12 deterministisches
Cleanup mit Loesch-Verifikation. Stand PR #57: alle PASS.

## Offen (deklariert)
- Prod-seitige Objekt-Angriffstests werden bewusst nicht gegen Production gefahren (nur lokale
  Replay-Instanz); Konfigurations-Paritaet Prod↔Replay ist ueber Fingerprint/Inventar gesichert.
- belege-ANZEIGE-Pfad auf Signed URLs (App-UI-Follow-up, Produktscope).
