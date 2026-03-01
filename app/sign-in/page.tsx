"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.16 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.07.72-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.27A12 12 0 0 0 0 12c0 1.93.46 3.75 1.27 5.38l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.82l3.45-3.45C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.27 6.62l4 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (session?.user) {
      router.replace("/dashboard");
    }
  }, [router, session]);

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setIsSigningIn(true);
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard"
      });
      const redirectUrl = (result as { data?: { url?: string } })?.data?.url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    try {
      setIsSigningIn(true);
      if (mode === "signup") {
        await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: "/dashboard"
        });
      } else {
        await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/dashboard"
        });
      }
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="dashboard-grid flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5 p-6 md:p-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s get started</h1>
            <p className="mt-1 text-muted-foreground">
              {mode === "signin"
                ? "Sign in to access Perimeter Honors College Analytics."
                : "Create your account to access the platform."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleEmailAuth}>
            {mode === "signup" ? (
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="John Doe"
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {mode === "signup" ? (
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="********"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSigningIn}>
              {isSigningIn ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground dark:bg-slate-900">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
          >
            {isSigningIn ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            Sign in with Google
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don&apos;t have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode((prev) => (prev === "signin" ? "signup" : "signin"));
                setError(null);
              }}
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </div>
        </div>

        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0f43ad] via-[#123f8f] to-[#0b2f6b] lg:block">
          <img
            src="/gsu-cover-photo.jpg"
            alt="Georgia State skyline"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f43ad]/50 via-[#0f43ad]/70 to-[#0b2f6b]/90" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-10 text-center text-white">
            <div className="mb-4 h-20 w-20 overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur">
              <img src="/gsu-logo.png" alt="GSU Logo" className="h-full w-full object-contain p-2" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">Perimeter Honors College</h2>
            <p className="mt-3 max-w-md text-sm text-blue-100">
              Your one-stop Perimeter Honors College Analytics Platform for institutional insights.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
