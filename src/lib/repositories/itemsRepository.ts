import { createId } from "@paralleldrive/cuid2";
import { getItemsDb, getItemsByOrderDb, createItemDb, updateItemDb } from "@/app/actions/items.actions";

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
    const id = data.id || createId();
    
    if (isSupabase) {
      const result = await createItemDb({ ...data, id });
      if (!result.ok) {
        console.error("itemsRepository.create error:", result.message, result.details);
        throw new Error(result.message || "Cannot create item");
      }
      return result.data as Item;
    }

    console.warn('Fallback hit in itemsRepository.create - returning empty mock item');
    return { ...data, id };
  },

  async update(id: string, changes: Partial<Item>): Promise<Item | null> {
    if (isSupabase) {
      const result = await updateItemDb(id, changes);
      if (!result.ok) {
        console.error("itemsRepository.update error:", result.message, result.details);
        throw new Error(result.message || "Cannot update item");
      }
      // Return the updated item merged. Realistically we might need to fetch the whole item if we need all fields
      // but returning what changed is sometimes enough, let's just fetch it by getAll and find for simplicity
      const all = await this.getAll();
      return all.find(i => i.id === id) || null;
    }

    console.warn('Fallback hit in itemsRepository.update - returning null');
    return null;
  },

  async createMany(items: Omit<Item, "id">[]): Promise<Item[]> {
    const results: Item[] = [];
    for (const item of items) {
      results.push(await this.create(item));
    }
    return results;
  }
};
