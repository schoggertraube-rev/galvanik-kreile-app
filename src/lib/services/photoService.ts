import { eventsRepository } from "../repositories/eventsRepository";
import { createClient } from "@/lib/supabase/client";

export const photoService = {
  async savePhotoForOrder(orderId: string, photoDataUrl: string) {
    // If no Supabase URL is provided, fallback to the offline/mock approach
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      console.log(`📸 Photo virtuell gespeichert (kein Supabase) für Order ${orderId}`);
      await eventsRepository.addEvent({ eventType: "PHOTO_CAPTURED", orderId });
      return photoDataUrl; 
    }

    try {
      // Decode base64 for real upload
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      
      const fileName = `${orderId}-${Date.now()}.jpg`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from('intake-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('intake-photos').getPublicUrl(fileName);
      await eventsRepository.addEvent({ eventType: "PHOTO_CAPTURED", orderId });
      console.log("☁️ Photo erfolgreich zu Supabase hochgeladen:", publicUrl);
      return publicUrl;
    } catch (error) {
      console.error("Fehler beim Upload des Bildes zu Supabase:", error);
      // Fallback: return the base64 string directly so we don't lose the photo
      return photoDataUrl;
    }
  }
};
