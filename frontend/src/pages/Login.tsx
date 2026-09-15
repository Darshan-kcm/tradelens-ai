import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, LineChart, Lock, UserRound } from "lucide-react";
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

type Mode = "signin" | "signup-email" | "signup-verify" | "forgot-email" | "forgot-verify";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = (error.body as { detail?: string } | null)?.detail;
    if (detail) return detail;
  }
  return fallback;
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  testId,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  testId: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="pr-10"
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        data-testid={`${testId}-toggle-visibility`}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  const onAuthed = (user: User, verb: string) => {
    beginSession();
    toast.success(`${verb}, ${user.name}`);
    navigate("/dashboard", { replace: true });
  };

  const resetFlowState = () => {
    setCode("");
    setPassword("");
    setConfirmPassword("");
  };

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<User>("/auth/login", body),
    onSuccess: (user) => onAuthed(user, "Welcome back"),
    onError: (error) => toast.error(errorMessage(error, "Could not reach the API. Make sure the backend is running.")),
  });

  const guestLogin = useMutation({
    mutationFn: () => apiPost<User>("/auth/guest"),
    onSuccess: (user) => onAuthed(user, "Browsing as"),
    onError: (error) => toast.error(errorMessage(error, "Could not reach the API. Make sure the backend is running.")),
  });

  const requestSignupCode = useMutation({
    mutationFn: (body: { email: string }) => apiPost("/auth/request-code", body),
    onSuccess: () => {
      toast.success("Code sent — check your inbox.");
      setMode("signup-verify");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not send a code. Try again.")),
  });

  const signup = useMutation({
    mutationFn: (body: { name: string; email: string; password: string; code: string }) =>
      apiPost<User>("/auth/signup", body),
    onSuccess: (user) => onAuthed(user, "Welcome"),
    onError: (error) => toast.error(errorMessage(error, "Could not create your account.")),
  });

  const requestResetCode = useMutation({
    mutationFn: (body: { email: string }) => apiPost("/auth/request-reset-code", body),
    onSuccess: () => {
      toast.success("If that email is registered, a code is on its way.");
      setMode("forgot-verify");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not send a code. Try again.")),
  });

  const resetPassword = useMutation({
    mutationFn: (body: { email: string; code: string; new_password: string }) =>
      apiPost("/auth/reset-password", body),
    onSuccess: () => {
      toast.success("Password reset — sign in with your new password.");
      resetFlowState();
      setMode("signin");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not reset your password.")),
  });

  const isPending =
    login.isPending ||
    guestLogin.isPending ||
    requestSignupCode.isPending ||
    signup.isPending ||
    requestResetCode.isPending ||
    resetPassword.isPending;

  const switchMode = (next: Mode) => {
    resetFlowState();
    setMode(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "signin") {
      login.mutate({ email: cleanEmail, password });
      return;
    }
    if (mode === "signup-email") {
      requestSignupCode.mutate({ email: cleanEmail });
      return;
    }
    if (mode === "signup-verify") {
      if (password.length < 6) return toast.error("Password must be at least 6 characters.");
      if (password !== confirmPassword) return toast.error("Passwords don't match.");
      signup.mutate({ name: name.trim(), email: cleanEmail, password, code });
      return;
    }
    if (mode === "forgot-email") {
      requestResetCode.mutate({ email: cleanEmail });
      return;
    }
    if (mode === "forgot-verify") {
      if (password.length < 6) return toast.error("Password must be at least 6 characters.");
      if (password !== confirmPassword) return toast.error("Passwords don't match.");
      resetPassword.mutate({ email: cleanEmail, code, new_password: password });
    }
  };

  const heading: Record<Mode, { title: string; subtitle: string }> = {
    signin: { title: "Sign in to your workspace", subtitle: "Enter your email and password to continue." },
    "signup-email": { title: "Create your account", subtitle: "We'll email you a 6-digit code to verify it's really you." },
    "signup-verify": { title: "Check your email", subtitle: `Enter the code sent to ${email || "your email"}, plus your name and a password.` },
    "forgot-email": { title: "Reset your password", subtitle: "Enter your account email and we'll send a reset code." },
    "forgot-verify": { title: "Check your email", subtitle: `Enter the code sent to ${email || "your email"} and choose a new password.` },
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
              "Real-time-ish prices across 7 markets",
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
            <h2 className="font-heading text-2xl font-bold tracking-tight">{heading[mode].title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{heading[mode].subtitle}</p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <form className="space-y-4" data-testid="login-form" onSubmit={handleSubmit}>
                {(mode === "signin" || mode === "signup-email" || mode === "forgot-email") && (
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
                )}

                {mode === "signin" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => switchMode("forgot-email")}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        data-testid="login-forgot-password-link"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      testId="login-password-input"
                    />
                  </div>
                )}

                {(mode === "signup-verify" || mode === "forgot-verify") && (
                  <div className="space-y-2">
                    <Label htmlFor="code">6-digit code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      data-testid="verification-code-input"
                      required
                    />
                  </div>
                )}

                {mode === "signup-verify" && (
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

                {(mode === "signup-verify" || mode === "forgot-verify") && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password">{mode === "forgot-verify" ? "New password" : "Password"}</Label>
                      <PasswordInput
                        id="password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="new-password"
                        testId="login-password-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <PasswordInput
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        autoComplete="new-password"
                        testId="signup-confirm-password-input"
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={isPending} data-testid="login-submit-button">
                  <Lock className="size-4" />
                  {isPending
                    ? "Please wait…"
                    : {
                        signin: "Sign in",
                        "signup-email": "Send verification code",
                        "signup-verify": "Create account",
                        "forgot-email": "Send reset code",
                        "forgot-verify": "Reset password",
                      }[mode]}
                </Button>
              </form>

              {mode === "signin" && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={isPending}
                  onClick={() => guestLogin.mutate()}
                  data-testid="guest-login-button"
                >
                  <UserRound className="size-4" />
                  Continue as guest
                </Button>
              )}

              <button
                type="button"
                onClick={() => switchMode(mode === "signin" ? "signup-email" : "signin")}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                data-testid="login-mode-toggle"
              >
                {mode === "signin" ? (
                  <>
                    Don't have an account? <span className="font-semibold text-foreground">Sign up</span>
                  </>
                ) : (
                  <>
                    Back to <span className="font-semibold text-foreground">sign in</span>
                  </>
                )}
              </button>
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