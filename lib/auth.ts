import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ||
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg"
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account"
    }
  }
});
