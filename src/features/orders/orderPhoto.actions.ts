'use server';

export async function uploadOrderPhotoRecord(params: {
  orderId: string;
  fileUrl: string;
  fileType: string;
}) {
  console.warn("Legacy uploadOrderPhotoRecord was called, but is deactivated.");
  return { success: false, error: 'Legacy-Foto-Upload deaktiviert. Bitte nutzen Sie die zentrale Scan-Erfassung.' };
}
