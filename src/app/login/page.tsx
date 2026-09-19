"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink() {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="relative flex min-h-svh flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(45% 40% at 50% 50%, oklch(0.58 0.19 250 / 32%), transparent 70%), radial-gradient(32% 30% at 62% 42%, oklch(0.62 0.15 230 / 20%), transparent 70%)",
        }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="mb-6 flex w-full items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-heading font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            ScamShield AI
          </Link>
          <ThemeToggle />
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Welcome back to ScamShield AI</CardTitle>
            <CardDescription>Your scan history and dashboard are waiting for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <Alert>
                <AlertDescription>We&apos;ve sent a sign-in link to {email} — check your inbox.</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                    disabled={loading}
                  />
                </div>
                <Button className="w-full" onClick={sendMagicLink} disabled={loading || !email.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send magic link
                </Button>
                <div className="relative py-2 text-center text-xs text-muted-foreground">
                  <span className="bg-card px-2">or</span>
                  <div className="absolute inset-x-0 top-1/2 -z-10 border-t" />
                </div>
                <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
                  Continue with Google
                </Button>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
