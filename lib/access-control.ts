import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformUserRoles } from "@/db/schema";

export type UserRole = "admin" | "viewer";

export type RequestActor = {
  name: string;
  email: string;
  role: UserRole;
};

export function getAdminEmailSet() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getDefaultRoleForEmail(email?: string | null): UserRole {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return "viewer";
  return getAdminEmailSet().has(normalized) ? "admin" : "viewer";
}

export async function getRoleForEmail(email?: string | null): Promise<UserRole> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return "viewer";
  const rows = await db
    .select({ role: platformUserRoles.role })
    .from(platformUserRoles)
    .where(eq(platformUserRoles.email, normalized))
    .limit(1);
  if (rows.length) return rows[0].role;
  return getDefaultRoleForEmail(normalized);
}

export async function getSessionActor(session: unknown): Promise<RequestActor> {
  const user = (session as { user?: { name?: string | null; email?: string | null } } | null)?.user;
  const email = (user?.email || "").trim().toLowerCase();
  const name = user?.name?.trim() || user?.email?.trim() || "Dashboard User";
  const role = await getRoleForEmail(email);
  return { name, email, role };
}

export function assertAdmin(actor: RequestActor) {
  if (actor.role !== "admin") {
    throw new Error("Admin role required");
  }
}
