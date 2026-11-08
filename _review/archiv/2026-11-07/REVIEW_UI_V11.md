# Review Paket I · Oberfläche V1.1 (Claude, 27.10.2026 03:27 Berlin)

Geprüft: `docs/delivery/ABGABE_UI_V11.md` (0d8dc2a9), Produkt-SHA 417438c6, Branch kreile/s1-p2-eingang, PR #154.
Grundlage: Paar-Seite `output/v11-paare/` (33/33 Paare, 03:10–03:12 Berlin), Code am SHA, Supabase-Migrationsliste.

## Urteil: FAIL – 1 Blocker (alles andere bestanden)

Sichtvergleich Paar-Seite (Desktop 1914 geprüft, Handy Stichprobe):
- Shell + Globales Plus, Der Tag, Neuer Eingang (frisch / Neukunde / Kunde mit Lücke), Kundenkarte, Kunden: Aufbau, Bauteile und Farben entsprechen V1.1. Hauptfläche neutral hell (≈ #F4F2EE), Karten weiß, Navy-Seitenleiste, Plus im Kopf. Abweichungen nur Daten (echte statt Demo) → kein Blocker.
- Neuer Eingang: Art Auftrag|KV oben, Kunde-Auswahl mit „Neukunde anlegen“, ein Namensfeld, bei Kunde mit Lücke nur fehlende Felder + Hinweis. H.1–H.5 erfüllt.
- Verbotene Dateien: keine. Neue Hex-Farben in src: keine. DB synchron (siehe STAND).

## Blocker

1. **Auftragskarte: Aktionsleiste und Bearbeiten fehlen** (AKTUELLE_ANWEISUNG B, OWNER_ENTSCHEIDUNGEN Nr. 3; Paar `auftragskarte-*`).
   Datei `src/modules/orders/ui/OrderCardView.tsx`, Z. 151–156 (`quickActions`) und Z. 190/194 (Teile, Notiz).
   Ist: rechte Spalte zeigt nur den Stationsknopf (z. B. „Galvanik“); keine Status-Mail, kein Anrufen, kein Foto, kein „Mehr“; Positionen und Notiz nur lesbar (kein „Teil hinzufügen“, kein Stift je Position, Notiz nicht editierbar).
   Änderung: `quickActions` immer um **Status-Mail** (vorhandener Mailweg, sonst ehrlich deaktiviert mit Grund), **Anrufen** (`tel:` Kundentelefon), **Foto** (vorhandener Beleg-/Foto-Upload) und **Mehr** (KV, Duplizieren, Dokument) ergänzen – wie `Schnellaktionen als="raster"` im Prototyp. Je Teil Knöpfe Foto · fertig · Stift (Bauteil `Teil`), „Teil hinzufügen“ im Block Teile, Notiz über bestehenden Schreibweg bearbeitbar. Rechte-Prüfung über die vorhandenen `actions`.
   Nachweis: Paar `auftragskarte-*` neu erzeugen.

Keine weiteren Blocker. Eine Korrekturrunde: nur Punkt 1, danach PASS-Prüfung nur dieses Punkts.

## Nicht-Blocker → DEZEMBER_LISTE
- Ladezeit am neuen SHA nicht neu gemessen (Abgabe sagt das offen).
- Neuer Eingang Neukunde: Feldreihenfolge weicht vom Prototyp ab (App: Ansprechpartner/Telefon vor Anschrift; Prototyp: Anschrift vor Telefon).
- Paar-Seite nur lokal; für Owner-Sicht nicht direkt erreichbar.


---

# Zweite Prüfung (Claude, 27.10.2026 06:28 Berlin) — nur Blocker 1

Geprüft: ABGABE_UI_V11 (f4c51dcd), Produkt-SHA 263aa72b, Preview https://galvanik-kreile-werkstatt-csquq7hyq.vercel.app, PR #154.

## Urteil: PASS

Blocker 1 behoben (Code am SHA, `OrderCardView.tsx` + `OrderCardAppAdapter.tsx` + neuer `orderContentCommand.ts`):
- Schnellaktionen immer: Status-Mail (springt zum Kommunikationsbereich), Anrufen (`tel:` Kundentelefon, sonst ehrlich deaktiviert mit Grund), Foto + (Rollenprüfung, Grund bei fehlendem Recht), Mehr (KV anlegen, Duplizieren, Dokument hinzufügen).
- Je Teil: Foto, fertig/wieder öffnen (Recht `perm_op_status`), Stift → Dialog „Teil bearbeiten“; „Teil hinzufügen“ im Block Teile (max. 20); Notiz über Dialog bearbeitbar.
- Schreibweg: Recht `perm_data_orders`, alle Abfragen tenant-gebunden, Versionsprüfung, Ereignis `ORDER_CONTENT_CHANGED_V1` / `ORDER_ITEM_FINISHED_CHANGED_V1`, idempotent über clientEventId, kein DELETE von Positionen, abgeschlossene Aufträge gesperrt.
- Verbotene Dateien: keine. Neue Hex-Farben: keine. Keine neue Migration; DB 36 synchron.
- Eine Korrekturrunde eingehalten (8f883513 → 263aa72b → Abgabe f4c51dcd, 12 min).
