import {
  createItemDb,
  getItemsByOrderDb,
  getItemsDb,
  updateItemDb,
  type ItemResponse,
} from "@/app/actions/items.actions";

export type Item = ItemResponse;

function confirmed<T>(result: Awaited<ReturnType<typeof getItemsDb>> | { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.data as T;
}

export const itemsRepository = {
  async getAll(): Promise<Item[]> {
    return confirmed<Item[]>(await getItemsDb());
  },

  async getByOrderId(orderId: string): Promise<Item[]> {
    return confirmed<Item[]>(await getItemsByOrderDb(orderId));
  },

  async create(data: Omit<Item, "id"> & { id?: string }): Promise<Item> {
    return confirmed<Item>(await createItemDb(data));
  },

  async update(id: string, changes: Partial<Omit<Item, "id" | "orderId">>): Promise<Item> {
    return confirmed<Item>(await updateItemDb(id, changes));
  },

  async createMany(newItems: Array<Omit<Item, "id">>): Promise<Item[]> {
    const results: Item[] = [];
    for (const item of newItems) results.push(await this.create(item));
    return results;
  },
};
