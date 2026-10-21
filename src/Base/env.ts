import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "is required"),
  CLIENT_ID: z.string().min(1, "is required"),
  DATABASE_URL: z.url("must be a valid connection string"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[Env] Invalid or missing environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
