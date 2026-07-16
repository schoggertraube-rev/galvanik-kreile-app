import {
  createComplaint,
  getComplaints,
  getComplaintsByCustomer,
  updateComplaint,
} from "@/app/actions/complaints.actions";

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
  status?: string;
};

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
  return result.data;
}

export const complaintsRepository = {
  async getAll(): Promise<Complaint[]> {
    return unwrap(await getComplaints());
  },

  async getByCustomer(customerId: string): Promise<Complaint[]> {
    return unwrap(await getComplaintsByCustomer(customerId));
  },

  async addComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint> {
    return unwrap(await createComplaint(complaint));
  },
  
  async updateComplaint(id: string, changes: Partial<Complaint>): Promise<Complaint | null> {
    const result = await updateComplaint(id, {
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.reason !== undefined ? { reason: changes.reason } : {}),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.resolution !== undefined ? { resolution: changes.resolution } : {}),
      ...(changes.resolvedAt !== undefined ? { resolvedAt: new Date(changes.resolvedAt) } : {}),
      ...(changes.photoIds !== undefined ? { photoIds: changes.photoIds } : {}),
    });
    return unwrap(result);
  }
};
