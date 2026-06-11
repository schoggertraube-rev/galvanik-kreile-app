"use server"

import { createClient } from '@/utils/supabase/server';
import { getKostensatz, getEinkaufspreis } from '@/lib/erfassung/snapshot';

export async function startZeit(input: {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
}) {
  const supabase = await createClient();

  // 1. Check existing timer
  const { data: existing } = await supabase
    .from('arbeitszeit_buchung')
    .select('id')
    .eq('employee_id', input.employee_id)
    .is('end_zeit', null)
    .maybeSingle();

  if (existing) {
    return { error: 'Laufender Timer existiert bereits' };
  }

  // 2. Get kostensatz
  const { kostensatz } = await getKostensatz(supabase, input.employee_id, input.station_kuerzel, 'galvanik-kreile');

  if (kostensatz === null) {
    return {
      error: 'Kostensatz fehlt',
      hinweis: 'Bitte Inhaber: Kostensatz für Mitarbeiter oder Station hinterlegen'
    };
  }

  // 3. Insert
  const { data: buchung, error } = await supabase
    .from('arbeitszeit_buchung')
    .insert({
      tenant_id: 'galvanik-kreile',
      auftrag_id: input.auftrag_id,
      employee_id: input.employee_id,
      kostenstelle_kuerzel: input.station_kuerzel,
      station_kuerzel: input.station_kuerzel,
      start_zeit: new Date().toISOString(),
      dauer_minuten: 0,
      kostensatz_eur_pro_stunde: kostensatz,
      erfasst_modus: 'live_timer'
    })
    .select('id, start_zeit')
    .single();

  if (error) {
    return { error: 'Fehler beim Starten des Timers: ' + error.message };
  }

  // 4. Audit Log
  await supabase.from('audit_log').insert({
    action: 'timer_start',
    table_name: 'arbeitszeit_buchung',
    record_id: buchung.id,
    actor_id: input.employee_id,
    payload: { auftrag_id: input.auftrag_id, station_kuerzel: input.station_kuerzel }
  });

  return { success: true, buchung_id: buchung.id, start_zeit: buchung.start_zeit };
}

export async function stopZeit(input: {
  buchung_id: string;
  korrektur_minuten?: number;
}) {
  const supabase = await createClient();

  // 1. Get running timer
  const { data: timer, error: timerError } = await supabase
    .from('arbeitszeit_buchung')
    .select('id, start_zeit, kostensatz_eur_pro_stunde, employee_id')
    .eq('id', input.buchung_id)
    .is('end_zeit', null)
    .single();

  if (timerError || !timer) {
    return { error: 'Kein laufender Timer gefunden' };
  }

  // 2. Calculate duration
  const now = new Date();
  const start = new Date(timer.start_zeit);
  const diffMinutes = Math.round((now.getTime() - start.getTime()) / 60000);
  const dauer = input.korrektur_minuten ?? diffMinutes;

  // 3. Update
  const { error: updateError } = await supabase
    .from('arbeitszeit_buchung')
    .update({
      end_zeit: now.toISOString(),
      dauer_minuten: dauer
    })
    .eq('id', input.buchung_id);

  if (updateError) {
    return { error: 'Fehler beim Stoppen des Timers: ' + updateError.message };
  }

  // 4. Audit Log
  await supabase.from('audit_log').insert({
    action: 'timer_stop',
    table_name: 'arbeitszeit_buchung',
    record_id: input.buchung_id,
    actor_id: timer.employee_id,
    payload: { dauer_minuten: dauer }
  });

  const kosten = (dauer / 60) * timer.kostensatz_eur_pro_stunde;
  return { success: true, dauer_minuten: dauer, kosten_eur: kosten };
}

export async function erfasseZeitDirekt(input: {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
  dauer_minuten: number;
  datum?: string;
  war_aus_vorlage?: boolean;
  vorlage_id?: string;
}) {
  const supabase = await createClient();

  // 1. Get kostensatz
  const { kostensatz } = await getKostensatz(supabase, input.employee_id, input.station_kuerzel, 'galvanik-kreile');

  if (kostensatz === null) {
    return {
      error: 'Kostensatz fehlt',
      hinweis: 'Bitte Inhaber: Kostensatz für Mitarbeiter oder Station hinterlegen'
    };
  }

  const startDatum = input.datum ? new Date(input.datum + 'T08:00:00') : new Date(new Date().toISOString().split('T')[0] + 'T08:00:00');
  const endDatum = new Date(startDatum.getTime() + input.dauer_minuten * 60000);

  // 2. Insert
  const { data: buchung, error } = await supabase
    .from('arbeitszeit_buchung')
    .insert({
      tenant_id: 'galvanik-kreile',
      auftrag_id: input.auftrag_id,
      employee_id: input.employee_id,
      kostenstelle_kuerzel: input.station_kuerzel,
      station_kuerzel: input.station_kuerzel,
      start_zeit: startDatum.toISOString(),
      end_zeit: endDatum.toISOString(),
      dauer_minuten: input.dauer_minuten,
      kostensatz_eur_pro_stunde: kostensatz,
      erfasst_modus: input.war_aus_vorlage ? 'aus_vorlage' : 'rueckwirkend',
      war_aus_vorlage: input.war_aus_vorlage ?? false,
      vorlage_id: input.vorlage_id || null
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Fehler beim Speichern der Zeit: ' + error.message };
  }

  // 3. Audit Log
  await supabase.from('audit_log').insert({
    action: 'zeit_erfasst',
    table_name: 'arbeitszeit_buchung',
    record_id: buchung.id,
    actor_id: input.employee_id,
    payload: { dauer_minuten: input.dauer_minuten, modus: input.war_aus_vorlage ? 'aus_vorlage' : 'rueckwirkend' }
  });

  const kosten = (input.dauer_minuten / 60) * kostensatz;
  return { success: true, buchung_id: buchung.id, kosten_eur: kosten };
}

export async function erfasseVerbrauch(input: {
  auftrag_id: string;
  inventory_item_id: string;
  menge: number;
  station_kuerzel: string;
  employee_id: string;
  war_aus_vorlage?: boolean;
  vorlage_id?: string;
}) {
  const supabase = await createClient();

  // 1. Get einkaufspreis
  const einkaufspreis = await getEinkaufspreis(supabase, input.inventory_item_id);

  if (einkaufspreis === null) {
    return {
      error: 'Einkaufspreis fehlt',
      hinweis: 'Bitte Einkaufspreis für Artikel hinterlegen'
    };
  }

  // 2. Insert stock_movements
  const { data: movement, error } = await supabase
    .from('stock_movements')
    .insert({
      tenant_id: 'galvanik-kreile',
      order_id: input.auftrag_id,
      inventory_item_id: input.inventory_item_id,
      quantity: -input.menge, // negative for consumption
      movement_type: 'verbrauch',
      reason: 'Auftrag ' + input.auftrag_id,
      kostenstelle_kuerzel: input.station_kuerzel,
      station_kuerzel: input.station_kuerzel,
      erfasst_von: input.employee_id,
      war_aus_vorlage: input.war_aus_vorlage ?? false,
      vorlage_id: input.vorlage_id || null,
      snapshot_einkaufspreis_eur: einkaufspreis
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Fehler beim Buchen des Verbrauchs: ' + error.message };
  }

  // 3. Update inventory_items
  const { error: stockError } = await supabase.rpc('decrement_inventory_stock', {
    item_id: input.inventory_item_id,
    amount: input.menge
  });
  
  // If no RPC exists, we do a raw select and update (assuming optimistic UI or simple environment)
  if (stockError) {
    const { data: itemData } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', input.inventory_item_id)
      .single();
      
    if (itemData) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: itemData.current_stock - input.menge })
        .eq('id', input.inventory_item_id);
    }
  }

  // 4. Audit log
  await supabase.from('audit_log').insert({
    action: 'erfasst',
    table_name: 'stock_movements',
    record_id: movement.id,
    actor_id: input.employee_id,
    payload: { menge: input.menge, inventory_item_id: input.inventory_item_id }
  });

  const kosten = input.menge * einkaufspreis;
  return { success: true, movement_id: movement.id, kosten_eur: kosten };
}

export async function uebernehmeVorlage(input: {
  auftrag_id: string;
  employee_id: string;
  schluessel: string;
}) {
  const supabase = await createClient();

  // 1 & 2. Load templates
  const [zeitRes, verbrauchRes] = await Promise.all([
    supabase.from('vorlage_zeit').select('id, station_kuerzel, median_minuten').eq('schluessel', input.schluessel).eq('tenant_id', 'galvanik-kreile'),
    supabase.from('vorlage_verbrauch').select('id, station_kuerzel, inventory_item_id, median_menge').eq('schluessel', input.schluessel).eq('tenant_id', 'galvanik-kreile')
  ]);

  if ((!zeitRes.data || zeitRes.data.length === 0) && (!verbrauchRes.data || verbrauchRes.data.length === 0)) {
    return { error: 'Keine Vorlage vorhanden' };
  }

  const fehler = [];
  let zCount = 0;
  let vCount = 0;
  let kostenGesamt = 0;

  // 4. Process zeit
  if (zeitRes.data) {
    for (const z of zeitRes.data) {
      const res = await erfasseZeitDirekt({
        auftrag_id: input.auftrag_id,
        employee_id: input.employee_id,
        station_kuerzel: z.station_kuerzel,
        dauer_minuten: Math.round(Number(z.median_minuten)),
        war_aus_vorlage: true,
        vorlage_id: z.id
      });
      if (res.error) {
        fehler.push(`Zeit (${z.station_kuerzel}): ${res.error}`);
      } else {
        zCount++;
        if (res.kosten_eur) kostenGesamt += res.kosten_eur;
      }
    }
  }

  // 5. Process verbrauch
  if (verbrauchRes.data) {
    for (const v of verbrauchRes.data) {
      const res = await erfasseVerbrauch({
        auftrag_id: input.auftrag_id,
        inventory_item_id: v.inventory_item_id,
        menge: Number(Number(v.median_menge).toFixed(1)),
        station_kuerzel: v.station_kuerzel,
        employee_id: input.employee_id,
        war_aus_vorlage: true,
        vorlage_id: v.id
      });
      if (res.error) {
        fehler.push(`Verbrauch (${v.inventory_item_id}): ${res.error}`);
      } else {
        vCount++;
        if (res.kosten_eur) kostenGesamt += res.kosten_eur;
      }
    }
  }

  // 7. Audit log
  await supabase.from('audit_log').insert({
    action: 'vorlage_uebernommen',
    table_name: 'vorlagen',
    actor_id: input.employee_id,
    payload: { schluessel: input.schluessel, zCount, vCount, fehler }
  });

  if (fehler.length > 0) {
    return { partial: true, erfolgreich: zCount + vCount, fehler, gesamt_kosten_eur: kostenGesamt };
  }

  return { success: true, zeit_buchungen: zCount, verbrauch_buchungen: vCount, gesamt_kosten_eur: kostenGesamt };
}

import { db } from "@/db";
import { customers, orders, items, events, calendarEvents } from "@/db/schema";
import { eq, desc, like } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth } from "@/lib/server/authHelper";
import { revalidatePath } from "next/cache";

export async function createCustomerFromErfassung(input: any) {
  console.info("[CAPTURE_CUSTOMER_START]", {
    hasInput: Boolean(input),
    customerType: input?.customerType ?? input?.customer_type,
    name: input?.name,
    firstName: input?.firstName ?? input?.first_name,
    lastName: input?.lastName ?? input?.last_name,
    company: input?.company,
    source: input?.source,
  });
  // Check write permissions
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.message };

  // Validate required fields per spec
  const validationErrors: string[] = [];
  if (!input.contactName && !input.company) validationErrors.push("Name oder Firma ist erforderlich");
  if (!input.source) validationErrors.push("Quelle (source) ist erforderlich");
  if (validationErrors.length) {
    return { ok: false, error: validationErrors.join(", ") };
  }

  if (!db) return { ok: false, error: "DB_ERROR" };

  try {
    const customerId = createId();
    const isCompany = !!input.company;
    const customerType = input.type || (input.isLead ? "lead" : (isCompany ? "business" : "privat"));

    // Generate robust customer number
    const year = new Date().getFullYear();
    const prefix = "K";
    const pattern = `${prefix}-${year}-%`;
    const existingCustomers = await db
      .select({ customerNumber: customers.customerNumber })
      .from(customers)
      .where(like(customers.customerNumber, pattern));

    let maxNum = 0;
    for (const ec of existingCustomers) {
      if (ec.customerNumber) {
        const parts = ec.customerNumber.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    let sequenceNum = maxNum + 1;
    const sequenceString = sequenceNum.toString().padStart(4, "0");
    const customerNumber = `${prefix}-${year}-${sequenceString}`;

    const newCustomer = {
      id: customerId,
      customerNumber,
      name: input.contactName || input.company || "Unbenannter Kunde",
      companyName: input.company || null,
      contactPerson: input.contactName || null,
      email: input.email || null,
      phone: input.phone || null,
      street: input.street || null,
      zipCode: input.zipCode || null,
      city: input.city || null,
      country: input.country || null,
      address: input.address || null,
      type: customerType,
      isLead: input.isLead || false,
      source: input.source || "manual",
      sourceRef: input.sourceRef || null,
      notes: input.notes || null,
      behaviorNotes: input.behaviorNote || null,
      // No spreading of arbitrary input fields to prevent schema crashes
    };

    await db.insert(customers).values(newCustomer);
    const verify = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (verify.length === 0) {
      throw new Error("Insert failed silently");
    }
    try { revalidatePath("/"); } catch (e) { /* ignore when not in Next runtime */ }
    return { ok: true, customer: verify[0] };
  } catch (err: any) {
    console.error("Failed to create customer:", {
      message: err.message,
      details: (err as any).details,
      hint: (err as any).hint,
    });
    return { ok: false, error: err.message || "Failed to create customer" };
  }
}

export async function createOrderFromErfassung(input: any) {
  // Check write permissions
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR" };

  // Validate required fields per spec
  const validationErrors: string[] = [];
  if (!input.customerId) validationErrors.push("Kunden-ID ist erforderlich");
  if (!input.title) validationErrors.push("Titel ist erforderlich");
  if (!input.source) validationErrors.push("Quelle (source) ist erforderlich");
  if (validationErrors.length) {
    return { ok: false, error: validationErrors.join(", ") };
  }

  try {
    const orderId = createId();
    const year = new Date().getFullYear();

    // Generate robust order number
    const prefix = input.isQuote ? "KV" : "A";
    const pattern = `${prefix}-${year}-%`;
    const existingOrders = await db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(like(orders.orderNumber, pattern));

    let maxNum = 0;
    for (const eo of existingOrders) {
      if (eo.orderNumber) {
        const parts = eo.orderNumber.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    let sequenceNum = maxNum + 1;
    const sequenceString = sequenceNum.toString().padStart(4, "0");
    const orderNumber = `${prefix}-${year}-${sequenceString}`;

    const timeWindowStr = input.timeWindow && input.timeWindow !== 'ganztaegig' ? `\n[Termin: ${input.timeWindow}]` : '';
    const calSyncStr = input.calendarSync ? ` [Kalender-Sync aktiv]` : '';
    const combinedFreetext = `${input.freetextOriginal || ''}${timeWindowStr}${calSyncStr}`.trim();

    const newOrder = {
      id: orderId,
      tenantId: "galvanik-kreile",
      orderNumber,
      customerId: input.customerId,
      title: input.title,
      currentStationId: "wareneingang",
      status: "in_progress",
      priorityComputed: input.priority || "green",
      isQuote: input.isQuote || false,
      quoteStatus: input.isQuote ? "offen" : null,
      source: input.source,
      sourceRef: input.sourceRef || null,
      freetextOriginal: combinedFreetext || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    };

    await db.insert(orders).values(newOrder);

    if (input.calendarSync && input.dueDate) {
      await db.insert(calendarEvents).values({
        id: createId(),
        tenantId: "galvanik-kreile",
        orderId: orderId,
        customerId: input.customerId,
        title: `Abgabe/Lieferung: ${input.title}`,
        eventType: "delivery",
        startsAt: new Date(input.dueDate),
        timeSlot: input.timeWindow || "ganztaegig",
        status: "planned",
        source: input.source,
      });
    }

    if (input.items && Array.isArray(input.items) && input.items.length > 0) {
      const newItems = input.items.map((p: any) => ({
        id: createId(),
        tenantId: "galvanik-kreile",
        orderId,
        customerId: input.customerId,
        name: p.name || "Unbekanntes Teil",
        quantity: parseInt(p.quantity) || 1,
        currentStationId: "wareneingang",
      }));
      await db.insert(items).values(newItems);
    }

    await db.insert(events).values({
      id: createId(),
      tenantId: "galvanik-kreile",
      orderId,
      eventType: "ORDER_CREATED",
      description: input.isQuote ? "KV erstellt" : "Auftrag erstellt",
      station: "wareneingang",
    });

    const verify = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (verify.length === 0) {
      throw new Error("Insert failed silently");
    }

    try { revalidatePath("/"); } catch (e) { /* ignore when not in Next runtime */ }

    return { ok: true, order: verify[0] };
  } catch (err: any) {
    console.error("Failed to create order:", {
      message: err.message,
      details: (err as any).details,
      hint: (err as any).hint,
    });
    return { ok: false, error: err.message || "Failed to create order" };
  }
}
