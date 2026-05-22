export type Complaint = {
  id: string;
  customerId: string;
  orderId: string;
  itemId?: string;
  reason:
    | "surface_quality"
    | "wrong_surface"
    | "damage"
    | "delay"
    | "communication"
    | "customer_expectation"
    | "transport"
    | "other";
  stationId?: string;
  description: string;
  photoIds: string[];
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};

const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: "complaint-1",
    customerId: "cust-1",
    orderId: "A-2026-0042",
    reason: "surface_quality",
    description: "Kunde meldet matte Stellen an der Stoßstange",
    photoIds: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const complaintsRepository = {
  async getAll(): Promise<Complaint[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_complaints");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_complaints", JSON.stringify(INITIAL_COMPLAINTS));
    }
    return INITIAL_COMPLAINTS;
  },

  async getByCustomer(customerId: string): Promise<Complaint[]> {
    const all = await this.getAll();
    return all.filter(c => c.customerId === customerId);
  },

  async addComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint> {
    const newComplaint: Complaint = {
      ...complaint,
      id: `complaint-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const all = await this.getAll();
    all.push(newComplaint);
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_complaints", JSON.stringify(all));
    }
    return newComplaint;
  }
};
