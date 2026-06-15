import { Customer } from "@/lib/types/customer";
import { getCustomersDb, getCustomerByIdDb, createCustomerDb, updateCustomerDb, searchCustomersDb } from "@/app/actions/customers.actions";

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
    const res = await createCustomerDb(data);
    if (!res.ok) {
      throw new Error(res.message);
    }
    return res.data;
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


    const res = await updateCustomerDb(id, changes);
    if (!res.ok) {
      throw new Error(res.message);
    }
    return res.data;
  }
};
