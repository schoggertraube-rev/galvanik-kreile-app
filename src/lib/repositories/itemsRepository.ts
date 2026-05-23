import { createId } from "@paralleldrive/cuid2";

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

export const itemsRepository = {
  async createMany(items: Omit<Item, "id">[]): Promise<Item[]> {
    const newItems = items.map(i => ({ ...i, id: createId() }));
    
    if (typeof window !== "undefined") {
      const existing = JSON.parse(localStorage.getItem("kreile_items") || "[]");
      localStorage.setItem("kreile_items", JSON.stringify([...existing, ...newItems]));
      
      // Persist base64 photo data URL in localStorage
      newItems.forEach(item => {
        if (item.photo) {
          localStorage.setItem(`kreile_photo_item_${item.id}`, item.photo);
        }
      });
    }
    return newItems;
  }
};
