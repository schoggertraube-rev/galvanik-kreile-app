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

export const kvpRepository = {
  async getAll(): Promise<KvpItem[]> {
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
    void item;
    throw new Error("NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.");
  },

  async updateItemStatus(id: string, status: KvpItem["status"]): Promise<KvpItem | null> {
    void id;
    void status;
    throw new Error("NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.");
  }
};
