import { defineConfig } from "drizzle-kit";

/** drizzle-kit config — used only to generate SQL migrations from the schema. */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
});
