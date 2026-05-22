import { createId } from "@paralleldrive/cuid2";

export type Item = {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  material?: string;
  surfaceRequested?: string;
  photoIds?: string[];
}

export const itemsRepository = {
  async createMany(items: Omit<Item, "id">[]): Promise<Item[]> {
    const newItems = items.map(i => ({ ...i, id: createId() }));
    
    if (typeof window !== "undefined") {
      const existing = JSON.parse(localStorage.getItem("kreile_items") || "[]");
      localStorage.setItem("kreile_items", JSON.stringify([...existing, ...newItems]));
    }
    return newItems;
  }
};
