"use client";

import { createContext, useContext } from "react";

export type MockFrameMode = "desktop" | "tablet";

export const FrameModeContext = createContext<MockFrameMode>("desktop");
export const useMockFrameMode = () => useContext(FrameModeContext);
