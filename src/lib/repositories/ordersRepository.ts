import { getOrdersDb, createOrderDb, updateOrderDb } from "@/app/actions/orders.actions";
import type { OrderSource } from "@/lib/validation/orderSchema";
import type { OrderUpdateInput } from "@/lib/orders/orderMutationContract";

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
  isQuote?: boolean;
}

export type OrderCreateInput = {
  customerId: string;
  title: string;
  task?: string;
  source: OrderSource;
  sourceRef?: string;
  dueDate?: string | Date;
  isQuote?: boolean;
  calendarSync?: boolean;
  timeWindow?: "ganztaegig" | "vormittags" | "nachmittags" | "spaet";
  freetextOriginal?: string;
  customerBehaviorNote?: string;
  parts: Array<{
    name: string;
    quantity: number;
    surfaceRequested?: string;
    material?: string;
  }>;
};

function repositoryError(operation: string, result: { message: string; error: string }): Error {
  const prefix = result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
    ? "AUTH_ERROR"
    : "DATA_ERROR";
  return new Error(`${prefix}: ${operation}: ${result.message}`);
}

export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    const result = await getOrdersDb();
    if (!result.ok) {
      throw repositoryError("Aufträge laden", result);
    }
    return result.data as unknown as Order[];
  },

  async create(data: OrderCreateInput): Promise<Order> {
    const result = await createOrderDb(data);
    if (!result.ok) {
      throw repositoryError("Auftrag anlegen", result);
    }
    return result.data as unknown as Order;
  },

  async updateOrder(idOrNumber: string, changes: OrderUpdateInput): Promise<Order | null> {
    const result = await updateOrderDb(idOrNumber, changes);
    if (!result.ok) {
      throw repositoryError("Auftrag aktualisieren", result);
    }
    const all = await this.getAll();
    return all.find(o => o.id === idOrNumber || o.orderNumber === idOrNumber) ?? null;
  }
};
