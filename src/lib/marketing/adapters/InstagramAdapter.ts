/* ═══════════════════════════════════════════════════════════
   Instagram Adapter (Meta Graph API)
   Spec: 22 §2 (Instagram - Stufe 1/2)
   ═══════════════════════════════════════════════════════════ */

import type { AktionVorschlag } from "../marketingTypes";

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message?: unknown };
    return typeof message === "string" ? message : undefined;
  }

  return undefined;
}

export interface ChannelAdapter {
  id: string;
  isConnected(): Promise<boolean>;
  publish(aktion: AktionVorschlag): Promise<{ success: boolean; message: string; touchpointId?: string }>;
}

export class InstagramAdapter implements ChannelAdapter {
  id = 'instagram';

  private async getStoredToken(): Promise<string | null> {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ig_access_token') || null;
    }
    return null;
  }

  async isConnected(): Promise<boolean> {
    const token = await this.getStoredToken();
    return !!token;
  }

  connect(redirectUri: string) {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID || '1480036612948628'; // fallback to a generic app id if missing
    const scope = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement';
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&display=page&extras={"setup":{"channel":"IG_API_ONBOARDING"}}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}`;
    
    if (typeof window !== 'undefined') {
      window.location.href = authUrl;
    }
  }

  async fetchIgUserId(token: string): Promise<string> {
    // 1. Get Pages
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
    const pagesData = await pagesRes.json();
    if (pagesData.error) throw new Error(pagesData.error.message);
    if (!pagesData.data || pagesData.data.length === 0) throw new Error("Keine Facebook-Seite gefunden.");

    const pageId = pagesData.data[0].id;

    // 2. Get IG Business Account
    const igRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${token}`);
    const igData = await igRes.json();
    if (igData.error) throw new Error(igData.error.message);
    if (!igData.instagram_business_account) throw new Error("Kein Instagram Business Account mit dieser Facebook-Seite verknüpft.");

    return igData.instagram_business_account.id;
  }

  async publish(aktion: AktionVorschlag): Promise<{ success: boolean; message: string; touchpointId?: string }> {
    const token = await this.getStoredToken();
    if (!token) {
      return { success: false, message: "Instagram ist nicht verknüpft." };
    }

    try {
      const igUserId = await this.fetchIgUserId(token);
      
      // 1. Container erstellen (Bild hochladen)
      const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: 'https://via.placeholder.com/1080', // Fallback for now if image is missing
          caption: `[${aktion.titel}]\n\n${Array.isArray(aktion.hashtags) ? aktion.hashtags.join(' ') : (aktion.hashtags || '')}`,
          access_token: token
        })
      });

      const containerData = await containerRes.json();
      if (containerData.error) throw new Error(containerData.error.message);

      // Wait a bit for FB processing
      await new Promise(r => setTimeout(r, 2000));

      // 2. Veröffentlichen
      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: token
        })
      });

      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message);

      return {
        success: true,
        message: "Erfolgreich auf Instagram veröffentlicht!",
        touchpointId: publishData.id
      };

    } catch (err: unknown) {
      console.error("Instagram API Error:", err);
      return { success: false, message: `Instagram API Fehler: ${getErrorMessage(err) ?? "undefined"}` };
    }
  }
}

export const instagramAdapter = new InstagramAdapter();
