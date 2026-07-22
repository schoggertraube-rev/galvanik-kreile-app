"use server";

// Preserved compatibility export.  The former implementation accepted an
// arbitrary URL and wrote an unverifiable `processed` scan row.  Order photos
// must use the private, receipt-backed item-photo job boundary instead.
export async function uploadOrderPhotoRecord(_params: {
  orderId: string;
  fileUrl: string;
  fileType: string;
}) {
  void _params;
  return {
    success: false as const,
    code: "ORDER_PHOTO_RECEIPT_REQUIRED",
    error: "Auftragsfotos bleiben gesperrt, bis der private Foto-Belegpfad angebunden ist.",
  };
}
