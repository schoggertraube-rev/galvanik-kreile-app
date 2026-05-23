import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";

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

const INITIAL_ITEMS: InventoryItem[] = [
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
];

const INITIAL_MOVEMENTS: StockMovement[] = [
  { id: "sm-1", inventoryItemId: "inv-1", movementType: "stock_in", quantity: 50, unit: "l", reason: "Reguläre Nachlieferung", createdBy: "office@kreile.de", createdAt: "2026-05-20T08:30:00Z" },
  { id: "sm-2", inventoryItemId: "inv-5", movementType: "consumption", quantity: 5, unit: "pcs", orderId: "o1", reason: "Materialentnahme Schleiferei", createdBy: "werkstatt1@kreile.de", createdAt: "2026-05-21T09:15:00Z" },
  { id: "sm-3", inventoryItemId: "inv-6", movementType: "consumption", quantity: 10, unit: "pcs", orderId: "o2", reason: "Reinigung Schleiferei", createdBy: "werkstatt2@kreile.de", createdAt: "2026-05-21T10:45:00Z" },
  { id: "sm-4", inventoryItemId: "inv-4", movementType: "consumption", quantity: 2, unit: "l", reason: "Dosierung Nickelbad 1", createdBy: "meister@kreile.de", createdAt: "2026-05-21T11:20:00Z" },
  { id: "sm-5", inventoryItemId: "inv-7", movementType: "correction", quantity: -2, unit: "pcs", reason: "Ausschuss-Korrektur Inventur", createdBy: "meister@kreile.de", createdAt: "2026-05-21T14:00:00Z" },
  { id: "sm-6", inventoryItemId: "inv-2", movementType: "consumption", quantity: 5, unit: "l", orderId: "o11", reason: "Badregeneration Nickelbad 1", createdBy: "meister@kreile.de", createdAt: "2026-05-20T10:00:00Z" },
  { id: "sm-7", inventoryItemId: "inv-11", movementType: "consumption", quantity: 15, unit: "pcs", orderId: "o5", reason: "Verpackung Möbelbeschläge", createdBy: "werkstatt2@kreile.de", createdAt: "2026-05-21T16:00:00Z" },
  { id: "sm-8", inventoryItemId: "inv-3", movementType: "consumption", quantity: 10, unit: "l", reason: "Ansatz Entfettungsbad 1", createdBy: "werkstatt1@kreile.de", createdAt: "2026-05-19T08:00:00Z" },
  { id: "sm-9", inventoryItemId: "inv-12", movementType: "consumption", quantity: 25, unit: "m", orderId: "o3", reason: "Verpackung Besteckteile", createdBy: "werkstatt2@kreile.de", createdAt: "2026-05-21T15:30:00Z" },
  { id: "sm-10", inventoryItemId: "inv-10", movementType: "stock_in", quantity: 10, unit: "pcs", reason: "Ersatzbeschaffung Aufhängungen", createdBy: "office@kreile.de", createdAt: "2026-05-18T10:00:00Z" },
  { id: "sm-11", inventoryItemId: "inv-5", movementType: "consumption", quantity: 8, unit: "pcs", orderId: "o9", reason: "Schleifvorgang Porsche Zierleisten", createdBy: "werkstatt1@kreile.de", createdAt: "2026-05-21T11:00:00Z" },
  { id: "sm-12", inventoryItemId: "inv-13", movementType: "consumption", quantity: 2, unit: "pcs", orderId: "o9", reason: "Polieren Porsche Zierleisten", createdBy: "werkstatt1@kreile.de", createdAt: "2026-05-21T13:45:00Z" },
  { id: "sm-13", inventoryItemId: "inv-14", movementType: "consumption", quantity: 1, unit: "pcs", orderId: "o8", reason: "Entrostung Tank NSU", createdBy: "werkstatt2@kreile.de", createdAt: "2026-05-20T14:30:00Z" },
  { id: "sm-14", inventoryItemId: "inv-1", movementType: "consumption", quantity: 15, unit: "l", reason: "Nachdosierung Säurebad", createdBy: "meister@kreile.de", createdAt: "2026-05-21T08:15:00Z" },
  { id: "sm-15", inventoryItemId: "inv-8", movementType: "consumption", quantity: 3, unit: "pcs", reason: "Verschleißersatz Bürsten", createdBy: "werkstatt1@kreile.de", createdAt: "2026-05-20T16:45:05Z" },
  { id: "sm-16", inventoryItemId: "inv-11", movementType: "stock_in", quantity: 100, unit: "pcs", reason: "Nachbestellung Kartonagen", createdBy: "office@kreile.de", createdAt: "2026-05-17T11:30:00Z" },
  { id: "sm-17", inventoryItemId: "inv-4", movementType: "stock_in", quantity: 20, unit: "l", reason: "Chemielieferung BASF", createdBy: "office@kreile.de", createdAt: "2026-05-19T09:00:00Z" },
  { id: "sm-18", inventoryItemId: "inv-5", movementType: "consumption", quantity: 4, unit: "pcs", orderId: "o10", reason: "Vorschleifen Altarleuchter", createdBy: "werkstatt2@kreile.de", createdAt: "2026-05-21T10:15:00Z" },
  { id: "sm-19", inventoryItemId: "inv-13", movementType: "consumption", quantity: 3, unit: "pcs", orderId: "o10", reason: "Feinpolitur Altarleuchter", createdBy: "werkstatt2@kreile.de", createdAt: "2026-05-21T15:00:00Z" },
  { id: "sm-20", inventoryItemId: "inv-2", movementType: "stock_in", quantity: 30, unit: "l", reason: "Nachbestellung Nickelzusatz", createdBy: "office@kreile.de", createdAt: "2026-05-19T14:30:00Z" }
];

export const inventoryRepository = {
  async getAllItems(): Promise<InventoryItem[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_inventory_items");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_inventory_items", JSON.stringify(INITIAL_ITEMS));
    }
    return INITIAL_ITEMS;
  },

  async getAllMovements(): Promise<StockMovement[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_stock_movements");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_stock_movements", JSON.stringify(INITIAL_MOVEMENTS));
    }
    return INITIAL_MOVEMENTS;
  },

  async getItemById(id: string): Promise<InventoryItem | null> {
    const all = await this.getAllItems();
    return all.find(item => item.id === id) || null;
  },

  async getMovementsByItem(inventoryItemId: string): Promise<StockMovement[]> {
    const all = await this.getAllMovements();
    return all
      .filter(m => m.inventoryItemId === inventoryItemId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createMovement(data: Omit<StockMovement, "id" | "createdAt">): Promise<StockMovement> {
    const items = await this.getAllItems();
    const item = items.find(i => i.id === data.inventoryItemId);
    
    if (!item) {
      throw new Error(`Inventory item ${data.inventoryItemId} not found.`);
    }

    // Calculate new stock
    let change = data.quantity;
    if (data.movementType === "consumption" || data.movementType === "stock_out" || data.movementType === "waste") {
      change = -Math.abs(data.quantity);
    } else if (data.movementType === "correction") {
      change = data.quantity; // correction can be positive or negative
    } else {
      change = Math.abs(data.quantity); // stock_in
    }

    item.currentStock = Math.max(0, item.currentStock + change);

    const newMovement: StockMovement = {
      ...data,
      id: createId(),
      createdAt: new Date().toISOString()
    };

    // 1. Handle Offline write queue
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing material booking movement in IndexedDB");
      await OfflineManager.enqueueAction("MATERIAL_BOOKING", data);
      
      // Perform optimistic updates locally for instant inventory warning & layout refresh
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_inventory_items", JSON.stringify(items));
        
        // optimistic movement tracking
        const movements = await this.getAllMovements();
        localStorage.setItem("kreile_stock_movements", JSON.stringify([newMovement, ...movements]));
        
        window.dispatchEvent(new Event("storage")); // force layout state sync
      }
      return newMovement;
    }

    // 2. Handle Online standard write
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_inventory_items", JSON.stringify(items));
      const movements = await this.getAllMovements();
      localStorage.setItem("kreile_stock_movements", JSON.stringify([newMovement, ...movements]));
      
      // Dispatch custom storage event to update topbar instantly
      window.dispatchEvent(new Event("storage"));
    }

    return newMovement;
  },

  async hasCriticalStock(): Promise<boolean> {
    const items = await this.getAllItems();
    return items.some(item => item.currentStock < item.minStock);
  }
};

