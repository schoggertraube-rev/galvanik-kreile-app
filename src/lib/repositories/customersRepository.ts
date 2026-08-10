import { Customer } from "@/lib/types/customer";
import { getCustomersDb, getCustomerByIdDb, searchCustomersDb } from "@/app/actions/customers.actions";

export type { Customer };

export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    const res = await getCustomersDb();
    if (!res.ok) {
      if (res.error === "UNAUTHORIZED" || res.error === "FORBIDDEN") {
        return [];
      }
      throw new Error(res.message);
    }
    return res.data;
  },

  async getById(id: string): Promise<Customer | null> {
    const res = await getCustomerByIdDb(id);
    if (!res.ok) {
      if (res.error === "UNAUTHORIZED" || res.error === "FORBIDDEN") {
        return null;
      }
      throw new Error(res.message);
    }
    return res.data;
  },

  async create(data: Omit<Customer, "id" | "customerNumber">): Promise<Customer> {
    void data;
    throw new Error("NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag.");
  },

  async findSimilar(nameOrPhone: string): Promise<Customer[]> {
    const res = await searchCustomersDb(nameOrPhone);
    if (!res.ok) {
      if (res.error === "UNAUTHORIZED" || res.error === "FORBIDDEN") {
        return [];
      }
      throw new Error(res.message);
    }
    return res.data;
  },

  async updateCustomer(id: string, changes: Partial<Customer>): Promise<Customer | null> {
    void id;
    void changes;
    throw new Error("NOT_AVAILABLE: Kundenänderungen benötigen den W3-Command-Vertrag.");
  }
};
