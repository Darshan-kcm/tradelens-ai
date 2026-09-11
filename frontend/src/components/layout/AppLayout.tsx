import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Beaker,
  Building2,
  Gauge,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { TradeLensWordmark } from "@/components/brand/TradeLensLogo";
import { DemoDataBadge } from "@/components/common/Widgets";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useTheme } from "@/hooks/useApp";
import { apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { MarketSessionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: Globe2 },
  { to: "/screener", label: "Screener", icon: SlidersHorizontal },
  { to: "/news", label: "News & Sentiment", icon: Newspaper },
  { to: "/fundamentals", label: "Fundamentals", icon: Building2 },
  { to: "/volume", label: "Volume Analysis", icon: Gauge },
  { to: "/backtesting", label: "Backtesting", icon: Beaker },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle colour theme"
      data-testid="theme-toggle-button"
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function SessionStrip() {
  const { data } = useQuery<MarketSessionsResponse>({
    queryKey: ["market-sessions", "strip"],
    queryFn: () => apiGet<MarketSessionsResponse>("/market-sessions"),
    refetchInterval: 60_000,
  });
  if (!data) return null;
  return (
    <div className="hidden items-center gap-4 lg:flex" data-testid="header-session-strip">
      {data.sessions.map((s) => (
        <div key={s.market} className="flex items-center gap-1.5" data-testid={`header-session-${s.market}`}>
          <span
            className={cn(
              "size-1.5 rounded-full",
              s.is_open ? "animate-ticker-pulse bg-[#16a34a]" : "bg-slate-400 dark:bg-slate-600",
            )}
          />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {s.market} {s.local_time}
          </span>
        </div>
      ))}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useCurrentUser();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <Link to="/dashboard" onClick={onNavigate} data-testid="sidebar-logo-link">
          <TradeLensWordmark />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" data-testid="sidebar-nav">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            data-testid={`nav-link-${to.slice(1)}`}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "absolute left-0 h-6 w-[3px] rounded-r-full bg-sidebar-primary transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4" data-testid="sidebar-profile">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {(user?.name ?? "TL")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white" data-testid="sidebar-user-name">
              {user?.name ?? "Guest"}
            </div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">{user?.email ?? "not signed in"}</div>
          </div>
          <button
            type="button"
            onClick={() => void endSession()}
            aria-label="Sign out"
            data-testid="sidebar-logout-button"
            className="rounded-md p-2 text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isError, isLoading } = useCurrentUser();

  if (isError) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const current = NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block" data-testid="sidebar-desktop">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="sidebar-mobile">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-slide-up shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              data-testid="sidebar-close-button"
              className="absolute right-3 top-5 z-10 rounded-md p-2 text-white/70 hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header
          className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8"
          data-testid="app-header"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              data-testid="sidebar-open-button"
            >
              <Menu className="size-5" />
            </Button>
            <span className="font-heading text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {current}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SessionStrip />
            <DemoDataBadge className="hidden sm:inline-flex" />
            <ThemeToggleButton />
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8" data-testid="app-main">
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-muted" data-testid="app-loading" />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
