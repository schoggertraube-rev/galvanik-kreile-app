import { getItemsDb, getItemsByOrderDb } from "@/app/actions/items.actions";

export type Item = {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  material?: string;
  surfaceRequested?: string;
  photoIds?: string[];
  photo?: string;
}

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

export const itemsRepository = {
  async getAll(): Promise<Item[]> {
    if (isSupabase) {
      const result = await getItemsDb();
      if (!result.ok) {
        console.error("itemsRepository.getAll error:", result.message, result.details);
        return [];
      }
      return result.data as Item[];
    }

    console.warn('Fallback hit in itemsRepository.getAll - returning empty');
    return [];
  },

  async getByOrderId(orderId: string): Promise<Item[]> {
    if (isSupabase) {
      const result = await getItemsByOrderDb(orderId);
      if (!result.ok) {
        console.error("itemsRepository.getByOrderId error:", result.message, result.details);
        return [];
      }
      return result.data as Item[];
    }

    console.warn('Fallback hit in itemsRepository.getByOrderId - returning empty');
    return [];
  },

  async create(data: Omit<Item, "id"> & { id?: string }): Promise<Item> {
    void data;
    throw new Error("NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.");
  },

  async update(id: string, changes: Partial<Item>): Promise<Item | null> {
    void id;
    void changes;
    throw new Error("NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.");
  },

  async createMany(items: Omit<Item, "id">[]): Promise<Item[]> {
    void items;
    throw new Error("NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.");
  }
};
