export const labelService = {
  async generateLabel(_orderId: string) {
    throw new Error("NOT_CONFIGURED: Etikettendruck besitzt noch keinen belegten Druck- und QR-Vertrag.");
  },
};
