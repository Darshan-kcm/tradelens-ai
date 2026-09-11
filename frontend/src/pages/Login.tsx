import { useMutation } from "@tanstack/react-query";
import { LineChart, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TradeLensLogo } from "@/components/brand/TradeLensLogo";
import { DemoDataBadge, DISCLAIMER_TEXT } from "@/components/common/Widgets";
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
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<User>("/auth/login", body),
    onSuccess: (user) => {
      beginSession();
      toast.success(`Welcome back, ${user.name}`);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 401
          ? "Invalid email or password."
          : "Could not reach the API. Make sure the backend is running.";
      toast.error(message);
    },
  });

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
              "36 demo assets across 7 markets",
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
            <DemoDataBadge />
            <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight">Sign in to your workspace</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This is a demo login for the college project — credentials are pre-filled.
            </p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <form
                className="space-y-4"
                data-testid="login-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  login.mutate({ email: email.trim().toLowerCase(), password });
                }}
              >
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
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="login-password-input"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={login.isPending}
                  data-testid="login-submit-button"
                >
                  <Lock className="size-4" />
                  {login.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <div
                className="mt-5 rounded-md border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground"
                data-testid="login-demo-hint"
              >
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-3.5" /> Demo credentials
                </div>
                <div className="mt-1.5 font-mono">{DEMO_EMAIL} / {DEMO_PASSWORD}</div>
                <div className="font-mono">student@tradelens.ai / student123</div>
              </div>
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
