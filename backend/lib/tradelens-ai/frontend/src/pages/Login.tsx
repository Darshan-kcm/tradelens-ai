import { useMutation } from "@tanstack/react-query";
import { LineChart, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TradeLensLogo } from "@/components/brand/TradeLensLogo";
import { DISCLAIMER_TEXT } from "@/components/common/Widgets";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { User } from "@/lib/types";

const DEMO_EMAIL = "demo@tradelens.ai";
const DEMO_PASSWORD = "demo123";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onAuthed = (user: User, verb: string) => {
    beginSession();
    toast.success(`${verb}, ${user.name}`);
    navigate("/dashboard", { replace: true });
  };

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<User>("/auth/login", body),
    onSuccess: (user) => onAuthed(user, "Welcome back"),
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 401
          ? "Invalid email or password."
          : "Could not reach the API. Make sure the backend is running.";
      toast.error(message);
    },
  });

  const signup = useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) =>
      apiPost<User>("/auth/signup", body),
    onSuccess: (user) => onAuthed(user, "Welcome"),
    onError: (error) => {
      const message =
        error instanceof ApiError && (error.status === 409 || error.status === 422)
          ? String((error.body as { detail?: string } | null)?.detail ?? "Could not create your account.")
          : "Could not reach the API. Make sure the backend is running.";
      toast.error(message);
    },
  });

  const isPending = login.isPending || signup.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      login.mutate({ email: email.trim().toLowerCase(), password });
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    signup.mutate({ name: name.trim(), email: email.trim().toLowerCase(), password });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-[#0b192c] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <TradeLensLogo size={40} />
          <div className="font-heading text-xl font-extrabold tracking-tight">
            TradeLens<span className="text-[#38bdf8]"> AI</span>
          </div>
        </div>
        <div className="max-w-lg">
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight">
            Multi-market research, screening and strategy backtesting.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-slate-300">
            Monitor Indian, US, forex, commodity and crypto assets in one workspace. Compute technical indicators,
            screen by fundamentals and sentiment, then backtest simple rule-based strategies on historical data.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              "36 assets across 7 markets",
              "RSI, EMA 21/50/200, SMA and volume analytics",
              "Rule-based screener with a composite Research Score",
              "Long-only backtester with equity curve and trade log",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <LineChart className="size-4 shrink-0 text-[#38bdf8]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="max-w-lg text-xs leading-relaxed text-slate-500">{DISCLAIMER_TEXT}</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <TradeLensLogo size={34} />
            <span className="font-heading text-lg font-extrabold tracking-tight">TradeLens AI</span>
          </div>
          <div className="mb-6">
            <h2 className="font-heading text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Sign in to your workspace" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Enter your email and password to continue."
                : "Takes less than a minute — just a name, email and password."}
            </p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <form className="space-y-4" data-testid="login-form" onSubmit={handleSubmit}>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="signup-name-input"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="login-email-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="login-password-input"
                    required
                  />
                </div>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="signup-confirm-password-input"
                      required
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending}
                  data-testid="login-submit-button"
                >
                  <Lock className="size-4" />
                  {isPending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                data-testid="login-mode-toggle"
              >
                {mode === "signin" ? (
                  <>
                    Don't have an account? <span className="font-semibold text-foreground">Sign up</span>
                  </>
                ) : (
                  <>
                    Already have an account? <span className="font-semibold text-foreground">Sign in</span>
                  </>
                )}
              </button>

              {mode === "signin" && (
                <div
                  className="mt-5 rounded-md border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground"
                  data-testid="login-demo-hint"
                >
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <ShieldCheck className="size-3.5" /> Try it without an account
                  </div>
                  <div className="mt-1.5 font-mono">{DEMO_EMAIL} / {DEMO_PASSWORD}</div>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            Research and education only. No broker connectivity, no live order execution, no guaranteed signals.
          </p>
        </div>
      </div>
    </div>
  );
}
