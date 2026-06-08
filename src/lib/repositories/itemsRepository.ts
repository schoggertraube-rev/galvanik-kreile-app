import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();
      const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error("Supabase itemsRepository.getAll error:", error.message, error.details, error.hint);
        return [];
      }
      
      return data.map(i => ({
        id: i.id,
        orderId: i.order_id,
        name: i.name,
        quantity: i.quantity,
        material: i.material || undefined,
        surfaceRequested: i.surface_requested || undefined,
        photoIds: i.photo_ids || [],
        photo: i.photo || undefined,
      }));
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in itemsRepository.getAll - returning empty');
    return [];
  },

  async getByOrderId(orderId: string): Promise<Item[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('items').select('*').eq('order_id', orderId);
      if (error) {
        console.error("Supabase itemsRepository.getByOrderId error:", error.message, error.details, error.hint);
        return [];
      }
      
      return data.map(i => ({
        id: i.id,
        orderId: i.order_id,
        name: i.name,
        quantity: i.quantity,
        material: i.material || undefined,
        surfaceRequested: i.surface_requested || undefined,
        photoIds: i.photo_ids || [],
        photo: i.photo || undefined,
      }));
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in itemsRepository.getByOrderId - returning empty');
    return [];
  },

  async create(data: Omit<Item, "id"> & { id?: string }): Promise<Item> {
    const id = data.id || createId();
    
    if (isSupabase) {
      const supabase = createClient();
      
      // We must fetch the customer_id from the order first since it's NOT NULL in our schema
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('id', data.orderId)
        .single();
        
      if (orderError || !orderData) {
        console.error("Supabase itemsRepository.create failed to fetch customer_id from order:", orderError?.message, orderError?.details, orderError?.hint);
        throw new Error("Cannot create item: Order not found or missing customer_id");
      }

      const { error } = await supabase.from('items').insert({
        id,
        order_id: data.orderId,
        customer_id: orderData.customer_id,
        name: data.name,
        quantity: data.quantity,
        material: data.material || null,
        surface_requested: data.surfaceRequested || null,
        photo_ids: data.photoIds || [],
        photo: data.photo || null
      });

      if (error) {
        console.error("Supabase itemsRepository.create error:", error.message, error.details, error.hint);
        throw error;
      }
      
      return { ...data, id };
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in itemsRepository.create - returning empty mock item');
    return { ...data, id };
  },

  async update(id: string, changes: Partial<Item>): Promise<Item | null> {
    if (isSupabase) {
      const supabase = createClient();
      const updateData: Record<string, unknown> = {};
      
      if (changes.name) updateData.name = changes.name;
      if (changes.quantity !== undefined) updateData.quantity = changes.quantity;
      if (changes.material !== undefined) updateData.material = changes.material;
      if (changes.surfaceRequested !== undefined) updateData.surface_requested = changes.surfaceRequested;
      if (changes.photoIds !== undefined) updateData.photo_ids = changes.photoIds;
      if (changes.photo !== undefined) updateData.photo = changes.photo;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from('items').update(updateData).eq('id', id);
        if (error) {
          console.error("Supabase itemsRepository.update error:", error.message, error.details, error.hint);
          throw error;
        }
      }
      
      const all = await this.getAll();
      return all.find(i => i.id === id) || null;
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in itemsRepository.update - returning null');
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
