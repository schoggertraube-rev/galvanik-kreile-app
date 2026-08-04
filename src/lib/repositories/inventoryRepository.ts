import { createId } from "@paralleldrive/cuid2";
import { createClient } from "@/lib/supabase/client";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: "chemical" | "consumable" | "tooling" | "packaging";
  unit: string;
  currentStock: number;
  minStock: number;
  storageLocation: string;
  isConsumable: boolean;
  isHazardous: boolean;
  pricePerUnit?: number;
}

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: "stock_in" | "stock_out" | "consumption" | "correction" | "waste";
  quantity: number;
  unit: string;
  orderId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

export const inventoryRepository = {
  async getAllItems(): Promise<InventoryItem[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('inventory_items').select('*').order('name', { ascending: true });
      if (error) {
        console.error("Supabase inventoryRepository.getAllItems error:", error);
        throw error;
      }
      return data.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: (item.is_consumable ? "consumable" : "tooling") as InventoryItem["category"], // Fallback da DB kein 'category' Feld hat
        unit: item.unit,
        currentStock: item.current_stock,
        minStock: item.min_stock || 0,
        storageLocation: "Standardlager", // Fallback da DB kein 'storage_location' Feld hat
        isConsumable: item.is_consumable,
        isHazardous: item.is_hazardous,
        pricePerUnit: item.price_per_unit || undefined
      }));
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in inventoryRepository.getAllItems - returning empty');
    return [];
  },

  async getAllMovements(): Promise<StockMovement[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('stock_movements').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error("Supabase inventoryRepository.getAllMovements error:", error);
        throw error;
      }
      return data.map(m => ({
        id: m.id,
        inventoryItemId: m.inventory_item_id,
        movementType: m.movement_type as StockMovement["movementType"],
        quantity: m.quantity,
        unit: m.unit,
        orderId: m.order_id || undefined,
        reason: m.reason || undefined,
        createdBy: m.created_by,
        createdAt: m.created_at
      }));
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in inventoryRepository.getAllMovements - returning empty');
    return [];
  },

  async getItemById(id: string): Promise<InventoryItem | null> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('inventory_items').select('*').eq('id', id).single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        console.error("Supabase inventoryRepository.getItemById error:", error);
        throw error;
      }
      if (!data) return null;
      
      return {
        id: data.id,
        sku: data.sku,
        name: data.name,
        category: (data.is_consumable ? "consumable" : "tooling") as InventoryItem["category"],
        unit: data.unit,
        currentStock: data.current_stock,
        minStock: data.min_stock || 0,
        storageLocation: "Standardlager",
        isConsumable: data.is_consumable,
        isHazardous: data.is_hazardous,
        pricePerUnit: data.price_per_unit || undefined
      };
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in inventoryRepository.getItemById - returning empty');
    return null;
  },

  async getMovementsByItem(inventoryItemId: string): Promise<StockMovement[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('stock_movements').select('*').eq('inventory_item_id', inventoryItemId).order('created_at', { ascending: false });
      if (error) {
        console.error("Supabase inventoryRepository.getMovementsByItem error:", error);
        throw error;
      }
      return data.map(m => ({
        id: m.id,
        inventoryItemId: m.inventory_item_id,
        movementType: m.movement_type as StockMovement["movementType"],
        quantity: m.quantity,
        unit: m.unit,
        orderId: m.order_id || undefined,
        reason: m.reason || undefined,
        createdBy: m.created_by,
        createdAt: m.created_at
      }));
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in inventoryRepository.getMovementsByItem - returning empty');
    return [];
  },

  async createMovement(data: Omit<StockMovement, "id" | "createdAt">): Promise<StockMovement> {
    if (isSupabase) {
      const supabase = createClient();
      
      // 1. Hole den aktuellen Artikel für Bestandskalkulation
      const item = await this.getItemById(data.inventoryItemId);
      if (!item) {
        throw new Error(`Inventory item ${data.inventoryItemId} not found.`);
      }

      // 2. Berechne neuen Bestand
      let change = data.quantity;
      if (data.movementType === "consumption" || data.movementType === "stock_out" || data.movementType === "waste") {
        change = -Math.abs(data.quantity);
      } else if (data.movementType === "correction") {
        change = data.quantity;
      } else {
        change = Math.abs(data.quantity);
      }
      
      const newStock = Math.max(0, item.currentStock + change);
      
      const newMovementDb = {
        id: createId(),
        inventory_item_id: data.inventoryItemId,
        movement_type: data.movementType,
        quantity: change, // Speichere die faktische Änderung (inkl. Vorzeichen), wie es in ERPs üblich ist, oder absolut? Mock nutzte absolut im Objekt.
        unit: data.unit,
        order_id: data.orderId || null,
        reason: data.reason || null,
        created_by: data.createdBy, // Stub für UUID im RLS Fall, aktuell Mail/Dummy
        created_at: new Date().toISOString()
      };

      // TRANSAKTIONALE SEQUENZ
      // A: Insert Bewegung (Historie ist wichtiger)
      const { error: moveError } = await supabase.from('stock_movements').insert(newMovementDb);
      if (moveError) {
        console.error("Supabase createMovement (insert movement) failed:", moveError?.message, moveError?.details, moveError?.hint);
        throw moveError;
      }

      // B: Update Lagerbestand
      const { error: updateError } = await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', data.inventoryItemId);
      if (updateError) {
        console.error("CRITICAL: Movement inserted, but stock update failed! Inventory out of sync.", updateError?.message, updateError?.details, updateError?.hint);
        throw updateError;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
      }

      return {
        ...data,
        id: newMovementDb.id,
        createdAt: newMovementDb.created_at
      };
    }

    // --- Mock Fallback ---
    console.warn('Mock fallback hit in inventoryRepository.createMovement - returning empty mock movement');
    return {
      ...data,
      id: createId(),
      createdAt: new Date().toISOString()
    };
  },

  async hasCriticalStock(): Promise<boolean> {
    const items = await this.getAllItems();
    return items.some(item => item.currentStock < item.minStock);
  }
};
