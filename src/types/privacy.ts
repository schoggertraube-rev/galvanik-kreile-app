// src/types/privacy.ts
// DSGVO-Minimum — NUR für Rechnungen, Zahlungen, Kundenstammdaten

export type DataRetentionPolicy = {
  id: string;
  entityType: "invoice" | "payment" | "customer";
  retentionYears: number;
  triggerField: string;
  lawfulBasis: string;
};

export type DataSubjectRequest = {
  id: string;
  type: "access" | "erasure";
  customerId: string;
  receivedAt: string;
  deadline: string;
  status: "open" | "in_progress" | "done";
  resultNote?: string;
  handledBy?: string;
  handledAt?: string;
};
