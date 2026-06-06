import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { createClient } from "@/lib/supabase/client";

export type Complaint = {
  id: string;
  customerId: string;
  orderId: string;
  itemId?: string;
  reason:
    | "surface_quality"
    | "wrong_surface"
    | "damage"
    | "delay"
    | "communication"
    | "customer_expectation"
    | "transport"
    | "other";
  stationId?: string;
  description: string;
  photoIds: string[];
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
  status?: string;
};

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: "complaint-1",
    customerId: "cust-1",
    orderId: "A-2026-0042",
    reason: "surface_quality",
    description: "Kunde meldet matte Stellen an der Stoßstange",
    photoIds: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: "open"
  }
];

export const complaintsRepository = {
  async getAll(): Promise<Complaint[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('complaints').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn("Supabase complaintsRepository.getAll error:", error.message, error.details, error.hint);
      } else {
        return data.map(c => ({
          id: c.id,
          customerId: c.customer_id,
          orderId: c.order_id,
          itemId: c.item_id || undefined,
          reason: c.reason as Complaint["reason"],
          stationId: c.station_id || undefined,
          description: c.description,
          photoIds: c.photo_ids || [],
          createdAt: c.created_at,
          resolvedAt: c.resolved_at || undefined,
          resolution: c.resolution || undefined,
          status: c.status || undefined
        }));
      }
    }

    // --- Mock Fallback ---
    if (typeof window !== "undefined") {
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Complaint>("complaints");
        if (cached && cached.length > 0) {
          return cached;
        }
      }

      const saved = localStorage.getItem("kreile_complaints");
      const complaints = saved ? JSON.parse(saved) : INITIAL_COMPLAINTS;

      if (!saved) {
        localStorage.setItem("kreile_complaints", JSON.stringify(INITIAL_COMPLAINTS));
      }

      if (!OfflineManager.isOffline()) {
        IndexedDBHelper.saveSnapshot("complaints", complaints.slice(0, 100)).catch(err =>
          console.error("Failed to save complaints snapshot to IndexedDB:", err)
        );
      }

      return complaints as Complaint[];
    }
    return INITIAL_COMPLAINTS;
  },

  async getByCustomer(customerId: string): Promise<Complaint[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('complaints').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      if (error) {
        console.warn("Supabase complaintsRepository.getByCustomer error:", error.message, error.details, error.hint);
      } else {
        return data.map(c => ({
          id: c.id,
          customerId: c.customer_id,
          orderId: c.order_id,
          itemId: c.item_id || undefined,
          reason: c.reason as Complaint["reason"],
          stationId: c.station_id || undefined,
          description: c.description,
          photoIds: c.photo_ids || [],
          createdAt: c.created_at,
          resolvedAt: c.resolved_at || undefined,
          resolution: c.resolution || undefined,
          status: c.status || undefined
        }));
      }
    }

    const all = await this.getAll();
    return all.filter(c => c.customerId === customerId);
  },

  async addComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint> {
    const id = createId();
    const createdAt = new Date().toISOString();
    
    if (isSupabase) {
      const supabase = createClient();
      const { error } = await supabase.from('complaints').insert({
        id,
        tenant_id: "galvanik-kreile",
        customer_id: complaint.customerId,
        order_id: complaint.orderId,
        item_id: complaint.itemId || null,
        reason: complaint.reason,
        station_id: complaint.stationId || null,
        description: complaint.description,
        photo_ids: complaint.photoIds || [],
        status: complaint.status || "open",
        created_at: createdAt
      });

      if (error) {
        console.warn("Supabase complaintsRepository.addComplaint error:", error.message, error.details, error.hint);
      } else {
        return { ...complaint, id, createdAt };
      }
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    const newComplaint: Complaint = {
      ...complaint,
      id,
      createdAt
    };
    
    const updated = [newComplaint, ...all];

    if (OfflineManager.isOffline()) {
      await OfflineManager.enqueueAction("COMPLAINT_CREATE", newComplaint);
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_complaints", JSON.stringify(updated));
      }
      return newComplaint;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_complaints", JSON.stringify(updated));
      IndexedDBHelper.saveSnapshot("complaints", updated.slice(0, 100)).catch(err => console.error(err));
    }
    
    return newComplaint;
  },
  
  async updateComplaint(id: string, changes: Partial<Complaint>): Promise<Complaint | null> {
    if (isSupabase) {
      const supabase = createClient();
      const updateData: Record<string, unknown> = {};
      
      if (changes.description !== undefined) updateData.description = changes.description;
      if (changes.reason !== undefined) updateData.reason = changes.reason;
      if (changes.status !== undefined) updateData.status = changes.status;
      if (changes.resolution !== undefined) updateData.resolution = changes.resolution;
      if (changes.resolvedAt !== undefined) updateData.resolved_at = changes.resolvedAt;

      let errorOccurred = false;
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from('complaints').update(updateData).eq('id', id);
        if (error) {
          console.warn("Supabase complaintsRepository.updateComplaint error:", error.message, error.details, error.hint);
          errorOccurred = true;
        }
      }
      
      if (!errorOccurred) {
        const all = await this.getAll();
        return all.find(c => c.id === id) || null;
      }
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    let updatedComplaint: Complaint | null = null;
    
    const updated = all.map(c => {
      if (c.id === id) {
        updatedComplaint = { ...c, ...changes };
        return updatedComplaint;
      }
      return c;
    });

    if (!updatedComplaint) return null;

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_complaints", JSON.stringify(updated));
      IndexedDBHelper.saveSnapshot("complaints", updated.slice(0, 100)).catch(err => console.error(err));
    }
    return updatedComplaint;
  }
};
