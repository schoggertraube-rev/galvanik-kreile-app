import { describe, expect, it } from "vitest";

import { PhotoServiceNotConfiguredError, photoService } from "../photoService";

describe("photo service unavailable adapter", () => {
  it("rejects instead of uploading, converting, or recording a photo", async () => {
    await expect(photoService.savePhotoForOrder("order-1", "data:image/jpeg;base64,abc"))
      .rejects.toBeInstanceOf(PhotoServiceNotConfiguredError);
  });
});
