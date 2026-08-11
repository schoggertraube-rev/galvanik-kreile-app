import { getOrdersDb, updateOrderDb } from "@/app/actions/orders.actions";

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  station: string; 
  status: string;
  risk: string; 
  currentStationId?: string;
  dueDate?: string;
  parts: Record<string, unknown>[];
  statusText?: string;
  delayReason?: string;
  recommendedAction?: string;
  dueLabel?: string;
  dueValue?: string;
  intakeDate?: string;
  task?: string;
  customerName?: string;
  itemDescription?: string;
  surfaceRequested?: string;
  rawIntakeDate?: string;
  source?: string;
  rawDueDate?: string;
  attachmentUrl?: string;
}

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    const result = await getOrdersDb();
    if (!result.ok) {
      throw new Error(`${result.error}: ${result.message}`);
    }
    return result.data as unknown as Order[];
  },

  async create(data: Omit<Order, "id" | "orderNumber" | "status" | "risk"> & { id?: string }): Promise<Order> {
    void data;
    throw new Error("NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag.");
  },

  async updateOrder(idOrNumber: string, changes: Partial<Order>): Promise<Order | null> {
    if (isSupabase) {
      const result = await updateOrderDb(idOrNumber, changes);
      if (!result.ok) {
        if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
          throw new Error(`AUTH_ERROR: ${result.message}`);
        }
        throw new Error("Update failed: " + result.message);
      }
      const all = await this.getAll();
      const updatedOrder = all.find(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
      return updatedOrder || null;
    }
    throw new Error("Supabase is not enabled.");
  }
};
