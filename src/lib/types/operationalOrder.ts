export type OperationalOrderItem = {
  id: string;
  tenantId: string | null;
  orderId: string;
  customerId: string;
  name: string;
  quantity: number;
  currentStationId: string | null;
  material: string | null;
  surfaceRequested: string | null;
  photoIds: string[] | null;
  photo: string | null;
  repairTypes: string[] | null;
  stationSequence: unknown;
  currentStep: number | null;
  internalNotes: string | null;
  createdAt: Date;
};

export type OperationalOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string | null;
  title: string;
  task: string | null;
  itemDescription: string | null;
  surfaceRequested: string | null;
  station: string;
  status: string;
  risk: string;
  currentStationId: string;
  parts: OperationalOrderItem[];
  intakeDate: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
  createdAt: string | undefined;
};
