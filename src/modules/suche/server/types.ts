export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_QUERY_LENGTH = 80;
export const SEARCH_MAX_HITS = 20;
export const SEARCH_MAX_HITS_PER_TYPE = 10;

export type SearchHitType = "ORDER" | "CUSTOMER";

export type SearchMatchField =
  | "orderNumber"
  | "title"
  | "customerName"
  | "task"
  | "part"
  | "material"
  | "surface"
  | "dueDate"
  | "name"
  | "companyName"
  | "customerNumber"
  | "city";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle: string;
  status: string;
  matchField: SearchMatchField;
  source: "Auftragsbestand" | "Kundenstamm";
  matchLabel: string;
  matchValue: string;
  context: string;
  actionLabel: "Auftragskarte öffnen" | "Kundenkarte öffnen";
};

export type SearchOrderPart = {
  name: string;
  material: string | null;
  surfaceRequested: string | null;
};

export type SearchOrderDocument = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  title: string;
  task: string | null;
  station: string;
  status: string;
  dueDate: string;
  parts: readonly SearchOrderPart[];
};

export type SearchCustomerDocument = {
  id: string;
  customerNumber: string | null;
  name: string;
  companyName: string | null;
  customerType: string;
  city: string | null;
};

export type SearchPorts = {
  readOrders: () => Promise<readonly SearchOrderDocument[]>;
  searchCustomers: (query: string) => Promise<readonly SearchCustomerDocument[]>;
};

export type SearchTenantResult =
  | { code: "OK"; query: string; hits: SearchHit[] }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type SearchDialogState =
  | "idle"
  | "loading"
  | "empty"
  | "data"
  | "denial"
  | "error"
  | "conflict";

export type SearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: (query: string) => Promise<SearchTenantResult>;
  onSelect: (hit: SearchHit) => void;
  debounceMs?: number;
};
