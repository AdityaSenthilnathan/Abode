import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "postgres://localhost:5432/abode";
// RDS requires TLS; add sslmode for remote hosts (drizzle-kit/pg reads it from the URL).
const dbUrl =
  url.includes("localhost") || url.includes("127.0.0.1") || url.includes("sslmode=")
    ? url
    : `${url}?sslmode=no-verify`;

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: dbUrl },
});
