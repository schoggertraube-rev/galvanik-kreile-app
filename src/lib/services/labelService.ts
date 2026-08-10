export type LabelUnavailable = {
  ok: false;
  error: "NOT_AVAILABLE";
  message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";
};

export const labelService = {
  async generateLabel(_orderId: string): Promise<LabelUnavailable> {
    void _orderId;
    return {
      ok: false,
      error: "NOT_AVAILABLE",
      message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.",
    };
  },
};
