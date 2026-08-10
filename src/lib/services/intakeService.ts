export type IntakeUnavailable = {
  ok: false;
  error: "NOT_AVAILABLE";
  message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";
};

export const intakeService = {
  async processIntake(_data: {
    customerId: string | null;
    newCustomerName?: string;
    newCustomerDetails?: Record<string, string>;
    orderTitle: string;
    items: { name: string; quantity: number; surfaceRequested?: string; photo?: string }[];
  }): Promise<IntakeUnavailable> {
    void _data;
    return {
      ok: false,
      error: "NOT_AVAILABLE",
      message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.",
    };
  },
};
