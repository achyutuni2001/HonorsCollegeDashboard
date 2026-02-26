import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  return postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === "development" ? 5 : 10
  });
}

const client = global.__pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") global.__pgClient = client;

export const db = drizzle(client, { schema });
export { client as pgClient };
