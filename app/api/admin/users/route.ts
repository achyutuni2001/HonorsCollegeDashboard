import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { assertAdmin, getSessionActor } from "@/lib/access-control";
import { requireApiSession } from "@/lib/require-api-session";
import { listPlatformUsers, setUserRole } from "@/lib/admin-users-service";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const actor = await getSessionActor(session);
    assertAdmin(actor);
    const users = await listPlatformUsers();
    return NextResponse.json(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users";
    const status =
      message === "Authentication required" ? 401 : message === "Admin role required" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession(request);
    const actor = await getSessionActor(session);
    assertAdmin(actor);

    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "viewer"])
      })
      .parse(await request.json());

    const updated = await setUserRole(body.email, body.role);
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update user role";
    const status =
      message === "Authentication required"
        ? 401
        : message === "Admin role required"
          ? 403
          : message === "User not found"
            ? 404
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
