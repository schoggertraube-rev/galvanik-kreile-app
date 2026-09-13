'use server';

export async function uploadOrderPhotoRecord(params: {
  orderId: string;
  fileUrl: string;
  fileType: string;
}): Promise<{ success: boolean; error?: string }> {
  void params;
  return { success: false, error: "NOT_AVAILABLE: Fotoerfassung benötigt den W3-Command-Vertrag." };
}
