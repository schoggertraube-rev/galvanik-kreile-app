export type CustomerType = "private" | "business" | "institution" | "Privatkunde" | "Geschäftskunde" | "Institution";

export type CustomerStatus =
  | "new"
  | "regular"
  | "vip"
  | "watch"
  | "sensitive"
  | "inactive";

export type PaymentProfile = {
  defaultPaymentMethod?: "invoice" | "cash" | "card" | "bank_transfer" | "unknown";
  paymentBehavior?: "unknown" | "on_time" | "slow" | "prepayment_required";
  invoiceNotes?: string;
  requiresPurchaseOrder?: boolean;
  vatId?: string;
};

export type ApprovalProfile = {
  needsWrittenApproval?: boolean;
  usualApprovalTimeDays?: number;
  decisionMaker?: string;
  approvalNotes?: string;
};

export type ExpectationProfile = {
  qualityExpectation?: "standard" | "high" | "show_quality" | "museum_quality" | "unclear";
  priceSensitivity?: "low" | "medium" | "high" | "unknown";
  communicationStyle?: "brief" | "detailed" | "needs_guidance" | "technical";
  riskNotes?: string;
};

export type TechnicalProfile = {
  commonMaterials?: string[];
  commonSurfaces?: string[];
  recurringObjectTypes?: string[];
  packagingPreference?: string;
  handlingNotes?: string;
  specialTechnicalNotes?: string;
};

export type PriceMemoryEntry = {
  id: string;
  customerId: string;
  orderId?: string;
  itemId?: string;

  title: string;
  surface?: string;
  material?: string;
  quantity?: number;

  priceNet?: number;
  priceGross?: number;
  currency: "EUR";

  year: number;
  reason?: string;
  marginNote?: string;
  wasSpecialAgreement?: boolean;

  createdAt: string;
};

export type RecurringItemProfile = {
  id: string;
  customerId: string;

  name: string;
  usualSurface?: string;
  usualMaterial?: string;
  averagePriceNet?: number;
  averageDurationDays?: number;

  lastOrderId?: string;
  lastSeenAt?: string;

  photoIds?: string[];
  notes?: string;
};

export type ComplaintSummary = {
  totalComplaints: number;
  totalReworks: number;
  lastComplaintAt?: string;
  mainCauses?: string[];
  riskLevel: "low" | "medium" | "high" | "unknown";
};

export type CustomerInsightType =
  | "similar_order_found"
  | "price_reference"
  | "communication_hint"
  | "risk_hint"
  | "opportunity_hint"
  | "documentation_hint"
  | "payment_hint"
  | "approval_hint";

export type CustomerInsight = {
  id: string;
  customerId: string;

  type: CustomerInsightType;

  title: string;
  description: string;
  severity: "info" | "positive" | "watch" | "critical";
  relatedOrderId?: string;
  relatedItemId?: string;
  createdAt: string;
};

// MockOrder integration to avoid importing huge mock file everywhere
export interface CustomerMockOrder {
  id: string;
  orderNumber: string;
  task: string;
  intakeDate: string;
  dueDate: string;
  status: "active" | "done" | "waiting" | "critical" | string;
  statusText: string;
  parts: any[];
}

export type Customer = {
  id: string;
  customerNumber: string;
  name: string;
  type: CustomerType;

  city?: string;
  address?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;

  prefComm?: "E-Mail" | "Telefon" | "Brief / Post" | "whatsapp" | "unknown";
  communicationPreference?: "phone" | "email" | "whatsapp" | "post" | "unknown";

  customerStatus?: CustomerStatus;
  trustLevel?: "unknown" | "stable" | "very_reliable" | "needs_attention";
  risk?: "Niedrig" | "Mittel" | "Hoch";
  riskNote?: string;

  paymentProfile?: PaymentProfile;
  approvalProfile?: ApprovalProfile;
  expectationProfile?: ExpectationProfile;
  technicalProfile?: TechnicalProfile;

  priceMemory?: PriceMemoryEntry[];
  recurringItems?: RecurringItemProfile[];
  complaintSummary?: ComplaintSummary;
  relationshipInsights?: CustomerInsight[];

  // Legacy mappings for backwards compatibility
  orders?: CustomerMockOrder[];
  priceAgreements?: any[];
  feedbacks?: any[];

  notes?: string;
  internalWarning?: string;

  companyInfo?: {
    industry?: string;
    size?: string;
    revenue?: string;
    website?: string;
    founded?: string;
    linkedin?: string;
  };
  aiSummary?: string;
  tags?: string[];
  creditRating?: string;

  createdAt?: string;
  updatedAt?: string;
};
