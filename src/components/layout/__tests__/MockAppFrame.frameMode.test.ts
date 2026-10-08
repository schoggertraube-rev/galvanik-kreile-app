import { describe, expect, it } from "vitest";
import { frameClassForWidth } from "../MockFrameMode";

describe("MockAppFrame device classification", () => {
  it.each([
    { width: 1182, finePointer: true, mode: "desktop", className: "frame desktop" },
    { width: 1182, finePointer: false, mode: "tablet", className: "frame tablet touch" },
    { width: 1023, finePointer: true, mode: "tablet", className: "frame tablet touch" },
    { width: 1220, finePointer: false, mode: "tablet", className: "frame tablet touch" },
    { width: 1914, finePointer: true, mode: "desktop", className: "frame desktop" },
    { width: 1914, finePointer: false, mode: "desktop", className: "frame desktop" },
    { width: 390, finePointer: false, mode: "tablet", className: "frame tablet touch phone mock-mobile" },
  ])("maps $widthpx with finePointer=$finePointer to $className", ({ width, finePointer, mode, className }) => {
    expect(frameClassForWidth(width, finePointer)).toEqual({ mode, className });
  });
});
