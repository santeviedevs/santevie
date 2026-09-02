import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migrate needs a direct, non-pooled connection. Left undefined when
    // absent (e.g. CI running `prisma generate`, which needs no database).
    url: process.env.DIRECT_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
