import { auth } from "@/lib/auth";

export async function requireApiSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  if (!session) {
    throw new Error("Authentication required");
  }

  return session;
}
