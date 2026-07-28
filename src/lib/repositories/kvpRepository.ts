import { createId } from "@paralleldrive/cuid2";
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

// Browser-side writes and hard-coded tenant values cannot prove actor, tenant
// or receipt ownership. Keep the legacy adapter inert until its server contract
// and RLS proof have been released.
function isKvpRepositoryEnabled(): boolean {
  return false;
}

export const kvpRepository = {
  async getAll(): Promise<KvpItem[]> {
    if (!isKvpRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: KVP ist bis zum geprüften Fundamentvertrag nicht verfügbar.");
    }
    if (!isSupabase) return [];
    
    // Strict: Do not read from shadow DB

    const supabase = createClient();
    const { data, error } = await supabase.from('kvp_items').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Supabase kvpRepository.getAll error:", error.message, error.details, error.hint);
      return [];
    }
    
    return data.map(c => ({
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
  },

  async addItem(item: Omit<KvpItem, "id">): Promise<KvpItem> {
    if (!isKvpRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: KVP ist bis zum geprüften Fundamentvertrag nicht verfügbar.");
    }
    const id = "b-" + createId();
    const newItem: KvpItem = { ...item, id };
    


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
    }
    
    return newItem;
  },

  async updateItemStatus(id: string, status: KvpItem["status"]): Promise<KvpItem | null> {
    if (!isKvpRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: KVP ist bis zum geprüften Fundamentvertrag nicht verfügbar.");
    }
    if (isSupabase) {
      const supabase = createClient();
      const { error } = await supabase.from('kvp_items').update({ status }).eq('id', id);
      if (error) {
        console.error("Supabase kvpRepository.updateItemStatus error:", error.message, error.details, error.hint);
        throw error;
      }
      return { id, status } as unknown as KvpItem;
    }

    return null;
  }
};
