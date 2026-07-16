export function buchhaltungMockEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.KREILE_MOCK_BUCHHALTUNG === "true";
}

export function buchhaltungDataSource(): "mock" | "database" {
  return buchhaltungMockEnabled() ? "mock" : "database";
}
