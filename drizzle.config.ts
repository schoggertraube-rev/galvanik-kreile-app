import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Lade .env.local für lokale Drizzle Commands
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
