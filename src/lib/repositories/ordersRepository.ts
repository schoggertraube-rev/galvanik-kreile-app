import { createId } from "@paralleldrive/cuid2";
import { INITIAL_ORDERS } from "@/lib/mockData";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { createClient } from "@/lib/supabase/client";

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  station: string; 
  status: string;
  risk: string; 
  currentStationId?: string;
  dueDate?: string;
  parts: Record<string, unknown>[];
  statusText?: string;
  delayReason?: string;
  recommendedAction?: string;
  dueLabel?: string;
  dueValue?: string;
  intakeDate?: string;
  task?: string;
  customerName?: string;
  rawIntakeDate?: string;
  rawDueDate?: string;
  attachmentUrl?: string;
}

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    if (isSupabase) {
      const supabase = createClient();
      let dbOrders = null;
      let ordersError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        dbOrders = data;
        ordersError = error;
        
        if (ordersError && ordersError.message?.includes("JWT issued at future")) {
          console.warn(`Supabase clock drift detected (JWT future). Retrying attempt ${attempt}...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        break;
      }

      if (ordersError || !dbOrders) {
        console.error("Supabase ordersRepository.getAll (orders) error:", ordersError?.message, ordersError?.details, ordersError?.hint);
        return [];
      }
      
      const { data: dbItems, error: itemsError } = await supabase.from('items').select('*');
      if (itemsError) {
        console.error("Supabase ordersRepository.getAll (items) error:", itemsError?.message, itemsError?.details, itemsError?.hint);
        return [];
      }
      
      const { data: dbCustomers, error: customersError } = await supabase.from('customers').select('id, name');
      if (customersError) {
        console.error("Supabase ordersRepository.getAll (customers) error:", customersError?.message, customersError?.details, customersError?.hint);
        return [];
      }

      return dbOrders.map(o => {
        const orderItems = dbItems.filter(item => item.order_id === o.id);
        const customer = dbCustomers.find(c => c.id === o.customer_id);
        const customerName = customer ? customer.name : "Unbekannter Kunde";
        
        let normalizedOrderNumber = o.order_number || "A-0000-0000";
        const numMatch = normalizedOrderNumber.match(/^A-(\d{4})-?(\d+)$/i);
        if (numMatch) {
          normalizedOrderNumber = `A-${numMatch[1]}-${numMatch[2].padStart(4, '0')}`;
        }
        
        const rawIntake = o.intake_date ? new Date(o.intake_date) : (o.created_at ? new Date(o.created_at) : new Date());
        const rawDue = o.due_date ? new Date(o.due_date) : new Date(rawIntake.getTime() + 10 * 24 * 60 * 60 * 1000);
        
        const intakeDate = !isNaN(rawIntake.getTime()) 
          ? rawIntake.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ", " + rawIntake.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + " Uhr"
          : "Unbekannt";
        const dueDate = !isNaN(rawDue.getTime()) 
          ? rawDue.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : "Unbekannt";
        
        return {
          id: o.id,
          orderNumber: normalizedOrderNumber,
          customerId: o.customer_id || "",
          customerName,
          title: o.title,
          task: o.task || o.title || "Unbenanntes Projekt",
          station: o.current_station || "wareneingang",
          currentStationId: o.current_station || "wareneingang",
          status: o.status,
          risk: o.risk || "green",
          statusText: o.status_text,
          delayReason: o.delay_reason,
          recommendedAction: o.recommended_action,
          parts: orderItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            surfaceRequested: item.surface_requested || "",
            station: o.current_station || "wareneingang"
          })),
          intakeDate,
          dueDate,
          rawIntakeDate: !isNaN(rawIntake.getTime()) ? rawIntake.toISOString() : undefined,
          rawDueDate: !isNaN(rawDue.getTime()) ? rawDue.toISOString() : undefined,
          attachmentUrl: o.attachment_url,
          dueLabel: "Fällig in",
          dueValue: "10 Tagen"
        };
      });
    }

    // --- Mock Fallback ---
    if (typeof window !== "undefined") {
      // If offline or error, try reading from IndexedDB Read-Cache snapshot
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Order>("orders");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded orders from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      // Fallback to localStorage
      const saved = localStorage.getItem("kreile_orders");
      const orders = saved ? JSON.parse(saved) : INITIAL_ORDERS;
      
      if (!saved) {
        localStorage.setItem("kreile_orders", JSON.stringify(INITIAL_ORDERS));
      }

      // Update the IndexedDB cache snapshot for next time
      if (!OfflineManager.isOffline()) {
        IndexedDBHelper.saveSnapshot("orders", orders.slice(0, 50)).catch(err =>
          console.error("Failed to save orders snapshot to IndexedDB:", err)
        );
      }

      return orders as Order[];
    }
    return INITIAL_ORDERS as unknown as Order[];
  },

  async create(data: Omit<Order, "id" | "orderNumber" | "status" | "risk"> & { id?: string }): Promise<Order> {
    const intakeDate = new Date().toISOString();
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    
    if (isSupabase) {
      const supabase = createClient();
      const orderId = data.id || createId();
      const orderNumber = `A-${202600 + Math.floor(Math.random() * 10000)}`;
      
      const newOrderDb: Record<string, unknown> = {
        id: orderId,
        order_number: orderNumber,
        customer_id: data.customerId,
        title: data.title,
        status: "in_progress",
        risk: "green",
        intake_date: intakeDate,
        due_date: dueDate
      };
      if (data.attachmentUrl) {
        newOrderDb.attachment_url = data.attachmentUrl;
      }
      
      const { error: orderError } = await supabase.from('orders').insert(newOrderDb);
      if (orderError) {
        console.error("Supabase ordersRepository.create (order) error:", orderError.message, orderError.details, orderError.hint);
        throw orderError;
      }
      
      const mappedParts = (data.parts || []).map((part: Record<string, unknown>) => ({
        id: (part.id as string) || createId(),
        order_id: orderId,
        customer_id: data.customerId,
        name: (part.name as string) || "Teil",
        quantity: typeof part.quantity === "number" ? part.quantity : parseInt(String(part.quantity)) || 1,
        surface_requested: (part.surfaceRequested as string) || ""
      }));
      
      if (mappedParts.length > 0) {
        const { error: itemsError } = await supabase.from('items').insert(mappedParts);
        if (itemsError) {
          console.error("Supabase ordersRepository.create (items) error:", itemsError?.message, itemsError?.details, itemsError?.hint);
          throw itemsError;
        }
      }
      
      let customerName = "Unbekannter Kunde";
      const { data: customerData } = await supabase.from('customers').select('name').eq('id', data.customerId).single();
      if (customerData) {
        customerName = customerData.name;
      }
      
      return {
        ...data,
        id: orderId,
        orderNumber,
        customerName,
        status: "in_progress",
        risk: "green",
        intakeDate,
        dueDate,
        dueLabel: "Fällig in",
        dueValue: "10 Tagen",
        parts: mappedParts.map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            surfaceRequested: p.surface_requested,
            status: "in_progress",
            station: data.currentStationId || "wareneingang"
        }))
      };
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    const orderNumber = `A-${202600 + all.length}`;
    
    const cleanOrderNum = String(202600 + all.length);
    const mappedParts = (data.parts || []).map((part: Record<string, unknown>, index: number) => {
      const partNum = index + 1;
      const generatedPartId = `T-A-${cleanOrderNum}-${partNum}`;
      return {
        id: part.id || generatedPartId,
        name: part.name,
        quantity: typeof part.quantity === "number" ? part.quantity : parseInt(String(part.quantity)) || 1,
        surfaceRequested: part.surfaceRequested || "",
        status: part.status || "in_progress",
        station: part.station || data.currentStationId || "wareneingang"
      };
    });

    let customerName = "Unbekannter Kunde";
    try {
      const savedCustomers = localStorage.getItem("kreile_customers");
      if (savedCustomers) {
        const customers = JSON.parse(savedCustomers);
        const customer = customers.find((c: { id: string, name: string }) => c.id === data.customerId);
        if (customer) {
          customerName = customer.name;
        }
      }
    } catch (e) {
      console.warn("Failed to find customerName in local storage lookup", e);
    }

    const newOrder: Order = {
      ...data,
      id: data.id || createId(),
      orderNumber,
      customerName,
      status: "in_progress",
      risk: "green",
      intakeDate,
      dueDate,
      dueLabel: "Fällig in",
      dueValue: "10 Tagen",
      parts: mappedParts
    };

    const updated = [newOrder, ...all];

    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing order creation in IndexedDB");
      await OfflineManager.enqueueAction("ORDER_CREATE", data);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
      }
      return newOrder;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
      IndexedDBHelper.saveSnapshot("orders", updated.slice(0, 50)).catch(err =>
        console.error("Failed to update orders snapshot:", err)
      );
    }
    return newOrder;
  },

  async updateOrder(idOrNumber: string, changes: Partial<Order>): Promise<Order | null> {
    if (isSupabase) {
      const supabase = createClient();
      const isId = idOrNumber.length > 20; 
      
      const updateData: Record<string, unknown> = {};
      if (changes.status) updateData.status = changes.status;
      if (changes.title) updateData.title = changes.title;
      if (changes.risk) updateData.risk = changes.risk;
      if (changes.statusText) updateData.status_text = changes.statusText;
      if (changes.delayReason) updateData.delay_reason = changes.delayReason;
      if (changes.recommendedAction) updateData.recommended_action = changes.recommendedAction;
      if (changes.station || changes.currentStationId) updateData.current_station = changes.station || changes.currentStationId;
      if (changes.customerId) updateData.customer_id = changes.customerId;
      if (changes.rawIntakeDate) updateData.intake_date = changes.rawIntakeDate;
      if (changes.rawDueDate) updateData.due_date = changes.rawDueDate;
      if (changes.task) updateData.task = changes.task;
      
      if (Object.keys(updateData).length > 0) {
        const query = supabase.from('orders').update(updateData);
        const { error } = isId 
          ? await query.eq('id', idOrNumber)
          : await query.eq('order_number', idOrNumber);
          
        if (error) {
          const errMsg = error.message || JSON.stringify(error);
          console.error("Supabase ordersRepository.updateOrder error:", errMsg, error.details, error.hint, error.code);
          throw new Error(errMsg);
        }
      }
      
      // Return the updated object by re-fetching all and finding it, 
      // ensuring we have the exact UI format mapped correctly.
      const all = await this.getAll();
      const updatedOrder = all.find(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
      return updatedOrder || null;
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    let updatedOrder: Order | null = null;

    const updated = all.map(o => {
      if (o.id === idOrNumber || o.orderNumber === idOrNumber) {
        updatedOrder = { ...o, ...changes };
        return updatedOrder;
      }
      return o;
    });

    if (!updatedOrder) return null;

    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing order status update in IndexedDB");
      await OfflineManager.enqueueAction("ORDER_STATUS_UPDATE", {
        id: (updatedOrder as Order).id,
        orderNumber: (updatedOrder as Order).orderNumber,
        changes
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      }
      return updatedOrder;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      
      IndexedDBHelper.saveSnapshot("orders", updated.slice(0, 50)).catch(err =>
        console.error("Failed to update orders snapshot:", err)
      );
    }

    return updatedOrder;
  }
};
