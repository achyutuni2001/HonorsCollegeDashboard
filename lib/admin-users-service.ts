import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformUserRoles, user } from "@/db/schema";
import { getDefaultRoleForEmail, type UserRole } from "@/lib/access-control";

export async function listPlatformUsers() {
  const [users, roleRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })
      .from(user)
      .orderBy(desc(user.updatedAt)),
    db
      .select({ email: platformUserRoles.email, role: platformUserRoles.role })
      .from(platformUserRoles)
  ]);

  const roleMap = new Map(roleRows.map((r) => [r.email.toLowerCase(), r.role]));

  return users.map((u) => {
    const normalizedEmail = u.email.trim().toLowerCase();
    const role = roleMap.get(normalizedEmail) ?? getDefaultRoleForEmail(normalizedEmail);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role,
      emailVerified: u.emailVerified,
      image: u.image,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.updatedAt.toISOString()
    };
  });
}

export async function setUserRole(email: string, role: UserRole) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Email is required");
  }

  const existingUser = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (!existingUser.length) {
    throw new Error("User not found");
  }

  await db
    .insert(platformUserRoles)
    .values({
      email: normalized,
      role,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: platformUserRoles.email,
      set: {
        role,
        updatedAt: new Date()
      }
    });

  return { email: normalized, role };
}
