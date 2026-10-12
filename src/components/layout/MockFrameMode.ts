"use client";

import { createContext, useContext } from "react";

export type MockFrameMode = "desktop" | "tablet";

export function frameClassForWidth(
  width: number,
  finePointer = false,
): { mode: MockFrameMode; className: string } {
  if (width >= 1300 || (width >= 1024 && finePointer)) {
    return { mode: "desktop", className: "frame desktop" };
  }
  if (width < 600) {
    return {
      mode: "tablet",
      className: "frame tablet touch phone mock-mobile",
    };
  }
  if (width < 900) {
    return { mode: "tablet", className: "frame tablet touch mock-portrait" };
  }
  return { mode: "tablet", className: "frame tablet touch" };
}

export const FrameModeContext = createContext<MockFrameMode>("desktop");
export const useMockFrameMode = () => useContext(FrameModeContext);
