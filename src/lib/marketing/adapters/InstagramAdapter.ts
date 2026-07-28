import type { AktionVorschlag } from "../marketingTypes";

export interface ChannelAdapter {
  id: string;
  isConnected(): Promise<boolean>;
  publish(aktion: AktionVorschlag): Promise<{ success: boolean; message: string; touchpointId?: string }>;
}

/** Marketing integrations require consent, tenant and execution contracts. */
export class InstagramAdapter implements ChannelAdapter {
  id = "instagram";

  async isConnected(): Promise<boolean> {
    return false;
  }

  connect(_redirectUri: string): never {
    void _redirectUri;
    throw new Error("NOT_CONFIGURED: Instagram-Integration ist nicht freigegeben.");
  }

  async publish(_aktion: AktionVorschlag): Promise<{ success: boolean; message: string }> {
    void _aktion;
    return {
      success: false,
      message: "NOT_CONFIGURED: Marketing-Veröffentlichungen sind nicht freigegeben.",
    };
  }
}

export const instagramAdapter = new InstagramAdapter();
