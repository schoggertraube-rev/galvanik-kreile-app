'use server';

export async function saveShipmentInfo(params: {
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
}) {
  void params;
  return { success: false, error: 'NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.' };
}

export async function sendShippingConfirmation(params: {
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
}) {
  void params;
  return { success: false, error: 'NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.' };
}
