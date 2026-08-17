import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { uploadOrderPhotoRecord } from "../orderPhoto.actions";

const EXACT_DENIAL_MESSAGE_HEX = "4e4f545f415641494c41424c453a20466f746f657266617373756e672062656ec3b6746967742064656e2057332d436f6d6d616e642d566572747261672e";
const denialMessage = "NOT_AVAILABLE: Fotoerfassung benötigt den W3-Command-Vertrag.";
const actionPath = resolve(process.cwd(), "src/features/orders/orderPhoto.actions.ts");

describe("uploadOrderPhotoRecord fail-closed boundary", () => {
  it("denies adversarial browser input exactly without success", async () => {
    await expect(uploadOrderPhotoRecord({
      orderId: "order' OR '1'='1",
      fileUrl: "https://attacker.invalid/photo.jpg?redirect=internal",
      fileType: "image/jpeg; malicious=true",
    })).resolves.toEqual({ success: false, error: denialMessage });
  });

  it("locks the UTF-8 denial bytes and complete fail-closed module", () => {
    const sourceBuffer = readFileSync(actionPath);
    const source = sourceBuffer.toString("utf8").replace(/\r\n/g, "\n");
    const expectedMessageBytes = Buffer.from(EXACT_DENIAL_MESSAGE_HEX, "hex");
    const expectedModule = [
      "'use server';",
      "",
      "export async function uploadOrderPhotoRecord(params: {",
      "  orderId: string;",
      "  fileUrl: string;",
      "  fileType: string;",
      "}): Promise<{ success: boolean; error?: string }> {",
      "  void params;",
      "  return { success: false, error: \"NOT_AVAILABLE: Fotoerfassung benötigt den W3-Command-Vertrag.\" };",
      "}",
      "",
    ].join("\n");

    expect(sourceBuffer.includes(expectedMessageBytes)).toBe(true);
    expect(denialMessage).toBe(expectedMessageBytes.toString("utf8"));
    expect(source).toBe(expectedModule);
  });
});
