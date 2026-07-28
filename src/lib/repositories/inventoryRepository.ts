import { createId } from "@paralleldrive/cuid2";
import "@/lib/offline/OfflineManager";
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

void ([
  { id: "inv-1", sku: "MAT-100", name: "Salzsäure 30%", category: "chemical", unit: "l", currentStock: 85, minStock: 30, storageLocation: "Chemielager Regal A", isConsumable: true, isHazardous: true, pricePerUnit: 2.50 },
  { id: "inv-2", sku: "MAT-101", name: "Nickelzusatz Typ X", category: "chemical", unit: "l", currentStock: 45, minStock: 25, storageLocation: "Chemielager Regal B", isConsumable: true, isHazardous: true, pricePerUnit: 18.00 },
  { id: "inv-3", sku: "MAT-102", name: "Entfetter Universal", category: "chemical", unit: "l", currentStock: 60, minStock: 20, storageLocation: "Chemielager Regal A", isConsumable: true, isHazardous: true, pricePerUnit: 9.50 },
  { id: "inv-4", sku: "MAT-103", name: "Glanzzusatz Ultra", category: "chemical", unit: "l", currentStock: 12, minStock: 15, storageLocation: "Chemielager Regal B", isConsumable: true, isHazardous: false, pricePerUnit: 15.00 },
  { id: "inv-5", sku: "MAT-104", name: "Schleifpapier P240", category: "consumable", unit: "pcs", currentStock: 40, minStock: 25, storageLocation: "Schleiferei Schrank 2", isConsumable: true, isHazardous: false, pricePerUnit: 0.80 },
  { id: "inv-6", sku: "MAT-105", name: "Schleifpapier P400", category: "consumable", unit: "pcs", currentStock: 12, minStock: 30, storageLocation: "Schleiferei Schrank 2", isConsumable: true, isHazardous: false, pricePerUnit: 0.95 },
  { id: "inv-7", sku: "MAT-106", name: "Polierscheibe Filz", category: "consumable", unit: "pcs", currentStock: 8, minStock: 10, storageLocation: "Schleiferei Regal 1", isConsumable: true, isHazardous: false, pricePerUnit: 4.50 },
  { id: "inv-8", sku: "MAT-107", name: "Bürste Messing", category: "consumable", unit: "pcs", currentStock: 15, minStock: 5, storageLocation: "Galvanik Badbereich", isConsumable: true, isHazardous: false, pricePerUnit: 6.20 },
  { id: "inv-9", sku: "MAT-108", name: "Titan-Anodenkorb", category: "tooling", unit: "pcs", currentStock: 4, minStock: 2, storageLocation: "Galvanik Lagerraum", isConsumable: false, isHazardous: false, pricePerUnit: 250.00 },
  { id: "inv-10", sku: "MAT-109", name: "Kupferaufhängung XL", category: "tooling", unit: "pcs", currentStock: 24, minStock: 10, storageLocation: "Galvanik Lagerraum", isConsumable: false, isHazardous: false, pricePerUnit: 45.00 },
  { id: "inv-11", sku: "MAT-110", name: "Karton A4 Faltbar", category: "packaging", unit: "pcs", currentStock: 150, minStock: 50, storageLocation: "Warenausgang Lager", isConsumable: true, isHazardous: false, pricePerUnit: 1.20 },
  { id: "inv-12", sku: "MAT-111", name: "Schutzfolie Rolle", category: "packaging", unit: "m", currentStock: 300, minStock: 50, storageLocation: "Warenausgang Lager", isConsumable: true, isHazardous: false, pricePerUnit: 0.15 },
  { id: "inv-13", sku: "MAT-112", name: "Polierscheibe Baumwolle", category: "consumable", unit: "pcs", currentStock: 15, minStock: 5, storageLocation: "Schleiferei Regal 1", isConsumable: true, isHazardous: false, pricePerUnit: 3.20 },
  { id: "inv-14", sku: "MAT-113", name: "Bürste Stahl", category: "consumable", unit: "pcs", currentStock: 10, minStock: 5, storageLocation: "Schleiferei Schrank 2", isConsumable: true, isHazardous: false, pricePerUnit: 7.40 }
]);

void ([
  { id: "sm-1", inventoryItemId: "inv-1", movementType: "stock_in", quantity: 50, unit: "l", reason: "Reguläre Nachlieferung", createdBy: "office@kreile.de", createdAt: "2026-05-20T08:30:00Z" },
  { id: "sm-2", inventoryItemId: "inv-5", movementType: "consumption", quantity: 5, unit: "pcs", orderId: "o1", reason: "Materialentnahme Schleiferei", createdBy: "werkstatt1@kreile.de", createdAt: "2026-05-21T09:15:00Z" }
]);

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

function legacyInventoryUnavailable(): never {
  throw new Error("NOT_CONFIGURED: Lagerzugriff und Bestandsbuchungen besitzen keinen belegten Server- und Transaktionsvertrag.");
}

function isLegacyInventoryEnabled(): boolean {
  return false;
}

export const inventoryRepository = {
  async getAllItems(): Promise<InventoryItem[]> {
    if (!isLegacyInventoryEnabled()) return legacyInventoryUnavailable();
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
    if (!isLegacyInventoryEnabled()) return legacyInventoryUnavailable();
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
    void id;
    if (!isLegacyInventoryEnabled()) return legacyInventoryUnavailable();
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
    void inventoryItemId;
    if (!isLegacyInventoryEnabled()) return legacyInventoryUnavailable();
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
    void data;
    if (!isLegacyInventoryEnabled()) return legacyInventoryUnavailable();
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
    if (!isLegacyInventoryEnabled()) return legacyInventoryUnavailable();
    const items = await this.getAllItems();
    return items.some(item => item.currentStock < item.minStock);
  }
};
