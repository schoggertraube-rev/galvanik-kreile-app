---
name: open-q-g04-008-manifest-ownership
description: Manifest-Tabellenbesitz von G04 (orders/items/events) ist per Q-G04-008 an PL/Architektur gebunden, nicht vom Writer entscheidbar
metadata:
  type: project
---

Der formale Tabellen-/Event-Besitz im `orders`-Manifest ist durch **Q-G04-008** (`_MODULDOSSIERS/G04_AUFTRAEGE/08_OFFENE_FRAGEN.md`) an PL/Architektur gebunden, Status "OFFEN – abgesichert". Optionen: A = G04 besitzt `orders/items/events` vollstaendig, B = gemeinsame Persistenz bleibt Hostbesitz, C = gemischter Besitz.

**Why:** Die Schreibwege (`src/lib/server/commands/*`) entstanden vor der Modulschicht und liegen ausserhalb `src/modules/orders/`. `public.events` wird faktisch auch von Zahlungs-/Rechnungs-Commands beschrieben (`confirmPaymentCommand.ts`, `immutableInvoiceCommand.ts`, `recordGoodsOutCommand.ts`) — ein Alleinbesitz-Eintrag waere unwahr.

**How to apply:** Reviewer-Forderungen "Manifest vollstaendig deklarieren" nicht blind als Writer-Fix umsetzen. `public.orders` ist deklarierbar (Dossier §4 nennt G04 als Besitzer jedes orders-Feldes, kein konkurrierendes Manifest). `public.events` NICHT als `ownsTables`, nur `events.consumes`. Die saubere Loesung (Cross-Modul-Fakten nur ueber `public.v_*`) braucht eine Migration und damit Freigabe. Siehe [[reference-g04-dossier]].
