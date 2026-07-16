import {
  createKvpItemAction,
  getKvpItemsAction,
  updateKvpStatusAction,
} from "@/app/actions/kvp.actions";

export type KvpItem = {
  id: string;
  title: string;
  category: string;
  benefit: string;
  status: "neu" | "prüfen" | "angenommen" | "umgesetzt" | "abgelehnt";
  problemDesc: string;
  hasPhoto: boolean;
  date: string;
};

export const kvpRepository = {
  async getAll(): Promise<KvpItem[]> {
    const result = await getKvpItemsAction();
    if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
    return result.data;
  },

  async addItem(item: Omit<KvpItem, "id" | "date"> & { date?: string }): Promise<KvpItem> {
    const result = await createKvpItemAction({
      title: item.title,
      category: item.category,
      benefit: item.benefit,
      status: item.status,
      problemDesc: item.problemDesc,
      hasPhoto: item.hasPhoto,
    });
    if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
    return result.data;
  },

  async updateItemStatus(id: string, status: KvpItem["status"]): Promise<KvpItem | null> {
    const result = await updateKvpStatusAction(id, status);
    if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
    return result.data;
  }
};
