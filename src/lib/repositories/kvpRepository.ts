import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { createClient } from "@/lib/supabase/client";

export type KvpItem = {
  id: string;
  title: string;
  category: string;
  benefit: string;
  status: "neu" | "prüfen" | "angenommen" | "umgesetzt" | "abgelehnt";
  problemDesc: string;
  hasPhoto: boolean;
  date: string;
  isDemo?: boolean;
};

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

const DEMO_ITEMS: KvpItem[] = [
  {
    id: "b-demo-1", title: "Abtropfblech an Bad 4 verlängern", category: "Qualität", benefit: "Kosten senken", status: "angenommen",
    problemDesc: "Es tropft zu viel Chemie daneben beim Herausheben der Ware.", hasPhoto: true, date: "12.05.2026", isDemo: true
  },
  {
    id: "b-demo-2", title: "Neuer Besen für Halle 2", category: "Ordnung/Sauberkeit", benefit: "Arbeit erleichtern", status: "umgesetzt",
    problemDesc: "Der alte Besen ist komplett abgenutzt, fegen dauert ewig.", hasPhoto: false, date: "10.05.2026", isDemo: true
  },
  {
    id: "b-demo-3", title: "Kunden-Abholung deutlicher ausschildern", category: "Kunde", benefit: "Kunde zufriedener", status: "neu",
    problemDesc: "LKW-Fahrer wissen oft nicht, an welchem Tor sie klingeln sollen.", hasPhoto: true, date: "Gestern", isDemo: true
  },
  {
    id: "b-demo-4", title: "Gefahrstoffetiketten lösen sich", category: "Sicherheit", benefit: "Fehler vermeiden", status: "prüfen",
    problemDesc: "Durch die Dämpfe fallen die Aufkleber von den Reservebehältern ab.", hasPhoto: true, date: "Heute", isDemo: true
  }
];

export const kvpRepository = {
  async getAll(): Promise<KvpItem[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('kvp_items').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error("Supabase kvpRepository.getAll error:", error.message, error.details, error.hint);
        return [];
      }
      
      const mapped = data.map(c => ({
        id: c.id,
        title: c.title,
        category: c.category,
        benefit: c.benefit,
        status: c.status as KvpItem["status"],
        problemDesc: c.problem_desc || "",
        hasPhoto: c.has_photo,
        date: c.date || "",
        isDemo: c.is_demo
      }));

      // If DB is empty, return mock data
      if (mapped.length === 0) return [];
      return mapped;
    }

    // --- Mock Fallback ---
    if (typeof window !== "undefined") {
      if (OfflineManager.isOffline()) {
        // @ts-expect-error: kvp_items not in store types
        const cached = await IndexedDBHelper.getSnapshot<KvpItem>("kvp_items");
        if (cached && cached.length > 0) {
          return cached;
        }
      }

      const saved = localStorage.getItem("kreile_business_kvp_items");
      const items = saved ? JSON.parse(saved) : DEMO_ITEMS;

      if (!saved) {
        localStorage.setItem("kreile_business_kvp_items", JSON.stringify(DEMO_ITEMS));
      }

      if (!OfflineManager.isOffline()) {
        // @ts-expect-error: kvp_items not in store types
        IndexedDBHelper.saveSnapshot("kvp_items", items.slice(0, 100)).catch(err =>
          console.error("Failed to save kvp_items snapshot to IndexedDB:", err)
        );
      }

      return items as KvpItem[];
    }
    return [];
  },

  async addItem(item: Omit<KvpItem, "id">): Promise<KvpItem> {
    const id = "b-" + createId();
    
    if (isSupabase) {
      const supabase = createClient();
      const { error } = await supabase.from('kvp_items').insert({
        id,
        tenant_id: "galvanik-kreile",
        title: item.title,
        category: item.category,
        benefit: item.benefit,
        status: item.status,
        problem_desc: item.problemDesc,
        has_photo: item.hasPhoto,
        date: item.date,
        is_demo: item.isDemo || false
      });

      if (error) {
        console.error("Supabase kvpRepository.addItem error:", error.message, error.details, error.hint);
        throw error;
      }
      
      return { ...item, id };
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    const newItem: KvpItem = { ...item, id };
    const updated = [newItem, ...all];

    if (OfflineManager.isOffline()) {
      await OfflineManager.enqueueAction("BUSINESS_KVP_CREATE", newItem);
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_business_kvp_items", JSON.stringify(updated));
      }
      return newItem;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_business_kvp_items", JSON.stringify(updated));
      // @ts-expect-error: kvp_items not in store types
      IndexedDBHelper.saveSnapshot("kvp_items", updated.slice(0, 100)).catch(err => console.error(err));
    }
    
    return newItem;
  },

  async updateItemStatus(id: string, status: KvpItem["status"]): Promise<KvpItem | null> {
    if (isSupabase) {
      const supabase = createClient();
      const { error } = await supabase.from('kvp_items').update({ status }).eq('id', id);
      if (error) {
        console.error("Supabase kvpRepository.updateItemStatus error:", error.message, error.details, error.hint);
        throw error;
      }
      const all = await this.getAll();
      return all.find(i => i.id === id) || null;
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    let updatedItem: KvpItem | null = null;
    
    const updated = all.map(i => {
      if (i.id === id) {
        updatedItem = { ...i, status };
        return updatedItem;
      }
      return i;
    });

    if (!updatedItem) return null;

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_business_kvp_items", JSON.stringify(updated));
      // @ts-expect-error: kvp_items not in store types
      IndexedDBHelper.saveSnapshot("kvp_items", updated.slice(0, 100)).catch(err => console.error(err));
    }
    return updatedItem;
  }
};
