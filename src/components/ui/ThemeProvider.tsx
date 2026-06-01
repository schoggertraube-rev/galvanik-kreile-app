"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem("kreile-theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    const root = document.documentElement;
    
    if (theme === "dark") {
      root.classList.add("dark", "theme-dark");
      root.classList.remove("theme-light");
    } else {
      root.classList.add("theme-light");
      root.classList.remove("dark", "theme-dark");
    }
  }, []);

  return <>{children}</>;
}
