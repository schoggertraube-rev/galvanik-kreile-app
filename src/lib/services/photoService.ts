export class PhotoServiceNotConfiguredError extends Error {
  constructor() {
    super("NOT_CONFIGURED: Foto-Upload benötigt einen geprüften Storage-, Mandanten- und Receipt-Vertrag.");
    this.name = "PhotoServiceNotConfiguredError";
  }
}

/**
 * Compatibility adapter only. It deliberately has no transport, conversion,
 * storage, event, or fallback path until the photo contract is proven.
 */
export const photoService = {
  async savePhotoForOrder(_orderId: string, _photoDataUrl: string): Promise<never> {
    void _orderId;
    void _photoDataUrl;
    throw new PhotoServiceNotConfiguredError();
  },
};
